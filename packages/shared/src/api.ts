import { z } from 'zod'

const flag = z.enum(['true', 'false']).transform((v) => v === 'true')

const paging = {
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
}

export const pagingQuery = z.object(paging)

export const uuidParam = z.object({ id: z.string().uuid() })

export const businessListQuery = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  industry: z.string().max(60).optional(),
  niche: z.string().max(60).optional(),
  city: z.string().max(100).optional(),
  countryCode: z.string().length(2).optional(),
  hasWebsite: flag.optional(),
  hasEmail: flag.optional(),
  hasPhone: flag.optional(),
  contactable: flag.optional(),
  audited: flag.optional(),
  minSeverity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  sort: z.enum(['recent', 'issues']).default('recent'),
  ...paging,
})

export const businessExportQuery = businessListQuery.omit({ limit: true, offset: true })

export const contactScanRequest = z.object({ thenAudit: z.boolean().default(false) })

export const investigationListQuery = z.object({
  kind: z.enum(['contact_scan', 'website_audit', 'tech_detection', 'competitor_scan']).optional(),
  status: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']).optional(),
  businessId: z.string().uuid().optional(),
  ...paging,
})

export const bulkContactScanRequest = z.object({
  limit: z.number().int().min(1).max(500).default(25),
  industry: z.string().max(60).optional(),
  city: z.string().max(100).optional(),
  rescanAfterDays: z.number().int().min(1).max(365).default(30),
  thenAudit: z.boolean().default(false),
})

export const bulkWebsiteAuditRequest = z.object({
  limit: z.number().int().min(1).max(500).default(25),
  industry: z.string().max(60).optional(),
  city: z.string().max(100).optional(),
  auditAfterDays: z.number().int().min(0).max(365).default(30),
})