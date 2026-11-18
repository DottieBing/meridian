import type { EvidenceKind, FindingCategory, Severity } from '@meridian/db'
import type { CheerioAPI } from 'cheerio'

export type Log = (message: string) => void

export type AuditPage = {
  snapshotId: string
  requestedUrl: string
  url: string
  status: number
  bytes: number
  truncated: boolean
  headers: Record<string, string>
  redirects: { url: string; status: number }[]
  ttfbMs: number | null
  contentHash: string
  storagePath: string
  capturedAt: Date
  html: string
  $: CheerioAPI
}

export type AuditFiles = {
  robots: { status: number; body: string; url: string } | null
  sitemap: {
    found: boolean
    url: string | null
    checked: { url: string; status: number }[]
    inconclusive: boolean
  }
}

export type AuditContext = {
  siteUrl: string
  home: AuditPage
  pages: AuditPage[]
  files: AuditFiles
}

export type FindingEvidence = {
  kind: EvidenceKind
  method: string
  snapshotId?: string
  sourceUrl?: string
  excerpt?: string
  measurement?: Record<string, unknown>
}

export type FindingDraft = {
  code: string
  category: FindingCategory
  severity: Severity
  isObjective: boolean
  title: string
  detail: string
  affectedUrl: string | null
  confidence: number
  evidence: FindingEvidence
}

export type Rule = { id: string; run: (ctx: AuditContext) => FindingDraft[] }