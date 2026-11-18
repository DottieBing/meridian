import { failScan, runContactScan } from '@meridian/contacts'
import { and, eq, inArray, investigations, type Db } from '@meridian/db'
import type { Boss } from '@meridian/queue'
import { QUEUES, contactScanPayload } from '@meridian/shared'
import { createWebsiteAudit, failAudit } from '@meridian/website'
import type { Logger } from '../logger'

// An audit follows a scan when the site answered (even with a TLS error, which the audit reports on).
const CHAIN_OUTCOMES = new Set(['ok', 'no_contacts', 'unreachable'])

async function chainAudit(boss: Boss, db: Db, scanId: string, log: Logger): Promise<void> {
  const [scan] = await db.select().from(investigations).where(eq(investigations.id, scanId)).limit(1)
  if (!scan?.websiteId) return
  const [active] = await db
    .select({ id: investigations.id })
    .from(investigations)
    .where(
      and(
        eq(investigations.websiteId, scan.websiteId),
        eq(investigations.kind, 'website_audit'),
        inArray(investigations.status, ['queued', 'running']),
      ),
    )
    .limit(1)
  if (active) return
  const auditId = await createWebsiteAudit(db, {
    workspaceId: scan.workspaceId,
    businessId: scan.businessId,
    websiteId: scan.websiteId,
  })
  const jobId = await boss.send(QUEUES.websiteAudit, { investigationId: auditId })
  if (!jobId) {
    await failAudit(db, auditId, 'The queue did not create a job')
    return
  }
  log.info(`queued website audit ${auditId} after contact scan ${scanId}`)
}

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
        const { investigationId, thenAudit } = parsed.data
        try {
          const s = await runContactScan(db, investigationId, (m) => log.info(m))
          log.info(`contact scan ${investigationId} finished: ${String(s['outcome'])}, ${String(s['newContacts'] ?? 0)} new contacts`)
          if (thenAudit && CHAIN_OUTCOMES.has(String(s['outcome']))) {
            await chainAudit(boss, db, investigationId, log).catch((e) =>
              log.error(`could not chain audit: ${e instanceof Error ? e.message : String(e)}`),
            )
          }
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