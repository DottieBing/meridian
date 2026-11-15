import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createdAt, pk } from './columns'
import type { EvidenceKind } from './enums'
import { workspaces } from './workspaces'

export const evidence = pgTable(
  'evidence',
  {
    id: pk(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<EvidenceKind>().notNull(),
    sourceUrl: text('source_url'),
    method: text('method').notNull(),
    excerpt: text('excerpt'),
    contentHash: text('content_hash'),
    storagePath: text('storage_path'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [index('evidence_ws_kind_idx').on(t.workspaceId, t.kind)],
)