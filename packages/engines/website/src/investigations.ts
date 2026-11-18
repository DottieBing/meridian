import { FetchError, PoliteClient, savePageSnapshot, type Page } from '@meridian/crawl'
import {
  and,
  evidence,
  eq,
  findings as findingRows,
  investigations,
  suppressions,
  websites,
  type Db,
} from '@meridian/db'
import { AUDIT_METHOD_VERSION, runRules } from './audit'
import { buildContext, loadPages, pickHome } from './context'
import type { AuditFiles, Log } from './types'

const FRESH_MS = 7 * 24 * 3600 * 1000

export async function createWebsiteAudit(
  db: Db,
  p: { workspaceId: string; businessId: string; websiteId: string },
): Promise<string> {
  const [row] = await db
    .insert(investigations)
    .values({ ...p, kind: 'website_audit', methodVersion: AUDIT_METHOD_VERSION })
    .returning({ id: investigations.id })
  if (!row) throw new Error('investigation insert returned no row')
  return row.id
}

export async function failAudit(db: Db, id: string, error: string): Promise<void> {
  await db
    .update(investigations)
    .set({ status: 'failed', error: error.slice(0, 2000), finishedAt: new Date() })
    .where(eq(investigations.id, id))
}

function statusOutcome(status: number): string | null {
  if (status === 404 || status === 410) return 'dead'
  if ([401, 403, 429, 503].includes(status)) return 'blocked'
  if (status < 200 || status >= 300) return 'unreachable'
  return null
}

async function checkFiles(client: PoliteClient, origin: string, log: Log): Promise<AuditFiles> {
  let robots: AuditFiles['robots'] = null
  let inconclusive = false
  try {
    const r = await client.fetchResource(`${origin}/robots.txt`)
    robots = { status: r.status, body: r.status === 200 ? r.body : '', url: r.finalUrl }
  } catch (e) {
    log(`robots.txt check failed for ${origin}: ${e instanceof Error ? e.message : String(e)}`)
    inconclusive = true
  }

  const declared = robots
    ? [...robots.body.matchAll(/^\s*sitemap:\s*(\S+)/gim)].flatMap((m) => (m[1] ? [m[1]] : []))
    : []
  const checked: { url: string; status: number }[] = []
  if (declared.length > 0) {
    return { robots, sitemap: { found: true, url: declared[0] ?? null, checked, inconclusive: false } }
  }

  for (const path of ['/sitemap.xml', '/sitemap_index.xml', '/wp-sitemap.xml']) {
    try {
      const r = await client.fetchResource(`${origin}${path}`)
      checked.push({ url: r.finalUrl, status: r.status })
      if (r.status === 200 && /<(urlset|sitemapindex)\b/i.test(r.body)) {
        return { robots, sitemap: { found: true, url: r.finalUrl, checked, inconclusive: false } }
      }
    } catch (e) {
      log(`sitemap check failed for ${origin}${path}: ${e instanceof Error ? e.message : String(e)}`)
      inconclusive = true
    }
  }
  return { robots, sitemap: { found: false, url: null, checked, inconclusive } }
}

export async function runWebsiteAudit(db: Db, id: string, log: Log): Promise<Record<string, unknown>> {
  const started = Date.now()
  const [inv] = await db.select().from(investigations).where(eq(investigations.id, id)).limit(1)
  if (!inv) throw new Error(`Investigation ${id} not found`)
  if (inv.kind !== 'website_audit') throw new Error(`Investigation ${id} is not a website audit`)
  if (inv.status === 'completed') return inv.summary ?? {}

  const [site] = inv.websiteId
    ? await db.select().from(websites).where(eq(websites.id, inv.websiteId)).limit(1)
    : []
  if (!site) {
    await failAudit(db, id, 'Website no longer exists')
    return { outcome: 'failed' }
  }

  await db
    .update(investigations)
    .set({ status: 'running', startedAt: new Date(), finishedAt: null, error: null })
    .where(eq(investigations.id, id))

  const finishWith = async (summary: Record<string, unknown>): Promise<Record<string, unknown>> => {
    await db
      .update(investigations)
      .set({ status: 'completed', summary, finishedAt: new Date() })
      .where(eq(investigations.id, id))
    await db.update(websites).set({ lastCheckedAt: new Date() }).where(eq(websites.id, site.id))
    return summary
  }
  const fail = (outcome: string, error: string) =>
    finishWith({ outcome, siteUrl: site.url, error, durationMs: Date.now() - started })

  const suppressed = await db
    .select({ value: suppressions.value })
    .from(suppressions)
    .where(and(eq(suppressions.workspaceId, inv.workspaceId), eq(suppressions.type, 'domain')))
  const domain = site.domain.toLowerCase()
  if (suppressed.some((s) => domain === s.value.toLowerCase() || domain.endsWith(`.${s.value.toLowerCase()}`))) {
    return finishWith({ outcome: 'suppressed', siteUrl: site.url })
  }

  const client = new PoliteClient({
    userAgent: process.env.CRAWLER_USER_AGENT ?? 'MeridianBot/0.1',
    minGapMs: 2000,
    timeoutMs: 15_000,
    maxBytes: 1_048_576,
    maxRedirects: 5,
  })
  const ctxIds = { workspaceId: inv.workspaceId, websiteId: site.id }

  let pages = await loadPages(db, site.id)
  let fetchedFresh = false
  if (!pages.some((p) => Date.now() - p.capturedAt.getTime() < FRESH_MS)) {
    let page: Page
    try {
      page = await client.fetchPage(site.url)
    } catch (e) {
      if (!(e instanceof FetchError)) throw e
      const outcome =
        e.kind === 'dns' ? 'dead' : e.kind === 'robots' ? 'blocked_by_robots' : e.kind === 'not_html' ? 'not_html' : 'unreachable'
      return fail(outcome, `${e.kind}: ${e.message}`)
    }
    const bad = statusOutcome(page.status)
    if (bad) return fail(bad, `HTTP ${page.status}`)
    await savePageSnapshot(db, ctxIds, page)
    fetchedFresh = true
    pages = await loadPages(db, site.id)
  }

  const home = pickHome(pages, site.url)
  if (!home) return fail('no_snapshot', 'No readable page snapshot was available')

  const files = await checkFiles(client, new URL(home.url).origin, log)
  const context = buildContext(site.url, pages, files)
  if (!context) return fail('no_snapshot', 'No readable page snapshot was available')

  const { findings, errors } = runRules(context)
  const byId = new Map(context.pages.map((p) => [p.snapshotId, p]))

  await db.transaction(async (tx) => {
    for (const f of findings) {
      const page = f.evidence.snapshotId ? byId.get(f.evidence.snapshotId) : undefined
      const [ev] = await tx
        .insert(evidence)
        .values({
          workspaceId: inv.workspaceId,
          kind: f.evidence.kind,
          sourceUrl: f.evidence.sourceUrl ?? page?.url ?? f.affectedUrl,
          method: f.evidence.method,
          excerpt: f.evidence.excerpt ?? null,
          contentHash: page?.contentHash ?? null,
          storagePath: page?.storagePath ?? null,
          capturedAt: page?.capturedAt ?? new Date(),
          metadata: {
            investigationId: inv.id,
            snapshotId: f.evidence.snapshotId ?? null,
            auditor: AUDIT_METHOD_VERSION,
            ...(f.evidence.measurement ? { measurement: f.evidence.measurement } : {}),
          },
        })
        .returning({ id: evidence.id })
      if (!ev) throw new Error('evidence insert returned no row')
      await tx.insert(findingRows).values({
        investigationId: inv.id,
        category: f.category,
        code: f.code,
        severity: f.severity,
        isObjective: f.isObjective,
        title: f.title,
        detail: f.detail,
        affectedUrl: f.affectedUrl,
        evidenceId: ev.id,
        confidence: f.confidence,
      })
    }
  })

  const bySeverity: Record<string, number> = {}
  const byCategory: Record<string, number> = {}
  for (const f of findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1
    byCategory[f.category] = (byCategory[f.category] ?? 0) + 1
  }

  return finishWith({
    outcome: 'ok',
    siteUrl: site.url,
    mainPage: context.home.url,
    pagesAudited: context.pages.length,
    fetchedFresh,
    findings: findings.length,
    bySeverity,
    byCategory,
    ruleErrors: errors,
    truncatedPages: context.pages.filter((p) => p.truncated).length,
    metrics: {
      ttfbMs: context.home.ttfbMs,
      htmlBytes: context.home.bytes,
      redirects: context.home.redirects.length,
      https: context.home.url.startsWith('https:'),
    },
    durationMs: Date.now() - started,
  })
}