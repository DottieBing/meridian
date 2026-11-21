import { Resolver } from 'node:dns/promises'

const resolver = new Resolver({ timeout: 2500, tries: 1 })
resolver.setServers(['1.1.1.1', '8.8.8.8'])

let cache: { at: number; online: boolean } | null = null

/** True when this machine can reach the internet. Asks public DNS servers directly, so a site's own DNS problems never count. Cached for 15 seconds. */
export async function isOnline(): Promise<boolean> {
  if (cache && Date.now() - cache.at < 15_000) return cache.online
  let online = false
  for (const host of ['example.com', 'cloudflare.com']) {
    try {
      if ((await resolver.resolve4(host)).length > 0) {
        online = true
        break
      }
    } catch {
      /* try the next host */
    }
  }
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