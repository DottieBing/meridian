import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createdAt, pk } from './columns'
import { websites } from './websites'
import { workspaces } from './workspaces'

export type RedirectHop = { url: string; status: number }

export const pageSnapshots = pgTable(
  'page_snapshots',
  {
    id: pk(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    websiteId: uuid('website_id')
      .notNull()
      .references(() => websites.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    finalUrl: text('final_url').notNull(),
    status: integer('status').notNull(),
    contentType: text('content_type'),
    bytes: integer('bytes').notNull(),
    truncated: boolean('truncated').notNull().default(false),
    contentHash: text('content_hash').notNull(),
    storagePath: text('storage_path').notNull(),
    headers: jsonb('headers').$type<Record<string, string>>().notNull(),
    redirects: jsonb('redirects').$type<RedirectHop[]>().notNull(),
    ttfbMs: integer('ttfb_ms'),
    totalMs: integer('total_ms'),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [
    index('page_snapshots_site_url_idx').on(t.websiteId, t.finalUrl, t.fetchedAt),
    index('page_snapshots_hash_idx').on(t.contentHash),
  ],
)