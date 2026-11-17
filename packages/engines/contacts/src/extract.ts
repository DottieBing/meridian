import * as cheerio from 'cheerio'
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'
import type { ExtractSource } from './types'

export type RawEmail = { value: string; source: ExtractSource; context: string }
export type RawPhone = { value: string; e164: string; source: ExtractSource; context: string }
export type RawSocial = { url: string; platform: string; source: ExtractSource; context: string }
export type Extracted = {
  title: string
  emails: RawEmail[]
  phones: RawPhone[]
  socials: RawSocial[]
  hasContactForm: boolean
  links: { href: string; text: string }[]
}

const ASSET_TLDS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'css', 'js', 'woff', 'woff2', 'ico', 'avif', 'pdf', 'mp4'])
const JUNK_DOMAINS = new Set([
  'example.com', 'example.org', 'domain.com', 'yourdomain.com', 'yoursite.com', 'mysite.com',
  'email.com', 'test.com', 'sentry.io', 'wixpress.com', 'sentry-next.wixpress.com',
])
const JUNK_LOCALS = new Set(['your', 'name', 'email', 'user', 'username', 'yourname', 'youremail', 'example', 'test', 'someone'])

export function cleanEmail(raw: string): string | undefined {
  const e = raw.trim().toLowerCase().replace(/^mailto:/, '').replace(/[.,;:)>\]]+$/, '')
  if (e.length > 254 || !/^[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,24}$/.test(e)) return undefined
  const [local = '', domain = ''] = e.split('@')
  const tld = domain.split('.').pop() ?? ''
  if (ASSET_TLDS.has(tld) || JUNK_DOMAINS.has(domain) || JUNK_LOCALS.has(local)) return undefined
  return e
}

function decodeCfEmail(hex: string): string | undefined {
  if (!/^[0-9a-f]{4,}$/i.test(hex) || hex.length % 2 !== 0) return undefined
  const key = parseInt(hex.slice(0, 2), 16)
  let out = ''
  for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key)
  return out
}

function toE164(raw: string, region: string | null): string | undefined {
  const cleaned = raw.trim().replace(/^00/, '+')
  const p = parsePhoneNumberFromString(cleaned, (region ?? undefined) as CountryCode | undefined)
  return p?.isValid() ? p.number : undefined
}

const SOCIAL_HOSTS: Record<string, string> = {
  'facebook.com': 'facebook', 'fb.com': 'facebook', 'instagram.com': 'instagram',
  'linkedin.com': 'linkedin', 'twitter.com': 'x', 'x.com': 'x',
  'youtube.com': 'youtube', 'tiktok.com': 'tiktok',
}
const BAD_FIRST = new Set([
  'sharer', 'sharer.php', 'share', 'dialog', 'plugins', 'tr', 'login', 'intent', 'home', 'i',
  'hashtag', 'explore', 'accounts', 'p', 'reel', 'reels', 'stories', 'watch', 'embed',
  'results', 'search', 'policies', 'legal', 'help',
])

export function canonicalSocial(raw: string, base?: string): { url: string; platform: string } | undefined {
  let u: URL
  try {
    u = new URL(raw, base)
  } catch {
    return undefined
  }
  const host = u.hostname.toLowerCase().replace(/^(www|m|mobile)\./, '')
  const platform = SOCIAL_HOSTS[host]
  if (!platform) return undefined
  const segs = u.pathname.split('/').filter(Boolean)
  const first = segs[0]?.toLowerCase()
  if (!first || BAD_FIRST.has(first)) return undefined
  if (platform === 'linkedin' && !['company', 'in', 'school'].includes(first)) return undefined
  if (platform === 'youtube' && !(first.startsWith('@') || ['channel', 'c', 'user'].includes(first))) return undefined
  if (platform === 'tiktok' && !first.startsWith('@')) return undefined
  if (first === 'profile.php') {
    const id = u.searchParams.get('id')
    return id ? { url: `https://${host}/profile.php?id=${id}`, platform } : undefined
  }
  const keep =
    platform === 'linkedin' ? 2 : platform === 'youtube' ? (first.startsWith('@') ? 1 : 2) : first === 'pages' ? 3 : 1
  return { url: `https://${host}/${segs.slice(0, keep).join('/')}`.toLowerCase(), platform }
}

type LdFound = { emails: string[]; phones: string[]; sameAs: string[] }
const strings = (v: unknown): string[] =>
  typeof v === 'string' ? [v] : Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []

function walkLd(node: unknown, out: LdFound, depth = 0): void {
  if (depth > 8) return
  if (Array.isArray(node)) {
    for (const n of node) walkLd(n, out, depth + 1)
    return
  }
  if (node === null || typeof node !== 'object') return
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k === 'email') out.emails.push(...strings(v))
    else if (k === 'telephone') out.phones.push(...strings(v))
    else if (k === 'sameAs') out.sameAs.push(...strings(v))
    else walkLd(v, out, depth + 1)
  }
}

const EMAIL_RE = /[a-z0-9][a-z0-9._%+-]{0,63}@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,24}/gi
const PHONE_INTL_RE = /(?:\+|00)\s?\d[\d\s().\-–]{6,18}\d/g
const PHONE_LABELED_RE = /(?:tel(?:ephone)?|phone|mob(?:ile)?|call|τηλ(?:έφωνο)?)\.?\s*[:.\-]?\s*((?:\+|00)?\d[\d\s().\-–]{6,16}\d)/gi

const around = (text: string, index: number, length: number): string =>
  text.slice(Math.max(0, index - 80), Math.min(text.length, index + length + 80)).trim()

export function extractFromHtml(html: string, pageUrl: string, region: string | null): Extracted {
  const $ = cheerio.load(html)
  const emails: RawEmail[] = []
  const phones: RawPhone[] = []
  const socials: RawSocial[] = []
  const links: Extracted['links'] = []

  const addPhone = (raw: string, source: ExtractSource, context: string) => {
    const e164 = toE164(raw, region)
    if (e164) phones.push({ value: raw.trim(), e164, source, context })
  }
  const addSocial = (raw: string, source: ExtractSource, context: string) => {
    const s = canonicalSocial(raw, pageUrl)
    if (s) socials.push({ url: s.url, platform: s.platform, source, context })
  }

  // Cloudflare-obfuscated emails
  $('[data-cfemail]').each((_, el) => {
    const dec = decodeCfEmail($(el).attr('data-cfemail') ?? '')
    if (dec) {
      emails.push({
        value: dec, source: 'cfemail',
        context: $(el).parent().text().replace(/\s+/g, ' ').trim().slice(0, 200),
      })
    }
  })
  $('a[href*="/cdn-cgi/l/email-protection#"]').each((_, el) => {
    const dec = decodeCfEmail(($(el).attr('href') ?? '').split('#')[1] ?? '')
    if (dec) emails.push({ value: dec, source: 'cfemail', context: $(el).parent().text().replace(/\s+/g, ' ').trim().slice(0, 200) })
  })

  // Links: mailto, tel, social, and candidates for subpages
  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') ?? '').trim()
    if (!href) return
    const text = $(el).text().replace(/\s+/g, ' ').trim()
    const ctx = ($(el).parent().text().replace(/\s+/g, ' ').trim() || text).slice(0, 200)
    const lower = href.toLowerCase()
    if (lower.startsWith('mailto:')) {
      let addr = href.slice(7).split('?')[0] ?? ''
      try { addr = decodeURIComponent(addr) } catch { /* keep raw */ }
      for (const a of addr.split(/[,;]/)) emails.push({ value: a.trim(), source: 'mailto', context: ctx })
    } else if (lower.startsWith('tel:')) {
      let raw = href.slice(4)
      try { raw = decodeURIComponent(raw) } catch { /* keep raw */ }
      addPhone(raw.split(';')[0] ?? raw, 'tel', ctx)
    } else {
      addSocial(href, 'link', ctx)
      try {
        const abs = new URL(href, pageUrl)
        if (abs.protocol === 'http:' || abs.protocol === 'https:') {
          links.push({ href: abs.toString().split('#')[0] ?? abs.toString(), text })
        }
      } catch { /* ignore */ }
    }
  })

  // JSON-LD structured data
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const found: LdFound = { emails: [], phones: [], sameAs: [] }
      walkLd(JSON.parse($(el).html() ?? ''), found)
      for (const e of found.emails) emails.push({ value: e, source: 'jsonld', context: 'JSON-LD structured data' })
      for (const p of found.phones) addPhone(p, 'jsonld', 'JSON-LD structured data')
      for (const s of found.sameAs) addSocial(s, 'jsonld', 'JSON-LD sameAs')
    } catch { /* invalid JSON-LD */ }
  })

  // Contact form: a form with a message box and no password field
  let hasContactForm = false
  $('form').each((_, f) => {
    const $f = $(f)
    if ($f.find('textarea').length > 0 && $f.find('input[type="password"]').length === 0) hasContactForm = true
  })

  const title = $('title').first().text().replace(/\s+/g, ' ').trim().slice(0, 200)

  // Visible text
  $('script, style, noscript, template').remove()
  $('p, div, li, td, th, tr, br, h1, h2, h3, h4, h5, h6, section, article, header, footer, address, dd, dt, label, form').each(
    (_, el) => { $(el).before(' ').after(' ') },
  )
  const rawText = $('body').length > 0 ? $('body').text() : $.root().text()
  const text = rawText.replace(/\s+/g, ' ')
  const deob = text
    .replace(/\s*[[({]\s*(?:at|AT)\s*[\])}]\s*/g, '@')
    .replace(/\s*[[({]\s*(?:dot|DOT)\s*[\])}]\s*/g, '.')

  const seen = new Set<string>()
  for (const m of text.matchAll(EMAIL_RE)) {
    seen.add(m[0].toLowerCase())
    emails.push({ value: m[0], source: 'text', context: around(text, m.index ?? 0, m[0].length) })
  }
  if (deob !== text) {
    for (const m of deob.matchAll(EMAIL_RE)) {
      if (seen.has(m[0].toLowerCase())) continue
      emails.push({ value: m[0], source: 'obfuscated', context: around(deob, m.index ?? 0, m[0].length) })
    }
  }

  for (const m of text.matchAll(PHONE_INTL_RE)) {
    addPhone(m[0], 'text', around(text, m.index ?? 0, m[0].length))
  }
  for (const m of text.matchAll(PHONE_LABELED_RE)) {
    if (m[1]) addPhone(m[1], 'text', around(text, m.index ?? 0, m[0].length))
  }

  return { title, emails, phones, socials, hasContactForm, links }
}