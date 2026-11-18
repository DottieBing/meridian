import type { DiscoveredBusiness, OsmElement } from './types'

const SOCIAL = [
  'facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'x.com',
  'tiktok.com', 'youtube.com', 'linktr.ee', 'wa.me',
]

const AGGREGATORS = [
  'booking.com', 'airbnb.com', 'abnb.me', 'tripadvisor.com', 'expedia.com', 'agoda.com',
  'hotels.com', 'trivago.com', 'vrbo.com', 'google.com', 'goo.gl', 'g.page', 'share.google',
  'yelp.com', 'doctoralia.com', 'bit.ly', 'tinyurl.com', 't.co', 'cyprus.com',
]
const matches = (domain: string, list: string[]) =>
  list.some((s) => domain === s || domain.endsWith(`.${s}`))
const looksLikeAggregator = (domain: string) =>
  matches(domain, AGGREGATORS) || /^airbnb\./.test(domain) // airbnb.com.cy, airbnb.co.uk, ...

function parseWebsite(raw: string | undefined): DiscoveredBusiness['website'] {
  const first = raw?.split(';')[0]?.trim()
  if (!first) return undefined
  try {
    const u = new URL(/^https?:\/\//i.test(first) ? first : `https://${first}`)
    if (!u.hostname.includes('.')) return undefined
    const domain = u.hostname.toLowerCase().replace(/^www\./, '')
    const listingPage = /^\/listings?\/[^/]+/i.test(u.pathname) // a directory's page for the business, not its own site
    return {
      url: u.toString(),
      domain,
      isSocial: matches(domain, SOCIAL),
      isAggregator: looksLikeAggregator(domain) || listingPage,
    }
  } catch {
    return undefined
  }
}

function parseEmails(raw: string | undefined): string[] {
  if (!raw) return []
  const out = raw
    .split(/[;,]/)
    .map((e) => e.trim().replace(/^mailto:/i, '').toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
  return [...new Set(out)]
}

function parsePhones(...raws: Array<string | undefined>): string[] {
  const out = raws.flatMap((r) => (r ? r.split(';').map((p) => p.trim()) : [])).filter(Boolean)
  return [...new Set(out)]
}

/** Returns undefined for elements without a name: we can't use those as leads. */
export function normalizeElement(el: OsmElement): DiscoveredBusiness | undefined {
  const t = el.tags ?? {}
  const name = (t['name'] ?? t['name:en'])?.trim()
  if (!name) return undefined

  const lat = el.lat ?? el.center?.lat
  const lon = el.lon ?? el.center?.lon
  const website = parseWebsite(t['website'] ?? t['contact:website'] ?? t['url'])
  const street = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ')

  return {
    provider: 'osm',
    externalId: `${el.type}/${el.id}`,
    sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    name,
    ...(website ? { website } : {}),
    emails: parseEmails(t['email'] ?? t['contact:email']),
    phones: parsePhones(t['phone'], t['contact:phone'], t['mobile'], t['contact:mobile']),
    address: {
      ...(street ? { street } : {}),
      ...(t['addr:city'] ? { city: t['addr:city'] } : {}),
      ...(t['addr:postcode'] ? { postcode: t['addr:postcode'] } : {}),
      ...(t['addr:country'] ? { country: t['addr:country'] } : {}),
    },
    ...(lat !== undefined ? { lat } : {}),
    ...(lon !== undefined ? { lon } : {}),
    tags: t,
  }
}