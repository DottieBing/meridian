import { createDb, pingDb } from '@meridian/db'
import { loadConfig } from '@meridian/shared'
import { buildApp } from './app'

let config: ReturnType<typeof loadConfig>
try {
  config = loadConfig()
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
}

const { db, pool } = createDb(config.DATABASE_URL)
const app = await buildApp({ config, db, checkDb: () => pingDb(pool) })

app.addHook('onClose', async () => {
  await pool.end()
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, 'shutting down')
    void app.close().then(() => process.exit(0))
  })
}

try {
  await app.listen({ port: config.API_PORT, host: '127.0.0.1' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}