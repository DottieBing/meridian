import type { Db } from '@meridian/db'
import type { Boss } from '@meridian/queue'
import { QUEUES, browserAuditPayload } from '@meridian/shared'
import { failBrowserAudit, runBrowserAudit } from '@meridian/website'
import type { Logger } from '../logger'

export async function registerBrowser(boss: Boss, db: Db, log: Logger): Promise<void> {
  // One browser at a time: Chromium is heavy, and a mobile check is a deliberate, small batch.
  await boss.work(QUEUES.browserAudit, async (jobs) => {
    const out: unknown[] = []
    for (const job of jobs) {
      const parsed = browserAuditPayload.safeParse(job.data)
      if (!parsed.success) {
        log.error(`mobile check ${job.id}: invalid payload`)
        out.push({ ok: false, error: 'invalid payload' })
        continue
      }
      const { investigationId } = parsed.data
      try {
        const s = await runBrowserAudit(db, investigationId, (m) => log.info(m))
        log.info(`mobile check ${investigationId} finished: ${String(s['outcome'])}, ${String(s['findings'] ?? 0)} findings`)
        out.push({ ok: true, investigationId, outcome: s['outcome'] })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        log.error(`mobile check ${investigationId} failed: ${message}`)
        await failBrowserAudit(db, investigationId, message).catch(() => undefined)
        out.push({ ok: false, investigationId, error: message })
      }
    }
    return out
  })
}