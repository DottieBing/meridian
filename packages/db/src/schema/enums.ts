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

export const FINDING_CATEGORIES = [
  'performance',
  'seo',
  'ux',
  'accessibility',
  'technical',
  'security',
  'ecommerce',
  'content',
] as const
export type FindingCategory = (typeof FINDING_CATEGORIES)[number]

export const SEVERITIES = ['info', 'low', 'medium', 'high', 'critical'] as const
export type Severity = (typeof SEVERITIES)[number]

export const DISCOVERY_RUN_STATUSES = ['queued', 'running', 'completed', 'failed'] as const
export type DiscoveryRunStatus = (typeof DISCOVERY_RUN_STATUSES)[number]

export const CONTACT_ROLES = [
  'general',
  'booking',
  'sales',
  'support',
  'privacy_legal',
  'technical',
  'no_reply',
  'named_person',
  'unknown',
] as const
export type ContactRole = (typeof CONTACT_ROLES)[number]

export const TECH_CATEGORIES = [
  'cms', 'website_builder', 'ecommerce', 'page_builder', 'plugin', 'framework', 'js_library',
  'analytics', 'tag_manager', 'advertising', 'marketing', 'chat', 'booking', 'payment',
  'consent', 'hosting', 'server', 'language', 'legacy',
] as const
export type TechCategory = (typeof TECH_CATEGORIES)[number]