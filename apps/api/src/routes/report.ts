import {
  and, businesses, contactPoints, desc, eq, evidence, findings, investigations, reportSettings,
  websiteTechnologies, websites, workspaces, type Db,
} from '@meridian/db'
import { completeness, contactability } from '@meridian/website'
import type { FastifyPluginAsync } from 'fastify'
import { catalogueFor } from '@meridian/website'

const RANK: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 }

export const reportRoutes =
  (db: Db): FastifyPluginAsync =>
  async (app) => {
    app.get('/api/v1/businesses/:id/internal-report', async (req, reply) => {
      const { id } = req.params as { id: string }

      const [business] = await db.select().from(businesses).where(eq(businesses.id, id)).limit(1)
      if (!business) return reply.code(404).send({ error: 'Business not found' })

      const [site] = await db
        .select()
        .from(websites)
        .where(eq(websites.businessId, id))
        .orderBy(desc(websites.isPrimary))
        .limit(1)

      const [audit] = site
        ? await db
            .select()
            .from(investigations)
            .where(and(eq(investigations.websiteId, site.id), eq(investigations.kind, 'website_audit'), eq(investigations.status, 'completed')))
            .orderBy(desc(investigations.createdAt))
            .limit(1)
        : []

      const [mobile] = site
        ? await db
            .select()
            .from(investigations)
            .where(and(eq(investigations.websiteId, site.id), eq(investigations.kind, 'browser_audit'), eq(investigations.status, 'completed')))
            .orderBy(desc(investigations.createdAt))
            .limit(1)
        : []

      const auditFindings = audit
        ? await db
            .select({
              id: findings.id, code: findings.code, category: findings.category, severity: findings.severity,
              isObjective: findings.isObjective, title: findings.title, detail: findings.detail,
              affectedUrl: findings.affectedUrl, confidence: findings.confidence,
              evidenceKind: evidence.kind, evidenceMethod: evidence.method, evidenceSourceUrl: evidence.sourceUrl,
              evidenceExcerpt: evidence.excerpt, evidenceCapturedAt: evidence.capturedAt, evidenceStoragePath: evidence.storagePath,
            })
            .from(findings)
            .innerJoin(evidence, eq(evidence.id, findings.evidenceId))
            .where(eq(findings.investigationId, audit.id))
        : []

      const mobileFindings = mobile
        ? await db
            .select({
              id: findings.id, code: findings.code, category: findings.category, severity: findings.severity,
              isObjective: findings.isObjective, title: findings.title, detail: findings.detail,
              affectedUrl: findings.affectedUrl, confidence: findings.confidence,
              evidenceKind: evidence.kind, evidenceMethod: evidence.method, evidenceSourceUrl: evidence.sourceUrl,
              evidenceExcerpt: evidence.excerpt, evidenceCapturedAt: evidence.capturedAt, evidenceStoragePath: evidence.storagePath,
            })
            .from(findings)
            .innerJoin(evidence, eq(evidence.id, findings.evidenceId))
            .where(eq(findings.investigationId, mobile.id))
        : []

      const sortFindings = <T extends { severity: string; code: string }>(rows: T[]) =>
        [...rows].sort((a, b) => (RANK[b.severity] ?? 0) - (RANK[a.severity] ?? 0) || a.code.localeCompare(b.code))

      const techs = audit
        ? await db.select().from(websiteTechnologies).where(eq(websiteTechnologies.investigationId, audit.id))
        : []

      const contacts = await db.select().from(contactPoints).where(eq(contactPoints.businessId, id))
      const contactChannels = [
        ...new Set(
          contacts
            .filter((c) => !c.staleAt && !(c.type === 'email' && ['privacy_legal', 'no_reply', 'technical'].includes(c.role ?? 'unknown')))
            .map((c) => c.type),
        ),
      ]

      const [scanned] = await db
        .select({ id: investigations.id })
        .from(investigations)
        .where(and(eq(investigations.businessId, id), eq(investigations.kind, 'contact_scan'), eq(investigations.status, 'completed')))
        .limit(1)

      const [ws] = await db.select({ id: workspaces.id }).from(workspaces).limit(1)
      const [settings] = ws ? await db.select().from(reportSettings).where(eq(reportSettings.workspaceId, ws.id)).limit(1) : []

      return {
        data: {
          business,
          website: site ?? null,
          audit: audit ? { id: audit.id, createdAt: audit.createdAt, finishedAt: audit.finishedAt, summary: audit.summary } : null,
          mobile: mobile ? { id: mobile.id, createdAt: mobile.createdAt, finishedAt: mobile.finishedAt, summary: mobile.summary } : null,
          findings: sortFindings(auditFindings).map(annotate),
          mobileFindings: sortFindings(mobileFindings).map(annotate),
          technologies: techs,
          leadScores: {
            contactability: contactability(contactChannels),
            completeness: completeness({
              industry: Boolean(business.industry),
              niche: Boolean(business.niche),
              city: Boolean(business.city),
              hasWebsite: Boolean(site),
              auditOk: audit?.summary?.['outcome'] === 'ok',
              auditPages: Number(audit?.summary?.['pagesAudited'] ?? 0),
              techCount: techs.length,
              contactScanDone: Boolean(scanned),
              hasContact: contacts.some((c) => !c.staleAt),
            }).score,
          },
          reportSettings: settings ?? null,
          generatedAt: new Date().toISOString(),
        },
      }
    })
  }