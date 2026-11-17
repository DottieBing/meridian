import type { Db } from '@meridian/db'
import { searchOverpass } from './overpass'
import { persistBusiness } from './persist'
import { PRESETS, type PresetId } from './presets'
import type { Log } from './types'

export type DiscoveryRunParams = {
  workspaceId: string
  preset: PresetId
  countryCode?: string
  city?: string
  useCache: boolean
}

export type DiscoverySummary = {
  area: string
  preset: PresetId
  fromCache: boolean
  fetched: number
  usable: number
  created: number
  merged: number
  mergedBy: Record<string, number>
  unchanged: number
  ambiguous: number
  phonesRejected: number
  errors: number
  errorSamples: string[]
  osmDataTimestamp?: string
  durationMs: number
}

export async function runDiscoverySearch(
  db: Db, p: DiscoveryRunParams, log: Log,
): Promise<DiscoverySummary> {
  const started = Date.now()
  const preset = PRESETS[p.preset]
  const { businesses, stats } = await searchOverpass(
    {
      preset: p.preset,
      useCache: p.useCache,
      ...(p.countryCode ? { countryCode: p.countryCode } : {}),
      ...(p.city ? { city: p.city } : {}),
    },
    log,
  )

  const ctx = {
    workspaceId: p.workspaceId,
    industry: preset.industry,
    niche: preset.niche,
    countryCode: p.countryCode?.toUpperCase() ?? null,
    city: p.city ?? null,
  }

  const s: DiscoverySummary = {
    area: stats.areaLabel, preset: p.preset, fromCache: stats.cached,
    fetched: stats.rawElements, usable: businesses.length,
    created: 0, merged: 0, mergedBy: {}, unchanged: 0, ambiguous: 0,
    phonesRejected: 0, errors: 0, errorSamples: [], durationMs: 0,
    ...(stats.osmDataTimestamp ? { osmDataTimestamp: stats.osmDataTimestamp } : {}),
  }

  let i = 0
  for (const b of businesses) {
    i++
    try {
      const o = await persistBusiness(db, ctx, b, p.preset)
      s.phonesRejected += o.phonesRejected
      if (o.kind === 'created') s.created++
      else if (o.kind === 'ambiguous_created') { s.created++; s.ambiguous++ }
      else if (o.kind === 'unchanged') s.unchanged++
      else {
        s.merged++
        const r = o.rule ?? 'unknown'
        s.mergedBy[r] = (s.mergedBy[r] ?? 0) + 1
      }
    } catch (err) {
      s.errors++
      if (s.errorSamples.length < 5) {
        s.errorSamples.push(`${b.externalId}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    if (i % 100 === 0) log(`saved ${i}/${businesses.length}`)
  }

  s.durationMs = Date.now() - started
  return s
}