import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createdAt, pk } from './columns'
import type { DiscoveryRunStatus } from './enums'
import { workspaces } from './workspaces'

export const discoveryRuns = pgTable(
  'discovery_runs',
  {
    id: pk(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    jobId: text('job_id'),
    provider: text('provider').notNull().default('osm'),
    preset: text('preset').notNull(),
    countryCode: text('country_code'),
    city: text('city'),
    useCache: boolean('use_cache').notNull().default(true),
    status: text('status').$type<DiscoveryRunStatus>().notNull().default('queued'),
    attempts: integer('attempts').notNull().default(0),
    summary: jsonb('summary').$type<Record<string, unknown>>(),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('discovery_runs_ws_created_idx').on(t.workspaceId, t.createdAt)],
)