import { eq } from 'drizzle-orm'
import type { UserDto } from '#shared/types/api'
import type { Database } from '../database'
import { users } from '../database/schema'
import type { VerifiedTelegramUser } from '../utils/telegram-auth'

export type UserRecord = typeof users.$inferSelect

export function toUserDto(user: UserRecord): UserDto {
  return {
    id: user.id,
    telegramId: user.telegramId,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    photoUrl: user.photoUrl,
    createdAt: user.createdAt.toISOString(),
  }
}

export async function upsertTelegramUser(
  db: Database,
  input: VerifiedTelegramUser,
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

export async function findUserById(db: Database, id: string): Promise<UserRecord | null> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  return user ?? null
}
