import { createDb, eq, websites } from '@meridian/db'
import { measureMobile, type BrowserMeasurement } from './measure'

const targets = process.argv.slice(2)
if (targets.length === 0) {
  console.error('Usage: pnpm --filter @meridian/website browser-probe <domain or https://url> [more ...]')
  process.exit(1)
}

const { db, pool } = createDb()
try {
  const results: { label: string; m: BrowserMeasurement }[] = []
  for (const target of targets) {
    let url = target
    if (!/^https?:\/\//i.test(target)) {
      const domain = target.toLowerCase().replace(/^www\./, '')
      const [site] = await db.select().from(websites).where(eq(websites.domain, domain)).limit(1)
      if (!site) {
        console.error(`No website with domain ${domain}`)
        continue
      }
      url = site.url
    }
    const label = new URL(url).hostname.replace(/^www\./, '')
    try {
      results.push({ label, m: await measureMobile(url, { screenshotName: label }) })
    } catch (e) {
      console.error(`${label}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  console.table(
    results.map(({ label, m }) => ({
      site: label,
      secs: Math.round(m.durationMs / 100) / 10,
      status: m.status,
      loaded: m.loaded,
      lcp_ms: m.lcpMs,
      cls: m.cls,
      load_ms: m.loadMs,
      requests: m.requests,
      mb: Math.round(m.transferBytes / 1e4) / 100,
      overflow_px: m.overflow.pixels,
      scrollable: m.overflow.scrollable,
      console_errors: m.consoleErrors.length + m.pageErrors.length,
      failed: m.failedRequests.length,
    })),
  )

  for (const { label, m } of results) {
    console.log(`\n${label}  ${m.finalUrl}`)
    if (m.overflow.offenders.length > 0) console.log('  overflow culprits:', m.overflow.offenders)
    for (const e of [...m.pageErrors, ...m.consoleErrors].slice(0, 3)) console.log('  error:', e)
    for (const f of m.failedRequests.slice(0, 3)) console.log('  failed:', f.reason, f.url)
    if (m.screenshotPath) console.log('  screenshot:', m.screenshotPath)
  }
} finally {
  await pool.end()
}