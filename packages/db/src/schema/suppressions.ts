import { pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { createdAt, pk } from './columns'
import type { SuppressionType } from './enums'
import { workspaces } from './workspaces'

export const suppressions = pgTable(
  'suppressions',
  {
    id: pk(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    type: text('type').$type<SuppressionType>().notNull(),
    value: text('value').notNull(),
    reason: text('reason'),
    source: text('source'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('suppressions_uq').on(t.workspaceId, t.type, t.value)],
)