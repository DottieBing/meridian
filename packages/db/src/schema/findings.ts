import { boolean, index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { createdAt, pk } from './columns'
import type { FindingCategory, Severity } from './enums'
import { evidence } from './evidence'
import { investigations } from './investigations'

export const findings = pgTable(
  'findings',
  {
    id: pk(),
    investigationId: uuid('investigation_id')
      .notNull()
      .references(() => investigations.id, { onDelete: 'cascade' }),
    category: text('category').$type<FindingCategory>().notNull(),
    code: text('code').notNull(),
    severity: text('severity').$type<Severity>().notNull(),
    isObjective: boolean('is_objective').notNull(),
    title: text('title').notNull(),
    detail: text('detail'),
    affectedUrl: text('affected_url'),
    evidenceId: uuid('evidence_id')
      .notNull()
      .references(() => evidence.id, { onDelete: 'restrict' }),
    confidence: integer('confidence').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index('findings_investigation_idx').on(t.investigationId),
    index('findings_code_idx').on(t.code),
  ],
)