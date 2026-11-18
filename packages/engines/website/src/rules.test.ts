import assert from 'node:assert/strict'
import { test } from 'node:test'
import { load } from 'cheerio'
import { runRules } from './audit'
import { RULES } from './rules'
import type { AuditContext, AuditFiles, AuditPage } from './types'

const GOOD_HEADERS = {
  'strict-transport-security': 'max-age=31536000',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'content-encoding': 'gzip',
}

const FILES_OK: AuditFiles = {
  robots: { status: 200, body: 'User-agent: *\nAllow: /', url: 'https://example.cy/robots.txt' },
  sitemap: { found: true, url: 'https://example.cy/sitemap.xml', checked: [], inconclusive: false },
}

function page(html: string, o: Partial<AuditPage> = {}): AuditPage {
  return {
    snapshotId: 's1',
    requestedUrl: 'https://example.cy/',
    url: 'https://example.cy/',
    status: 200,
    bytes: 20_000,
    truncated: false,
    headers: GOOD_HEADERS,
    redirects: [],
    ttfbMs: 300,
    contentHash: 'h',
    storagePath: 'x',
    capturedAt: new Date(),
    html,
    $: load(html),
    ...o,
  }
}

function ctx(home: AuditPage, files: AuditFiles = FILES_OK, others: AuditPage[] = []): AuditContext {
  return { siteUrl: home.requestedUrl, home, pages: [home, ...others], files }
}

const fired = new Set<string>()
function codesOf(c: AuditContext): Set<string> {
  const { findings, errors } = runRules(c)
  assert.deepEqual(errors, [], 'rules must not throw')
  const codes = new Set(findings.map((f) => f.code))
  for (const code of codes) fired.add(code)
  return codes
}
function expectFires(c: AuditContext, expected: string[]): void {
  const codes = codesOf(c)
  for (const code of expected) assert.ok(codes.has(code), `expected ${code}, got: ${[...codes].join(', ') || 'nothing'}`)
}

const CLEAN = `<!doctype html><html lang="en"><head><title>Example Hotel</title>
<meta name="description" content="A small hotel by the sea."><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="https://example.cy/"><meta property="og:title" content="Example Hotel">
<meta property="og:image" content="https://example.cy/a.jpg"><script type="application/ld+json">{"@type":"Hotel"}</script>
</head><body><h1>Welcome</h1><img src="a.jpg" alt="A room"></body></html>`

test('a clean page produces no findings', () => {
  const codes = codesOf(ctx(page(CLEAN)))
  assert.deepEqual([...codes], [])
})

test('a broken HTTPS page triggers the HTML rules', () => {
  const scripts = Array.from({ length: 5 }, (_, i) => `<script src="/s${i}.js"></script>`).join('')
  const imgs = Array.from({ length: 6 }, (_, i) => `<img src="http://cdn.example.com/${i}.jpg">`).join('')
  const html = `<html><head><meta name="robots" content="noindex, follow">${scripts}</head><body>${imgs}</body></html>`
  expectFires(ctx(page(html, { headers: {} })), [
    'seo.title.missing',
    'seo.meta_description.missing',
    'seo.h1.missing',
    'seo.noindex',
    'seo.canonical.missing',
    'seo.open_graph.missing',
    'seo.structured_data.missing',
    'ux.viewport.missing',
    'a11y.lang.missing',
    'a11y.images.alt_missing',
    'security.mixed_content',
    'security.headers.missing_basic',
    'performance.compression.missing',
    'performance.render_blocking_scripts',
  ])
})

test('plain HTTP is flagged', () => {
  const p = page(CLEAN, { url: 'http://example.cy/', requestedUrl: 'http://example.cy/' })
  expectFires(ctx(p), ['security.https.not_used'])
})

test('redirect chains, large HTML and slow first byte are flagged', () => {
  const hops = [
    { url: 'http://example.cy/', status: 301 },
    { url: 'https://example.cy/', status: 301 },
    { url: 'https://www.example.cy/', status: 302 },
  ]
  expectFires(ctx(page(CLEAN, { redirects: hops, bytes: 600_000, ttfbMs: 5000 })), [
    'performance.redirect_chain',
    'performance.html.large',
    'performance.ttfb.slow',
  ])
})

test('disabled zoom is flagged', () => {
  const html = CLEAN.replace('width=device-width, initial-scale=1', 'width=device-width, user-scalable=no')
  expectFires(ctx(page(html)), ['a11y.zoom_disabled'])
})

test('duplicate titles across pages are flagged', () => {
  const home = page(CLEAN)
  const other = page(CLEAN, { snapshotId: 's2', url: 'https://example.cy/about', requestedUrl: 'https://example.cy/about' })
  expectFires(ctx(home, FILES_OK, [other]), ['seo.title.duplicate'])
})

test('robots.txt that blocks everything is flagged', () => {
  const files: AuditFiles = {
    ...FILES_OK,
    robots: { status: 200, body: 'User-agent: *\nDisallow: /', url: 'https://example.cy/robots.txt' },
  }
  expectFires(ctx(page(CLEAN), files), ['seo.robots_txt.blocks_all'])
})

test('a missing sitemap is flagged, but not when the check was inconclusive', () => {
  const missing: AuditFiles = {
    ...FILES_OK,
    sitemap: { found: false, url: null, checked: [{ url: 'https://example.cy/sitemap.xml', status: 404 }], inconclusive: false },
  }
  expectFires(ctx(page(CLEAN), missing), ['seo.sitemap.missing'])
  const unsure: AuditFiles = { ...missing, sitemap: { ...missing.sitemap, inconclusive: true } }
  assert.ok(!codesOf(ctx(page(CLEAN), unsure)).has('seo.sitemap.missing'))
})

test('every rule in the engine was exercised by a fixture', () => {
  const untested = RULES.map((r) => r.id).filter((id) => !fired.has(id))
  assert.deepEqual(untested, [], `rules with no fixture: ${untested.join(', ')}`)
})