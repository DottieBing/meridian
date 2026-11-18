import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'

function findRepoRoot(start: string = process.cwd()): string {
  let dir = resolve(start)
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    const parent = dirname(dir)
    if (parent === dir) return resolve(start)
    dir = parent
  }
}

/** SNAPSHOT_DIR if set, otherwise <repo root>/data/snapshots. Always an absolute path. */
export function snapshotRoot(): string {
  const configured = process.env.SNAPSHOT_DIR
  if (configured) return isAbsolute(configured) ? configured : resolve(findRepoRoot(), configured)
  return join(findRepoRoot(), 'data', 'snapshots')
}

/** Stores the page text gzipped, named by its content hash. Identical content is stored once. */
export async function writeSnapshot(hash: string, html: string): Promise<string> {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid snapshot hash')
  const rel = `${hash.slice(0, 2)}/${hash}.html.gz`
  const full = join(snapshotRoot(), rel)
  if (existsSync(full)) return rel
  await mkdir(dirname(full), { recursive: true })
  const tmp = `${full}.${process.pid}.tmp`
  await writeFile(tmp, gzipSync(Buffer.from(html, 'utf8')))
  try {
    await rename(tmp, full)
  } catch (e) {
    if (!existsSync(full)) throw e // another process may have stored the same page first
  }
  return rel
}

export async function readSnapshot(storagePath: string): Promise<string> {
  const root = resolve(snapshotRoot())
  const full = resolve(root, storagePath)
  if (!full.startsWith(root)) throw new Error('Snapshot path escapes the snapshot directory')
  return gunzipSync(await readFile(full)).toString('utf8')
}