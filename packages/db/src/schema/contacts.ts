import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { businesses } from './businesses'
import { createdAt, pk } from './columns'
import type { ContactClass, ContactRole, ContactType } from './enums'
import { evidence } from './evidence'
import { websites } from './websites'
import { workspaces } from './workspaces'

export type ContactValidation = {
  syntaxValid?: boolean
  domainResolves?: boolean
  hasMx?: boolean | null
  checkedAt?: string
}

export const contactPoints = pgTable(
  'contact_points',
  {
    id: pk(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    websiteId: uuid('website_id').references(() => websites.id, { onDelete: 'set null' }),
    type: text('type').$type<ContactType>().notNull(),
    value: text('value').notNull(),
    normalizedValue: text('normalized_value').notNull(),
    classification: text('classification').$type<ContactClass>().notNull().default('unknown'),
    role: text('role').$type<ContactRole>(),
    validation: jsonb('validation').$type<ContactValidation>(),
    confidence: integer('confidence').notNull().default(0),
    evidenceId: uuid('evidence_id')
      .notNull()
      .references(() => evidence.id, { onDelete: 'restrict' }),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    staleAt: timestamp('stale_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('contact_points_uq').on(t.workspaceId, t.businessId, t.type, t.normalizedValue),
    index('contact_points_business_idx').on(t.businessId),
    index('contact_points_lookup_idx').on(t.workspaceId, t.type, t.normalizedValue),
  ],
)