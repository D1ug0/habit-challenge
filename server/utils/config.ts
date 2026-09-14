import type { H3Event } from 'h3'
import { z } from 'zod'

const booleanString = z.union([z.boolean(), z.enum(['true', 'false'])])
  .transform(value => value === true || value === 'true')

const serverConfigSchema = z.object({
  databaseUrl: z.string().url().refine(
    value => value.startsWith('postgresql://') || value.startsWith('postgres://'),
    'DATABASE_URL должен использовать PostgreSQL',
  ),
  telegramBotToken: z.string(),
  authSessionSecret: z.string().min(32, 'AUTH_SESSION_SECRET должен содержать минимум 32 символа'),
  authMaxAgeSeconds: z.coerce.number().int().positive().max(604_800),
  demoMode: booleanString,
  telegramBotUsername: z.string().regex(/^[A-Za-z0-9_]{5,32}$/).or(z.literal('')),
})

export type ServerConfig = z.infer<typeof serverConfigSchema>

export function getServerConfig(event: H3Event): ServerConfig {
  const runtimeConfig = useRuntimeConfig(event)
  const demoMode = runtimeConfig.public.demoMode
  const developmentSecret = String(demoMode) === 'true'
    ? 'habit-challenge-local-development-secret'
    : ''

  return serverConfigSchema.parse({
    databaseUrl: runtimeConfig.databaseUrl,
    telegramBotToken: runtimeConfig.telegramBotToken,
    authSessionSecret: runtimeConfig.authSessionSecret || developmentSecret,
    authMaxAgeSeconds: runtimeConfig.authMaxAgeSeconds,
    demoMode,
    telegramBotUsername: runtimeConfig.public.telegramBotUsername,
  })
}
