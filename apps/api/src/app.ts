import cors from '@fastify/cors'
import type { Db } from '@meridian/db'
import type { Config } from '@meridian/shared'
import Fastify from 'fastify'
import { healthRoutes } from './routes/health'
import { workspaceRoutes } from './routes/workspaces'

export type AppDeps = {
  config: Config
  db: Db
  checkDb: () => Promise<void>
}

export async function buildApp({ config, db, checkDb }: AppDeps) {
  const app = Fastify({
    logger:
      config.NODE_ENV === 'development'
        ? {
            level: config.LOG_LEVEL,
            transport: {
              target: 'pino-pretty',
              options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
            },
          }
        : { level: config.LOG_LEVEL },
  })

  await app.register(cors, {
    origin: [`http://localhost:${config.WEB_PORT}`, `http://127.0.0.1:${config.WEB_PORT}`],
  })

  await app.register(healthRoutes(checkDb))
  await app.register(workspaceRoutes(db))

  return app
}