export const LEAD_STATUSES = [
  'discovered',
  'investigated',
  'qualified',
  'report_ready',
  'pitch_ready',
  'contacted',
  'replied',
  'meeting_booked',
  'converted',
  'not_suitable',
  'do_not_contact',
  'unresponsive',
  'archived',
] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]

export const CONTACT_TYPES = ['email', 'phone', 'social', 'contact_form', 'address'] as const
export type ContactType = (typeof CONTACT_TYPES)[number]

export const CONTACT_CLASSES = ['business', 'personal', 'unknown'] as const
export type ContactClass = (typeof CONTACT_CLASSES)[number]

export const EVIDENCE_KINDS = [
  'page_snapshot',
  'http_response',
  'measurement',
  'screenshot',
  'registry_entry',
  'directory_listing',
] as const
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number]

export const INVESTIGATION_KINDS = [
  'contact_scan',
  'website_audit',
  'tech_detection',
  'competitor_scan',
] as const
export type InvestigationKind = (typeof INVESTIGATION_KINDS)[number]

export const INVESTIGATION_STATUSES = [
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const
export type InvestigationStatus = (typeof INVESTIGATION_STATUSES)[number]

export const SUPPRESSION_TYPES = ['email', 'domain', 'phone'] as const
export type SuppressionType = (typeof SUPPRESSION_TYPES)[number]

export const WEBSITE_STATUSES = ['active', 'unreachable', 'dead', 'parked'] as const
export type WebsiteStatus = (typeof WEBSITE_STATUSES)[number]