import { desc, discoveryRuns, eq, sql, type Db } from '@meridian/db'
import type { DiscoverySummary } from './run'

export type RunRequest = {
  workspaceId: string
  preset: string
  countryCode?: string | undefined
  city?: string | undefined
  useCache: boolean
}

export async function createRun(db: Db, r: RunRequest): Promise<string> {
  const [row] = await db
    .insert(discoveryRuns)
    .values({
      workspaceId: r.workspaceId,
      preset: r.preset,
      countryCode: r.countryCode?.toUpperCase() ?? null,
      city: r.city ?? null,
      useCache: r.useCache,
    })
    .returning({ id: discoveryRuns.id })
  if (!row) throw new Error('discovery run insert returned no row')
  return row.id
}

export async function attachJob(db: Db, runId: string, jobId: string): Promise<void> {
  await db.update(discoveryRuns).set({ jobId }).where(eq(discoveryRuns.id, runId))
}

export async function markRunning(db: Db, runId: string, jobId: string): Promise<void> {
  await db
    .update(discoveryRuns)
    .set({
      status: 'running',
      jobId,
      attempts: sql`${discoveryRuns.attempts} + 1`,
      startedAt: new Date(),
      finishedAt: null,
      error: null,
    })
    .where(eq(discoveryRuns.id, runId))
}

export async function markCompleted(db: Db, runId: string, summary: DiscoverySummary): Promise<void> {
  await db
    .update(discoveryRuns)
    .set({ status: 'completed', summary, error: null, finishedAt: new Date() })
    .where(eq(discoveryRuns.id, runId))
}

export async function markFailed(db: Db, runId: string, error: string): Promise<void> {
  await db
    .update(discoveryRuns)
    .set({ status: 'failed', error: error.slice(0, 2000), finishedAt: new Date() })
    .where(eq(discoveryRuns.id, runId))
}

export async function listRuns(db: Db, opts: { limit: number; offset: number }) {
  return db
    .select()
    .from(discoveryRuns)
    .orderBy(desc(discoveryRuns.createdAt))
    .limit(opts.limit)
    .offset(opts.offset)
}

export async function getRun(db: Db, id: string) {
  const [row] = await db.select().from(discoveryRuns).where(eq(discoveryRuns.id, id)).limit(1)
  return row ?? null
}