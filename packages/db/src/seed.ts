import { createDb } from './client'
import { DEFAULT_WORKSPACE_ID, workspaces } from './schema'

const { db, pool } = createDb()

await db
  .insert(workspaces)
  .values({ id: DEFAULT_WORKSPACE_ID, name: 'Zeno Studio' })
  .onConflictDoNothing()

console.log('Seed complete')
await pool.end()