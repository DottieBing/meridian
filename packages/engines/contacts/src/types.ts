export type Log = (message: string) => void

export type ExtractSource =
  | 'mailto' | 'cfemail' | 'jsonld' | 'text' | 'obfuscated' | 'tel' | 'form' | 'link'

export type FoundContact = {
  type: 'email' | 'phone' | 'social' | 'contact_form'
  value: string
  normalizedValue: string
  source: ExtractSource
  pageUrl: string
  context: string
  confidence: number
  classification: 'business' | 'personal' | 'unknown'
  offDomain?: boolean
  validation?: { syntaxValid: boolean; domainResolves: boolean; hasMx: boolean; checkedAt: string }
}

export type PageResult = { url: string; status: number; bytes: number; contentHash: string }

export type ScanOutcome =
  | 'ok' | 'no_contacts' | 'unreachable' | 'dead' | 'blocked'
  | 'blocked_by_robots' | 'not_html' | 'suppressed'

export type ScanResult = {
  outcome: ScanOutcome
  siteUrl: string
  finalUrl?: string
  pages: PageResult[]
  skipped: { url: string; reason: string }[]
  contacts: FoundContact[]
  durationMs: number
  error?: string
}