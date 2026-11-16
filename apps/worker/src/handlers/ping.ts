import type { Boss } from '@meridian/queue'
import { QUEUES, pingPayload } from '@meridian/shared'
import type { Logger } from '../logger'

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export async function registerPing(boss: Boss, log: Logger): Promise<void> {
  await boss.work(QUEUES.systemPing, async (jobs) => {
    for (const job of jobs) {
      const payload = pingPayload.parse(job.data)
      log.info(`ping ${job.id} started: "${payload.message}"`)
      if (payload.delayMs > 0) await sleep(payload.delayMs)
      log.info(`ping ${job.id} finished`)
    }
  })
}