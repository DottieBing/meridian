import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'

export const BRAND_MODES = ['auto', 'own', 'cobrand', 'meridian'] as const
export type BrandMode = (typeof BRAND_MODES)[number]

export const reportSettings = pgTable('report_settings', {
  workspaceId: uuid('workspace_id')
    .primaryKey()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  orgName: text('org_name').notNull().default('Your Company Name'),
  contactLine: text('contact_line').notNull().default('you@example.com'),
  logoPath: text('logo_path'),
  brandMode: text('brand_mode').$type<BrandMode>().notNull().default('auto'),
  showMeridianCredit: boolean('show_meridian_credit').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})