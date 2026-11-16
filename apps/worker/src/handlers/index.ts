import type { Boss } from '@meridian/queue'
import type { Logger } from '../logger'
import { registerPing } from './ping'

export async function registerHandlers(boss: Boss, log: Logger): Promise<void> {
  await registerPing(boss, log)
}