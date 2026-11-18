import { createContactScan, failScan } from '@meridian/contacts'
import {
  and, asc, businesses, desc, eq, inArray, investigations, sql, websites, type Db,
} from '@meridian/db'
import type { Boss } from '@meridian/queue'
import {
  QUEUES, bulkContactScanRequest, investigationListQuery, uuidParam, contactScanRequest,
} from '@meridian/shared'
import type { FastifyPluginAsync } from 'fastify'

export const investigationRoutes =
  (db: Db, boss: Boss): FastifyPluginAsync =>
  async (app) => {
    app.post('/api/v1/businesses/:id/contact-scan', async (req, reply) => {
      const p = uuidParam.safeParse(req.params)
      if (!p.success) return reply.code(400).send({ error: 'Invalid id' })
      const body = contactScanRequest.safeParse(req.body ?? {})
      const thenAudit = body.success ? body.data.thenAudit : false

      const [site] = await db
        .select()
        .from(websites)
        .where(eq(websites.businessId, p.data.id))
        .orderBy(desc(websites.isPrimary), asc(websites.createdAt))
        .limit(1)
      if (!site) return reply.code(409).send({ error: 'This business has no website to scan' })

      const [active] = await db
        .select({ id: investigations.id })
        .from(investigations)
        .where(
          and(
            eq(investigations.websiteId, site.id),
            eq(investigations.kind, 'contact_scan'),
            inArray(investigations.status, ['queued', 'running']),
          ),
        )
        .limit(1)
      if (active) {
        return reply.code(409).send({ error: 'A scan is already queued or running', investigationId: active.id })
      }

      const investigationId = await createContactScan(db, {
        workspaceId: site.workspaceId, businessId: site.businessId, websiteId: site.id,
      })
      const jobId = await boss.send(QUEUES.contactScan, { investigationId, thenAudit })
      if (!jobId) {
        await failScan(db, investigationId, 'The queue did not create a job')
        return reply.code(500).send({ error: 'Job was not created', investigationId })
      }
      return reply.code(202).send({ data: { investigationId, jobId } })
    })

    app.post('/api/v1/contact-scans', async (req, reply) => {
      const parsed = bulkContactScanRequest.safeParse(req.body ?? {})
      if (!parsed.success) return reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues })
      const f = parsed.data

      const rows = await db
        .select({ websiteId: websites.id, businessId: websites.businessId, workspaceId: websites.workspaceId })
        .from(websites)
        .innerJoin(businesses, eq(businesses.id, websites.businessId))
        .where(
          and(
            eq(websites.isPrimary, true),
            f.industry ? eq(businesses.industry, f.industry) : undefined,
            f.city ? sql`lower(${businesses.city}) = lower(${f.city})` : undefined,
            sql`not exists (
              select 1 from investigations i
              where i.website_id = ${websites.id} and i.kind = 'contact_scan'
                and (i.status in ('queued', 'running')
                     or (i.status = 'completed' and i.created_at > now() - (${f.rescanAfterDays}::int * interval '1 day'))))`,
          ),
        )
        .orderBy(businesses.name)
        .limit(f.limit)

      const ids: string[] = []
      for (const r of rows) {
        const investigationId = await createContactScan(db, r)
        const jobId = await boss.send(QUEUES.contactScan, { investigationId, thenAudit: f.thenAudit })
        if (!jobId) {
          await failScan(db, investigationId, 'The queue did not create a job')
          continue
        }
        ids.push(investigationId)
      }
      return reply.code(202).send({ data: { queued: ids.length, investigationIds: ids } })
    })

    app.get('/api/v1/investigations', async (req, reply) => {
      const q = investigationListQuery.safeParse(req.query)
      if (!q.success) return reply.code(400).send({ error: 'Invalid query', issues: q.error.issues })
      const f = q.data
      const where = and(
        f.kind ? eq(investigations.kind, f.kind) : undefined,
        f.status ? eq(investigations.status, f.status) : undefined,
        f.businessId ? eq(investigations.businessId, f.businessId) : undefined,
      )
      const rows = await db
        .select()
        .from(investigations)
        .where(where)
        .orderBy(desc(investigations.createdAt))
        .limit(f.limit)
        .offset(f.offset)
      const [t] = await db.select({ total: sql<number>`count(*)::int` }).from(investigations).where(where)
      return { data: rows, page: { limit: f.limit, offset: f.offset, total: t?.total ?? 0 } }
    })

    app.get('/api/v1/investigations/:id', async (req, reply) => {
      const p = uuidParam.safeParse(req.params)
      if (!p.success) return reply.code(400).send({ error: 'Invalid id' })
      const [row] = await db.select().from(investigations).where(eq(investigations.id, p.data.id)).limit(1)
      if (!row) return reply.code(404).send({ error: 'Investigation not found' })
      return { data: row }
    })
  }