import { eq } from 'drizzle-orm'
import type { ParticipantUserDto, UserDto } from '#shared/types/api'
import type { Database } from '../database'
import { challenges, users } from '../database/schema'
import type { ProfileSettingsInput } from '#shared/schemas/challenge'
import type { VerifiedTelegramUser } from '../utils/telegram-auth'

export type UserRecord = typeof users.$inferSelect
type UserIdentityInput = VerifiedTelegramUser & { timeZone: string }

export function toUserDto(user: UserRecord): UserDto {
  return {
    id: user.id,
    telegramId: user.telegramId,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    photoUrl: user.photoUrl,
    timeZone: user.timeZone,
    reminderEnabled: user.reminderEnabled,
    reminderHour: user.reminderHour,
    createdAt: user.createdAt.toISOString(),
  }
}

export function toParticipantUserDto(user: UserRecord): ParticipantUserDto {
  return {
    id: user.id,
    firstName: user.firstName,
    photoUrl: user.photoUrl,
  }
}

export async function upsertTelegramUser(
  db: Database,
  input: UserIdentityInput,
): Promise<UserRecord> {
  const [user] = await db
    .insert(users)
    .values(input)
    .onConflictDoUpdate({
      target: users.telegramId,
      set: {
        username: input.username,
        firstName: input.firstName,
        lastName: input.lastName,
        photoUrl: input.photoUrl,
      },
    })
    .returning()

  if (!user) {
    throw new Error('Не удалось сохранить пользователя')
  }

  return user
}

export async function updateUserSettings(
  db: Database,
  id: string,
  input: ProfileSettingsInput,
): Promise<UserRecord> {
  const [user] = await db.update(users).set(input).where(eq(users.id, id)).returning()
  if (!user) throw new Error('Пользователь не найден')
  return user
}

export async function deleteUserAccount(db: Database, id: string): Promise<void> {
  await db.transaction(async (transaction) => {
    await transaction.delete(challenges).where(eq(challenges.ownerId, id))
    await transaction.delete(users).where(eq(users.id, id))
  })
}

export async function findUserById(db: Database, id: string): Promise<UserRecord | null> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  return user ?? null
}
