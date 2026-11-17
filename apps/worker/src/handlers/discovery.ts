import type { Db } from '@meridian/db'
import {
  DiscoveryError, isPresetId, markCompleted, markFailed, markRunning, runDiscoverySearch,
} from '@meridian/discovery'
import type { Boss } from '@meridian/queue'
import { QUEUES, discoverySearchPayload } from '@meridian/shared'
import type { Logger } from '../logger'

const PERMANENT = new Set(['bad_input', 'area_not_found', 'query_error', 'parse'])

export async function registerDiscovery(boss: Boss, db: Db, log: Logger): Promise<void> {
  // One handler loop, batches of 1: Overpass searches run strictly one at a time
  await boss.work(QUEUES.discoverySearch, async (jobs) => {
    const results: unknown[] = []
    for (const job of jobs) {
      const payload = discoverySearchPayload.parse(job.data)
      const { runId } = payload
      await markRunning(db, runId, job.id)

      if (!isPresetId(payload.preset)) {
        const error = `Unknown preset "${payload.preset}"`
        log.error(`discovery ${job.id}: ${error}`)
        await markFailed(db, runId, error)
        results.push({ ok: false, error })
        continue
      }

      log.info(`discovery ${job.id} started: ${payload.preset} in ${payload.city ?? payload.countryCode}`)
      try {
        const summary = await runDiscoverySearch(
          db,
          {
            workspaceId: payload.workspaceId,
            preset: payload.preset,
            useCache: payload.useCache,
            ...(payload.countryCode ? { countryCode: payload.countryCode } : {}),
            ...(payload.city ? { city: payload.city } : {}),
          },
          (m) => log.info(m),
        )
        await markCompleted(db, runId, summary)
        log.info(
          `discovery ${job.id} finished: ${summary.created} created, ${summary.merged} merged, ` +
            `${summary.unchanged} unchanged, ${summary.errors} errors`,
        )
        results.push({ ok: true, ...summary })
      } catch (err) {
        const kind = err instanceof DiscoveryError ? err.kind : 'unexpected'
        const message = err instanceof Error ? err.message : String(err)
        await markFailed(db, runId, `[${kind}] ${message}`)
        if (err instanceof DiscoveryError && PERMANENT.has(err.kind)) {
          log.error(`discovery ${job.id} failed permanently [${err.kind}]: ${err.message}`)
          results.push({ ok: false, kind: err.kind, error: err.message })
        } else {
          throw err // transient: let the queue retry
        }
      }
    }
    return results.length === 1 ? results[0] : results
  })
}