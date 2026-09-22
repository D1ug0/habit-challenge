import { eq } from 'drizzle-orm'
import type { ParticipantUserDto, UserDto } from '#shared/types/api'
import type { Database } from '../database'
import { users } from '../database/schema'
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
        timeZone: input.timeZone,
      },
    })
    .returning()

  if (!user) {
    throw new Error('Не удалось сохранить пользователя')
  }

  return user
}

export async function findUserById(db: Database, id: string): Promise<UserRecord | null> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  return user ?? null
}
