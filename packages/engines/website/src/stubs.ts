import { readSnapshot } from '@meridian/crawl'
import { createDb, sql } from '@meridian/db'
import { detectPlaceholder, visibleText } from './placeholder'

const args = process.argv.slice(2)
const wantShells = args.includes('--shells')
const show = args.filter((a) => !a.startsWith('--'))

const { db, pool } = createDb()
try {
  const res = await db.execute(sql`
    select distinct on (s.website_id) w.domain, s.final_url, s.bytes, s.storage_path,
      (select i.summary->>'outcome' from investigations i
        where i.website_id = s.website_id and i.kind = 'website_audit' and i.status = 'completed'
        order by i.created_at desc limit 1) as outcome
    from page_snapshots s join websites w on w.id = s.website_id
    order by s.website_id, length(s.final_url), s.fetched_at desc`)
  const rows = res.rows as { domain: string; final_url: string; bytes: number; storage_path: string; outcome: string | null }[]

  const flagged: { domain: string; kind: string; bytes: number; detail: string }[] = []
  const shells: { domain: string; audit: string | null; bytes: number; text_chars: number; looks_like: string }[] = []

  for (const r of rows) {
    let html: string
    try {
      html = await readSnapshot(r.storage_path)
    } catch {
      continue // unreadable snapshot
    }
    if (show.includes(r.domain)) {
      console.log(`\n${r.domain}  ${r.final_url}  ${r.bytes} bytes`)
      console.log(html.slice(0, 1200))
    }
    const found = detectPlaceholder(html, r.bytes)
    if (found) {
      flagged.push({ domain: r.domain, kind: found.kind, bytes: r.bytes, detail: found.detail.slice(0, 90) })
      continue
    }
    if (wantShells) {
      const text = visibleText(html)
      if (text.length < 300 && r.bytes >= 1500) {
        const looksLike = /<app-root|ng-version/i.test(html)
          ? 'Angular'
          : /id=["']__next["']|__NEXT_DATA__/i.test(html)
            ? 'Next.js'
            : /id=["']__nuxt["']|__NUXT__/i.test(html)
              ? 'Nuxt'
              : /id=["'](?:root|app)["']/i.test(html)
                ? 'script app (React/Vue)'
                : ''
        shells.push({ domain: r.domain, audit: r.outcome, bytes: r.bytes, text_chars: text.length, looks_like: looksLike })
      }
    }
  }

  console.log(`${rows.length} sites checked, ${flagged.length} flagged as not real websites`)
  console.table(flagged)
  if (wantShells) {
    console.log(`${shells.length} pages show almost no text without running scripts`)
    console.table(shells)
  }
} finally {
  await pool.end()
}