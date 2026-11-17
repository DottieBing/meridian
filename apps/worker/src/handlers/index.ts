import type { Db } from '@meridian/db'
import type { Boss } from '@meridian/queue'
import type { Logger } from '../logger'
import { registerDiscovery } from './discovery'
import { registerPing } from './ping'

export async function registerHandlers(boss: Boss, log: Logger, db: Db): Promise<void> {
  await registerPing(boss, log)
  await registerDiscovery(boss, db, log)
}