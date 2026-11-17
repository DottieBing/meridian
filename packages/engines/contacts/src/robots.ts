export type Robots = {
  isAllowed: (pathAndQuery: string) => boolean
  crawlDelayMs: number | undefined
}

export const ALLOW_ALL: Robots = { isAllowed: () => true, crawlDelayMs: undefined }
export const DENY_ALL: Robots = { isAllowed: () => false, crawlDelayMs: undefined }

type Rule = { allow: boolean; re: RegExp; len: number }
type Group = { agents: string[]; rules: Rule[]; delay: number | undefined }

function compile(pattern: string): RegExp {
  const anchored = pattern.endsWith('$')
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
  return new RegExp(`^${body}${anchored ? '$' : ''}`)
}

/** Minimal RFC 9309 parser: group selection by product token, longest-match rule, allow wins ties. */
export function parseRobots(body: string, userAgent: string): Robots {
  const token = (/^[A-Za-z0-9_-]+/.exec(userAgent)?.[0] ?? '').toLowerCase()
  const groups: Group[] = []
  let current: Group | undefined
  let lastWasAgent = false

  for (const raw of body.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim()
    const idx = line.indexOf(':')
    if (idx < 1) continue
    const key = line.slice(0, idx).trim().toLowerCase()
    const value = line.slice(idx + 1).trim()
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], delay: undefined }
        groups.push(current)
      }
      current.agents.push(value.toLowerCase())
      lastWasAgent = true
      continue
    }
    lastWasAgent = false
    if (!current) continue
    if ((key === 'allow' || key === 'disallow') && value !== '') {
      current.rules.push({ allow: key === 'allow', re: compile(value), len: value.length })
    } else if (key === 'crawl-delay') {
      const n = Number(value)
      if (Number.isFinite(n) && n >= 0) current.delay = n
    }
  }

  const specific = groups.filter((g) => g.agents.some((a) => a !== '*' && a !== '' && token.includes(a)))
  const chosen = specific.length > 0 ? specific : groups.filter((g) => g.agents.includes('*'))
  const rules = chosen.flatMap((g) => g.rules)
  const delay = chosen.map((g) => g.delay).find((d): d is number => d !== undefined)

  return {
    isAllowed(path) {
      let best: Rule | undefined
      for (const r of rules) {
        if (!r.re.test(path)) continue
        if (!best || r.len > best.len || (r.len === best.len && r.allow)) best = r
      }
      return best ? best.allow : true
    },
    crawlDelayMs: delay === undefined ? undefined : Math.min(delay, 10) * 1000,
  }
}