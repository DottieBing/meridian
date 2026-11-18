import { pageSnapshots, type Db } from '@meridian/db'
import type { Page } from './net'
import { writeSnapshot } from './snapshots'

type Ctx = { workspaceId: string; websiteId: string }

/** Saves one page and returns the snapshot id, or null when the page has no HTML. */
export async function savePageSnapshot(db: Db, ctx: Ctx, p: Page): Promise<string | null> {
  if (!p.html) return null
  const storagePath = await writeSnapshot(p.hash, p.html)
  const [row] = await db
    .insert(pageSnapshots)
    .values({
      workspaceId: ctx.workspaceId,
      websiteId: ctx.websiteId,
      url: p.requestedUrl,
      finalUrl: p.finalUrl,
      status: p.status,
      contentType: p.contentType || null,
      bytes: p.bytes,
      truncated: p.truncated,
      contentHash: p.hash,
      storagePath,
      headers: p.headers,
      redirects: p.redirects,
      ttfbMs: Math.round(p.timing.ttfbMs),
      totalMs: Math.round(p.timing.totalMs),
    })
    .returning({ id: pageSnapshots.id })
  return row?.id ?? null
}

export async function savePageSnapshots(db: Db, ctx: Ctx, pages: Page[]): Promise<number> {
  let saved = 0
  for (const p of pages) {
    if (await savePageSnapshot(db, ctx, p)) saved++
  }
  return saved
}