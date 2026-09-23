import type { H3Event } from 'h3'
import { z } from 'zod'

const booleanString = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => value === true || value === 'true')

const serverConfigSchema = z.object({
  databaseUrl: z
    .string()
    .url()
    .refine(
      (value) => value.startsWith('postgresql://') || value.startsWith('postgres://'),
      'DATABASE_URL должен использовать PostgreSQL',
    ),
  telegramBotToken: z.string(),
  authSessionSecret: z.string().min(32, 'AUTH_SESSION_SECRET должен содержать минимум 32 символа'),
  authMaxAgeSeconds: z.coerce.number().int().positive().max(604_800),
  demoMode: booleanString,
  telegramBotUsername: z
    .string()
    .regex(/^[A-Za-z0-9_]{5,32}$/)
    .or(z.literal('')),
  reminderJobSecret: z.string().optional(),
  monitoringToken: z.string().optional(),
})

export type ServerConfig = z.infer<typeof serverConfigSchema>

export function getServerConfig(event: H3Event): ServerConfig {
  const runtimeConfig = useRuntimeConfig(event)
  const demoMode = process.env.NUXT_PUBLIC_DEMO_MODE ?? runtimeConfig.public.demoMode
  const developmentSecret =
    String(demoMode) === 'true' ? 'habit-challenge-local-development-secret' : ''

  return serverConfigSchema.parse({
    databaseUrl: process.env.DATABASE_URL ?? runtimeConfig.databaseUrl,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? runtimeConfig.telegramBotToken,
    authSessionSecret:
      process.env.AUTH_SESSION_SECRET || runtimeConfig.authSessionSecret || developmentSecret,
    authMaxAgeSeconds: process.env.AUTH_MAX_AGE_SECONDS ?? runtimeConfig.authMaxAgeSeconds,
    demoMode,
    telegramBotUsername:
      process.env.NUXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? runtimeConfig.public.telegramBotUsername,
    reminderJobSecret: process.env.REMINDER_JOB_SECRET ?? runtimeConfig.reminderJobSecret,
    monitoringToken: process.env.MONITORING_TOKEN ?? runtimeConfig.monitoringToken,
  })
}
