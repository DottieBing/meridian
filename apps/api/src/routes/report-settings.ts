import { createReadStream, createWriteStream, existsSync } from 'node:fs'
import { mkdir, unlink } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { eq, reportSettings, workspaces, type Db } from '@meridian/db'
import { screenshotDir } from '@meridian/website'
import type { FastifyPluginAsync } from 'fastify'

const TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

/** Logos live next to screenshots, in their own folder, so they share the data directory. */
function logoDir(): string {
  return join(dirname(screenshotDir()), 'logos')
}

export const reportSettingsRoutes =
  (db: Db): FastifyPluginAsync =>
  async (app) => {
    // Single-workspace tool for now: always the first workspace.
    const workspaceId = async (): Promise<string> => {
      const [ws] = await db.select({ id: workspaces.id }).from(workspaces).limit(1)
      if (!ws) throw new Error('No workspace exists. Run pnpm db:seed.')
      return ws.id
    }

    const ensureRow = async (ws: string) => {
      const [row] = await db.select().from(reportSettings).where(eq(reportSettings.workspaceId, ws)).limit(1)
      if (row) return row
      const [created] = await db.insert(reportSettings).values({ workspaceId: ws }).onConflictDoNothing().returning()
      if (created) return created
      const [again] = await db.select().from(reportSettings).where(eq(reportSettings.workspaceId, ws)).limit(1)
      if (!again) throw new Error('report_settings row could not be created')
      return again
    }

    app.get('/api/v1/report-settings', async () => {
      return { data: await ensureRow(await workspaceId()) }
    })

    app.put('/api/v1/report-settings', async (req, reply) => {
      const body = (req.body ?? {}) as {
        orgName?: unknown
        contactLine?: unknown
        brandMode?: unknown
        showMeridianCredit?: unknown
      }
      if (typeof body.orgName !== 'string' || typeof body.contactLine !== 'string') {
        return reply.code(400).send({ error: 'orgName and contactLine are required strings' })
      }
      const modes = ['auto', 'own', 'cobrand', 'meridian'] as const
      const mode = modes.find((m) => m === body.brandMode)
      const ws = await workspaceId()
      await ensureRow(ws)
      const [row] = await db
        .update(reportSettings)
        .set({
          orgName: body.orgName.trim().slice(0, 200),
          contactLine: body.contactLine.trim().slice(0, 300),
          ...(mode ? { brandMode: mode } : {}),
          ...(typeof body.showMeridianCredit === 'boolean' ? { showMeridianCredit: body.showMeridianCredit } : {}),
          updatedAt: new Date(),
        })
        .where(eq(reportSettings.workspaceId, ws))
        .returning()
      return { data: row }
    })

    app.post('/api/v1/report-settings/logo', async (req, reply) => {
      const file = await req.file()
      if (!file) return reply.code(400).send({ error: 'No file uploaded' })
      const ext = extname(file.filename).toLowerCase()
      if (!TYPES[ext]) return reply.code(400).send({ error: 'Logo must be png, jpg, webp or svg' })

      const ws = await workspaceId()
      const current = await ensureRow(ws)
      const dir = logoDir()
      await mkdir(dir, { recursive: true })
      const fileName = `${ws}${ext}`
      const full = join(dir, fileName)
      await pipeline(file.file, createWriteStream(full))
      if (file.file.truncated) {
        await unlink(full).catch(() => undefined)
        return reply.code(400).send({ error: 'Logo must be under 2 MB' })
      }

      if (current.logoPath && current.logoPath !== fileName) {
        await unlink(join(dir, current.logoPath)).catch(() => undefined)
      }
      const [row] = await db
        .update(reportSettings)
        .set({ logoPath: fileName, updatedAt: new Date() })
        .where(eq(reportSettings.workspaceId, ws))
        .returning()
      return { data: row }
    })

    app.delete('/api/v1/report-settings/logo', async () => {
      const ws = await workspaceId()
      const current = await ensureRow(ws)
      if (current.logoPath) await unlink(join(logoDir(), current.logoPath)).catch(() => undefined)
      const [row] = await db
        .update(reportSettings)
        .set({ logoPath: null, updatedAt: new Date() })
        .where(eq(reportSettings.workspaceId, ws))
        .returning()
      return { data: row }
    })

    app.get('/api/v1/report-settings/logo', async (_req, reply) => {
      const row = await ensureRow(await workspaceId())
      if (!row.logoPath) return reply.code(404).send({ error: 'No logo set' })
      const full = join(logoDir(), row.logoPath)
      if (!existsSync(full)) return reply.code(404).send({ error: 'Logo file is missing' })
      return reply
        .header('Cache-Control', 'private, max-age=300')
        .header('X-Content-Type-Options', 'nosniff')
        .header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox")
        .type(TYPES[extname(row.logoPath).toLowerCase()] ?? 'application/octet-stream')
        .send(createReadStream(full))
    })
  }