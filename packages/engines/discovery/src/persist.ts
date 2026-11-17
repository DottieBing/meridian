import { createHash } from 'node:crypto'
import {
  and, eq, inArray, sql,
  businessLocations, businessSources, businesses, contactPoints, evidence, sourceRecords, websites,
  type Db,
} from '@meridian/db'
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'
import type { DiscoveredBusiness } from './types'

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
type MatchRule = 'source_record' | 'domain' | 'phone_name' | 'name_location'

export type PersistContext = {
  workspaceId: string
  industry: string | null
  niche: string | null
  countryCode: string | null
  city: string | null
}

export type Outcome = {
  kind: 'created' | 'merged' | 'unchanged' | 'ambiguous_created'
  rule?: MatchRule
  phonesRejected: number
}

const LEGAL = /\b(ltd|limited|llc|inc|plc|co|company)\b/g

export function normalizeName(name: string): string {
  const n = name
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(LEGAL, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return n || name.toLowerCase()
}

export function normalizePhone(raw: string, region: string | null): string | null {
  const p = parsePhoneNumberFromString(raw, (region ?? undefined) as CountryCode | undefined)
  return p?.isValid() ? p.number : null
}

function metres(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h))
}

function hashTags(tags: Record<string, string>): string {
  const sorted = Object.keys(tags).sort().map((k) => [k, tags[k]])
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex')
}

const GENERIC = new Set([
  'info', 'contact', 'hello', 'office', 'admin', 'reservations', 'booking', 'bookings',
  'sales', 'enquiries', 'enquiry', 'reception', 'support', 'mail', 'clinic',
])
const classifyEmail = (e: string) =>
  GENERIC.has(e.split('@')[0] ?? '') ? ('business' as const) : ('unknown' as const)

type Match = { businessId: string; rule: MatchRule } | { ambiguous: true } | null

function oneOrAmbiguous(ids: string[], rule: MatchRule): Match {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return null
  const [only] = unique
  return unique.length === 1 && only ? { businessId: only, rule } : { ambiguous: true }
}

async function findMatch(
  tx: Tx, ctx: PersistContext, b: DiscoveredBusiness, nn: string, phones: string[],
): Promise<Match> {
  const bySource = await tx
    .select({ id: businessSources.businessId })
    .from(sourceRecords)
    .innerJoin(businessSources, eq(businessSources.sourceRecordId, sourceRecords.id))
    .where(
      and(
        eq(sourceRecords.workspaceId, ctx.workspaceId),
        eq(sourceRecords.provider, b.provider),
        eq(sourceRecords.externalId, b.externalId),
      ),
    )
    .limit(1)
  if (bySource[0]) return { businessId: bySource[0].id, rule: 'source_record' }

  if (b.website && !b.website.isSocial && !b.website.isAggregator) {
    const byDomain = await tx
      .select({ id: websites.businessId })
      .from(websites)
      .where(and(eq(websites.workspaceId, ctx.workspaceId), eq(websites.domain, b.website.domain)))
      .limit(1)
    if (byDomain[0]) return { businessId: byDomain[0].id, rule: 'domain' }
  }

  if (phones.length > 0) {
    const rows = await tx
      .selectDistinct({ id: contactPoints.businessId })
      .from(contactPoints)
      .innerJoin(businesses, eq(businesses.id, contactPoints.businessId))
      .where(
        and(
          eq(contactPoints.workspaceId, ctx.workspaceId),
          eq(contactPoints.type, 'phone'),
          inArray(contactPoints.normalizedValue, phones),
          sql`similarity(${businesses.normalizedName}, ${nn}) >= 0.5`,
        ),
      )
    const m = oneOrAmbiguous(rows.map((r) => r.id), 'phone_name')
    if (m) return m
  }

  if (b.lat !== undefined && b.lon !== undefined) {
    const here = { lat: b.lat, lon: b.lon }
    const cands = await tx
      .select({ id: businesses.id, lat: businessLocations.latitude, lon: businessLocations.longitude })
      .from(businesses)
      .innerJoin(businessLocations, eq(businessLocations.businessId, businesses.id))
      .where(
        and(
          eq(businesses.workspaceId, ctx.workspaceId),
          sql`${businesses.normalizedName} % ${nn}`,
          sql`similarity(${businesses.normalizedName}, ${nn}) >= 0.8`,
        ),
      )
      .limit(30)
    const near = cands.filter(
      (c) => c.lat !== null && c.lon !== null && metres(here, { lat: c.lat, lon: c.lon }) <= 300,
    )
    const m = oneOrAmbiguous(near.map((c) => c.id), 'name_location')
    if (m) return m
  }
  return null
}

async function addLocation(
  tx: Tx, businessId: string, b: DiscoveredBusiness, ctx: PersistContext, isNew: boolean,
): Promise<void> {
  const hasAddress = Object.keys(b.address).length > 0
  const hasCoords = b.lat !== undefined && b.lon !== undefined
  if (!hasAddress && !hasCoords) return
  if (!isNew && b.lat !== undefined && b.lon !== undefined) {
    const here = { lat: b.lat, lon: b.lon }
    const existing = await tx
      .select({ lat: businessLocations.latitude, lon: businessLocations.longitude })
      .from(businessLocations)
      .where(eq(businessLocations.businessId, businessId))
    if (existing.some((l) => l.lat !== null && l.lon !== null && metres(here, { lat: l.lat, lon: l.lon }) <= 100)) {
      return
    }
  }
  await tx.insert(businessLocations).values({
    businessId,
    label: b.name,
    addressLine: b.address.street ?? null,
    city: b.address.city ?? ctx.city,
    postalCode: b.address.postcode ?? null,
    countryCode: b.address.country ?? ctx.countryCode,
    latitude: b.lat ?? null,
    longitude: b.lon ?? null,
    isPrimary: isNew,
  })
}

const EXCERPT_KEYS = [
  'name', 'website', 'contact:website', 'url', 'email', 'contact:email',
  'phone', 'contact:phone', 'mobile', 'contact:mobile',
]

const words = (s: string) => s.trim().split(/\s+/)

/** A name for a group of properties: shared leading words, else shared trailing words, else the domain. */
function brandName(names: string[], domain: string): string {
  const w = names.map(words)
  const first = w[0] ?? []
  let p = 0
  while (p < first.length && w.every((x) => x[p]?.toLowerCase() === first[p]?.toLowerCase())) p++
  if (p >= 1 && first.slice(0, p).join('').length >= 4) return first.slice(0, p).join(' ')
  let s = 0
  while (
    s < first.length &&
    w.every((x) => x[x.length - 1 - s]?.toLowerCase() === first[first.length - 1 - s]?.toLowerCase())
  ) {
    s++
  }
  if (s >= 2) return first.slice(first.length - s).join(' ')
  const label = domain.split('.')[0] ?? domain
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** When one domain covers several differently-named properties, name the business after the group. */
async function maybeRebrand(tx: Tx, businessId: string, domain: string): Promise<void> {
  const rows = await tx
    .select({ name: sql<string | null>`${sourceRecords.payload}->'tags'->>'name'` })
    .from(sourceRecords)
    .innerJoin(businessSources, eq(businessSources.sourceRecordId, sourceRecords.id))
    .where(eq(businessSources.businessId, businessId))
  const byNormalized = new Map<string, string>()
  for (const r of rows) if (r.name) byNormalized.set(normalizeName(r.name), r.name)
  if (byNormalized.size < 2) return // same property seen twice (node + way): keep its own name
  const brand = brandName([...byNormalized.values()], domain)
  await tx
    .update(businesses)
    .set({ name: brand, normalizedName: normalizeName(brand) })
    .where(eq(businesses.id, businessId))
}

export async function persistBusiness(
  db: Db, ctx: PersistContext, b: DiscoveredBusiness, searchPreset: string,
): Promise<Outcome> {
  return db.transaction(async (tx) => {
    const hash = hashTags(b.tags)

    const same = await tx
      .select({ id: sourceRecords.id })
      .from(sourceRecords)
      .where(
        and(
          eq(sourceRecords.workspaceId, ctx.workspaceId),
          eq(sourceRecords.provider, b.provider),
          eq(sourceRecords.externalId, b.externalId),
          eq(sourceRecords.contentHash, hash),
        ),
      )
      .limit(1)
    if (same[0]) {
      await tx
        .update(businesses)
        .set({ lastSeenAt: new Date(), staleAt: null })
        .where(
          inArray(
            businesses.id,
            tx
              .select({ id: businessSources.businessId })
              .from(businessSources)
              .where(eq(businessSources.sourceRecordId, same[0].id)),
          ),
        )
      return { kind: 'unchanged', phonesRejected: 0 }
    }

    const [rec] = await tx
      .insert(sourceRecords)
      .values({
        workspaceId: ctx.workspaceId,
        provider: b.provider,
        externalId: b.externalId,
        url: b.sourceUrl,
        payload: { tags: b.tags, lat: b.lat ?? null, lon: b.lon ?? null },
        contentHash: hash,
      })
      .onConflictDoNothing()
      .returning({ id: sourceRecords.id })
    if (!rec) return { kind: 'unchanged', phonesRejected: 0 }

    const nn = normalizeName(b.name)
    const phoneMap = new Map<string, string>() // e164 -> raw
    let phonesRejected = 0
    for (const raw of b.phones) {
      const e164 = normalizePhone(raw, ctx.countryCode)
      if (e164) phoneMap.set(e164, raw)
      else phonesRejected++
    }

    const match = await findMatch(tx, ctx, b, nn, [...phoneMap.keys()])
    let businessId: string
    let kind: Outcome['kind']
    let rule: MatchRule | undefined

    if (match && 'businessId' in match) {
      businessId = match.businessId
      kind = 'merged'
      rule = match.rule
      await tx
        .update(businesses)
        .set({ lastSeenAt: new Date(), staleAt: null })
        .where(eq(businesses.id, businessId))
      await addLocation(tx, businessId, b, ctx, false)
    } else {
      kind = match ? 'ambiguous_created' : 'created'
      const [row] = await tx
        .insert(businesses)
        .values({
          workspaceId: ctx.workspaceId,
          name: b.name,
          normalizedName: nn,
          industry: ctx.industry,
          niche: ctx.niche,
          countryCode: ctx.countryCode,
          city: b.address.city ?? ctx.city,
        })
        .returning({ id: businesses.id })
      if (!row) throw new Error('business insert returned no row')
      businessId = row.id
      await addLocation(tx, businessId, b, ctx, true)
    }

    await tx.insert(businessSources).values({ businessId, sourceRecordId: rec.id }).onConflictDoNothing()
        if (rule === 'domain' && b.website) await maybeRebrand(tx, businessId, b.website.domain)

    const [ev] = await tx
      .insert(evidence)
      .values({
        workspaceId: ctx.workspaceId,
        kind: 'directory_listing',
        sourceUrl: b.sourceUrl,
        method: 'osm-overpass',
        excerpt: JSON.stringify(
          Object.fromEntries(EXCERPT_KEYS.filter((k) => b.tags[k] !== undefined).map((k) => [k, b.tags[k]])),
        ),
        contentHash: hash,
        metadata: {
          provider: b.provider,
          externalId: b.externalId,
          searchPreset,
          license: 'ODbL 1.0',
          attribution: '© OpenStreetMap contributors',
        },
      })
      .returning({ id: evidence.id })
    if (!ev) throw new Error('evidence insert returned no row')

    if (b.website && !b.website.isSocial && !b.website.isAggregator) {
      const has = await tx
        .select({ id: websites.id })
        .from(websites)
        .where(eq(websites.businessId, businessId))
        .limit(1)
      await tx
        .insert(websites)
        .values({
          workspaceId: ctx.workspaceId,
          businessId,
          url: b.website.url,
          domain: b.website.domain,
          isPrimary: has.length === 0,
        })
        .onConflictDoNothing()
    }

    type Row = {
      type: 'email' | 'phone' | 'social'
      value: string
      normalizedValue: string
      classification: 'business' | 'unknown'
    }
    const rows = new Map<string, Row>()
    for (const e of b.emails) {
      rows.set(`email:${e}`, { type: 'email', value: e, normalizedValue: e, classification: classifyEmail(e) })
    }
    for (const [e164, raw] of phoneMap) {
      rows.set(`phone:${e164}`, { type: 'phone', value: raw, normalizedValue: e164, classification: 'unknown' })
    }
    if (b.website?.isSocial) {
      const v = b.website.url
      rows.set(`social:${v.toLowerCase()}`, {
        type: 'social', value: v, normalizedValue: v.toLowerCase(), classification: 'business',
      })
    }
    if (rows.size > 0) {
      await tx
        .insert(contactPoints)
        .values(
          [...rows.values()].map((r) => ({
            ...r,
            workspaceId: ctx.workspaceId,
            businessId,
            evidenceId: ev.id,
            confidence: 50,
          })),
        )
        .onConflictDoUpdate({
          target: [
            contactPoints.workspaceId,
            contactPoints.businessId,
            contactPoints.type,
            contactPoints.normalizedValue,
          ],
          set: { lastSeenAt: new Date(), staleAt: null },
        })
    }

    return { kind, phonesRejected, ...(rule ? { rule } : {}) }
  })
}