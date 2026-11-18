import type {
  BusinessDetail,
  BusinessFilters,
  BusinessListItem,
  HealthResponse,
  InvestigationDto,
  Paged,
  PresetDto,
  WorkspaceDto,
} from '@meridian/shared/api-types'

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`Request failed: HTTP ${res.status}`)
  return (await res.json()) as T
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/health')
  if (!res.ok && res.status !== 503) throw new Error(`Health check failed: HTTP ${res.status}`)
  return (await res.json()) as HealthResponse
}

export async function fetchWorkspaces(): Promise<WorkspaceDto[]> {
  return (await getJson<{ data: WorkspaceDto[] }>('/api/v1/workspaces')).data
}

export function fetchBusinesses(f: BusinessFilters): Promise<Paged<BusinessListItem>> {
  const p = new URLSearchParams()
  if (f.q) p.set('q', f.q)
  if (f.industry) p.set('industry', f.industry)
  if (f.hasWebsite !== undefined) p.set('hasWebsite', String(f.hasWebsite))
  if (f.hasEmail !== undefined) p.set('hasEmail', String(f.hasEmail))
  if (f.hasPhone !== undefined) p.set('hasPhone', String(f.hasPhone))
  p.set('limit', String(f.limit))
  p.set('offset', String(f.offset))
  return getJson<Paged<BusinessListItem>>(`/api/v1/businesses?${p.toString()}`)
}

export async function fetchBusiness(id: string): Promise<BusinessDetail> {
  return (await getJson<{ data: BusinessDetail }>(`/api/v1/businesses/${id}`)).data
}

export async function fetchPresets(): Promise<PresetDto[]> {
  return (await getJson<{ data: PresetDto[] }>('/api/v1/discovery/presets')).data
}

export async function fetchScans(businessId: string): Promise<InvestigationDto[]> {
  const p = new URLSearchParams({ businessId, kind: 'contact_scan', limit: '10' })
  return (await getJson<{ data: InvestigationDto[] }>(`/api/v1/investigations?${p.toString()}`)).data
}

export async function startContactScan(businessId: string): Promise<{ investigationId: string }> {
  const res = await getJson<{ data: { investigationId: string } }>(
    `/api/v1/businesses/${businessId}/contact-scan`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
  )
  return res.data
}