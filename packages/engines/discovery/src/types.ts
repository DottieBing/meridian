export type Log = (message: string) => void

export type ErrorKind =
  | 'timeout'
  | 'network'
  | 'rate_limited'
  | 'http'
  | 'parse'
  | 'query_error'
  | 'area_not_found'
  | 'bad_input'

export class DiscoveryError extends Error {
  readonly kind: ErrorKind
  readonly retryable: boolean
  readonly retryAfterMs?: number

  constructor(
    kind: ErrorKind,
    message: string,
    opts: { retryable?: boolean; retryAfterMs?: number } = {},
  ) {
    super(message)
    this.name = 'DiscoveryError'
    this.kind = kind
    this.retryable = opts.retryable ?? false
    if (opts.retryAfterMs !== undefined) this.retryAfterMs = opts.retryAfterMs
  }
}

export type OsmElement = {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

export type OverpassResponse = {
  elements?: OsmElement[]
  remark?: string
  osm3s?: { timestamp_osm_base?: string }
}

export type DiscoveredBusiness = {
  provider: 'osm'
  externalId: string
  sourceUrl: string
  name: string
  website?: { url: string; domain: string; isSocial: boolean; isAggregator: boolean }
  emails: string[]
  phones: string[]
  address: { street?: string; city?: string; postcode?: string; country?: string }
  lat?: number
  lon?: number
  tags: Record<string, string>
}