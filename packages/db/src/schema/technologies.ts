import { index, integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { createdAt, pk } from './columns'
import type { TechCategory } from './enums'
import { evidence } from './evidence'
import { investigations } from './investigations'
import { websites } from './websites'
import { workspaces } from './workspaces'

export const websiteTechnologies = pgTable(
  'website_technologies',
  {
    id: pk(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    websiteId: uuid('website_id')
      .notNull()
      .references(() => websites.id, { onDelete: 'cascade' }),
    investigationId: uuid('investigation_id')
      .notNull()
      .references(() => investigations.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    category: text('category').$type<TechCategory>().notNull(),
    version: text('version'),
    versions: jsonb('versions').$type<string[]>().notNull(),
    detail: text('detail'),
    confidence: integer('confidence').notNull(),
    via: text('via').notNull(),
    evidenceId: uuid('evidence_id')
      .notNull()
      .references(() => evidence.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
  },
  (t) => [
    index('website_tech_investigation_idx').on(t.investigationId),
    index('website_tech_site_idx').on(t.websiteId),
    index('website_tech_slug_idx').on(t.slug),
  ],
)