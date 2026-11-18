import { createHash } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { ALLOW_ALL, DENY_ALL, parseRobots, type Robots } from './robots'

export type FetchErrorKind =
  | 'dns' | 'timeout' | 'network' | 'blocked_host' | 'redirects' | 'not_html' | 'robots' | 'bad_url'

export class FetchError extends Error {
  readonly kind: FetchErrorKind
  constructor(kind: FetchErrorKind, message: string) {
    super(message)
    this.name = 'FetchError'
    this.kind = kind
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function isPrivateIPv4(ip: string): boolean {
  const [a = 0, b = 0] = ip.split('.').map(Number)
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  )
}

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) return isPrivateIPv4(ip)
  const v6 = ip.toLowerCase()
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6)
  if (mapped?.[1]) return isPrivateIPv4(mapped[1])
  return v6 === '::1' || v6 === '::' || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6)
}

async function assertPublic(u: URL): Promise<void> {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new FetchError('bad_url', `Unsupported scheme ${u.protocol}`)
  }
  if (u.port !== '' && u.port !== '80' && u.port !== '443') {
    throw new FetchError('bad_url', `Unusual port ${u.port}`)
  }
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new FetchError('blocked_host', `${host} is a private address`)
    return
  }
  let addrs: { address: string }[]
    try {
    addrs = await lookup(host, { all: true })
  } catch (e) {
    const code = (e as { code?: string } | null)?.code
    throw code === 'ENOTFOUND' || code === 'ENODATA'
      ? new FetchError('dns', `Cannot resolve ${host}`)
      : new FetchError('network', `DNS lookup failed for ${host} (${code ?? 'unknown'})`)
  }
}

function classify(e: unknown): FetchError {
  if (e instanceof FetchError) return e
  const code = (e as { cause?: { code?: string } } | null)?.cause?.code
  if (code === 'ENOTFOUND') return new FetchError('dns', 'DNS lookup failed')
  const name = e instanceof Error ? e.name : ''
  if (name === 'TimeoutError' || name === 'AbortError') return new FetchError('timeout', 'Request timed out')
  return new FetchError('network', e instanceof Error ? `${e.message}${code ? ` (${code})` : ''}` : String(e))
}

async function readCapped(
  res: Response, maxBytes: number,
): Promise<{ text: string; bytes: number; truncated: boolean }> {
  const reader = res.body?.getReader()
  if (!reader) return { text: '', bytes: 0, truncated: false }
  const chunks: Uint8Array[] = []
  let total = 0
  let truncated = false
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      chunks.push(value.subarray(0, value.byteLength - (total - maxBytes)))
      total = maxBytes
      truncated = true
      await reader.cancel()
      break
    }
    chunks.push(value)
  }
  const buf = Buffer.concat(chunks)
  const charset =
    /charset=([\w-]+)/i.exec(res.headers.get('content-type') ?? '')?.[1] ??
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(buf.subarray(0, 2048).toString('latin1'))?.[1] ??
    'utf-8'
  let text: string
  try {
    text = new TextDecoder(charset).decode(buf)
  } catch {
    text = buf.toString('utf8')
  }
  return { text, bytes: total, truncated }
}

export type Page = {
  requestedUrl: string
  finalUrl: string
  status: number
  html: string
  bytes: number
  hash: string
  truncated: boolean
}

export type ClientOptions = {
  userAgent: string
  minGapMs: number
  timeoutMs: number
  maxBytes: number
  maxRedirects: number
}

type Raw = {
  status: number
  location: string | undefined
  contentType: string
  body: string
  bytes: number
  truncated: boolean
}

export class PoliteClient {
  private readonly lastRequestAt = new Map<string, number>()
  private readonly robots = new Map<string, Promise<Robots>>()
  private readonly o: ClientOptions

  constructor(o: ClientOptions) {
    this.o = o
  }

  private async pace(host: string, delayMs: number): Promise<void> {
    const wait = (this.lastRequestAt.get(host) ?? 0) + delayMs - Date.now()
    if (wait > 0) await sleep(wait)
    this.lastRequestAt.set(host, Date.now())
  }

  private async single(
    url: URL, accept: string, maxBytes: number, delayMs: number, requireHtml: boolean,
  ): Promise<Raw> {
    await assertPublic(url)
    await this.pace(url.host, delayMs)
    let res: Response
    try {
      res = await fetch(url, {
        redirect: 'manual',
        headers: {
          'User-Agent': this.o.userAgent,
          Accept: accept,
          'Accept-Language': 'en,el;q=0.8',
        },
        signal: AbortSignal.timeout(this.o.timeoutMs),
      })
    } catch (e) {
      throw classify(e)
    }
    const location = res.headers.get('location') ?? undefined
    const contentType = res.headers.get('content-type') ?? ''
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel().catch(() => undefined)
      return { status: res.status, location, contentType, body: '', bytes: 0, truncated: false }
    }
    if (requireHtml && res.status < 300 && contentType && !/html|xml/i.test(contentType)) {
      await res.body?.cancel().catch(() => undefined)
      throw new FetchError('not_html', `Content-Type is ${contentType}`)
    }
    try {
      const b = await readCapped(res, maxBytes)
      return { status: res.status, location: undefined, contentType, body: b.text, bytes: b.bytes, truncated: b.truncated }
    } catch (e) {
      throw classify(e)
    }
  }

  private async follow(
    start: URL, accept: string, maxBytes: number, checkRobots: boolean, requireHtml: boolean,
  ): Promise<Raw & { finalUrl: URL }> {
    let url = start
    for (let hop = 0; hop <= this.o.maxRedirects; hop++) {
      let delay = this.o.minGapMs
      if (checkRobots) {
        const robots = await this.robotsFor(url)
        if (!robots.isAllowed(url.pathname + url.search)) {
          throw new FetchError('robots', `robots.txt disallows ${url.pathname}`)
        }
        delay = Math.max(delay, robots.crawlDelayMs ?? 0)
      }
      const r = await this.single(url, accept, maxBytes, delay, requireHtml)
      if (r.status >= 300 && r.status < 400 && r.location) {
        try {
          url = new URL(r.location, url)
        } catch {
          throw new FetchError('bad_url', 'Invalid redirect location')
        }
        continue
      }
      return { ...r, finalUrl: url }
    }
    throw new FetchError('redirects', 'Too many redirects')
  }

  private robotsFor(url: URL): Promise<Robots> {
    let p = this.robots.get(url.origin)
    if (!p) {
      p = this.loadRobots(new URL('/robots.txt', url.origin))
      this.robots.set(url.origin, p)
    }
    return p
  }

  private async loadRobots(u: URL): Promise<Robots> {
    const r = await this.follow(u, 'text/plain,*/*;q=0.5', 512 * 1024, false, false)
    if (r.status >= 500) return DENY_ALL
    if (r.status >= 400) return ALLOW_ALL
    return parseRobots(r.body, this.o.userAgent)
  }

  async fetchPage(raw: string): Promise<Page> {
    let u: URL
    try {
      u = new URL(raw)
    } catch {
      throw new FetchError('bad_url', `Invalid URL ${raw}`)
    }
    const r = await this.follow(u, 'text/html,application/xhtml+xml;q=0.9', this.o.maxBytes, true, true)
    const ok = r.status >= 200 && r.status < 300
    return {
      requestedUrl: raw,
      finalUrl: r.finalUrl.toString(),
      status: r.status,
      html: ok ? r.body : '',
      bytes: r.bytes,
      hash: createHash('sha256').update(r.body).digest('hex'),
      truncated: r.truncated,
    }
  }
}