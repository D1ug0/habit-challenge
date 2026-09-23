import { defineConfig } from 'drizzle-kit'
import { z } from 'zod'
import { existsSync } from 'node:fs'

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env')

const databaseUrl = z.url().parse(process.env.DATABASE_URL)

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/database/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: databaseUrl,
  },
})
