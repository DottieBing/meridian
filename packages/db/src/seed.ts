import { eq } from 'drizzle-orm'
import { createDb } from './client'
import { workspaces } from './schema'

const { db, pool } = createDb()
const name = 'Default'

const existing = await db.select().from(workspaces).where(eq(workspaces.name, name)).limit(1)

if (existing.length === 0) {
  const [row] = await db.insert(workspaces).values({ name }).returning()
  console.log('Created workspace:', row?.id)
} else {
  console.log('Workspace already exists:', existing[0]?.id)
}

await pool.end()