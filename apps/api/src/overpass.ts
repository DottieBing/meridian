import { fetchJson, withCache } from './http'
import { normalizeElement } from './normalize'
import { resolveCity } from './nominatim'
import { PRESETS, type PresetId } from './presets'
import { DiscoveryError, type DiscoveredBusiness, type Log, type OverpassResponse } from './types'

const SERVER_TIMEOUT_S = 90
const CLIENT_TIMEOUT_MS = 120_000
const OVERPASS_TTL_MS = 24 * 3_600_000

export type OverpassSearch = {
  preset: PresetId
  countryCode?: string
  city?: string
  useCache?: boolean
}

export type OverpassResult = {
  businesses: DiscoveredBusiness[]
  stats: {
    areaLabel: string
    rawElements: number
    unnamed: number
    durationMs: number
    cached: boolean
    osmDataTimestamp?: string
  }
}

function buildQuery(areaClause: string, filters: readonly string[]): string {
  const body = filters.map((f) => `  nwr${f}(area.a);`).join('\n')
  return (
    `[out:json][timeout:${SERVER_TIMEOUT_S}][maxsize:268435456];\n` +
    `${areaClause}\n(\n${body}\n);\nout center qt;`
  )
}

export async function searchOverpass(search: OverpassSearch, log: Log): Promise<OverpassResult> {
  const started = Date.now()
  const useCache = search.useCache ?? true
  const cc = search.countryCode?.toUpperCase()
  if (cc && !/^[A-Z]{2}$/.test(cc)) {
    throw new DiscoveryError('bad_input', `Country code must be 2 letters, got "${cc}"`)
  }

  let areaClause: string
  let areaLabel: string
  if (search.city) {
    const area = await resolveCity(search.city, cc, useCache, log)
    areaClause = `area(${area.overpassAreaId})->.a;`
    areaLabel = area.displayName
  } else if (cc) {
    areaClause = `area["ISO3166-1"="${cc}"][admin_level=2]->.a;`
    areaLabel = `country ${cc}`
  } else {
    throw new DiscoveryError('bad_input', 'Provide a country code, a city, or both')
  }

  const query = buildQuery(areaClause, PRESETS[search.preset].filters)
  const url = process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter'

  log(`Overpass: ${PRESETS[search.preset].label} in ${areaLabel}`)
  const { value, cached } = await withCache(`overpass:${url}:${query}`, OVERPASS_TTL_MS, useCache, async () => {
    const res = await fetchJson<OverpassResponse>(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      },
      { timeoutMs: CLIENT_TIMEOUT_MS, attempts: 3, label: 'Overpass', log },
    )
    // Overpass reports some failures inside a 200 response
    if (res.remark && /error|timed out|out of memory/i.test(res.remark)) {
      throw new DiscoveryError('query_error', `Overpass: ${res.remark}`)
    }
    return res
  })

  const elements = value.elements ?? []
  const businesses: DiscoveredBusiness[] = []
  let unnamed = 0
  for (const el of elements) {
    const b = normalizeElement(el)
    if (b) businesses.push(b)
    else unnamed++
  }

  return {
    businesses,
    stats: {
      areaLabel,
      rawElements: elements.length,
      unnamed,
      durationMs: Date.now() - started,
      cached,
      ...(value.osm3s?.timestamp_osm_base ? { osmDataTimestamp: value.osm3s.timestamp_osm_base } : {}),
    },
  }
}