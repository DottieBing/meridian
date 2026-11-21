import { createReadStream, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  and, asc, businesses, desc, eq, evidence, findings, inArray, investigations, sql, websites, type Db,
} from '@meridian/db'
import type { Boss } from '@meridian/queue'
import { QUEUES, bulkBrowserAuditRequest, uuidParam } from '@meridian/shared'
import { createBrowserAudit, failBrowserAudit, latestOkAudit, screenshotDir } from '@meridian/website'
import type { FastifyPluginAsync } from 'fastify'

const RANK: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 }

export const browserRoutes =
  (db: Db, boss: Boss): FastifyPluginAsync =>
  async (app) => {
    app.post('/api/v1/businesses/:id/browser-audit', async (req, reply) => {
      const p = uuidParam.safeParse(req.params)
      if (!p.success) return reply.code(400).send({ error: 'Invalid id' })

      const [site] = await db
        .select()
        .from(websites)
        .where(eq(websites.businessId, p.data.id))
        .orderBy(desc(websites.isPrimary), asc(websites.createdAt))
        .limit(1)
      if (!site) return reply.code(409).send({ error: 'This business has no website to check' })
      if (!(await latestOkAudit(db, site.id))) {
        return reply.code(409).send({ error: 'Run the website audit first. It has to succeed before a mobile check.' })
      }

      const [active] = await db
        .select({ id: investigations.id })
        .from(investigations)
        .where(
          and(
            eq(investigations.websiteId, site.id),
            eq(investigations.kind, 'browser_audit'),
            inArray(investigations.status, ['queued', 'running']),
          ),
        )
        .limit(1)
      if (active) return reply.code(409).send({ error: 'A mobile check is already queued or running', investigationId: active.id })

      const investigationId = await createBrowserAudit(db, {
        workspaceId: site.workspaceId, businessId: site.businessId, websiteId: site.id,
      })
      const jobId = await boss.send(QUEUES.browserAudit, { investigationId })
      if (!jobId) {
        await failBrowserAudit(db, investigationId, 'The queue did not create a job')
        return reply.code(500).send({ error: 'Job was not created', investigationId })
      }
      return reply.code(202).send({ data: { investigationId, jobId } })
    })

    app.post('/api/v1/browser-audits', async (req, reply) => {
      const parsed = bulkBrowserAuditRequest.safeParse(req.body ?? {})
      if (!parsed.success) return reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues })
      const f = parsed.data

      const LATEST = sql`(select i.id from investigations i where i.website_id = ${websites.id} and i.kind = 'website_audit' and i.status = 'completed' order by i.created_at desc limit 1)`
      const HEALTH = sql`(select (a.summary->'scores'->>'health')::int from investigations a where a.id = ${LATEST})`

      const rows = await db
        .select({ websiteId: websites.id, businessId: websites.businessId, workspaceId: websites.workspaceId })
        .from(websites)
        .innerJoin(businesses, eq(businesses.id, websites.businessId))
        .where(
          and(
            eq(websites.isPrimary, true),
            f.industry ? eq(businesses.industry, f.industry) : undefined,
            f.city ? sql`lower(${businesses.city}) = lower(${f.city})` : undefined,
            sql`(select a.summary->>'outcome' from investigations a where a.id = ${LATEST}) = 'ok'`,
            sql`coalesce(${HEALTH}, 100) <= ${f.maxHealth}`,
            f.contactable
              ? sql`exists (select 1 from contact_points c where c.business_id = ${businesses.id} and c.type = 'email' and c.stale_at is null and coalesce(c.role, 'unknown') not in ('privacy_legal', 'no_reply', 'technical'))`
              : undefined,
            sql`not exists (
              select 1 from investigations i
              where i.website_id = ${websites.id} and i.kind = 'browser_audit'
                and (i.status in ('queued', 'running')
                     or (i.status = 'completed'
                         and coalesce(i.summary->>'outcome', '') in ('ok', 'blocked', 'empty_page')
                         and i.created_at > now() - (${f.auditAfterDays}::int * interval '1 day'))
                     or (i.status = 'completed'
                         and coalesce(i.summary->>'outcome', '') in ('load_failed', 'timeout')
                         and i.created_at > now() - interval '1 day')))`,
          ),
        )
        .orderBy(sql`${HEALTH} asc nulls last`, businesses.name)
        .limit(f.limit)

      const ids: string[] = []
      for (const r of rows) {
        const investigationId = await createBrowserAudit(db, r)
        const jobId = await boss.send(QUEUES.browserAudit, { investigationId })
        if (!jobId) {
          await failBrowserAudit(db, investigationId, 'The queue did not create a job')
          continue
        }
        ids.push(investigationId)
      }
      return reply.code(202).send({ data: { queued: ids.length, investigationIds: ids } })
    })

    app.get('/api/v1/businesses/:id/browser-audit', async (req, reply) => {
      const p = uuidParam.safeParse(req.params)
      if (!p.success) return reply.code(400).send({ error: 'Invalid id' })

      const [inv] = await db
        .select()
        .from(investigations)
        .where(
          and(
            eq(investigations.businessId, p.data.id),
            eq(investigations.kind, 'browser_audit'),
            eq(investigations.status, 'completed'),
          ),
        )
        .orderBy(desc(investigations.createdAt))
        .limit(1)
      if (!inv) return { data: null }

      const rows = await db
        .select({
          id: findings.id, code: findings.code, category: findings.category, severity: findings.severity,
          isObjective: findings.isObjective, title: findings.title, detail: findings.detail,
          affectedUrl: findings.affectedUrl, confidence: findings.confidence,
          evidenceKind: evidence.kind, evidenceMethod: evidence.method, evidenceSourceUrl: evidence.sourceUrl,
          evidenceExcerpt: evidence.excerpt, evidenceCapturedAt: evidence.capturedAt,
        })
        .from(findings)
        .innerJoin(evidence, eq(evidence.id, findings.evidenceId))
        .where(eq(findings.investigationId, inv.id))

      const shaped = rows
        .map((r) => ({
          id: r.id, code: r.code, category: r.category, severity: r.severity, isObjective: r.isObjective,
          title: r.title, detail: r.detail, affectedUrl: r.affectedUrl, confidence: r.confidence,
          evidence: {
            kind: r.evidenceKind, method: r.evidenceMethod, sourceUrl: r.evidenceSourceUrl,
            excerpt: r.evidenceExcerpt, capturedAt: r.evidenceCapturedAt,
          },
        }))
        .sort((a, b) => (RANK[b.severity] ?? 0) - (RANK[a.severity] ?? 0) || a.code.localeCompare(b.code))

      return {
        data: {
          investigation: {
            id: inv.id, status: inv.status, createdAt: inv.createdAt, finishedAt: inv.finishedAt, summary: inv.summary,
          },
          findings: shaped,
        },
      }
    })

    app.get('/api/v1/investigations/:id/screenshot', async (req, reply) => {
      const p = uuidParam.safeParse(req.params)
      if (!p.success) return reply.code(400).send({ error: 'Invalid id' })
      const [inv] = await db
        .select({ summary: investigations.summary })
        .from(investigations)
        .where(eq(investigations.id, p.data.id))
        .limit(1)
      const file = inv?.summary?.['screenshot']
      if (typeof file !== 'string' || !/^[a-z0-9._-]+\.jpg$/.test(file)) return reply.code(404).send({ error: 'No screenshot' })
      const full = join(screenshotDir(), file)
      if (!existsSync(full)) return reply.code(404).send({ error: 'Screenshot file is missing' })
      return reply.header('Cache-Control', 'private, max-age=3600').type('image/jpeg').send(createReadStream(full))
    })
  }