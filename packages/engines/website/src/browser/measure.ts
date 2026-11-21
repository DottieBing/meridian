import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium, devices } from 'playwright'
import { isPrivateHost } from './guards'
import { screenshotDir } from './paths'

export type BrowserMeasurement = {
  url: string
  finalUrl: string
  status: number | null
  loaded: boolean
  contentLoaded: boolean
  viewport: { width: number; height: number }
  layoutWidth: number
  lcpMs: number | null
  cls: number | null
  domContentLoadedMs: number | null
  loadMs: number | null
  requests: number
  transferBytes: number
  failedRequests: { url: string; reason: string }[]
  consoleErrors: string[]
  pageErrors: string[]
  overflow: { pixels: number; scrollable: boolean; offenders: { el: string; right: number; width: number }[] }
  textChars: number
  textSample: string
  screenshotPath: string | null
  durationMs: number
}

export type MeasureOptions = { screenshotName?: string | null; timeoutMs?: number }

// Runs before any page script. Largest Contentful Paint, and layout shift grouped into session windows
// (a window ends after a 1 second gap or 5 seconds), keeping the worst window, as Google defines it.
const VITALS_SCRIPT = `(() => {
  const m = { lcp: null, cls: 0 }
  window.__meridian = m
  try {
    new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const last = entries[entries.length - 1]
      if (last) m.lcp = last.startTime
    }).observe({ type: 'largest-contentful-paint', buffered: true })
  } catch (e) {}
  try {
    let value = 0, first = 0, last = 0, started = false
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.hadRecentInput) continue
        if (started && e.startTime - last < 1000 && e.startTime - first < 5000) { value += e.value }
        else { value = e.value; first = e.startTime; started = true }
        last = e.startTime
        if (value > m.cls) m.cls = value
      }
    }).observe({ type: 'layout-shift', buffered: true })
  } catch (e) {}
})()`

// Runs after the page has settled. Overflow culprits skip elements clipped by an ancestor or fixed to the screen.
const PAGE_SCRIPT = `(() => {
  const de = document.documentElement
  const vw = de.clientWidth
  const sw = Math.max(de.scrollWidth, document.body ? document.body.scrollWidth : 0)
  const rootOverflow = getComputedStyle(de).overflowX
  const viewportOverflow = rootOverflow !== 'visible' ? rootOverflow : (document.body ? getComputedStyle(document.body).overflowX : 'visible')
  const scrollable = viewportOverflow !== 'hidden' && viewportOverflow !== 'clip'
  const offenders = []
  if (sw > vw + 1 && document.body) {
    const clipped = (el) => {
      for (let p = el.parentElement; p && p !== document.body && p !== de; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX
        if ((o === 'hidden' || o === 'auto' || o === 'scroll' || o === 'clip') && p.getBoundingClientRect().right <= vw + 1) return true
      }
      return false
    }
    const label = (el) => {
      let s = el.tagName.toLowerCase()
      if (el.id) s += '#' + el.id
      const cls = (typeof el.className === 'string' ? el.className : '').trim().split(/\\s+/).filter(Boolean).slice(0, 2)
      if (cls.length) s += '.' + cls.join('.')
      return s.slice(0, 80)
    }
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0 || r.right <= vw + 1) continue
      const cs = getComputedStyle(el)
      if (cs.position === 'fixed' || cs.visibility === 'hidden' || cs.display === 'none') continue
      if (clipped(el)) continue
      offenders.push({ el: label(el), right: Math.round(r.right), width: Math.round(r.width) })
      if (offenders.length >= 300) break
    }
    offenders.sort((a, b) => b.right - a.right)
  }
  const nav = performance.getEntriesByType('navigation')[0]
  const m = window.__meridian || { lcp: null, cls: 0 }
  const text = document.body ? (document.body.innerText || '') : ''
  return {
    lcp: m.lcp, cls: m.cls,
    dcl: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
    load: nav ? Math.round(nav.loadEventEnd) : null,
    clientWidth: vw, scrollWidth: sw, scrollable,
    offenders: offenders.slice(0, 5),
    textChars: text.trim().length,
    textSample: text.trim().replace(/\\s+/g, ' ').slice(0, 400),
    finalUrl: location.href,
  }
})()`

type PageProbe = {
  lcp: number | null
  cls: number
  dcl: number | null
  load: number | null
  clientWidth: number
  scrollWidth: number
  scrollable: boolean
  offenders: { el: string; right: number; width: number }[]
  textChars: number
  textSample: string
  finalUrl: string
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** Loads the page like a phone would and measures it. Throws if the page cannot be loaded at all. */
export async function measureMobile(url: string, opts: MeasureOptions = {}): Promise<BrowserMeasurement> {
  const started = Date.now()
  const timeout = opts.timeoutMs ?? 30_000
  const base = devices['iPhone 13']
  if (!base) throw new Error('The iPhone 13 device profile is missing from this Playwright version')
  const botToken = process.env['CRAWLER_USER_AGENT'] ?? 'MeridianBot/0.1'

  const browser = await chromium.launch({ headless: true })
  const killer = setTimeout(() => void browser.close().catch(() => undefined), 200_000)
  try {
    const context = await browser.newContext({
      ...base,
      deviceScaleFactor: 1,
      userAgent: `${base.userAgent} ${botToken}`,
      serviceWorkers: 'block',
    })
    await context.addInitScript(VITALS_SCRIPT)

    // Never let a page (or a redirect) steer the browser at the local network.
    await context.route('**/*', async (route) => {
      let allowed = false
      try {
        const u = new URL(route.request().url())
        allowed = (u.protocol === 'http:' || u.protocol === 'https:') && !isPrivateHost(u.hostname)
      } catch {
        allowed = false
      }
      if (allowed) await route.continue()
      else await route.abort('blockedbyclient')
    })

    const page = await context.newPage()
    page.setDefaultTimeout(timeout)

    let requests = 0
    let transferBytes = 0
    const failedRequests: BrowserMeasurement['failedRequests'] = []
    const consoleErrors: string[] = []
    const pageErrors: string[] = []

    page.on('request', () => {
      requests++
    })
    page.on('requestfinished', async (req) => {
      const sizes = await req.sizes().catch(() => null)
      if (sizes) transferBytes += Math.max(0, sizes.responseBodySize) + Math.max(0, sizes.responseHeadersSize)
    })
    page.on('requestfailed', (req) => {
      const reason = req.failure()?.errorText ?? 'failed'
      if (reason.includes('ERR_ABORTED') || reason.includes('BLOCKED_BY_CLIENT')) return
      if (failedRequests.length < 50) failedRequests.push({ url: clip(req.url(), 160), reason })
    })
    page.on('response', (res) => {
      if (res.status() >= 400 && res.request().resourceType() !== 'document' && failedRequests.length < 50) {
        failedRequests.push({ url: clip(res.url(), 160), reason: `HTTP ${res.status()}` })
      }
    })
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.startsWith('Failed to load resource')) return // already counted as a failed request
      if (consoleErrors.length < 30) consoleErrors.push(clip(text, 200))
    })
    page.on('pageerror', (err) => {
      if (pageErrors.length < 30) pageErrors.push(clip(err.message, 200))
    })

    let status: number | null = null
    try {
      // Wait only for the first response, so a slow connection to a far-away server does not cost the whole reading
      const resp = await page.goto(url, { waitUntil: 'commit', timeout: 45_000 })
      status = resp?.status() ?? null
    } catch (e) {
      const first = e instanceof Error ? e.message.split('\n')[0] : undefined
      throw new Error(first ?? 'The page could not be loaded')
    }
    const contentLoaded = await page
      .waitForLoadState('domcontentloaded', { timeout: 60_000 })
      .then(() => true, () => false)
    const loaded = contentLoaded
      ? await page.waitForLoadState('load', { timeout: 15_000 }).then(() => true, () => false)
      : false
    if (contentLoaded) await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined)
    await page.waitForTimeout(1_500)

    const probe = (await page.evaluate(PAGE_SCRIPT)) as PageProbe
    const viewport = page.viewportSize() ?? { width: probe.clientWidth, height: 0 }

    let screenshotPath: string | null = null
    if (opts.screenshotName) {
      const dir = screenshotDir()
      await mkdir(dir, { recursive: true })
      const file = join(dir, `${opts.screenshotName.toLowerCase().replace(/[^a-z0-9._-]/g, '_')}.jpg`)
      await page.screenshot({ path: file, type: 'jpeg', quality: 70 })
      screenshotPath = file
    }

    return {
      url,
      finalUrl: probe.finalUrl,
      status,
      loaded,
      contentLoaded,
      viewport,
      layoutWidth: probe.clientWidth,
      lcpMs: probe.lcp === null ? null : Math.round(probe.lcp),
      cls: Math.round(probe.cls * 1000) / 1000,
      domContentLoadedMs: probe.dcl,
      loadMs: loaded && probe.load ? probe.load : null,
      requests,
      transferBytes,
      failedRequests,
      consoleErrors,
      pageErrors,
      overflow: {
        pixels: Math.max(0, probe.scrollWidth - probe.clientWidth),
        scrollable: probe.scrollable,
        offenders: probe.offenders,
      },
      textChars: probe.textChars,
      textSample: probe.textSample,
      screenshotPath,
      durationMs: Date.now() - started,
    }
  } finally {
    clearTimeout(killer)
    await browser.close().catch(() => undefined)
  }
}