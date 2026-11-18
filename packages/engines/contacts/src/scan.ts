import { Resolver, lookup } from 'node:dns/promises'
import { cleanEmail, extractFromHtml } from './extract'
import { FetchError, PoliteClient, type Page } from './net'
import type { FoundContact, Log, ScanOutcome, ScanResult } from './types'
import type { ContactRole } from '@meridian/db'

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

const ROLE_RULES: [ContactRole, RegExp][] = [
  ['privacy_legal', /^(dpo|dpd|privacy|gdpr|dataprotection|data-protection|data\.protection|legal|compliance|dsar|abuse)$/],
  ['no_reply', /^(no[-_.]?reply|do[-_.]?not[-_.]?reply|mailer-daemon|postmaster|bounces?)$/],
  ['technical', /^(webmaster|hostmaster|it|tech|technical|web|website|security)$/],
  ['booking', /^(reservations?|booking|bookings|book|rooms|stay|appointments?|front-?desk|reception)$/],
  ['sales', /^(sales|marketing)$/],
  ['support', /^(support|help|service|customer-?service|care|feedback|guest-?relations|concierge|complaints?)$/],
  ['general', /^(info|contact|hello|hi|office|admin|mail|enquiries|enquiry|welcome|hotel|clinic|team)$/],
]

function emailRole(email: string): ContactRole {
  const local = email.split('@')[0] ?? ''
  for (const [role, re] of ROLE_RULES) if (re.test(local)) return role
  return /^[a-z]{2,}[._-][a-z]{2,}$/.test(local) ? 'named_person' : 'unknown'
}

function classifyEmail(email: string): FoundContact['classification'] {
  const role = emailRole(email)
  if (role === 'named_person') return 'personal'
  return role === 'unknown' ? 'unknown' : 'business'
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

const systemResolver = new Resolver()
const publicResolver = new Resolver()
publicResolver.setServers(['1.1.1.1', '8.8.8.8'])
const DEFINITIVE = new Set(['ENODATA', 'ENOTFOUND'])

/** true / false only when DNS gave a definitive answer; undefined when the lookup itself failed. */
async function mxVia(r: Resolver, domain: string): Promise<boolean | undefined> {
  try {
    return (await withTimeout(r.resolveMx(domain))).length > 0
  } catch (e) {
    const code = (e as { code?: string } | null)?.code
    return code && DEFINITIVE.has(code) ? false : undefined
  }
}

async function checkDomain(domain: string): Promise<{ domainResolves: boolean; hasMx: boolean | null }> {
  const mx = (await mxVia(systemResolver, domain)) ?? (await mxVia(publicResolver, domain))
  if (mx === true) return { domainResolves: true, hasMx: true }
  let domainResolves = false
  try {
    domainResolves = (await withTimeout(lookup(domain, { all: true }))).length > 0
  } catch { /* unresolved */ }
  return { domainResolves, hasMx: mx ?? null }
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

    let home: Page | undefined
  let failure: FetchError | undefined
  for (let attempt = 1; attempt <= 2 && !home; attempt++) {
    try {
      home = await client.fetchPage(siteUrl)
    } catch (e) {
      if (!(e instanceof FetchError)) throw e
      failure = e
      if (e.kind !== 'timeout' && e.kind !== 'network') break // only transient failures are retried
      if (attempt === 1) await new Promise<void>((resolve) => setTimeout(resolve, 5000))
    }
  }
  if (!home) {
    const e = failure ?? new FetchError('network', 'unknown failure')
    if (e.kind === 'dns') return finish('dead', e.message)
    if (e.kind === 'robots') return finish('blocked_by_robots', e.message)
    if (e.kind === 'not_html') return finish('not_html', e.message)
    return finish('unreachable', `${e.kind}: ${e.message}`)
  }

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
        classification: classifyEmail(email), role: emailRole(email), offDomain: !onDomain && !free,
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
        type: 'social', value: r.url, normalizedValue: r.url.toLowerCase(), source: r.source, pageUrl: page.finalUrl,
        context: r.context, confidence: r.source === 'jsonld' ? 75 : 55, classification: 'business',
      })
    }
    if (ex.hasContactForm) {
      keep(found, {
        type: 'contact_form', value: page.finalUrl, normalizedValue: `form:${finalHost}`, source: 'form',
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
  const checks = new Map<string, { domainResolves: boolean; hasMx: boolean | null }>()
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