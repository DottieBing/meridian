import {
  and, contactPoints, eq, evidence, investigations, sql, suppressions, websites, businesses, type Db,
} from '@meridian/db'
import { scanWebsite } from './scan'
import type { Log } from './types'

export const METHOD_VERSION = 'contact-scan/1'

export async function createContactScan(
  db: Db, p: { workspaceId: string; businessId: string; websiteId: string },
): Promise<string> {
  const [row] = await db
    .insert(investigations)
    .values({ ...p, kind: 'contact_scan', methodVersion: METHOD_VERSION })
    .returning({ id: investigations.id })
  if (!row) throw new Error('investigation insert returned no row')
  return row.id
}

export async function failScan(db: Db, id: string, error: string): Promise<void> {
  await db
    .update(investigations)
    .set({ status: 'failed', error: error.slice(0, 2000), finishedAt: new Date() })
    .where(eq(investigations.id, id))
}

export async function runContactScan(db: Db, id: string, log: Log): Promise<Record<string, unknown>> {
  const [inv] = await db.select().from(investigations).where(eq(investigations.id, id)).limit(1)
  if (!inv) throw new Error(`Investigation ${id} not found`)
  if (inv.kind !== 'contact_scan') throw new Error(`Investigation ${id} is not a contact scan`)
  if (inv.status === 'completed') return inv.summary ?? {} // duplicate delivery

  const [site] = inv.websiteId
    ? await db.select().from(websites).where(eq(websites.id, inv.websiteId)).limit(1)
    : []
  const [biz] = await db.select().from(businesses).where(eq(businesses.id, inv.businessId)).limit(1)
  if (!site || !biz) {
    await failScan(db, id, 'Business or website no longer exists')
    return { outcome: 'failed' }
  }

  await db
    .update(investigations)
    .set({ status: 'running', startedAt: new Date(), finishedAt: null, error: null })
    .where(eq(investigations.id, id))

  const supp = await db
    .select({ type: suppressions.type, value: suppressions.value })
    .from(suppressions)
    .where(eq(suppressions.workspaceId, inv.workspaceId))
  const bucket = (t: string) => new Set(supp.filter((s) => s.type === t).map((s) => s.value.toLowerCase()))
  const suppEmails = bucket('email')
  const suppDomains = bucket('domain')
  const suppPhones = bucket('phone')
  const isSuppressedDomain = (d: string) => [...suppDomains].some((s) => d === s || d.endsWith(`.${s}`))

  const finishWith = async (summary: Record<string, unknown>): Promise<Record<string, unknown>> => {
    await db
      .update(investigations)
      .set({ status: 'completed', summary, finishedAt: new Date() })
      .where(eq(investigations.id, id))
    return summary
  }

  if (isSuppressedDomain(site.domain.toLowerCase())) {
    return finishWith({ outcome: 'suppressed', siteUrl: site.url })
  }

  const scanStart = new Date()
  const result = await scanWebsite(site.url, {
    userAgent: process.env.CRAWLER_USER_AGENT ?? 'MeridianBot/0.1',
    region: biz.countryCode,
    knownDomain: site.domain,
    log,
  })

  let suppressedSkipped = 0
  const kept = result.contacts.filter((c) => {
    const blocked =
      (c.type === 'email' && (suppEmails.has(c.normalizedValue) || isSuppressedDomain(c.normalizedValue.split('@')[1] ?? ''))) ||
      (c.type === 'phone' && suppPhones.has(c.normalizedValue))
    if (blocked) suppressedSkipped++
    return !blocked
  })
  const hashes = new Map(result.pages.map((p) => [p.url, p.contentHash]))

  let inserted = 0
  let updated = 0

  await db.transaction(async (tx) => {
    for (const c of kept) {
      const [ev] = await tx
        .insert(evidence)
        .values({
          workspaceId: inv.workspaceId,
          kind: 'page_snapshot',
          sourceUrl: c.pageUrl,
          method: `html-extract:${c.source}`,
          excerpt: c.context.slice(0, 400) || null,
          contentHash: hashes.get(c.pageUrl) ?? null,
          metadata: { investigationId: inv.id, scanner: METHOD_VERSION, offDomain: c.offDomain ?? false },
        })
        .returning({ id: evidence.id })
      if (!ev) throw new Error('evidence insert returned no row')

      const [row] = await tx
        .insert(contactPoints)
        .values({
          workspaceId: inv.workspaceId,
          businessId: biz.id,
          websiteId: site.id,
          type: c.type,
          value: c.value,
          normalizedValue: c.normalizedValue,
          classification: c.classification,
          validation: c.validation ?? null,
          confidence: c.confidence,
          evidenceId: ev.id,
        })
        .onConflictDoUpdate({
          target: [contactPoints.workspaceId, contactPoints.businessId, contactPoints.type, contactPoints.normalizedValue],
          set: {
            confidence: sql`greatest(${contactPoints.confidence}, excluded.confidence)`,
            evidenceId: sql`case when excluded.confidence > ${contactPoints.confidence} then excluded.evidence_id else ${contactPoints.evidenceId} end`,
            websiteId: site.id,
            validation: sql`coalesce(excluded.validation, ${contactPoints.validation})`,
            classification: sql`case when excluded.classification <> 'unknown' then excluded.classification else ${contactPoints.classification} end`,
            lastSeenAt: new Date(),
            staleAt: null,
          },
        })
        .returning({ inserted: sql<boolean>`(xmax = 0)` })
      if (row?.inserted) inserted++
      else updated++
    }

    const reached = result.outcome === 'ok' || result.outcome === 'no_contacts'
    if (reached) {
      // Contacts this scanner found before but did not see now are marked stale, never deleted
      await tx.execute(sql`
        update contact_points cp set stale_at = now()
        from evidence e
        where cp.evidence_id = e.id
          and cp.business_id = ${biz.id}
          and cp.website_id = ${site.id}
          and e.method like 'html-extract%'
          and cp.last_seen_at < ${scanStart.toISOString()}::timestamptz
          and cp.stale_at is null`)
    }

    const websiteStatus =
      reached ? 'active' : result.outcome === 'dead' ? 'dead' : result.outcome === 'unreachable' ? 'unreachable' : undefined
    await tx
      .update(websites)
      .set({ lastCheckedAt: new Date(), ...(websiteStatus ? { status: websiteStatus } : {}) })
      .where(eq(websites.id, site.id))
  })

  const count = (t: string) => kept.filter((c) => c.type === t).length
  return finishWith({
    outcome: result.outcome,
    siteUrl: result.siteUrl,
    finalUrl: result.finalUrl ?? null,
    error: result.error ?? null,
    pages: result.pages,
    skipped: result.skipped,
    found: { email: count('email'), phone: count('phone'), social: count('social'), contact_form: count('contact_form') },
    newContacts: inserted,
    updatedContacts: updated,
    suppressedSkipped,
    durationMs: result.durationMs,
  })
}