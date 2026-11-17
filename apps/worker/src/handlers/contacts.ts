import { failScan, runContactScan } from '@meridian/contacts'
import type { Db } from '@meridian/db'
import type { Boss } from '@meridian/queue'
import { QUEUES, contactScanPayload } from '@meridian/shared'
import type { Logger } from '../logger'

export async function registerContacts(boss: Boss, db: Db, log: Logger): Promise<void> {
  // Up to 3 websites at once. Each scan paces its own requests per domain.
  await boss.work(QUEUES.contactScan, { batchSize: 3 }, async (jobs) => {
    const results = await Promise.all(
      jobs.map(async (job) => {
        const parsed = contactScanPayload.safeParse(job.data)
        if (!parsed.success) {
          log.error(`contact scan ${job.id}: invalid payload`)
          return { ok: false, error: 'invalid payload' }
        }
        const { investigationId } = parsed.data
        try {
          const s = await runContactScan(db, investigationId, (m) => log.info(m))
          log.info(`contact scan ${investigationId} finished: ${String(s['outcome'])}, ${String(s['newContacts'] ?? 0)} new contacts`)
          return { ok: true, investigationId, outcome: s['outcome'] }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          log.error(`contact scan ${investigationId} failed: ${message}`)
          await failScan(db, investigationId, message).catch(() => undefined)
          return { ok: false, investigationId, error: message }
        }
      }),
    )
    return results
  })
}