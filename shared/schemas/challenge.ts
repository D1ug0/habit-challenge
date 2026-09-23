import { z } from 'zod'
import { isValidTimeZone } from '../domain/time'

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/

function isCalendarDate(value: string): boolean {
  if (!isoDatePattern.test(value)) {
    return false
  }

  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
}

export const challengeIdSchema = z.uuid()

export const createChallengeSchema = z.object({
  title: z.string().trim().min(2, 'Введите минимум 2 символа').max(80, 'Максимум 80 символов'),
  description: z.string().trim().max(500, 'Максимум 500 символов').optional().default(''),
  emoji: z.string().trim().min(1, 'Выберите emoji').max(12, 'Слишком длинное значение'),
  type: z.enum(['personal', 'group']),
  isPrivate: z.boolean().default(false),
  durationDays: z.union([z.literal(7), z.literal(14), z.literal(30)]),
  startDate: z.string().refine(isCalendarDate, 'Некорректная дата'),
})

export const editChallengeSchema = createChallengeSchema.pick({
  title: true,
  description: true,
  emoji: true,
})

export const profileSettingsSchema = z.object({
  timeZone: z.string().trim().max(64).refine(isValidTimeZone, 'Некорректный часовой пояс'),
  reminderEnabled: z.boolean(),
  reminderHour: z.number().int().min(0).max(23),
})

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
})

export const telegramAuthSchema = z.object({
  initData: z.string().max(16_384),
  timeZone: z.string().trim().max(64).refine(isValidTimeZone, 'Некорректный часовой пояс'),
})

export const emptyMutationSchema = z.object({}).strict()
export const inviteTokenSchema = z
  .string()
  .regex(/^[a-f0-9]{16}$/)
  .optional()
export const joinChallengeSchema = z.object({ inviteToken: inviteTokenSchema }).strict()

export type CreateChallengeInput = z.infer<typeof createChallengeSchema>
export type EditChallengeInput = z.infer<typeof editChallengeSchema>
export type ProfileSettingsInput = z.infer<typeof profileSettingsSchema>
