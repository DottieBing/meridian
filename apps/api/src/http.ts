import { createHash } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { DiscoveryError, type Log } from './types'

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export const userAgent = () => process.env.CRAWLER_USER_AGENT ?? 'MeridianBot/0.1'

/** Runtime data lives in <repo>/data (gitignored). Scripts run from packages/engines/discovery. */
export const dataDir = () =>
  path.resolve(process.env.MERIDIAN_DATA_DIR ?? path.join(process.cwd(), '../../../data'))

/** Guarantees a minimum gap between calls, even when callers overlap. */
export class MinGap {
  private next = 0
  constructor(private readonly gapMs: number) {}
  async wait(): Promise<void> {
    const now = Date.now()
    const at = Math.max(now, this.next)
    this.next = at + this.gapMs
    if (at > now) await sleep(at - now)
  }
}

type Opts = { timeoutMs: number; attempts: number; label: string; log: Log }

function classify(e: unknown, o: Opts): DiscoveryError {
  const timedOut = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')
  return timedOut
    ? new DiscoveryError('timeout', `${o.label}: no response within ${o.timeoutMs / 1000}s`, {
        retryable: true,
      })
    : new DiscoveryError('network', `${o.label}: ${e instanceof Error ? e.message : String(e)}`, {
        retryable: true,
      })
}

async function once<T>(url: string, init: RequestInit, o: Opts): Promise<T> {
  let res: Response
  let text: string
  try {
    res = await fetch(url, {
      ...init,
      headers: { 'User-Agent': userAgent(), Accept: 'application/json', ...init.headers },
      signal: AbortSignal.timeout(o.timeoutMs),
    })
    text = await res.text()
  } catch (e) {
    throw classify(e, o)
  }

  if (!res.ok) {
    const retryable = [429, 502, 503, 504].includes(res.status)
    const ra = Number(res.headers.get('retry-after'))
    throw new DiscoveryError(
      res.status === 429 ? 'rate_limited' : 'http',
      `${o.label}: HTTP ${res.status}`,
      { retryable, ...(ra > 0 ? { retryAfterMs: ra * 1000 } : {}) },
    )
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new DiscoveryError('parse', `${o.label}: not valid JSON (${text.slice(0, 120)})`)
  }
}

export async function fetchJson<T>(url: string, init: RequestInit, o: Opts): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await once<T>(url, init, o)
    } catch (e) {
      if (!(e instanceof DiscoveryError) || !e.retryable || attempt >= o.attempts) throw e
      const wait = e.retryAfterMs ?? Math.min(60_000, 5_000 * 2 ** (attempt - 1))
      o.log(`${e.message}; retry ${attempt}/${o.attempts - 1} in ${Math.round(wait / 1000)}s`)
      await sleep(wait)
    }
  }
}

/** Disk cache for successful responses only. */
export async function withCache<T>(
  key: string,
  ttlMs: number,
  enabled: boolean,
  produce: () => Promise<T>,
): Promise<{ value: T; cached: boolean }> {
  const dir = path.join(dataDir(), 'cache')
  const file = path.join(dir, createHash('sha256').update(key).digest('hex').slice(0, 24) + '.json')
  if (enabled) {
    try {
      const s = await stat(file)
      if (Date.now() - s.mtimeMs < ttlMs) {
        return { value: JSON.parse(await readFile(file, 'utf8')) as T, cached: true }
      }
    } catch {
      /* miss */
    }
  }
  const value = await produce()
  await mkdir(dir, { recursive: true })
  await writeFile(file, JSON.stringify(value))
  return { value, cached: false }
}