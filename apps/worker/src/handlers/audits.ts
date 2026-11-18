import type { Db } from '@meridian/db'
import type { Boss } from '@meridian/queue'
import { QUEUES, websiteAuditPayload } from '@meridian/shared'
import { failAudit, runWebsiteAudit } from '@meridian/website'
import type { Logger } from '../logger'

export async function registerAudits(boss: Boss, db: Db, log: Logger): Promise<void> {
  // Two audits at once: each paces its own requests per domain, and HTML parsing uses CPU.
  await boss.work(QUEUES.websiteAudit, { batchSize: 2 }, async (jobs) => {
    return Promise.all(
      jobs.map(async (job) => {
        const parsed = websiteAuditPayload.safeParse(job.data)
        if (!parsed.success) {
          log.error(`website audit ${job.id}: invalid payload`)
          return { ok: false, error: 'invalid payload' }
        }
        const { investigationId } = parsed.data
        try {
          const s = await runWebsiteAudit(db, investigationId, (m) => log.info(m))
          log.info(
            `website audit ${investigationId} finished: ${String(s['outcome'])}, ${String(s['findings'] ?? 0)} findings`,
          )
          return { ok: true, investigationId, outcome: s['outcome'] }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          log.error(`website audit ${investigationId} failed: ${message}`)
          await failAudit(db, investigationId, message).catch(() => undefined)
          return { ok: false, investigationId, error: message }
        }
      }),
    )
  })
}