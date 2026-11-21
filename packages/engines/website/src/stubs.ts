import { readSnapshot } from '@meridian/crawl'
import { createDb, sql } from '@meridian/db'
import { detectPlaceholder } from './placeholder'

const { db, pool } = createDb()
try {
  const res = await db.execute(sql`
    select distinct on (s.website_id) w.domain, s.final_url, s.bytes, s.storage_path
    from page_snapshots s join websites w on w.id = s.website_id
    order by s.website_id, length(s.final_url), s.fetched_at desc`)
  const rows = res.rows as { domain: string; final_url: string; bytes: number; storage_path: string }[]
  const show = process.argv.slice(2)
  for (const r of rows.filter((x) => show.includes(x.domain))) {
    console.log(`\n${r.domain}  ${r.final_url}  ${r.bytes} bytes`)
    console.log((await readSnapshot(r.storage_path)).slice(0, 1200))
  }
  const hits: { domain: string; kind: string; bytes: number; detail: string }[] = []
  for (const r of rows) {
    try {
      const found = detectPlaceholder(await readSnapshot(r.storage_path), r.bytes)
      if (found) hits.push({ domain: r.domain, kind: found.kind, bytes: r.bytes, detail: found.detail.slice(0, 90) })
    } catch {
      /* unreadable snapshot: skip */
    }
  }
  console.log(`${rows.length} sites checked, ${hits.length} flagged`)
  console.table(hits)
} finally {
  await pool.end()
}