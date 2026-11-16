import { workspaces, type Db } from '@meridian/db'
import type { FastifyPluginAsync } from 'fastify'

export const workspaceRoutes =
  (db: Db): FastifyPluginAsync =>
  async (app) => {
    app.get('/api/v1/workspaces', async () => {
      const rows = await db
        .select({ id: workspaces.id, name: workspaces.name, createdAt: workspaces.createdAt })
        .from(workspaces)
      return { data: rows }
    })
  }