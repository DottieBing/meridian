import {
  and,
  asc,
  businesses,
  desc,
  eq,
  evidence,
  findings,
  inArray,
  investigations,
  sql,
  websites,
  type Db,
  websiteTechnologies
} from '@meridian/db'
import type { Boss } from '@meridian/queue'
import { QUEUES, bulkWebsiteAuditRequest, uuidParam } from '@meridian/shared'
import { createWebsiteAudit, failAudit } from '@meridian/website'
import type { FastifyPluginAsync } from 'fastify'

const RANK: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 }

export const auditRoutes =

  (db: Db, boss: Boss): FastifyPluginAsync =>

  async (app) => {
    
    app.post('/api/v1/businesses/:id/website-audit', async (req, reply) => {
      const p = uuidParam.safeParse(req.params)
      if (!p.success) return reply.code(400).send({ error: 'Invalid id' })

      const [site] = await db
        .select()
        .from(websites)
        .where(eq(websites.businessId, p.data.id))
        .orderBy(desc(websites.isPrimary), asc(websites.createdAt))
        .limit(1)
      if (!site) return reply.code(409).send({ error: 'This business has no website to audit' })

      const [active] = await db
        .select({ id: investigations.id })
        .from(investigations)
        .where(
          and(
            eq(investigations.websiteId, site.id),
            eq(investigations.kind, 'website_audit'),
            inArray(investigations.status, ['queued', 'running']),
          ),
        )
        .limit(1)
      if (active) {
        return reply.code(409).send({ error: 'An audit is already queued or running', investigationId: active.id })
      }

      const investigationId = await createWebsiteAudit(db, {
        workspaceId: site.workspaceId,
        businessId: site.businessId,
        websiteId: site.id,
      })
      const jobId = await boss.send(QUEUES.websiteAudit, { investigationId })
      if (!jobId) {
        await failAudit(db, investigationId, 'The queue did not create a job')
        return reply.code(500).send({ error: 'Job was not created', investigationId })
      }
      return reply.code(202).send({ data: { investigationId, jobId } })
    })

    app.post('/api/v1/website-audits', async (req, reply) => {
      const parsed = bulkWebsiteAuditRequest.safeParse(req.body ?? {})
      if (!parsed.success) return reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues })
      const f = parsed.data

      const rows = await db
        .select({ websiteId: websites.id, businessId: websites.businessId, workspaceId: websites.workspaceId })
        .from(websites)
        .innerJoin(businesses, eq(businesses.id, websites.businessId))
        .where(
          and(
            eq(websites.isPrimary, true),
            sql`${websites.status} <> 'dead'`,
            f.industry ? eq(businesses.industry, f.industry) : undefined,
            f.city ? sql`lower(${businesses.city}) = lower(${f.city})` : undefined,
            sql`not exists (
              select 1 from investigations i
              where i.website_id = ${websites.id} and i.kind = 'website_audit'
                and (i.status in ('queued', 'running')
                     or (i.status = 'completed' and i.created_at > now() - (${f.auditAfterDays}::int * interval '1 day'))))`,
          ),
        )
        .orderBy(businesses.name)
        .limit(f.limit)

      const ids: string[] = []
      for (const r of rows) {
        const investigationId = await createWebsiteAudit(db, r)
        const jobId = await boss.send(QUEUES.websiteAudit, { investigationId })
        if (!jobId) {
          await failAudit(db, investigationId, 'The queue did not create a job')
          continue
        }
        ids.push(investigationId)
      }
      return reply.code(202).send({ data: { queued: ids.length, investigationIds: ids } })
    })

    app.get('/api/v1/businesses/:id/audit', async (req, reply) => {
      const p = uuidParam.safeParse(req.params)
      if (!p.success) return reply.code(400).send({ error: 'Invalid id' })

      const [inv] = await db
        .select()
        .from(investigations)
        .where(
          and(
            eq(investigations.businessId, p.data.id),
            eq(investigations.kind, 'website_audit'),
            eq(investigations.status, 'completed'),
          ),
        )
        .orderBy(desc(investigations.createdAt))
        .limit(1)
      if (!inv) return { data: null }

      const rows = await db
        .select({
          id: findings.id,
          code: findings.code,
          category: findings.category,
          severity: findings.severity,
          isObjective: findings.isObjective,
          title: findings.title,
          detail: findings.detail,
          affectedUrl: findings.affectedUrl,
          confidence: findings.confidence,
          evidenceKind: evidence.kind,
          evidenceMethod: evidence.method,
          evidenceSourceUrl: evidence.sourceUrl,
          evidenceExcerpt: evidence.excerpt,
          evidenceCapturedAt: evidence.capturedAt,
        })
        .from(findings)
        .innerJoin(evidence, eq(evidence.id, findings.evidenceId))
        .where(eq(findings.investigationId, inv.id))

      const shaped = rows
        .map((r) => ({
          id: r.id,
          code: r.code,
          category: r.category,
          severity: r.severity,
          isObjective: r.isObjective,
          title: r.title,
          detail: r.detail,
          affectedUrl: r.affectedUrl,
          confidence: r.confidence,
          evidence: {
            kind: r.evidenceKind,
            method: r.evidenceMethod,
            sourceUrl: r.evidenceSourceUrl,
            excerpt: r.evidenceExcerpt,
            capturedAt: r.evidenceCapturedAt,
          },
        }))
        .sort((a, b) => (RANK[b.severity] ?? 0) - (RANK[a.severity] ?? 0) || a.code.localeCompare(b.code))

      const technologies = await db
        .select({
          id: websiteTechnologies.id,
          slug: websiteTechnologies.slug,
          name: websiteTechnologies.name,
          category: websiteTechnologies.category,
          version: websiteTechnologies.version,
          versions: websiteTechnologies.versions,
          detail: websiteTechnologies.detail,
          confidence: websiteTechnologies.confidence,
          via: websiteTechnologies.via,
          excerpt: evidence.excerpt,
          sourceUrl: evidence.sourceUrl,
        })
        .from(websiteTechnologies)
        .innerJoin(evidence, eq(evidence.id, websiteTechnologies.evidenceId))
        .where(eq(websiteTechnologies.investigationId, inv.id))

      return {
        data: {
          investigation: {
            id: inv.id,
            status: inv.status,
            createdAt: inv.createdAt,
            finishedAt: inv.finishedAt,
            summary: inv.summary,
          },
          findings: shaped,
          technologies,
        },
      }
    })

    app.get('/api/v1/technologies', async () => {
      const res = await db.execute(sql`
        select t.slug, t.name, t.category, count(distinct t.website_id)::int as sites
        from website_technologies t
        where t.investigation_id in (
          select distinct on (website_id) id from investigations
          where kind = 'website_audit' and status = 'completed'
          order by website_id, created_at desc)
        group by 1, 2, 3
        order by sites desc, t.name`)
      return { data: res.rows }
    })
  }