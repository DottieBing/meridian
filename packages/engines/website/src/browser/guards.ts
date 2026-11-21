/** True for addresses that must never be fetched by the browser: loopback, private and link-local ranges. */
export function isPrivateHost(rawHost: string): boolean {
  const host = rawHost.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return true
  }
  if (host === '::1' || host === '::' || /^f[cd][0-9a-f]{2}:/.test(host) || /^fe80:/.test(host)) return true
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!m) return false
  const a = Number(m[1])
  const b = Number(m[2])
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  )
}

const BLOCK_RE =
  /access denied|forbidden|request blocked|you have been blocked|attention required|just a moment|checking your browser|verify you are (?:a )?human|captcha|security check|error 1020|not authorized|unusual traffic/i

export type ReadingCheck = { textChars: number; textSample: string; requests: number; transferBytes: number }

/** Decides whether a browser reading is of the real site. Short pages that say "access denied", or pages that rendered almost nothing, are not. */
export function unusableReading(m: ReadingCheck): 'blocked' | 'empty_page' | null {
  if (m.textChars < 600 && BLOCK_RE.test(m.textSample)) return 'blocked'
  if (m.textChars < 40 && m.requests <= 4 && m.transferBytes < 50_000) return 'empty_page'
  return null
}