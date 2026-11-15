import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { fileURLToPath } from 'node:url'
import { createDb } from './client'

const { db, pool } = createDb()

await migrate(db, {
  migrationsFolder: fileURLToPath(new URL('../migrations', import.meta.url)),
})

console.log('Migrations applied')
await pool.end()