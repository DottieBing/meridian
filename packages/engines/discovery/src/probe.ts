import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { dataDir } from './http'
import { searchOverpass } from './overpass'
import { PRESETS, isPresetId } from './presets'
import { DiscoveryError } from './types'

const { values } = parseArgs({
  options: {
    country: { type: 'string' },
    city: { type: 'string' },
    preset: { type: 'string' },
    'no-cache': { type: 'boolean' },
  },
  allowPositionals: true,
})

const presetArg = values.preset ?? ''
if (!isPresetId(presetArg)) {
  console.error(`Unknown or missing --preset. Choose one of: ${Object.keys(PRESETS).join(', ')}`)
  process.exit(1)
}

const log = (m: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`)
const pct = (n: number, total: number) => (total ? `${n} (${Math.round((n / total) * 100)}%)` : '0')

try {
  const { businesses: b, stats } = await searchOverpass(
    {
      preset: presetArg,
      ...(values.country ? { countryCode: values.country } : {}),
      ...(values.city ? { city: values.city } : {}),
      useCache: !values['no-cache'],
    },
    log,
  )

  const total = b.length
  const realSite = b.filter((x) => x.website && !x.website.isSocial)
  const socialOnly = b.filter((x) => x.website?.isSocial)
  const withEmail = b.filter((x) => x.emails.length > 0)
  const withPhone = b.filter((x) => x.phones.length > 0)

  console.log(`\nArea: ${stats.areaLabel}`)
  console.log(
    `Took ${(stats.durationMs / 1000).toFixed(1)}s${stats.cached ? ' (from cache)' : ''}` +
      (stats.osmDataTimestamp ? `, OSM data as of ${stats.osmDataTimestamp}` : ''),
  )
  console.table({
    'OSM elements returned': { count: String(stats.rawElements) },
    'Dropped (no name)': { count: String(stats.unnamed) },
    'Usable businesses': { count: String(total) },
    'Own website': { count: pct(realSite.length, total) },
    'Social page only': { count: pct(socialOnly.length, total) },
    'Public email tag': { count: pct(withEmail.length, total) },
    'Public phone tag': { count: pct(withPhone.length, total) },
    'Website + email': { count: pct(realSite.filter((x) => x.emails.length).length, total) },
    'Website, no email': { count: pct(realSite.filter((x) => !x.emails.length).length, total) },
    'No website at all': { count: pct(b.filter((x) => !x.website).length, total) },
  })

  console.log('\nSample (businesses with a website, up to 10):')
  for (const x of realSite.slice(0, 10)) {
    console.log(` - ${x.name} | ${x.website?.domain} | ${x.emails[0] ?? 'no email'} | ${x.phones[0] ?? 'no phone'}`)
  }

  const out = path.join(dataDir(), 'probe')
  await mkdir(out, { recursive: true })
  const file = path.join(out, `${presetArg}-${values.city ?? values.country}-${Date.now()}.json`)
  await writeFile(file, JSON.stringify({ stats, businesses: b }, null, 2))
  console.log(`\nFull results saved to ${file}`)
} catch (e) {
  if (e instanceof DiscoveryError) console.error(`\nFailed [${e.kind}]: ${e.message}`)
  else console.error(e)
  process.exit(1)
}