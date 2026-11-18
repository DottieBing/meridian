import { TECH_CATEGORIES } from '@meridian/db'
import { clip } from '../helpers'
import type { AuditPage, DetectedTech } from '../types'
import { SIGS, type Sig } from './signatures'

export const TECH_METHOD_VERSION = 'tech-detect/1'

const WEIGHT: Record<string, number> = { header: 90, meta: 90, src: 85, link: 80, href: 75, html: 70, inline: 70 }
const MAX_HTML = 600_000
const MAX_INLINE = 300_000

export function cmpVersion(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

type Index = {
  page: AuditPage
  home: boolean
  srcs: string[]
  links: string[]
  hrefs: string[]
  html: string
  inline: string
  meta: Record<string, string>
}

function indexPage(page: AuditPage, home: boolean): Index {
  const $ = page.$
  const attrs = (selector: string, name: string): string[] =>
    $(selector)
      .toArray()
      .flatMap((el) => {
        const v = $(el).attr(name)
        return v ? [v.trim()] : []
      })
  const meta: Record<string, string> = {}
  for (const el of $('meta').toArray()) {
    const key = ($(el).attr('name') ?? $(el).attr('property') ?? '').toLowerCase()
    const content = $(el).attr('content')
    if (key && content !== undefined && !(key in meta)) meta[key] = content
  }
  return {
    page,
    home,
    srcs: [
      ...attrs('script[src]', 'src'),
      ...attrs('iframe[src]', 'src'),
      ...attrs('embed[src]', 'src'),
      ...attrs('object[data]', 'data'),
    ].slice(0, 400),
    links: attrs('link[href]', 'href').slice(0, 400),
    hrefs: attrs('a[href]', 'href').slice(0, 800),
    html: page.html.slice(0, MAX_HTML),
    inline: $('script:not([src])')
      .toArray()
      .map((el) => $(el).html() ?? '')
      .join('\n')
      .slice(0, MAX_INLINE),
    meta,
  }
}

type Hit = { via: string; excerpt: string; page: AuditPage }
type Agg = { sig: Sig; hits: Hit[]; versions: Set<string>; ids: Set<string> }

function record(agg: Agg, m: RegExpExecArray): void {
  const g = m[1]
  if (!g) return
  if (agg.sig.capture === 'id') agg.ids.add(g)
  else if (/^\d/.test(g)) agg.versions.add(g)
}

function scanList(agg: Agg, res: RegExp[] | undefined, items: string[], via: string, page: AuditPage): void {
  if (!res) return
  for (const re of res) {
    let first = true
    for (const item of items) {
      const m = re.exec(item)
      if (!m) continue
      if (first) {
        agg.hits.push({ via, excerpt: clip(item, 160), page })
        first = false
      }
      record(agg, m)
    }
  }
}

function scanText(agg: Agg, res: RegExp[] | undefined, text: string, via: string, page: AuditPage): void {
  if (!res) return
  for (const re of res) {
    const m = re.exec(text)
    if (!m) continue
    agg.hits.push({ via, excerpt: clip(m[0].replace(/\s+/g, ' '), 160), page })
    record(agg, m)
  }
}

function scanMap(
  agg: Agg, spec: Record<string, RegExp> | undefined, values: Record<string, string>, via: string, page: AuditPage,
): void {
  if (!spec) return
  for (const [key, re] of Object.entries(spec)) {
    const v = values[key]
    if (v === undefined) continue
    const m = re.exec(v)
    if (!m) continue
    agg.hits.push({ via, excerpt: `${key}: ${clip(v, 120)}`, page })
    record(agg, m)
  }
}

/** Detects technologies from the stored pages. The first page is the main page: only it contributes headers and meta tags. */
export function detectTechnologies(pages: AuditPage[]): DetectedTech[] {
  const home = pages[0]
  if (!home) return []
  const indexes = pages.map((p, i) => indexPage(p, i === 0))
  const out: DetectedTech[] = []

  for (const sig of SIGS) {
    const agg: Agg = { sig, hits: [], versions: new Set(), ids: new Set() }
    for (const ix of indexes) {
      if (ix.home) {
        scanMap(agg, sig.headers, home.headers, 'header', ix.page)
        scanMap(agg, sig.meta, ix.meta, 'meta', ix.page)
      }
      scanList(agg, sig.srcs, ix.srcs, 'src', ix.page)
      scanList(agg, sig.links, ix.links, 'link', ix.page)
      scanList(agg, sig.hrefs, ix.hrefs, 'href', ix.page)
      scanText(agg, sig.html, ix.html, 'html', ix.page)
      scanText(agg, sig.inline, ix.inline, 'inline', ix.page)
    }
    if (agg.hits.length === 0) continue
    const best = agg.hits.reduce((a, b) => ((WEIGHT[b.via] ?? 0) > (WEIGHT[a.via] ?? 0) ? b : a))
    const vias = new Set(agg.hits.map((h) => h.via))
    const versions = [...agg.versions].sort(cmpVersion)
    out.push({
      slug: sig.slug,
      name: sig.name,
      category: sig.category,
      version: versions[versions.length - 1] ?? null,
      versions,
      detail: agg.ids.size > 0 ? [...agg.ids].slice(0, 5).join(', ') : null,
      confidence: Math.min(98, (WEIGHT[best.via] ?? 60) + (vias.size > 1 ? 5 : 0)),
      via: best.via,
      excerpt: best.excerpt,
      snapshotId: best.page.snapshotId,
      pageUrl: best.page.url,
    })
  }

  // Technologies implied by others, such as WordPress behind WooCommerce
  const have = new Set(out.map((t) => t.slug))
  for (const t of [...out]) {
    for (const slug of SIGS.find((s) => s.slug === t.slug)?.implies ?? []) {
      const target = SIGS.find((s) => s.slug === slug)
      if (!target || have.has(slug)) continue
      have.add(slug)
      out.push({
        slug, name: target.name, category: target.category, version: null, versions: [], detail: null,
        confidence: 55, via: 'implied', excerpt: `Implied by ${t.name}`, snapshotId: t.snapshotId, pageUrl: t.pageUrl,
      })
    }
  }

  const order = (c: string) => TECH_CATEGORIES.indexOf(c as (typeof TECH_CATEGORIES)[number])
  return out.sort((a, b) => order(a.category) - order(b.category) || a.name.localeCompare(b.name))
}