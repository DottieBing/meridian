import { parseArgs } from 'node:util'
import { scanWebsite } from './scan'

const { values, positionals } = parseArgs({
  options: { region: { type: 'string' } },
  allowPositionals: true,
})
const url = positionals[0]
if (!url) {
  console.error('Usage: pnpm --filter @meridian/contacts probe <url> [--region CY]')
  process.exit(1)
}

const log = (m: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`)
const host = new URL(url).hostname.replace(/^www\./, '')
const r = await scanWebsite(url, {
  userAgent: process.env.CRAWLER_USER_AGENT ?? 'MeridianBot/0.1',
  region: values.region ?? null,
  knownDomain: host,
  log,
})

console.log(`\nOutcome: ${r.outcome}${r.error ? ` (${r.error})` : ''}  |  ${(r.durationMs / 1000).toFixed(1)}s`)
console.log('\nPages fetched:')
console.table(r.pages.map((p) => ({ url: p.url, status: p.status, kb: Math.round(p.bytes / 1024) })))
if (r.skipped.length) console.log('Skipped:', r.skipped)
console.log('\nContacts:')
console.table(
  r.contacts
    .sort((a, b) => a.type.localeCompare(b.type) || b.confidence - a.confidence)
    .map((c) => ({
      type: c.type, value: c.value.slice(0, 50), conf: c.confidence, class: c.classification,
      via: c.source, mx: c.validation?.hasMx ?? '', page: c.pageUrl.replace(/^https?:\/\/[^/]+/, ''),
    })),
)