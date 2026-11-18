import {
  and, businessLocations, businessSources, businesses, contactPoints, desc, eq, evidence, ilike,
  sourceRecords, sql, websites, type Db,
} from '@meridian/db'
import { businessExportQuery, businessListQuery, uuidParam } from '@meridian/shared'
import type { FastifyPluginAsync } from 'fastify'

type Filters = ReturnType<typeof businessExportQuery.parse>

/** "has / has no" filter as an EXISTS subquery. Only fixed strings go into sql.raw. */
const has = (table: string, extra: string, want: boolean | undefined) =>
  want === undefined
    ? undefined
    : sql.raw(
        `${want ? '' : 'not '}exists (select 1 from ${table} x where x.business_id = "businesses"."id"${extra})`,
      )

const SEVERITY_SETS: Record<'low' | 'medium' | 'high' | 'critical', string> = {
  low: `'low','medium','high','critical'`,
  medium: `'medium','high','critical'`,
  high: `'high','critical'`,
  critical: `'critical'`,
}

const LATEST_AUDIT = sql`(select i.id from investigations i where i.business_id = "businesses"."id" and i.kind = 'website_audit' and i.status = 'completed' order by i.created_at desc limit 1)`

// A sorting aid: critical 8, high 5, medium 3, low 1, info 0. It is not a quality score.
const ISSUE_WEIGHT = sql`(select coalesce(sum(case f.severity when 'critical' then 8 when 'high' then 5 when 'medium' then 3 when 'low' then 1 else 0 end), 0)::int from findings f where f.investigation_id = ${LATEST_AUDIT})`

const PLATFORM = sql`(select t.name || coalesce(' ' || t.version, '') from website_technologies t where t.investigation_id = ${LATEST_AUDIT} and t.category in ('website_builder','cms','ecommerce','framework') order by case t.category when 'website_builder' then 1 when 'cms' then 2 when 'ecommerce' then 3 else 4 end, t.confidence desc limit 1)`

const CONTACTABLE = `exists (select 1 from contact_points c where c.business_id = "businesses"."id" and c.type = 'email' and c.stale_at is null and coalesce(c.role, 'unknown') not in ('privacy_legal', 'no_reply', 'technical'))`

function buildWhere(f: Filters) {
  return and(
    f.q ? ilike(businesses.name, `%${f.q}%`) : undefined,
    f.industry ? eq(businesses.industry, f.industry) : undefined,
    f.niche ? eq(businesses.niche, f.niche) : undefined,
    f.countryCode ? eq(businesses.countryCode, f.countryCode.toUpperCase()) : undefined,
    f.city ? sql`lower(${businesses.city}) = lower(${f.city})` : undefined,
    has('websites', '', f.hasWebsite),
    has('contact_points', " and x.type = 'email'", f.hasEmail),
    has('contact_points', " and x.type = 'phone'", f.hasPhone),
    f.contactable === undefined ? undefined : sql.raw(`${f.contactable ? '' : 'not '}${CONTACTABLE}`),
    f.audited === undefined ? undefined : f.audited ? sql`${LATEST_AUDIT} is not null` : sql`${LATEST_AUDIT} is null`,
    f.minSeverity
      ? sql`exists (select 1 from findings f where f.investigation_id = ${LATEST_AUDIT} and f.severity in (${sql.raw(SEVERITY_SETS[f.minSeverity])}))`
      : undefined,
    f.tech
      ? sql`exists (select 1 from website_technologies t where t.investigation_id = ${LATEST_AUDIT} and t.slug = ${f.tech})`
      : undefined,
  )
}

const orderFor = (sort: 'recent' | 'issues') =>
  sort === 'issues' ? [sql`${ISSUE_WEIGHT} desc`, businesses.name] : [desc(businesses.lastSeenAt), businesses.name]

function cell(v: unknown, phone = false): string {
  let s = v === null || v === undefined ? '' : String(v)
  // Spreadsheet formula injection guard. Phone numbers that start with + are safe and kept as they are.
  if (/^[=+\-@\t\r]/.test(s) && !(phone && /^\+[\d ]+$/.test(s))) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const businessRoutes =
  (db: Db): FastifyPluginAsync =>
  async (app) => {
    app.get('/api/v1/businesses', async (req, reply) => {
      const parsed = businessListQuery.safeParse(req.query)
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid query', issues: parsed.error.issues })
      }
      const f = parsed.data
      const where = buildWhere(f)

      const rows = await db
        .select({
          id: businesses.id,
          name: businesses.name,
          industry: businesses.industry,
          niche: businesses.niche,
          city: businesses.city,
          countryCode: businesses.countryCode,
          status: businesses.status,
          firstSeenAt: businesses.firstSeenAt,
          lastSeenAt: businesses.lastSeenAt,
          website: sql<string | null>`(select w.domain from websites w where w.business_id = "businesses"."id" order by w.is_primary desc, w.created_at asc limit 1)`,
          emailCount: sql<number>`(select count(*)::int from contact_points c where c.business_id = "businesses"."id" and c.type = 'email' and c.stale_at is null)`,
          phoneCount: sql<number>`(select count(*)::int from contact_points c where c.business_id = "businesses"."id" and c.type = 'phone' and c.stale_at is null)`,
          locationCount: sql<number>`(select count(*)::int from business_locations l where l.business_id = "businesses"."id")`,
          contactable: sql<boolean>`${sql.raw(CONTACTABLE)}`,
          platform: sql<string | null>`${PLATFORM}`,
          auditId: sql<string | null>`${LATEST_AUDIT}`,
          auditOutcome: sql<string | null>`(select i.summary->>'outcome' from investigations i where i.id = ${LATEST_AUDIT})`,
          issueWeight: sql<number>`${ISSUE_WEIGHT}`,
          issueCount: sql<number>`(select count(*)::int from findings f where f.investigation_id = ${LATEST_AUDIT} and f.severity <> 'info')`,
          signals: sql<string[]>`array(select f.code from findings f where f.investigation_id = ${LATEST_AUDIT} and f.severity in ('medium','high','critical') order by case f.severity when 'critical' then 3 when 'high' then 2 else 1 end desc, f.code limit 3)`,
        })
        .from(businesses)
        .where(where)
        .orderBy(...orderFor(f.sort))
        .limit(f.limit)
        .offset(f.offset)

      const [t] = await db.select({ total: sql<number>`count(*)::int` }).from(businesses).where(where)

      return {
        data: rows.map(({ auditId, auditOutcome, issueWeight, issueCount, signals, ...rest }) => ({
          ...rest,
          audit: auditId ? { outcome: auditOutcome, issueWeight, issueCount, signals } : null,
        })),
        page: { limit: f.limit, offset: f.offset, total: t?.total ?? 0 },
      }
    })

    app.get('/api/v1/businesses/export.csv', async (req, reply) => {
      const parsed = businessExportQuery.safeParse(req.query)
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid query', issues: parsed.error.issues })
      }
      const f = parsed.data

      const rows = await db
        .select({
          id: businesses.id,
          name: businesses.name,
          industry: businesses.industry,
          niche: businesses.niche,
          city: businesses.city,
          website: sql<string | null>`(select w.url from websites w where w.business_id = "businesses"."id" order by w.is_primary desc, w.created_at asc limit 1)`,
          email: sql<string | null>`(select c.value from contact_points c where c.business_id = "businesses"."id" and c.type = 'email' and c.stale_at is null and coalesce(c.role, 'unknown') not in ('privacy_legal', 'no_reply', 'technical') order by c.confidence desc, c.first_seen_at asc limit 1)`,
          emailRole: sql<string | null>`(select c.role from contact_points c where c.business_id = "businesses"."id" and c.type = 'email' and c.stale_at is null and coalesce(c.role, 'unknown') not in ('privacy_legal', 'no_reply', 'technical') order by c.confidence desc, c.first_seen_at asc limit 1)`,
          phone: sql<string | null>`(select c.value from contact_points c where c.business_id = "businesses"."id" and c.type = 'phone' and c.stale_at is null order by c.confidence desc, c.first_seen_at asc limit 1)`,
          auditOutcome: sql<string | null>`(select i.summary->>'outcome' from investigations i where i.id = ${LATEST_AUDIT})`,
          issueWeight: sql<number>`${ISSUE_WEIGHT}`,
          issues: sql<string[]>`array(select f.title from findings f where f.investigation_id = ${LATEST_AUDIT} and f.severity in ('medium','high','critical') order by case f.severity when 'critical' then 3 when 'high' then 2 else 1 end desc, f.code limit 3)`,
          platform: sql<string | null>`${PLATFORM}`,
        })
        .from(businesses)
        .where(buildWhere(f))
        .orderBy(...orderFor(f.sort))
        .limit(5000)

      const header = ['lead_id', 'name', 'industry', 'niche', 'city', 'website', 'platform', 'email', 'email_type', 'phone', 'audit_status', 'issue_weight', 'top_issues']
      const lines = rows.map((r) =>
        [
          cell(r.id), cell(r.name), cell(r.industry), cell(r.niche), cell(r.city), cell(r.website), cell(r.platform),
          cell(r.email), cell(r.emailRole), cell(r.phone, true), cell(r.auditOutcome), cell(r.auditOutcome ? r.issueWeight : ''),
          cell(r.issues.join(' | ')),
        ].join(','),
      )
      const stamp = new Date().toISOString().slice(0, 10)
      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="meridian-leads-${stamp}.csv"`)
        .send(`\uFEFF${[header.join(','), ...lines].join('\r\n')}\r\n`)
    })

    app.get('/api/v1/businesses/:id', async (req, reply) => {
      const p = uuidParam.safeParse(req.params)
      if (!p.success) return reply.code(400).send({ error: 'Invalid id' })
      const id = p.data.id

      const [business] = await db.select().from(businesses).where(eq(businesses.id, id)).limit(1)
      if (!business) return reply.code(404).send({ error: 'Business not found' })

      const [locations, sites, contacts, sources] = await Promise.all([
        db.select().from(businessLocations).where(eq(businessLocations.businessId, id)),
        db.select().from(websites).where(eq(websites.businessId, id)),
        db
          .select({
            id: contactPoints.id,
            type: contactPoints.type,
            value: contactPoints.value,
            classification: contactPoints.classification,
            role: contactPoints.role,
            validation: contactPoints.validation,
            staleAt: contactPoints.staleAt,
            confidence: contactPoints.confidence,
            firstSeenAt: contactPoints.firstSeenAt,
            lastSeenAt: contactPoints.lastSeenAt,
            evidence: {
              kind: evidence.kind,
              method: evidence.method,
              sourceUrl: evidence.sourceUrl,
              capturedAt: evidence.capturedAt,
            },
          })
          .from(contactPoints)
          .innerJoin(evidence, eq(evidence.id, contactPoints.evidenceId))
          .where(eq(contactPoints.businessId, id)),
        db
          .select({
            provider: sourceRecords.provider,
            externalId: sourceRecords.externalId,
            url: sourceRecords.url,
            fetchedAt: sourceRecords.fetchedAt,
          })
          .from(businessSources)
          .innerJoin(sourceRecords, eq(sourceRecords.id, businessSources.sourceRecordId))
          .where(eq(businessSources.businessId, id)),
      ])

      return { data: { ...business, locations, websites: sites, contacts, sources } }
    })
  }