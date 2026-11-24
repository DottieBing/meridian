import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'

export const reportSettings = pgTable('report_settings', {
  workspaceId: uuid('workspace_id')
    .primaryKey()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  orgName: text('org_name').notNull().default('Your Company Name'),
  contactLine: text('contact_line').notNull().default('you@example.com'),
  logoPath: text('logo_path'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})