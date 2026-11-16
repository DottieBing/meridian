import { MinGap, fetchJson, withCache } from './http'
import { DiscoveryError, type Log } from './types'

const gate = new MinGap(1100) // policy: max 1 request/second
const DAY = 86_400_000

type NominatimHit = { osm_type: string; osm_id: number; display_name: string }

export type ResolvedArea = { overpassAreaId: number; displayName: string }

export async function resolveCity(
  city: string,
  countryCode: string | undefined,
  useCache: boolean,
  log: Log,
): Promise<ResolvedArea> {
  const base = process.env.NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org'
  const params = new URLSearchParams({ q: city, format: 'jsonv2', limit: '1' })
  if (countryCode) params.set('countrycodes', countryCode.toLowerCase())
  const url = `${base}/search?${params}`

  const { value: hits } = await withCache(`nominatim:${url}`, 30 * DAY, useCache, async () => {
    await gate.wait()
    return fetchJson<NominatimHit[]>(url, {}, { timeoutMs: 20_000, attempts: 3, label: 'Nominatim', log })
  })

  const hit = hits[0]
  if (!hit) throw new DiscoveryError('area_not_found', `Nominatim found nothing for "${city}"`)
  // Overpass area ids are offsets of OSM ids: relation +3600000000, way +2400000000
  if (hit.osm_type === 'relation') {
    return { overpassAreaId: 3_600_000_000 + hit.osm_id, displayName: hit.display_name }
  }
  if (hit.osm_type === 'way') {
    return { overpassAreaId: 2_400_000_000 + hit.osm_id, displayName: hit.display_name }
  }
  throw new DiscoveryError(
    'area_not_found',
    `"${city}" resolved to a ${hit.osm_type}, which has no boundary area (${hit.display_name})`,
  )
}