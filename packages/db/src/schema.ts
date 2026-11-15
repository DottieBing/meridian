import {
  boolean,
  customType,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001'

const citext = customType<{ data: string }>({ dataType: () => 'citext' })
const ts = (name: string) => timestamp(name, { withTimezone: true })
const pk = () => uuid('id').primaryKey().defaultRandom()

// ---------------------------------------------------------------- workspaces
export const workspaces = pgTable('workspaces', {
  id: pk(),
  name: text('name').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
})

const workspaceId = () =>
  uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' })

// ------------------------------------------------- source records (immutable)
// Raw data exactly as a provider returned it. Never edited, only added.
export const sourceRecords = pgTable(
  'source_records',
  {
    id: pk(),
    workspaceId: workspaceId(),
    provider: text('provider').notNull(), // 'osm', 'website_crawl', ...
    providerRef: text('provider_ref'), // the provider's own id for the record
    url: text('url'),
    payload: jsonb('payload').notNull(),
    contentHash: text('content_hash').notNull(),
    fetchedAt: ts('fetched_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('source_records_dedupe_uq').on(
      t.workspaceId,
      t.provider,
      t.providerRef,
      t.contentHash,
    ),
    index('source_records_provider_idx').on(t.workspaceId, t.provider),
  ],
)

// ---------------------------------------------------------------- businesses
export const businesses = pgTable(
  'businesses',
  {
    id: pk(),
    workspaceId: workspaceId(),
    name: text('name').notNull(),
    normalizedName: text('normalized_name').notNull(),
    industry: text('industry'),
    niche: text('niche'),
    countryCode: text('country_code'),
    status: text('status').notNull().default('discovered'),
    isStale: boolean('is_stale').notNull().default(false),
    firstSeenAt: ts('first_seen_at').notNull().defaultNow(),
    lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('businesses_ws_status_idx').on(t.workspaceId, t.status),
    index('businesses_ws_country_idx').on(t.workspaceId, t.countryCode),
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
    address: text('address'),
    city: text('city'),
    region: text('region'),
    countryCode: text('country_code'),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('business_locations_business_idx').on(t.businessId)],
)

// Links a business to every source record that mentioned it.
// This is how deduplication keeps conflicting data instead of discarding it.
export const businessSources = pgTable(
  'business_sources',
  {
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    sourceRecordId: uuid('source_record_id')
      .notNull()
      .references(() => sourceRecords.id, { onDelete: 'cascade' }),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.sourceRecordId] })],
)

// ------------------------------------------------------------------ websites
export const websites = pgTable(
  'websites',
  {
    id: pk(),
    workspaceId: workspaceId(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    domain: text('domain').notNull(),
    isPrimary: boolean('is_primary').notNull().default(true),
    cms: text('cms'),
    isStale: boolean('is_stale').notNull().default(false),
    firstSeenAt: ts('first_seen_at').notNull().defaultNow(),
    lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
  },
  (t) => [
    unique('websites_business_domain_uq').on(t.businessId, t.domain),
    index('websites_domain_idx').on(t.domain),
  ],
)

// ------------------------------------------------------------------ evidence
// Every contact, finding and claim points at one of these.
export const evidence = pgTable(
  'evidence',
  {
    id: pk(),
    workspaceId: workspaceId(),
    kind: text('kind').notNull(), // 'page', 'measurement', 'screenshot', 'dns', 'registry'
    url: text('url'),
    method: text('method').notNull(), // how it was obtained, e.g. 'html_parse@1'
    excerpt: text('excerpt'),
    screenshotPath: text('screenshot_path'),
    contentHash: text('content_hash'),
    data: jsonb('data'),
    capturedAt: ts('captured_at').notNull().defaultNow(),
  },
  (t) => [index('evidence_ws_kind_idx').on(t.workspaceId, t.kind)],
)

// ------------------------------------------------------------ contact points
export const contactPoints = pgTable(
  'contact_points',
  {
    id: pk(),
    workspaceId: workspaceId(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'email', 'phone', 'social', 'form', 'address'
    value: text('value').notNull(),
    normalizedValue: text('normalized_value').notNull(),
    classification: text('classification'), // 'business', 'personal', 'role' (info@, sales@) ...
    confidence: real('confidence'), // 0..1, only set when evidence supports it
    validation: jsonb('validation'), // syntax / DNS / MX results. Never "verified" by itself.
    evidenceId: uuid('evidence_id').references(() => evidence.id, { onDelete: 'set null' }),
    isStale: boolean('is_stale').notNull().default(false),
    firstSeenAt: ts('first_seen_at').notNull().defaultNow(),
    lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
  },
  (t) => [
    unique('contact_points_business_value_uq').on(t.businessId, t.type, t.normalizedValue),
    index('contact_points_ws_type_idx').on(t.workspaceId, t.type),
  ],
)

// ------------------------------------------------- investigations (snapshots)
export const investigations = pgTable(
  'investigations',
  {
    id: pk(),
    workspaceId: workspaceId(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    websiteId: uuid('website_id').references(() => websites.id, { onDelete: 'set null' }),
    kind: text('kind').notNull(), // 'contact', 'website', 'full'
    status: text('status').notNull().default('queued'),
    methodVersion: text('method_version').notNull(),
    summary: jsonb('summary'),
    error: text('error'),
    startedAt: ts('started_at'),
    finishedAt: ts('finished_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('investigations_business_idx').on(t.businessId, t.createdAt)],
)

export const findings = pgTable(
  'findings',
  {
    id: pk(),
    investigationId: uuid('investigation_id')
      .notNull()
      .references(() => investigations.id, { onDelete: 'cascade' }),
    category: text('category').notNull(), // 'performance', 'seo', 'ux', 'technical', 'ecommerce'
    code: text('code').notNull(), // stable id, e.g. 'seo.meta_description.missing'
    severity: text('severity').notNull(), // 'info', 'low', 'medium', 'high', 'critical'
    isObjective: boolean('is_objective').notNull(), // measured fact vs subjective assessment
    title: text('title').notNull(),
    detail: text('detail'),
    affectedUrl: text('affected_url'),
    evidenceId: uuid('evidence_id').references(() => evidence.id, { onDelete: 'set null' }),
    confidence: real('confidence'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('findings_investigation_idx').on(t.investigationId),
    index('findings_code_idx').on(t.code),
  ],
)

// -------------------------------------------------------------- suppressions
// Hard gate: drafting and sending must check this before anything else.
export const suppressions = pgTable(
  'suppressions',
  {
    id: pk(),
    workspaceId: workspaceId(),
    kind: text('kind').notNull(), // 'email', 'domain', 'phone'
    value: citext('value').notNull(),
    reason: text('reason').notNull(), // 'opt_out', 'bounce', 'complaint', 'manual'
    note: text('note'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [unique('suppressions_ws_kind_value_uq').on(t.workspaceId, t.kind, t.value)],
)
