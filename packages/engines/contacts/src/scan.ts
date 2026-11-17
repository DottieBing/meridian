import { resolve4, resolve6, resolveMx } from 'node:dns/promises'
import { cleanEmail, extractFromHtml } from './extract'
import { FetchError, PoliteClient, type Page } from './net'
import type { FoundContact, Log, ScanOutcome, ScanResult } from './types'

export type ScanOptions = {
  userAgent: string
  region: string | null
  knownDomain: string | null
  log: Log
  maxPages?: number
  minGapMs?: number
}

const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.gr', 'hotmail.com', 'outlook.com', 'live.com',
  'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'mail.com', 'cytanet.com.cy',
])
const GENERIC_LOCALS = new Set([
  'info', 'contact', 'hello', 'office', 'admin', 'reservations', 'booking', 'bookings', 'sales',
  'enquiries', 'enquiry', 'reception', 'support', 'mail', 'clinic', 'frontdesk', 'welcome', 'hotel',
])
const SKIP_FILE = /\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?|pptx?|mp[34])(\?|$)/i
const CONTACT_RE = /(contact|kontakt|epikoinon|επικοινων|get-in-touch|reach-us|find-us)/i

const stripWww = (h: string) => h.toLowerCase().replace(/^www\./, '')

function pagePath(href: string): string {
  try {
    return decodeURIComponent(new URL(href).pathname)
  } catch {
    return href
  }
}

const isContactPageUrl = (href: string) => CONTACT_RE.test(pagePath(href))

function pageScore(href: string, text: string): number {
  const hay = `${pagePath(href)} ${text}`.toLowerCase()
  if (CONTACT_RE.test(hay)) return 100
  if (/(about|team|our-story|who-we-are|doctors|staff|σχετικ|ομάδα|ιατρο)/.test(hay)) return 50
  if (/(impressum|legal|privacy|terms)/.test(hay)) return 30
  return 0
}

function normalizeUrl(u: string): string {
  try {
    const x = new URL(u)
    x.hash = ''
    return x.toString().replace(/\/$/, '').toLowerCase()
  } catch {
    return u.toLowerCase()
  }
}

function classifyEmail(email: string): FoundContact['classification'] {
  const local = email.split('@')[0] ?? ''
  if (GENERIC_LOCALS.has(local)) return 'business'
  if (/^[a-z]{2,}[._-][a-z]{2,}$/.test(local)) return 'personal'
  return 'unknown'
}

function emailConfidence(source: string, contactPage: boolean, onDomain: boolean, free: boolean): number {
  const base = source === 'mailto' || source === 'cfemail' ? 85 : source === 'jsonld' ? 80 : source === 'obfuscated' ? 55 : 60
  return Math.max(10, Math.min(95, base + (contactPage ? 5 : 0) + (onDomain ? 10 : free ? 0 : -5)))
}

function keep(map: Map<string, FoundContact>, c: FoundContact): void {
  const key = `${c.type}:${c.normalizedValue}`
  const prev = map.get(key)
  if (!prev || c.confidence > prev.confidence) map.set(key, c)
}

const withTimeout = <T>(p: Promise<T>, ms = 5000): Promise<T> =>
  Promise.race([
    p,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('dns timeout')), ms).unref()
    }),
  ])

async function checkDomain(domain: string): Promise<{ domainResolves: boolean; hasMx: boolean }> {
  let hasMx = false
  let domainResolves = false
  try {
    hasMx = (await withTimeout(resolveMx(domain))).length > 0
    domainResolves = hasMx
  } catch { /* no MX records */ }
  if (!hasMx) {
    try {
      domainResolves = (await withTimeout(resolve4(domain))).length > 0
    } catch {
      try {
        domainResolves = (await withTimeout(resolve6(domain))).length > 0
      } catch { /* unresolved */ }
    }
  }
  return { domainResolves, hasMx }
}

export async function scanWebsite(siteUrl: string, o: ScanOptions): Promise<ScanResult> {
  const started = Date.now()
  const maxPages = o.maxPages ?? 5
  const client = new PoliteClient({
    userAgent: o.userAgent,
    minGapMs: o.minGapMs ?? 2000,
    timeoutMs: 15_000,
    maxBytes: 1_048_576,
    maxRedirects: 5,
  })
  const result: ScanResult = { outcome: 'ok', siteUrl, pages: [], skipped: [], contacts: [], durationMs: 0 }
  const found = new Map<string, FoundContact>()

  const finish = (outcome: ScanOutcome, error?: string): ScanResult => {
    result.outcome = outcome
    result.durationMs = Date.now() - started
    if (error) result.error = error
    return result
  }

  let home: Page
  try {
    home = await client.fetchPage(siteUrl)
  } catch (e) {
    if (!(e instanceof FetchError)) throw e
    if (e.kind === 'dns') return finish('dead', e.message)
    if (e.kind === 'robots') return finish('blocked_by_robots', e.message)
    if (e.kind === 'not_html') return finish('not_html', e.message)
    return finish('unreachable', `${e.kind}: ${e.message}`)
  }
  result.finalUrl = home.finalUrl
  if (home.status === 404 || home.status === 410) return finish('dead', `HTTP ${home.status}`)
  if ([401, 403, 429, 503].includes(home.status)) return finish('blocked', `HTTP ${home.status}`)
  if (home.status < 200 || home.status >= 300) return finish('unreachable', `HTTP ${home.status}`)

  const finalHost = stripWww(new URL(home.finalUrl).hostname)
  const siteDomains = [o.knownDomain ? stripWww(o.knownDomain) : null, finalHost].filter((d): d is string => !!d)

  const collect = (page: Page) => {
    result.pages.push({ url: page.finalUrl, status: page.status, bytes: page.bytes, contentHash: page.hash })
    const ex = extractFromHtml(page.html, page.finalUrl, o.region)
    const contactPage = isContactPageUrl(page.finalUrl)

    for (const r of ex.emails) {
      const email = cleanEmail(r.value)
      if (!email) continue
      const domain = email.split('@')[1] ?? ''
      const free = FREE_MAIL.has(domain)
      const onDomain = siteDomains.some((d) => domain === d || domain.endsWith(`.${d}`) || d.endsWith(`.${domain}`))
      keep(found, {
        type: 'email', value: email, normalizedValue: email, source: r.source, pageUrl: page.finalUrl,
        context: r.context, confidence: emailConfidence(r.source, contactPage, onDomain, free),
        classification: classifyEmail(email), offDomain: !onDomain && !free,
      })
    }
    for (const r of ex.phones) {
      const base = r.source === 'tel' ? 80 : r.source === 'jsonld' ? 75 : 55
      keep(found, {
        type: 'phone', value: r.value, normalizedValue: r.e164, source: r.source, pageUrl: page.finalUrl,
        context: r.context, confidence: Math.min(95, base + (contactPage ? 5 : 0)), classification: 'unknown',
      })
    }
    for (const r of ex.socials) {
      keep(found, {
        type: 'social', value: r.url, normalizedValue: r.url, source: r.source, pageUrl: page.finalUrl,
        context: r.context, confidence: r.source === 'jsonld' ? 75 : 55, classification: 'business',
      })
    }
    if (ex.hasContactForm) {
      keep(found, {
        type: 'contact_form', value: page.finalUrl, normalizedValue: normalizeUrl(page.finalUrl), source: 'form',
        pageUrl: page.finalUrl, context: ex.title, confidence: 70 + (contactPage ? 5 : 0), classification: 'business',
      })
    }
    return ex
  }

  const homeEx = collect(home)

  // Choose subpages: same site only, best-scoring first
  const homeKey = normalizeUrl(home.finalUrl)
  const seen = new Set<string>([homeKey])
  const candidates: { href: string; score: number }[] = []
  for (const l of homeEx.links) {
    let host: string
    try {
      host = stripWww(new URL(l.href).hostname)
    } catch {
      continue
    }
    if (host !== finalHost || SKIP_FILE.test(l.href)) continue
    const key = normalizeUrl(l.href)
    if (seen.has(key)) continue
    const score = pageScore(l.href, l.text)
    if (score === 0) continue
    seen.add(key)
    candidates.push({ href: l.href, score })
  }
  candidates.sort((a, b) => b.score - a.score || a.href.length - b.href.length)
  let picked = candidates.slice(0, maxPages - 1).map((c) => c.href)
  if (!candidates.some((c) => c.score === 100)) {
    const guess = new URL('/contact', home.finalUrl).toString()
    if (!seen.has(normalizeUrl(guess))) picked = [guess, ...picked].slice(0, maxPages - 1)
  }

  for (const href of picked) {
    try {
      const page = await client.fetchPage(href)
      if (page.status < 200 || page.status >= 300) {
        result.skipped.push({ url: href, reason: `HTTP ${page.status}` })
        continue
      }
      collect(page)
    } catch (e) {
      if (!(e instanceof FetchError)) throw e
      result.skipped.push({ url: href, reason: `${e.kind}: ${e.message}` })
    }
  }

  // Email domain checks (DNS only, nothing is sent to anyone)
  const contacts = [...found.values()]
  const domains = new Set(contacts.filter((c) => c.type === 'email').map((c) => c.normalizedValue.split('@')[1] ?? ''))
  const checks = new Map<string, { domainResolves: boolean; hasMx: boolean }>()
  for (const d of domains) if (d) checks.set(d, await checkDomain(d))
  const checkedAt = new Date().toISOString()
  for (const c of contacts) {
    if (c.type !== 'email') continue
    const chk = checks.get(c.normalizedValue.split('@')[1] ?? '')
    if (chk) c.validation = { syntaxValid: true, ...chk, checkedAt }
  }

  result.contacts = contacts
  o.log(`scan ${siteUrl}: ${result.pages.length} pages, ${contacts.length} contacts`)
  return finish(contacts.length > 0 ? 'ok' : 'no_contacts')
}