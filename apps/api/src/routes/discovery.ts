import { workspaces, type Db } from '@meridian/db'
import { PRESETS, isPresetId } from '@meridian/discovery'
import type { Boss } from '@meridian/queue'
import { QUEUES, discoverySearchRequest } from '@meridian/shared'
import type { FastifyPluginAsync } from 'fastify'

export const discoveryRoutes =
  (db: Db, boss: Boss): FastifyPluginAsync =>
  async (app) => {
    app.get('/api/v1/discovery/presets', async () => ({
      data: Object.entries(PRESETS).map(([id, p]) => ({
        id, label: p.label, industry: p.industry, niche: p.niche,
      })),
    }))

    app.post('/api/v1/discovery/searches', async (req, reply) => {
      const parsed = discoverySearchRequest.safeParse(req.body ?? {})
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues })
      }
      if (!isPresetId(parsed.data.preset)) {
        return reply.code(400).send({
          error: `Unknown preset "${parsed.data.preset}"`,
          presets: Object.keys(PRESETS),
        })
      }
      let workspaceId = parsed.data.workspaceId
      if (!workspaceId) {
        const [ws] = await db.select({ id: workspaces.id }).from(workspaces).limit(1)
        if (!ws) return reply.code(409).send({ error: 'No workspace exists. Run pnpm db:seed.' })
        workspaceId = ws.id
      }
      const id = await boss.send(QUEUES.discoverySearch, { ...parsed.data, workspaceId })
      if (!id) return reply.code(500).send({ error: 'Job was not created' })
      return reply.code(202).send({ data: { id } })
    })

    app.get<{ Params: { id: string } }>('/api/v1/discovery/searches/:id', async (req, reply) => {
      const job = await boss.getJobById(QUEUES.discoverySearch, req.params.id)
      if (!job) return reply.code(404).send({ error: 'Job not found' })
      return {
        data: {
          id: job.id,
          state: job.state,
          retryCount: job.retryCount,
          createdOn: job.createdOn,
          startedOn: job.startedOn,
          completedOn: job.completedOn,
          output: job.output,
        },
      }
    })
  }