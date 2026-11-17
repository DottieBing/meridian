import { MinGap, fetchJson, withCache } from './http'
import { DiscoveryError, type Log } from './types'

const gate = new MinGap(1100) // policy: max 1 request/second
const DAY = 86_400_000

type NominatimHit = {
  osm_type: string
  osm_id: number
  display_name: string
  category?: string
  type?: string
}

export type ResolvedArea = { overpassAreaId: number; displayName: string }

/** Picks the best hit that has a boundary: a boundary relation, else any relation, else a way. */
function pickArea(hits: NominatimHit[]): NominatimHit | undefined {
  return (
    hits.find((h) => h.osm_type === 'relation' && h.category === 'boundary') ??
    hits.find((h) => h.osm_type === 'relation') ??
    hits.find((h) => h.osm_type === 'way')
  )
}

export async function resolveCity(
  city: string,
  countryCode: string | undefined,
  useCache: boolean,
  log: Log,
): Promise<ResolvedArea> {
  const base = process.env.NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org'
  const params = new URLSearchParams({ q: city, format: 'jsonv2', limit: '10' })
  if (countryCode) params.set('countrycodes', countryCode.toLowerCase())
  const url = `${base}/search?${params}`

  const { value: hits } = await withCache(`nominatim:${url}`, 30 * DAY, useCache, async () => {
    await gate.wait()
    return fetchJson<NominatimHit[]>(url, {}, { timeoutMs: 20_000, attempts: 3, label: 'Nominatim', log })
  })

  if (hits.length === 0) {
    throw new DiscoveryError('area_not_found', `Nominatim found nothing for "${city}"`)
  }
  const hit = pickArea(hits)
  if (!hit) {
    throw new DiscoveryError(
      'area_not_found',
      `"${city}" only matched points, not areas (first match: ${hits[0]?.display_name})`,
    )
  }
  // Overpass area ids are offsets of OSM ids: relation +3600000000, way +2400000000
  const overpassAreaId = (hit.osm_type === 'relation' ? 3_600_000_000 : 2_400_000_000) + hit.osm_id
  log(`Nominatim: "${city}" -> ${hit.osm_type}/${hit.osm_id} (${hit.display_name})`)
  return { overpassAreaId, displayName: hit.display_name }
}