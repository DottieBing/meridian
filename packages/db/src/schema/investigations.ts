import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { businesses } from './businesses'
import { createdAt, pk } from './columns'
import type { InvestigationKind, InvestigationStatus } from './enums'
import { websites } from './websites'
import { workspaces } from './workspaces'

export type ScoreMap = Record<string, { value: number; method: string }>

export const investigations = pgTable(
  'investigations',
  {
    id: pk(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    websiteId: uuid('website_id').references(() => websites.id, { onDelete: 'set null' }),
    kind: text('kind').$type<InvestigationKind>().notNull(),
    status: text('status').$type<InvestigationStatus>().notNull().default('queued'),
    methodVersion: text('method_version').notNull(),
    scores: jsonb('scores').$type<ScoreMap>(),
    summary: jsonb('summary').$type<Record<string, unknown>>(),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('investigations_business_kind_idx').on(t.businessId, t.kind, t.createdAt),
    index('investigations_ws_status_idx').on(t.workspaceId, t.status),
  ],
)