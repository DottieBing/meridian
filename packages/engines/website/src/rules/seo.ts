import type { FindingCategory, Severity } from '@meridian/db'
import { clip, hasLinkRel, metaContent, pageTitle, snapshotEvidence } from '../helpers'
import type { AuditPage, Rule } from '../types'

type PerPage = {
  id: string
  category: FindingCategory
  homeSeverity: Severity
  otherSeverity: Severity
  missing: (p: AuditPage) => boolean
  singular: string
  plural: string
  detail: string
  excerpt: string
}

function perPage(o: PerPage): Rule {
  return {
    id: o.id,
    run(ctx) {
      const bad = ctx.pages.filter(o.missing)
      const first = bad.includes(ctx.home) ? ctx.home : bad[0]
      if (!first) return []
      const total = ctx.pages.length
      return [
        {
          code: o.id,
          category: o.category,
          severity: bad.includes(ctx.home) ? o.homeSeverity : o.otherSeverity,
          isObjective: true,
          title: total === 1 ? o.singular : `${bad.length} of ${total} audited pages ${o.plural}`,
          detail: o.detail,
          affectedUrl: first.url,
          confidence: 95,
          evidence: snapshotEvidence(first, o.excerpt, {
            affectedPages: bad.map((p) => p.url).slice(0, 10),
            auditedPages: total,
          }),
        },
      ]
    },
  }
}

const titleMissing = perPage({
  id: 'seo.title.missing',
  category: 'seo',
  homeSeverity: 'high',
  otherSeverity: 'medium',
  missing: (p) => pageTitle(p) === '',
  singular: 'Page has no title tag',
  plural: 'have no title tag',
  detail:
    'The title tag is the headline shown in search results and in browser tabs. Without one, search engines have to guess how to label the page.',
  excerpt: 'No non-empty <title> element found in the page HTML.',
})

const descriptionMissing = perPage({
  id: 'seo.meta_description.missing',
  category: 'seo',
  homeSeverity: 'medium',
  otherSeverity: 'low',
  missing: (p) => metaContent(p, 'description') === '',
  singular: 'Page has no meta description',
  plural: 'have no meta description',
  detail:
    'The meta description is the short summary search engines often show under the page title. Without one they pick a snippet themselves, which is often a poor summary.',
  excerpt: 'No <meta name="description"> with content found in the page HTML.',
})

const h1Missing = perPage({
  id: 'seo.h1.missing',
  category: 'seo',
  homeSeverity: 'low',
  otherSeverity: 'low',
  missing: (p) => p.$('h1').length === 0,
  singular: 'Page has no main heading (H1)',
  plural: 'have no main heading (H1)',
  detail:
    'The main heading tells visitors and search engines what a page is about. None was found in the HTML as delivered. If the site builds its content with JavaScript, a heading may only appear after scripts run.',
  excerpt: 'No <h1> element found in the page HTML.',
})

const noindex: Rule = {
  id: 'seo.noindex',
  run(ctx) {
    const robotsMeta = metaContent(ctx.home, 'robots').toLowerCase()
    const robotsHeader = (ctx.home.headers['x-robots-tag'] ?? '').toLowerCase()
    const viaMeta = /\bnoindex\b/.test(robotsMeta)
    const viaHeader = /\bnoindex\b/.test(robotsHeader)
    if (!viaMeta && !viaHeader) return []
    return [
      {
        code: 'seo.noindex',
        category: 'seo',
        severity: 'critical',
        isObjective: true,
        title: 'Main page tells search engines not to index it',
        detail:
          'The page carries a "noindex" instruction, which asks search engines to leave it out of their results. This is sometimes left switched on by mistake after a site is built or redesigned.',
        affectedUrl: ctx.home.url,
        confidence: 98,
        evidence: snapshotEvidence(
          ctx.home,
          viaMeta ? `<meta name="robots" content="${robotsMeta}">` : `X-Robots-Tag: ${robotsHeader}`,
        ),
      },
    ]
  },
}

const canonicalMissing: Rule = {
  id: 'seo.canonical.missing',
  run(ctx) {
    if (hasLinkRel(ctx.home, 'canonical')) return []
    return [
      {
        code: 'seo.canonical.missing',
        category: 'seo',
        severity: 'info',
        isObjective: true,
        title: 'Main page has no canonical link',
        detail:
          'A canonical link tells search engines which address is the preferred version of a page. It avoids duplicate-content confusion when the same page can be reached at several addresses.',
        affectedUrl: ctx.home.url,
        confidence: 90,
        evidence: snapshotEvidence(ctx.home, 'No <link rel="canonical"> found in the page HTML.'),
      },
    ]
  },
}

const openGraphMissing: Rule = {
  id: 'seo.open_graph.missing',
  run(ctx) {
    const missing = ['og:title', 'og:image'].filter((k) => metaContent(ctx.home, k) === '')
    if (missing.length === 0) return []
    return [
      {
        code: 'seo.open_graph.missing',
        category: 'seo',
        severity: 'info',
        isObjective: true,
        title: 'Main page is missing social sharing preview tags',
        detail: `When the page is shared on social networks or messaging apps, these tags control the preview card. Missing: ${missing.join(', ')}.`,
        affectedUrl: ctx.home.url,
        confidence: 90,
        evidence: snapshotEvidence(ctx.home, `Missing meta properties: ${missing.join(', ')}`),
      },
    ]
  },
}

const structuredDataMissing: Rule = {
  id: 'seo.structured_data.missing',
  run(ctx) {
    const ld = ctx.home.$('script[type="application/ld+json"]').length
    const micro = ctx.home.$('[itemscope]').length
    if (ld + micro > 0) return []
    return [
      {
        code: 'seo.structured_data.missing',
        category: 'seo',
        severity: 'info',
        isObjective: true,
        title: 'Main page has no structured data',
        detail:
          'Structured data (schema.org markup) lets search engines show richer results, such as opening hours, ratings or prices. None was found in the page HTML.',
        affectedUrl: ctx.home.url,
        confidence: 85,
        evidence: snapshotEvidence(ctx.home, 'No JSON-LD script or microdata found in the page HTML.'),
      },
    ]
  },
}

const duplicateTitles: Rule = {
  id: 'seo.title.duplicate',
  run(ctx) {
    const byTitle = new Map<string, AuditPage[]>()
    for (const p of ctx.pages) {
      const t = pageTitle(p).toLowerCase()
      if (t === '') continue
      byTitle.set(t, [...(byTitle.get(t) ?? []), p])
    }
    const groups = [...byTitle.values()].filter((g) => g.length >= 2)
    const first = groups[0]?.[0]
    if (!first) return []
    return [
      {
        code: 'seo.title.duplicate',
        category: 'seo',
        severity: 'low',
        isObjective: true,
        title: 'Several audited pages share the same title tag',
        detail:
          'Each page should have its own title so that search results and browser tabs tell pages apart.',
        affectedUrl: first.url,
        confidence: 95,
        evidence: snapshotEvidence(first, clip(pageTitle(first), 120), {
          groups: groups.map((g) => ({ title: g[0] ? pageTitle(g[0]) : '', pages: g.map((p) => p.url) })),
        }),
      },
    ]
  },
}

export const SEO_RULES: Rule[] = [
  titleMissing,
  descriptionMissing,
  h1Missing,
  noindex,
  canonicalMissing,
  openGraphMissing,
  structuredDataMissing,
  duplicateTitles,
]