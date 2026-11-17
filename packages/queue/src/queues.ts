import { QUEUES } from '@meridian/shared'
import type { Boss } from './boss'

export async function ensureQueues(boss: Boss): Promise<void> {
  await boss.createQueue(QUEUES.systemPing, {
    retryLimit: 2,
    retryDelay: 5,
    expireInSeconds: 60,
  })
  await boss.createQueue(QUEUES.discoverySearch, {
    retryLimit: 1,
    retryDelay: 60,
    expireInSeconds: 900,
  })
}