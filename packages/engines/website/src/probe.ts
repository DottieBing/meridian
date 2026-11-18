import { createDb, eq, websites } from '@meridian/db'
import { runRules } from './audit'
import { clip } from './helpers'
import { buildContext, loadPages } from './context'

const domain = process.argv[2]?.toLowerCase().replace(/^www\./, '')
if (!domain) {
  console.error('Usage: pnpm --filter @meridian/website probe <domain>')
  process.exit(1)
}

const { db, pool } = createDb()
try {
  const [site] = await db.select().from(websites).where(eq(websites.domain, domain)).limit(1)
  if (!site) {
    console.error(`No website with domain ${domain}`)
  } else {
    const pages = await loadPages(db, site.id)
    const ctx = buildContext(site.url, pages, {
      robots: null,
      sitemap: { found: false, url: null, checked: [], inconclusive: true },
    })
    if (!ctx) {
      console.error('No stored snapshots for this site yet. Run a contact scan first.')
    } else {
      const { findings, errors } = runRules(ctx)
      console.log(`Main page: ${ctx.home.url} | pages audited: ${ctx.pages.length} (robots.txt and sitemap rules skipped in probe)`)
      console.table(
        findings.map((f) => ({
          severity: f.severity,
          code: f.code,
          objective: f.isObjective,
          title: clip(f.title, 70),
        })),
      )
      if (errors.length > 0) console.log('Rule errors:', errors)
    }
  }
} finally {
  await pool.end()
}