import { doublePrecision, boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createdAt, pk, updatedAt } from './columns'
import type { LeadStatus } from './enums'
import { workspaces } from './workspaces'

export const businesses = pgTable(
  'businesses',
  {
    id: pk(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    normalizedName: text('normalized_name').notNull(),
    industry: text('industry'),
    niche: text('niche'),
    countryCode: text('country_code'),
    region: text('region'),
    city: text('city'),
    status: text('status').$type<LeadStatus>().notNull().default('discovered'),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    staleAt: timestamp('stale_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('businesses_ws_status_idx').on(t.workspaceId, t.status),
    index('businesses_ws_country_industry_idx').on(t.workspaceId, t.countryCode, t.industry),
    index('businesses_ws_normalized_name_idx').on(t.workspaceId, t.normalizedName),
    index('businesses_name_trgm_idx').using('gin', t.normalizedName.op('gin_trgm_ops')),
  ],
)

export const businessLocations = pgTable(
  'business_locations',
  {
    id: pk(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    addressLine: text('address_line'),
    city: text('city'),
    region: text('region'),
    postalCode: text('postal_code'),
    countryCode: text('country_code'),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('business_locations_business_idx').on(t.businessId)],
)