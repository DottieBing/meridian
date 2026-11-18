export type HealthResponse = {
  status: 'ok' | 'degraded'
  service: 'meridian-api'
  version: string
  uptimeSeconds: number
  time: string
  checks: {
    database: { ok: boolean; latencyMs: number }
  }
}

export type WorkspaceDto = {
  id: string
  name: string
  createdAt: string
}

export type Paged<T> = {
  data: T[]
  page: { limit: number; offset: number; total: number }
}

export type PresetDto = { id: string; label: string; industry: string; niche: string }

export type BusinessFilters = {
  q?: string
  industry?: string
  hasWebsite?: boolean
  hasEmail?: boolean
  hasPhone?: boolean
  limit: number
  offset: number
}

export type BusinessListItem = {
  id: string
  name: string
  industry: string | null
  niche: string | null
  city: string | null
  countryCode: string | null
  status: string
  firstSeenAt: string
  lastSeenAt: string
  website: string | null
  emailCount: number
  phoneCount: number
  locationCount: number
}

export type ContactType = 'email' | 'phone' | 'social' | 'contact_form' | 'address'

export type ContactDto = {
  id: string
  type: ContactType
  value: string
  classification: 'business' | 'personal' | 'unknown'
  role: string | null
  confidence: number
  validation: {
    syntaxValid?: boolean
    domainResolves?: boolean
    hasMx?: boolean | null
    checkedAt?: string
  } | null
  staleAt: string | null
  firstSeenAt: string
  lastSeenAt: string
  evidence: {
    kind: string
    method: string
    sourceUrl: string | null
    capturedAt: string
  }
}

export type LocationDto = {
  id: string
  label: string | null
  addressLine: string | null
  city: string | null
  region: string | null
  postalCode: string | null
  countryCode: string | null
  latitude: number | null
  longitude: number | null
  isPrimary: boolean
}

export type WebsiteDto = {
  id: string
  url: string
  domain: string
  isPrimary: boolean
  status: string
  lastCheckedAt: string | null
  staleAt: string | null
}

export type SourceDto = {
  provider: string
  externalId: string
  url: string | null
  fetchedAt: string
}

export type BusinessDetail = {
  id: string
  name: string
  industry: string | null
  niche: string | null
  city: string | null
  region: string | null
  countryCode: string | null
  status: string
  firstSeenAt: string
  lastSeenAt: string
  locations: LocationDto[]
  websites: WebsiteDto[]
  contacts: ContactDto[]
  sources: SourceDto[]
}

export type ScanSummary = {
  outcome?: string
  error?: string | null
  durationMs?: number
  found?: Record<string, number>
  newContacts?: number
  updatedContacts?: number
  pages?: unknown[]
  skipped?: unknown[]
  siteUrl?: string
}

export type InvestigationDto = {
  id: string
  businessId: string
  kind: string
  status: string
  summary: ScanSummary | null
  error: string | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
}