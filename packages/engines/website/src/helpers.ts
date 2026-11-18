import type { AuditPage, FindingEvidence } from './types'

export const clip = (s: string, n = 300): string => (s.length > n ? `${s.slice(0, n)}...` : s)

export function pageTitle(p: AuditPage): string {
  const el = p
    .$('title')
    .filter((_, e) => p.$(e).closest('svg').length === 0)
    .first()
  return el.text().trim()
}

export function metaContent(p: AuditPage, key: string): string {
  const k = key.toLowerCase()
  for (const el of p.$('meta').toArray()) {
    const name = (p.$(el).attr('name') ?? p.$(el).attr('property') ?? '').toLowerCase()
    if (name === k) return (p.$(el).attr('content') ?? '').trim()
  }
  return ''
}

export function hasLinkRel(p: AuditPage, rel: string): boolean {
  return p
    .$('link')
    .toArray()
    .some((el) => (p.$(el).attr('rel') ?? '').toLowerCase().split(/\s+/).includes(rel))
}

export function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

export function snapshotEvidence(
  p: AuditPage,
  excerpt?: string,
  measurement?: Record<string, unknown>,
): FindingEvidence {
  const e: FindingEvidence = { kind: 'page_snapshot', method: 'website-audit:html', snapshotId: p.snapshotId }
  if (excerpt) e.excerpt = clip(excerpt)
  if (measurement) e.measurement = measurement
  return e
}

export function headerEvidence(
  p: AuditPage,
  excerpt: string,
  measurement: Record<string, unknown>,
): FindingEvidence {
  return {
    kind: 'http_response',
    method: 'website-audit:headers',
    snapshotId: p.snapshotId,
    excerpt: clip(excerpt),
    measurement,
  }
}