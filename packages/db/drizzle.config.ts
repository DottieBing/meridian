import { defineConfig } from 'drizzle-kit'
import { resolve } from 'node:path'

try {
  process.loadEnvFile(resolve(process.cwd(), '../../.env'))
} catch {
  // DATABASE_URL may already be set in the environment
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set (check the .env file in the repo root)')
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './migrations',
  dbCredentials: { url: process.env.DATABASE_URL },
})