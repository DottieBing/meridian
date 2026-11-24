import { FetchError, PoliteClient, savePageSnapshot, isOnline, type Page } from '@meridian/crawl'
import {
  and,
  evidence,
  eq,
  findings as findingRows,
  investigations,
  suppressions,
  websites,
  type Db,
  websiteTechnologies,
} from '@meridian/db'
import { AUDIT_METHOD_VERSION, runRules } from './audit'
import { buildContext, loadPages, pickHome } from './context'
import type { AuditFiles, AuditPage, FindingDraft, Log, DetectedTech } from './types'
import { TECH_METHOD_VERSION } from './tech/detect'
import { scoreFindings } from './scores'
import { detectPlaceholder, isScriptRendered } from './placeholder'

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

function tlsFinding(siteUrl: string, code: string): FindingDraft {
  const reason =
    code === 'CERT_HAS_EXPIRED'
      ? 'has expired'
      : code === 'ERR_TLS_CERT_ALTNAME_INVALID'
        ? 'was issued for a different address'
        : 'is self-signed and not trusted'
  let origin = siteUrl
  try {
    origin = new URL(siteUrl).origin
  } catch {
    /* keep the raw address */
  }
  return {
    code: 'security.tls.invalid_certificate',
    category: 'security',
    severity: 'high',
    isObjective: true,
    title: `The site’s security certificate is invalid`,
    detail: `Opening ${origin} over HTTPS fails certificate verification: the certificate ${reason}. Browsers normally show visitors a full-page security warning, and many will leave. This was observed from the machine running Meridian, so re-test in a browser before relying on it.`,
    affectedUrl: siteUrl,
    confidence: 85,
    evidence: {
      kind: 'http_response',
      method: 'website-audit:tls',
      sourceUrl: siteUrl,
      excerpt: `TLS verification error: ${code}`,
      measurement: { code },
    },
  }
}

export async function saveFindings(
  db: Db,
  inv: { id: string; workspaceId: string },
  drafts: FindingDraft[],
  byId: Map<string, AuditPage>,
  auditor: string = AUDIT_METHOD_VERSION,
): Promise<void> {
  await db.transaction(async (tx) => {
    for (const f of drafts) {
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
          storagePath: f.evidence.storagePath ?? page?.storagePath ?? null,
          capturedAt: page?.capturedAt ?? new Date(),
          metadata: {
            investigationId: inv.id,
            snapshotId: f.evidence.snapshotId ?? null,
            auditor,
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
}

function originVariants(...urls: string[]): string[] {
  const primary = [...new Set(urls.map((u) => new URL(u).origin))]
  const flipped = primary.map((o) => {
    const u = new URL(o)
    u.hostname = u.hostname.startsWith('www.') ? u.hostname.slice(4) : `www.${u.hostname}`
    return u.origin
  })
  return [...new Set([...primary, ...flipped])]
}

async function checkFiles(
  client: PoliteClient,
  origins: string[],
  log: Log,
  state: { dnsDead: boolean },
): Promise<AuditFiles> {
  let robots: AuditFiles['robots'] = null
  let origin = origins[0] ?? ''
  let inconclusive = false
  let dnsFailures = 0
  for (const o of origins) {
    try {
      const r = await client.fetchResource(`${o}/robots.txt`)
      robots = { status: r.status, body: r.status === 200 ? r.body : '', url: r.finalUrl }
      origin = o
      inconclusive = false
      break
    } catch (e) {
      if (e instanceof FetchError && e.kind === 'dns') dnsFailures++
      log(`robots.txt check failed for ${o}: ${e instanceof Error ? e.message : String(e)}`)
      inconclusive = true
    }
  }
  state.dnsDead = !robots && dnsFailures === origins.length

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

async function saveTechnologies(
  db: Db,
  inv: { id: string; workspaceId: string },
  websiteId: string,
  techs: DetectedTech[],
  byId: Map<string, AuditPage>,
): Promise<void> {
  if (techs.length === 0) return
  await db.transaction(async (tx) => {
    for (const t of techs) {
      const page = byId.get(t.snapshotId)
      const [ev] = await tx
        .insert(evidence)
        .values({
          workspaceId: inv.workspaceId,
          kind: t.via === 'header' ? 'http_response' : 'page_snapshot',
          sourceUrl: t.pageUrl,
          method: `tech-detect:${t.via}`,
          excerpt: t.excerpt,
          contentHash: page?.contentHash ?? null,
          storagePath: page?.storagePath ?? null,
          capturedAt: page?.capturedAt ?? new Date(),
          metadata: { investigationId: inv.id, snapshotId: t.snapshotId, detector: TECH_METHOD_VERSION },
        })
        .returning({ id: evidence.id })
      if (!ev) throw new Error('evidence insert returned no row')
      await tx.insert(websiteTechnologies).values({
        workspaceId: inv.workspaceId,
        websiteId,
        investigationId: inv.id,
        slug: t.slug,
        name: t.name,
        category: t.category,
        version: t.version,
        versions: t.versions,
        detail: t.detail,
        confidence: t.confidence,
        via: t.via,
        evidenceId: ev.id,
      })
    }
  })
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
      page = await client.fetchEntry(site.url)
    } catch (e) {
      if (!(e instanceof FetchError)) throw e
      if (e.kind === 'tls') {
        await saveFindings(db, inv, [tlsFinding(site.url, e.code ?? 'UNKNOWN')], new Map())
        return finishWith({
          outcome: 'tls_error',
          siteUrl: site.url,
          error: `${e.kind}: ${e.message}`,
          findings: 1,
          bySeverity: { high: 1 },
          byCategory: { security: 1 },
          pagesAudited: 0,
          durationMs: Date.now() - started,
        })
      }
      const outcome =
        e.kind === 'dns' ? 'dead' : e.kind === 'robots' ? 'blocked_by_robots' : e.kind === 'not_html' ? 'not_html' : 'unreachable'
      if ((outcome === 'unreachable' || outcome === 'dead') && !(await isOnline())) {
        throw new Error('OFFLINE: the computer running Meridian had no internet connection')
      }
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

  const dnsState = { dnsDead: false }
  const files = await checkFiles(client, originVariants(home.url, site.url), log, dnsState)
  if (dnsState.dnsDead) {
    return fail('dead', 'The domain no longer resolves, so the stored pages are out of date and no audit was run.')
  }
  const context = buildContext(site.url, pages, files)
  if (!context) return fail('no_snapshot', 'No readable page snapshot was available')

  const placeholder = detectPlaceholder(context.home.html, context.home.bytes)
  if (placeholder) {
    return finishWith({
      outcome: placeholder.kind === 'redirect_stub' ? 'redirect_stub' : 'placeholder',
      siteUrl: site.url,
      mainPage: context.home.url,
      placeholder,
      error: placeholder.detail,
      pagesAudited: context.pages.length,
      scriptRendered: isScriptRendered(context.home.html),
      durationMs: Date.now() - started,
    })
  }

  const { findings, errors } = runRules(context)
  const byId = new Map(context.pages.map((p) => [p.snapshotId, p]))
  await saveFindings(db, inv, findings, byId)
  await saveTechnologies(db, inv, site.id, context.tech, byId)

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
    scores: scoreFindings(findings),
    technologies: context.tech.length,
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