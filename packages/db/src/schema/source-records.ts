import {
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { businesses } from './businesses'
import { createdAt, pk } from './columns'
import { workspaces } from './workspaces'

export const sourceRecords = pgTable(
  'source_records',
  {
    id: pk(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    externalId: text('external_id').notNull(),
    url: text('url'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    contentHash: text('content_hash').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('source_records_uq').on(t.workspaceId, t.provider, t.externalId, t.contentHash),
    index('source_records_provider_idx').on(t.workspaceId, t.provider),
  ],
)

export const businessSources = pgTable(
  'business_sources',
  {
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    sourceRecordId: uuid('source_record_id')
      .notNull()
      .references(() => sourceRecords.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.sourceRecordId] })],
)