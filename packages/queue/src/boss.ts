import { PgBoss } from 'pg-boss'

export type BossRole = 'worker' | 'client'

export function createBoss(connectionString: string, role: BossRole) {
  return new PgBoss({
    connectionString,
    max: role === 'worker' ? 5 : 2,
    supervise: role === 'worker',
    schedule: role === 'worker',
  })
}

export type Boss = ReturnType<typeof createBoss>