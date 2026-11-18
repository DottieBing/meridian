import { clip, headerEvidence, isHttps, snapshotEvidence } from '../helpers'
import type { Rule } from '../types'

const httpsNotUsed: Rule = {
  id: 'security.https.not_used',
  run(ctx) {
    if (isHttps(ctx.home.url)) return []
    return [
      {
        code: 'security.https.not_used',
        category: 'security',
        severity: 'high',
        isObjective: true,
        title: 'Website is not served over HTTPS',
        detail:
          'The main page is delivered over plain HTTP. Browsers label such pages as not secure, and anything visitors type, such as a booking enquiry, travels unencrypted.',
        affectedUrl: ctx.home.url,
        confidence: 98,
        evidence: headerEvidence(ctx.home, `Final address: ${ctx.home.url}`, {
          requestedUrl: ctx.home.requestedUrl,
          finalUrl: ctx.home.url,
          redirects: ctx.home.redirects,
        }),
      },
    ]
  },
}

const securityHeaders: Rule = {
  id: 'security.headers.missing_basic',
  run(ctx) {
    const h = ctx.home.headers
    const missing: string[] = []
    if (isHttps(ctx.home.url) && !h['strict-transport-security']) missing.push('Strict-Transport-Security')
    if (!/nosniff/i.test(h['x-content-type-options'] ?? '')) missing.push('X-Content-Type-Options')
    if (!h['x-frame-options'] && !/frame-ancestors/i.test(h['content-security-policy'] ?? '')) {
      missing.push('clickjacking protection (X-Frame-Options or CSP frame-ancestors)')
    }
    if (!h['referrer-policy']) missing.push('Referrer-Policy')
    if (missing.length === 0) return []
    return [
      {
        code: 'security.headers.missing_basic',
        category: 'security',
        severity: 'info',
        isObjective: true,
        title: `Basic security headers are missing (${missing.length})`,
        detail: `The main page response does not send: ${missing.join(', ')}. These headers are a low-effort hardening step. Their absence is not a vulnerability on its own, and many small-business sites omit them.`,
        affectedUrl: ctx.home.url,
        confidence: 95,
        evidence: headerEvidence(ctx.home, `Missing: ${missing.join(', ')}`, { missing }),
      },
    ]
  },
}

const TARGETS: [string, string][] = [
  ['img', 'src'],
  ['script', 'src'],
  ['link[rel="stylesheet"]', 'href'],
  ['iframe', 'src'],
  ['source', 'src'],
  ['video', 'src'],
  ['audio', 'src'],
]

const mixedContent: Rule = {
  id: 'security.mixed_content',
  run(ctx) {
    if (!isHttps(ctx.home.url)) return []
    const hits: { tag: string; url: string }[] = []
    for (const [selector, attr] of TARGETS) {
      for (const el of ctx.home.$(selector).toArray()) {
        const v = (ctx.home.$(el).attr(attr) ?? '').trim()
        if (/^http:\/\//i.test(v)) hits.push({ tag: selector, url: v })
      }
    }
    if (hits.length === 0) return []
    const active = hits.filter((h) => h.tag === 'script' || h.tag === 'iframe' || h.tag.startsWith('link')).length
    return [
      {
        code: 'security.mixed_content',
        category: 'security',
        severity: active > 0 ? 'medium' : 'low',
        isObjective: true,
        title: `${hits.length} resource${hits.length === 1 ? ' is' : 's are'} loaded over insecure HTTP on an HTTPS page`,
        detail:
          'A secure page should load everything over HTTPS. Browsers may block insecure scripts and styles, which can break parts of the page, and show warnings for the rest.',
        affectedUrl: ctx.home.url,
        confidence: 95,
        evidence: snapshotEvidence(ctx.home, hits.slice(0, 3).map((h) => h.url).join('\n'), {
          count: hits.length,
          activeContent: active,
          sample: hits.slice(0, 10),
        }),
      },
    ]
  },
}

const compressionMissing: Rule = {
  id: 'performance.compression.missing',
  run(ctx) {
    const enc = (ctx.home.headers['content-encoding'] ?? '').toLowerCase()
    if (ctx.home.bytes < 10_000 || /(gzip|br|zstd|deflate)/.test(enc)) return []
    const kb = Math.round(ctx.home.bytes / 1024)
    return [
      {
        code: 'performance.compression.missing',
        category: 'performance',
        severity: 'medium',
        isObjective: true,
        title: 'Main page is sent without compression',
        detail: `The page HTML is ${kb} KB and is sent without gzip or Brotli compression. Compression typically makes text pages several times smaller to download, which helps loading speed, especially on mobile connections.`,
        affectedUrl: ctx.home.url,
        confidence: 95,
        evidence: headerEvidence(ctx.home, `content-encoding: ${enc || '(none)'}`, {
          htmlBytes: ctx.home.bytes,
          contentEncoding: enc || null,
        }),
      },
    ]
  },
}

const redirectChain: Rule = {
  id: 'performance.redirect_chain',
  run(ctx) {
    const hops = ctx.home.redirects
    if (hops.length < 3) return []
    const chain = [...hops.map((h) => `${h.status} ${h.url}`), `200 ${ctx.home.url}`].join(' -> ')
    return [
      {
        code: 'performance.redirect_chain',
        category: 'performance',
        severity: 'low',
        isObjective: true,
        title: `Opening the site goes through ${hops.length} redirects`,
        detail:
          'Each redirect adds a round trip before any content appears. A direct link, or at most one redirect to the secure address, is faster.',
        affectedUrl: ctx.home.requestedUrl,
        confidence: 95,
        evidence: headerEvidence(ctx.home, clip(chain), { redirects: hops }),
      },
    ]
  },
}

const htmlLarge: Rule = {
  id: 'performance.html.large',
  run(ctx) {
    if (ctx.home.bytes <= 500_000) return []
    const kb = Math.round(ctx.home.bytes / 1024)
    return [
      {
        code: 'performance.html.large',
        category: 'performance',
        severity: 'low',
        isObjective: true,
        title: ctx.home.truncated ? 'Main page HTML is larger than 1 MB' : 'Main page HTML is very large',
        detail: `The HTML document alone is ${ctx.home.truncated ? 'at least ' : ''}${kb} KB, before images, scripts and styles. Very large documents are slower to download and parse. The 500 KB threshold is our judgement.`,
        affectedUrl: ctx.home.url,
        confidence: 90,
        evidence: headerEvidence(ctx.home, `HTML size: ${kb} KB`, {
          htmlBytes: ctx.home.bytes,
          truncated: ctx.home.truncated,
        }),
      },
    ]
  },
}

const ttfbSlow: Rule = {
  id: 'performance.ttfb.slow',
  run(ctx) {
    const t = ctx.home.ttfbMs
    if (t === null || t <= 4000) return []
    return [
      {
        code: 'performance.ttfb.slow',
        category: 'performance',
        severity: 'low',
        isObjective: true,
        title: 'Server was very slow to start responding',
        detail: `The server took ${(t / 1000).toFixed(1)} seconds to send its first byte. This was measured from the machine running Meridian, which may be far from the site's visitors, so treat it as an indication to re-test, not a verdict.`,
        affectedUrl: ctx.home.url,
        confidence: 60,
        evidence: headerEvidence(ctx.home, `Time to first byte: ${t} ms`, { ttfbMs: t }),
      },
    ]
  },
}

const renderBlocking: Rule = {
  id: 'performance.render_blocking_scripts',
  run(ctx) {
    const blocking = ctx.home
      .$('head script[src]')
      .toArray()
      .filter((el) => !ctx.home.$(el).is('[async], [defer], [type="module"]'))
    if (blocking.length < 4) return []
    const sample = blocking.slice(0, 3).map((el) => ctx.home.$(el).attr('src') ?? '')
    return [
      {
        code: 'performance.render_blocking_scripts',
        category: 'performance',
        severity: 'low',
        isObjective: true,
        title: `${blocking.length} scripts in the page head load without async or defer`,
        detail:
          'The browser stops drawing the page while it downloads and runs each of these scripts, which delays the moment content appears.',
        affectedUrl: ctx.home.url,
        confidence: 90,
        evidence: snapshotEvidence(ctx.home, sample.join('\n'), { count: blocking.length, sample }),
      },
    ]
  },
}

export const TECHNICAL_RULES: Rule[] = [
  httpsNotUsed,
  securityHeaders,
  mixedContent,
  compressionMissing,
  redirectChain,
  htmlLarge,
  ttfbSlow,
  renderBlocking,
]