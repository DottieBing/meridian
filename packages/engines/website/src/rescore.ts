import { and, createDb, eq, findings as findingRows, investigations } from '@meridian/db'
import { scoreFindings } from './scores'

const { db, pool } = createDb()
try {
  const runs = await db
    .select({ id: investigations.id, summary: investigations.summary })
    .from(investigations)
    .where(and(eq(investigations.kind, 'website_audit'), eq(investigations.status, 'completed')))
  let n = 0
  for (const run of runs) {
    if (!run.summary || run.summary['outcome'] !== 'ok') continue
    const rows = await db
      .select({
        code: findingRows.code,
        category: findingRows.category,
        severity: findingRows.severity,
        isObjective: findingRows.isObjective,
      })
      .from(findingRows)
      .where(eq(findingRows.investigationId, run.id))
    await db
      .update(investigations)
      .set({ summary: { ...run.summary, scores: scoreFindings(rows) } })
      .where(eq(investigations.id, run.id))
    n++
  }
  console.log(`Rescored ${n} audits with the current formula`)
} finally {
  await pool.end()
}