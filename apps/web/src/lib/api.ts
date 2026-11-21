import type {
  AuditDto,
  BusinessDetail,
  BusinessFilters,
  BusinessListItem,
  HealthResponse,
  InvestigationDto,
  Paged,
  PresetDto,
  WorkspaceDto,
  TechOptionDto,
  MobileAuditDto,
} from '@meridian/shared/api-types'

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`Request failed: HTTP ${res.status}`)
  return (await res.json()) as T
}

const postJson = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/health')
  if (!res.ok && res.status !== 503) throw new Error(`Health check failed: HTTP ${res.status}`)
  return (await res.json()) as HealthResponse
}

export async function fetchWorkspaces(): Promise<WorkspaceDto[]> {
  return (await getJson<{ data: WorkspaceDto[] }>('/api/v1/workspaces')).data
}

function businessQuery(f: BusinessFilters, paging: boolean): URLSearchParams {
  const p = new URLSearchParams()
  if (f.q) p.set('q', f.q)
  if (f.industry) p.set('industry', f.industry)
  if (f.hasWebsite !== undefined) p.set('hasWebsite', String(f.hasWebsite))
  if (f.hasEmail !== undefined) p.set('hasEmail', String(f.hasEmail))
  if (f.hasPhone !== undefined) p.set('hasPhone', String(f.hasPhone))
  if (f.contactable !== undefined) p.set('contactable', String(f.contactable))
  if (f.audited !== undefined) p.set('audited', String(f.audited))
  if (f.minSeverity) p.set('minSeverity', f.minSeverity)
  if (f.sort) p.set('sort', f.sort)
  if (f.tech) p.set('tech', f.tech)
  if (f.mobileIssue !== undefined) p.set('mobileIssue', String(f.mobileIssue))
  if (paging) {
    p.set('limit', String(f.limit))
    p.set('offset', String(f.offset))
  }
  return p
}

export function fetchBusinesses(f: BusinessFilters): Promise<Paged<BusinessListItem>> {
  return getJson<Paged<BusinessListItem>>(`/api/v1/businesses?${businessQuery(f, true).toString()}`)
}

export const businessExportUrl = (f: BusinessFilters): string =>
  `/api/v1/businesses/export.csv?${businessQuery(f, false).toString()}`

export async function startBulkAnalyse(industry?: string): Promise<{ queued: number }> {
  const res = await getJson<{ data: { queued: number } }>('/api/v1/contact-scans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit: 25, thenAudit: true, ...(industry ? { industry } : {}) }),
  })
  return res.data
}

export async function fetchBusiness(id: string): Promise<BusinessDetail> {
  return (await getJson<{ data: BusinessDetail }>(`/api/v1/businesses/${id}`)).data
}

export async function fetchPresets(): Promise<PresetDto[]> {
  return (await getJson<{ data: PresetDto[] }>('/api/v1/discovery/presets')).data
}

async function fetchRuns(businessId: string, kind: string, limit: number): Promise<InvestigationDto[]> {
  const p = new URLSearchParams({ businessId, kind, limit: String(limit) })
  return (await getJson<{ data: InvestigationDto[] }>(`/api/v1/investigations?${p.toString()}`)).data
}

export const fetchScans = (businessId: string) => fetchRuns(businessId, 'contact_scan', 10)
export const fetchAuditRuns = (businessId: string) => fetchRuns(businessId, 'website_audit', 5)

export async function startContactScan(businessId: string, thenAudit = true): Promise<{ investigationId: string }> {
  return (
    await getJson<{ data: { investigationId: string } }>(`/api/v1/businesses/${businessId}/contact-scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thenAudit }),
    })
  ).data
}

export async function startWebsiteAudit(businessId: string): Promise<{ investigationId: string }> {
  return (
    await getJson<{ data: { investigationId: string } }>(`/api/v1/businesses/${businessId}/website-audit`, postJson)
  ).data
}

export async function fetchAudit(businessId: string): Promise<AuditDto | null> {
  return (await getJson<{ data: AuditDto | null }>(`/api/v1/businesses/${businessId}/audit`)).data
}

export async function fetchTechOptions(): Promise<TechOptionDto[]> {
  return (await getJson<{ data: TechOptionDto[] }>('/api/v1/technologies')).data
}

export const fetchMobileRuns = (businessId: string) => fetchRuns(businessId, 'browser_audit', 5)

export async function startMobileAudit(businessId: string): Promise<{ investigationId: string }> {
  return (
    await getJson<{ data: { investigationId: string } }>(`/api/v1/businesses/${businessId}/browser-audit`, postJson)
  ).data
}

export async function fetchMobileAudit(businessId: string): Promise<MobileAuditDto | null> {
  return (await getJson<{ data: MobileAuditDto | null }>(`/api/v1/businesses/${businessId}/browser-audit`)).data
}