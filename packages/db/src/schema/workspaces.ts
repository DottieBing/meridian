import { pgTable, text } from 'drizzle-orm/pg-core'
import { createdAt, pk } from './columns'

export const workspaces = pgTable('workspaces', {
  id: pk(),
  name: text('name').notNull(),
  createdAt: createdAt(),
})