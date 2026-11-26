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
  contactable?: boolean
  audited?: boolean
  minSeverity?: 'low' | 'medium' | 'high' | 'critical'
  sort?: 'recent' | 'issues' | 'health'
  limit: number
  offset: number
  tech?: string
  mobileIssue?: boolean
}

export type BusinessAuditSummary = {
  outcome: string | null
  issueWeight: number
  issueCount: number
  signals: string[]
  health: number | null
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
  contactable: boolean
  audit: BusinessAuditSummary | null
  platform: string | null
  scores: { contactability: number; completeness: number }
  mobile: { signals: string[]; health: number | null } | null
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

export type FindingSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical'

export type FindingDto = {
  id: string
  code: string
  category: string
  severity: FindingSeverity
  isObjective: boolean
  title: string
  detail: string | null
  affectedUrl: string | null
  confidence: number
  evidence: {
    kind: string
    method: string
    sourceUrl: string | null
    excerpt: string | null
    capturedAt: string
  }
}

export type AuditSummary = {
  outcome?: string
  error?: string | null
  mainPage?: string
  pagesAudited?: number
  findings?: number
  bySeverity?: Record<string, number>
  truncatedPages?: number
  durationMs?: number
  scores?: AuditScores
  placeholder?: { kind: string; detail: string }
}

export type AuditDto = {
  investigation: {
    id: string
    status: string
    createdAt: string
    finishedAt: string | null
    summary: AuditSummary | null
  }
  findings: FindingDto[]
  technologies: TechnologyDto[]
}

export type TechnologyDto = {
  id: string
  slug: string
  name: string
  category: string
  version: string | null
  versions: string[]
  detail: string | null
  confidence: number
  via: string
  excerpt: string | null
  sourceUrl: string | null
}

export type AuditScores = {
  method: string
  health: number
  band: 'good' | 'fair' | 'weak' | 'poor'
  categories: Record<string, { score: number; points: number; findings: number; weighted: number }>
  points: { code: string; category: string; points: number }[]
}

export type MobileSummary = {
  outcome?: string
  error?: string | null
  url?: string
  finalUrl?: string
  device?: string
  screenshot?: string | null
  durationMs?: number
  partial?: boolean
  pageText?: string
  measurements?: {
    status: number | null
    loaded: boolean
    lcpMs: number | null
    cls: number | null
    loadMs: number | null
    domContentLoadedMs: number | null
    requests: number
    transferBytes: number
    layoutWidth: number
    overflowPx: number
    scrollable: boolean
    contentLoaded?: boolean
  }
  calibration?: { lcpMs: number | null; loadMs: number | null } | null
  scores?: AuditScores
  bySeverity?: Record<string, number>
}

export type MobileAuditDto = {
  investigation: {
    id: string
    status: string
    createdAt: string
    finishedAt: string | null
    summary: MobileSummary | null
  }
  findings: FindingDto[]
}

export type TechOptionDto = { slug: string; name: string; category: string; sites: number }

export type BrandMode = 'auto' | 'own' | 'cobrand' | 'meridian'

export type ReportSettingsDto = {
  workspaceId: string
  orgName: string
  contactLine: string
  logoPath: string | null
  brandMode: BrandMode
  showMeridianCredit: boolean
  updatedAt: string
}

export const PLACEHOLDER_ORG = 'Your Company Name'

/** Which header a report gets. 'auto' shows Meridian until the user sets a real name or logo. */
export function resolveHeader(s: {
  orgName: string
  logoPath: string | null
  brandMode: BrandMode
}): 'meridian' | 'own' | 'cobrand' {
  if (s.brandMode !== 'auto') return s.brandMode
  const name = s.orgName.trim()
  const customised = s.logoPath !== null || (name !== '' && name !== PLACEHOLDER_ORG)
  return customised ? 'own' : 'meridian'
}

export type ReportPriority = 'now' | 'soon' | 'worth_doing'

export type ReportCatalogueEntry = {
  observed: string
  whyItMatters: string
  recommendation: string
  priority: ReportPriority
}

export type ReportFindingDto = FindingDto & {
  evidence: FindingDto['evidence'] & { storagePath?: string | null }
  catalogue: ReportCatalogueEntry | null
}

export type InternalReportDto = {
  business: Record<string, unknown>
  website: Record<string, unknown> | null
  audit: { id: string; createdAt: string; finishedAt: string | null; summary: AuditSummary | null } | null
  mobile: { id: string; createdAt: string; finishedAt: string | null; summary: MobileSummary | null } | null
  findings: ReportFindingDto[]
  mobileFindings: ReportFindingDto[]
  technologies: { id: string; slug: string; name: string; category: string; version: string | null; confidence: number }[]
  leadScores: { contactability: number; completeness: number }
  reportSettings: ReportSettingsDto | null
  generatedAt: string
}