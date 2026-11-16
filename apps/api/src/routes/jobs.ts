import type { Boss } from '@meridian/queue'
import { QUEUES, pingPayload } from '@meridian/shared'
import type { FastifyPluginAsync } from 'fastify'

export const jobRoutes =
  (boss: Boss): FastifyPluginAsync =>
  async (app) => {
    app.post('/api/v1/system/ping', async (req, reply) => {
      const parsed = pingPayload.safeParse(req.body ?? {})
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues })
      }
      const id = await boss.send(QUEUES.systemPing, parsed.data)
      if (!id) return reply.code(500).send({ error: 'Job was not created' })
      return reply.code(202).send({ data: { id } })
    })

    app.get<{ Params: { id: string } }>('/api/v1/system/ping/:id', async (req, reply) => {
      const job = await boss.getJobById(QUEUES.systemPing, req.params.id)
      if (!job) return reply.code(404).send({ error: 'Job not found' })
      return {
        data: {
          id: job.id,
          state: job.state,
          retryCount: job.retryCount,
          createdOn: job.createdOn,
          startedOn: job.startedOn,
          completedOn: job.completedOn,
        },
      }
    })
  }