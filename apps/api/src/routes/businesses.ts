import {
  and, businessLocations, businessSources, businesses, contactPoints, desc, eq, evidence, ilike,
  sourceRecords, sql, websites, type Db,
} from '@meridian/db'
import { businessListQuery, uuidParam } from '@meridian/shared'
import type { FastifyPluginAsync } from 'fastify'

/** "has / has no" filter as an EXISTS subquery. Only fixed strings go into sql.raw. */
const has = (table: string, extra: string, want: boolean | undefined) =>
  want === undefined
    ? undefined
    : sql.raw(
        `${want ? '' : 'not '}exists (select 1 from ${table} x where x.business_id = "businesses"."id"${extra})`,
      )

export const businessRoutes =
  (db: Db): FastifyPluginAsync =>
  async (app) => {
    app.get('/api/v1/businesses', async (req, reply) => {
      const parsed = businessListQuery.safeParse(req.query)
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid query', issues: parsed.error.issues })
      }
      const f = parsed.data
      const where = and(
        f.q ? ilike(businesses.name, `%${f.q}%`) : undefined,
        f.industry ? eq(businesses.industry, f.industry) : undefined,
        f.niche ? eq(businesses.niche, f.niche) : undefined,
        f.countryCode ? eq(businesses.countryCode, f.countryCode.toUpperCase()) : undefined,
        f.city ? sql`lower(${businesses.city}) = lower(${f.city})` : undefined,
        has('websites', '', f.hasWebsite),
        has('contact_points', " and x.type = 'email'", f.hasEmail),
        has('contact_points', " and x.type = 'phone'", f.hasPhone),
      )

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
          emailCount: sql<number>`(select count(*)::int from contact_points c where c.business_id = "businesses"."id" and c.type = 'email')`,
          phoneCount: sql<number>`(select count(*)::int from contact_points c where c.business_id = "businesses"."id" and c.type = 'phone')`,
          locationCount: sql<number>`(select count(*)::int from business_locations l where l.business_id = "businesses"."id")`,
        })
        .from(businesses)
        .where(where)
        .orderBy(desc(businesses.lastSeenAt), businesses.name)
        .limit(f.limit)
        .offset(f.offset)

      const [t] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(businesses)
        .where(where)

      return { data: rows, page: { limit: f.limit, offset: f.offset, total: t?.total ?? 0 } }
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