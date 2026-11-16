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