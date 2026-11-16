import { APP_VERSION, type HealthResponse } from '@meridian/shared'
import type { FastifyPluginAsync } from 'fastify'

export const healthRoutes =
  (checkDb: () => Promise<void>): FastifyPluginAsync =>
  async (app) => {
    app.get('/health', async (_req, reply) => {
      const started = performance.now()
      let dbOk = true
      try {
        await checkDb()
      } catch (err) {
        dbOk = false
        app.log.error({ err }, 'database health check failed')
      }
      const body: HealthResponse = {
        status: dbOk ? 'ok' : 'degraded',
        service: 'meridian-api',
        version: APP_VERSION,
        uptimeSeconds: Math.round(process.uptime()),
        time: new Date().toISOString(),
        checks: {
          database: { ok: dbOk, latencyMs: Math.round(performance.now() - started) },
        },
      }
      return reply.code(dbOk ? 200 : 503).send(body)
    })
  }