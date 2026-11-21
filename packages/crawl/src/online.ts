import { connect } from 'node:net'

function canConnect(host: string, port: number, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port })
    const done = (ok: boolean) => {
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(ms, () => done(false))
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
  })
}

let cache: { at: number; online: boolean } | null = null

/** True when this machine can reach the internet. Connects straight to public addresses, so no website's DNS problems can count. Cached for 15 seconds. */
export async function isOnline(): Promise<boolean> {
  if (cache && Date.now() - cache.at < 15_000) return cache.online
  const results = await Promise.all([canConnect('1.1.1.1', 443, 3000), canConnect('8.8.8.8', 443, 3000)])
  const online = results.some(Boolean)
  cache = { at: Date.now(), online }
  return online
}

/** Waits until the connection returns. False if it did not within maxMs. */
export async function waitForOnline(maxMs: number): Promise<boolean> {
  const until = Date.now() + maxMs
  while (Date.now() < until) {
    cache = null
    if (await isOnline()) return true
    await new Promise<void>((resolve) => setTimeout(resolve, 15_000))
  }
  return false
}