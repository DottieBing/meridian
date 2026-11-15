import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { businesses } from './businesses'
import { createdAt, pk } from './columns'
import type { WebsiteStatus } from './enums'
import { workspaces } from './workspaces'

export const websites = pgTable(
  'websites',
  {
    id: pk(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    domain: text('domain').notNull(),
    isPrimary: boolean('is_primary').notNull().default(true),
    status: text('status').$type<WebsiteStatus>().notNull().default('active'),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('websites_ws_domain_uq').on(t.workspaceId, t.domain),
    index('websites_business_idx').on(t.businessId),
  ],
)