import { readSnapshot } from '@meridian/crawl'
import { desc, eq, pageSnapshots, type Db } from '@meridian/db'
import { load } from 'cheerio'
import type { AuditContext, AuditFiles, AuditPage } from './types'
import { detectTechnologies } from './tech/detect'

export async function loadPages(db: Db, websiteId: string, maxPages = 8): Promise<AuditPage[]> {
  const rows = await db
    .select()
    .from(pageSnapshots)
    .where(eq(pageSnapshots.websiteId, websiteId))
    .orderBy(desc(pageSnapshots.fetchedAt))
    .limit(120)

  const seen = new Set<string>()
  const pages: AuditPage[] = []
  for (const r of rows) {
    if (r.status < 200 || r.status >= 300 || seen.has(r.finalUrl)) continue
    seen.add(r.finalUrl)
    let html: string
    try {
      html = await readSnapshot(r.storagePath)
    } catch {
      continue
    }
    pages.push({
      snapshotId: r.id,
      requestedUrl: r.url,
      url: r.finalUrl,
      status: r.status,
      bytes: r.bytes,
      truncated: r.truncated,
      headers: r.headers,
      redirects: r.redirects,
      ttfbMs: r.ttfbMs,
      contentHash: r.contentHash,
      storagePath: r.storagePath,
      capturedAt: r.fetchedAt,
      html,
      $: load(html),
    })
    if (pages.length >= maxPages) break
  }
  return pages
}

/** The page the business itself points to: the snapshot of the stored website address. */
export function pickHome(pages: AuditPage[], siteUrl: string): AuditPage | undefined {
  const exact = pages.find((p) => p.requestedUrl === siteUrl)
  if (exact) return exact
  const depth = (p: AuditPage) => {
    try {
      return new URL(p.url).pathname.split('/').filter(Boolean).length
    } catch {
      return 99
    }
  }
  return [...pages].sort((a, b) => depth(a) - depth(b))[0]
}

export function buildContext(siteUrl: string, pages: AuditPage[], files: AuditFiles): AuditContext | undefined {
  const home = pickHome(pages, siteUrl)
  if (!home) return undefined
  const ordered = [home, ...pages.filter((p) => p !== home)]
  return { siteUrl, home, pages: ordered, files, tech: detectTechnologies(ordered) }
}