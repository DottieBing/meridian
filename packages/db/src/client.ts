import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

export function createDb(url: string | undefined = process.env.DATABASE_URL) {
  if (!url) throw new Error('DATABASE_URL is not set')
  const pool = new Pool({ connectionString: url, max: 10 })
  const db = drizzle({ client: pool })
  return { db, pool }
}

export type Db = ReturnType<typeof createDb>['db']