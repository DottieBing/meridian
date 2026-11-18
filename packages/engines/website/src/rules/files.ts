import { parseRobots } from '@meridian/crawl'
import { clip } from '../helpers'
import type { Rule } from '../types'

const robotsBlocksAll: Rule = {
  id: 'seo.robots_txt.blocks_all',
  run(ctx) {
    const r = ctx.files.robots
    if (!r || r.status !== 200 || r.body === '') return []
    const parsed = parseRobots(r.body, 'GenericBot')
    if (parsed.isAllowed('/') || parsed.isAllowed('/about') || parsed.isAllowed('/contact')) return []
    return [
      {
        code: 'seo.robots_txt.blocks_all',
        category: 'seo',
        severity: 'critical',
        isObjective: true,
        title: 'robots.txt blocks search engines from the whole site',
        detail:
          'The robots.txt file asks all crawlers to stay away from every page. Search engines will not list the site while this is in place. It is sometimes left over from development.',
        affectedUrl: r.url,
        confidence: 95,
        evidence: { kind: 'http_response', method: 'website-audit:files', sourceUrl: r.url, excerpt: clip(r.body) },
      },
    ]
  },
}

const sitemapMissing: Rule = {
  id: 'seo.sitemap.missing',
  run(ctx) {
    const s = ctx.files.sitemap
    if (s.found || s.inconclusive) return []
    const origin = new URL(ctx.home.url).origin
    return [
      {
        code: 'seo.sitemap.missing',
        category: 'seo',
        severity: 'low',
        isObjective: true,
        title: 'No XML sitemap found',
        detail:
          'A sitemap lists the pages a site wants search engines to find. None was declared in robots.txt or found at the usual addresses.',
        affectedUrl: `${origin}/sitemap.xml`,
        confidence: 85,
        evidence: {
          kind: 'http_response',
          method: 'website-audit:files',
          sourceUrl: `${origin}/sitemap.xml`,
          excerpt: clip(s.checked.map((c) => `${c.url} -> ${c.status}`).join('; ') || 'No sitemap address responded.'),
          measurement: { checked: s.checked },
        },
      },
    ]
  },
}

export const FILE_RULES: Rule[] = [robotsBlocksAll, sitemapMissing]