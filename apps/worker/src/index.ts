import { createDb } from '@meridian/db'
import { createBoss, ensureQueues } from '@meridian/queue'
import { loadConfig } from '@meridian/shared'
import { registerHandlers } from './handlers'
import { createLogger } from './logger'

const log = createLogger('worker')

let config: ReturnType<typeof loadConfig>
try {
  config = loadConfig()
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
}

const { db, pool } = createDb(config.DATABASE_URL)
const boss = createBoss(config.DATABASE_URL, 'worker')
boss.on('error', (err) => log.error('queue error', err))

await boss.start()
await ensureQueues(boss)
await registerHandlers(boss, log, db)
log.info('worker ready, waiting for jobs')

let stopping = false
async function shutdown(signal: string) {
  if (stopping) return
  stopping = true
  log.info(`${signal} received, finishing active jobs`)
  await boss.stop({ graceful: true, timeout: 30_000 })
  await pool.end()
  log.info('worker stopped')
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))