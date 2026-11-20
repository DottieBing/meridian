import { dirname, join } from 'node:path'
import { snapshotRoot } from '@meridian/crawl'

/** Screenshots live next to the page snapshots: <data dir>/screenshots. */
export function screenshotDir(): string {
  return join(dirname(snapshotRoot()), 'screenshots')
}