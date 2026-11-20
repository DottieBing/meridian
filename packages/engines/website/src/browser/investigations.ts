import { basename } from 'node:path'
import { and, desc, eq, investigations, suppressions, websites, type Db } from '@meridian/db'
import { saveFindings } from '../investigations'
import { scoreFindings } from '../scores'
import type { Log } from '../types'
import { BROWSER_METHOD_VERSION, runBrowserRules } from './rules'

export async function createBrowserAudit(
  db: Db,
  p: { workspaceId: string; businessId: string; websiteId: string },
): Promise<string> {
  const [row] = await db
    .insert(investigations)
    .values({ ...p, kind: 'browser_audit', methodVersion: BROWSER_METHOD_VERSION })
    .returning({ id: investigations.id })
  if (!row) throw new Error('investigation insert returned no row')
  return row.id
}

export async function failBrowserAudit(db: Db, id: string, error: string): Promise<void> {
  await db
    .update(investigations)
    .set({ status: 'failed', error: error.slice(0, 2000), finishedAt: new Date() })
    .where(eq(investigations.id, id))
}

/** The latest completed website audit for a site, when it succeeded. A mobile check needs one first. */
export async function latestOkAudit(db: Db, websiteId: string): Promise<{ id: string; mainPage: string | null } | null> {
  const [row] = await db
    .select({ id: investigations.id, summary: investigations.summary })
    .from(investigations)
    .where(
      and(
        eq(investigations.websiteId, websiteId),
        eq(investigations.kind, 'website_audit'),
        eq(investigations.status, 'completed'),
      ),
    )
    .orderBy(desc(investigations.createdAt))
    .limit(1)
  if (!row?.summary || row.summary['outcome'] !== 'ok') return null
  const main = row.summary['mainPage']
  return { id: row.id, mainPage: typeof main === 'string' ? main : null }
}

type Calibration = { lcpMs: number | null; loadMs: number | null }
let calibration: { at: number; value: Calibration } | null = null

/** A tiny static page measured at most every 30 minutes, so timings can be read against this machine's baseline. */
async function getCalibration(
  measure: (url: string, opts?: { timeoutMs?: number }) => Promise<{ lcpMs: number | null; loadMs: number | null }>,
): Promise<Calibration> {
  if (calibration && Date.now() - calibration.at < 30 * 60_000) return calibration.value
  let value: Calibration = { lcpMs: null, loadMs: null }
  try {
    const m = await measure('https://example.com', { timeoutMs: 20_000 })
    value = { lcpMs: m.lcpMs, loadMs: m.loadMs }
  } catch {
    /* leave empty: the baseline is optional */
  }
  calibration = { at: Date.now(), value }
  return value
}

export async function runBrowserAudit(db: Db, id: string, log: Log): Promise<Record<string, unknown>> {
  const started = Date.now()
  const [inv] = await db.select().from(investigations).where(eq(investigations.id, id)).limit(1)
  if (!inv) throw new Error(`Investigation ${id} not found`)
  if (inv.kind !== 'browser_audit') throw new Error(`Investigation ${id} is not a browser audit`)
  if (inv.status === 'completed') return inv.summary ?? {}

  const [site] = inv.websiteId
    ? await db.select().from(websites).where(eq(websites.id, inv.websiteId)).limit(1)
    : []
  if (!site) {
    await failBrowserAudit(db, id, 'Website no longer exists')
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
    return summary
  }

  const suppressed = await db
    .select({ value: suppressions.value })
    .from(suppressions)
    .where(and(eq(suppressions.workspaceId, inv.workspaceId), eq(suppressions.type, 'domain')))
  const domain = site.domain.toLowerCase()
  if (suppressed.some((s) => domain === s.value.toLowerCase() || domain.endsWith(`.${s.value.toLowerCase()}`))) {
    return finishWith({ outcome: 'suppressed', siteUrl: site.url })
  }

  const audit = await latestOkAudit(db, site.id)
  if (!audit) {
    return finishWith({ outcome: 'not_eligible', siteUrl: site.url, error: 'The website audit has to succeed first.' })
  }
  const target = audit.mainPage ?? site.url

  // Loaded here so that only the worker ever starts Playwright.
  const { measureMobile } = await import('./measure')
  let m: Awaited<ReturnType<typeof measureMobile>>
  try {
    m = await measureMobile(target, { screenshotName: `${site.domain}-${id.slice(0, 8)}` })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (/executable doesn't exist|browsertype\.launch/i.test(message)) throw e // a setup problem, fail loudly
    return finishWith({
      outcome: /timeout/i.test(message) ? 'timeout' : 'load_failed',
      url: target,
      error: message,
      durationMs: Date.now() - started,
    })
  }

  if (m.status !== null && [401, 403, 429, 503].includes(m.status)) {
    return finishWith({ outcome: 'blocked', url: target, error: `HTTP ${m.status}`, durationMs: Date.now() - started })
  }
  if (m.status !== null && m.status >= 400) {
    return finishWith({ outcome: 'load_failed', url: target, error: `HTTP ${m.status}`, durationMs: Date.now() - started })
  }

  const shot = m.screenshotPath ? basename(m.screenshotPath) : null
  const { findings, errors } = runBrowserRules(m, { screenshotRel: shot ? `screenshots/${shot}` : null })
  await saveFindings(db, inv, findings, new Map(), BROWSER_METHOD_VERSION)

  const bySeverity: Record<string, number> = {}
  for (const f of findings) bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1

  const baseline = await getCalibration(measureMobile)
  log(`mobile check ${site.domain}: ${findings.length} findings in ${((Date.now() - started) / 1000).toFixed(0)}s`)

  return finishWith({
    outcome: 'ok',
    url: target,
    finalUrl: m.finalUrl,
    device: `iPhone 13 (${m.viewport.width} px wide)`,
    screenshot: shot,
    partial: !m.contentLoaded,
    measurements: {
      status: m.status,
      loaded: m.loaded,
      contentLoaded: m.contentLoaded,
      lcpMs: m.lcpMs,
      cls: m.cls,
      loadMs: m.loadMs,
      domContentLoadedMs: m.domContentLoadedMs,
      requests: m.requests,
      transferBytes: m.transferBytes,
      layoutWidth: m.layoutWidth,
      overflowPx: m.overflow.pixels,
      scrollable: m.overflow.scrollable,
    },
    calibration: baseline,
    findings: findings.length,
    bySeverity,
    scores: scoreFindings(findings),
    ruleErrors: errors,
    consoleErrors: [...m.pageErrors, ...m.consoleErrors].slice(0, 10),
    failedRequests: m.failedRequests.slice(0, 10),
    durationMs: Date.now() - started,
  })
}