import type { HealthResponse, WorkspaceDto } from '@meridian/shared/api-types'

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/health')
  if (!res.ok && res.status !== 503) throw new Error(`Health check failed: HTTP ${res.status}`)
  return (await res.json()) as HealthResponse
}

export async function fetchWorkspaces(): Promise<WorkspaceDto[]> {
  const res = await fetch('/api/v1/workspaces')
  if (!res.ok) throw new Error(`Workspaces request failed: HTTP ${res.status}`)
  const body = (await res.json()) as { data: WorkspaceDto[] }
  return body.data
}