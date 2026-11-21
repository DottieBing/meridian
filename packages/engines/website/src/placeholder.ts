export type PlaceholderKind =
  | 'parked'
  | 'server_default'
  | 'suspended'
  | 'coming_soon'
  | 'framed_elsewhere'
  | 'redirect_stub'
export type Placeholder = { kind: PlaceholderKind; detail: string }

const SERVER_DEFAULT_TITLES: RegExp[] = [
  /^(?:IIS Windows Server|IIS[\d.]*|Internet Information Services)$/i,
  /^Welcome to nginx!?$/i,
  /^Apache2? (?:Ubuntu |Debian )?Default Page/i,
  /^Test Page for the (?:Apache|Nginx|HTTP Server)/i,
  /^(?:It works!?|Welcome to CentOS|Default Web Site(?: Page)?)$/i,
  /^Index of \//i,
]
const SUSPENDED = /account (?:has been )?suspended|this (?:site|website) (?:has been |is )?(?:suspended|disabled)|bandwidth limit exceeded/i
const PARKED =
  /domain(?: name)? (?:is |may be |might be )?(?:for sale|parked|available for purchase)|buy this domain|domain parking|parked (?:free )?(?:domain|by|at)/i
const COMING_SOON = /^(?:coming soon|under construction|site under construction|website under construction|launching soon)\b/i
const SALE_TARGET =
  /sedo\.|dan\.com|afternic\.|hugedomains\.|delcoso\.|bodis\.|parkingcrew\.|sav\.com|forsale|undeveloped\.|godaddy\.com\/(?:forsale|domainfind)|\/(?:lander|parking|parked|domain-for-sale)\b/i
const TRACKING_FRAME = /googletagmanager\.com|google-analytics\.com|doubleclick\.net|facebook\.com\/tr/i

const visibleText = (html: string): string =>
  html
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const titleOf = (html: string): string =>
  (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '').replace(/\s+/g, ' ').trim()

function redirectTarget(html: string): string | null {
  const metaA = /<meta[^>]+http-equiv=["']?refresh["']?[^>]*content=["'][^"']*?url=([^"'>\s]+)/i.exec(html)?.[1]
  const metaB = /<meta[^>]+content=["'][^"']*?url=([^"'>\s]+)[^>]*http-equiv=["']?refresh/i.exec(html)?.[1]
  const js =
    /(?:window\.|document\.|top\.|self\.|parent\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/i.exec(html)?.[1] ??
    /location\.(?:replace|assign)\(\s*["']([^"']+)["']/i.exec(html)?.[1]
  return metaA ?? metaB ?? js ?? null
}

/** Recognises addresses that do not host a real website. Only small pages and well-known server defaults are judged. */
export function detectPlaceholder(html: string, bytes: number): Placeholder | null {
  const title = titleOf(html)
  if (SERVER_DEFAULT_TITLES.some((re) => re.test(title))) {
    return { kind: 'server_default', detail: `The server shows its default page ("${title}"): no website is installed.` }
  }

  const text = visibleText(html)
  if (bytes > 4000 || text.length > 300) return null

  if (SUSPENDED.test(title) || SUSPENDED.test(text)) {
    return { kind: 'suspended', detail: 'The page says the hosting account is suspended.' }
  }
  if (PARKED.test(title) || PARKED.test(text)) {
    return { kind: 'parked', detail: 'The page says the domain is parked or for sale.' }
  }
  if (COMING_SOON.test(title) || COMING_SOON.test(text)) {
    return { kind: 'coming_soon', detail: 'The page is a "coming soon" or "under construction" placeholder.' }
  }

  const withoutNoscript = html.replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
  const frame = /<i?frame\b[^>]*\bsrc=["']([^"']+)["']/i.exec(withoutNoscript)?.[1]
  if (frame && !TRACKING_FRAME.test(frame) && (/<frameset/i.test(html) || text.length < 50)) {
    return SALE_TARGET.test(frame)
      ? { kind: 'parked', detail: `The whole page is a frame showing a domain-sale page (${frame}).` }
      : { kind: 'framed_elsewhere', detail: `The whole page is a frame showing ${frame}.` }
  }

  const target = redirectTarget(html)
  if (target) {
    return SALE_TARGET.test(target)
      ? { kind: 'parked', detail: `The page sends visitors to a domain-sale or parking page (${target}).` }
      : { kind: 'redirect_stub', detail: `The page only redirects with a script, to ${target}.` }
  }
  return null
}