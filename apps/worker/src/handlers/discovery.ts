import type { Db } from '@meridian/db'
import { DiscoveryError, isPresetId, runDiscoverySearch } from '@meridian/discovery'
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
      if (!isPresetId(payload.preset)) {
        log.error(`discovery ${job.id}: unknown preset "${payload.preset}"`)
        results.push({ ok: false, error: `Unknown preset "${payload.preset}"` })
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
        log.info(
          `discovery ${job.id} finished: ${summary.created} created, ${summary.merged} merged, ` +
            `${summary.unchanged} unchanged, ${summary.errors} errors`,
        )
        results.push({ ok: true, ...summary })
      } catch (err) {
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