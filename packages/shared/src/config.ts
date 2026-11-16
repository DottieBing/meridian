import { z } from 'zod'

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_PORT: z.coerce.number().int().min(1).max(65535).default(5173),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
})

export type Config = z.infer<typeof envSchema>

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(env)
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.map(String).join('.')}: ${i.message}`)
    throw new Error(`Invalid configuration:\n${lines.join('\n')}`)
  }
  return result.data
}