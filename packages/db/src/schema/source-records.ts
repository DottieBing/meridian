import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { businesses } from './businesses'
import { pk } from './columns'
import { workspaces } from './workspaces'

export const sourceRecords = pgTable(
  'source_records',
  {
    id: pk(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    businessId: uuid('business_id').references(() => businesses.id, { onDelete: 'set null' }),
    provider: text('provider').notNull(),
    externalId: text('external_id').notNull(),
    url: text('url'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    contentHash: text('content_hash').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('source_records_uq').on(t.workspaceId, t.provider, t.externalId, t.contentHash),
    index('source_records_business_idx').on(t.businessId),
  ],
)