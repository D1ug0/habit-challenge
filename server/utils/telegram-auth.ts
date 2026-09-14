import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

const telegramUserSchema = z.object({
  id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).transform(String),
  first_name: z.string().min(1).max(128),
  last_name: z.string().max(128).optional(),
  username: z.string().max(64).optional(),
  photo_url: z.string().url().optional(),
})

export interface VerifiedTelegramUser {
  telegramId: string
  firstName: string
  lastName: string | null
  username: string | null
  photoUrl: string | null
}

export function validateTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds: number,
  now = new Date(),
): VerifiedTelegramUser | null {
  const params = new URLSearchParams(initData)
  const receivedHash = params.get('hash')
  const authDateValue = params.get('auth_date')
  const userValue = params.get('user')

  if (!receivedHash || !/^[a-f\d]{64}$/i.test(receivedHash) || !authDateValue || !userValue) {
    return null
  }

  const authDate = Number(authDateValue)
  const nowSeconds = Math.floor(now.valueOf() / 1000)
  if (
    !Number.isInteger(authDate) ||
    authDate > nowSeconds + 30 ||
    nowSeconds - authDate > maxAgeSeconds
  ) {
    return null
  }

  params.delete('hash')
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const calculatedHash = createHmac('sha256', secretKey).update(dataCheckString).digest()
  const receivedBuffer = Buffer.from(receivedHash, 'hex')

  if (
    receivedBuffer.length !== calculatedHash.length ||
    !timingSafeEqual(receivedBuffer, calculatedHash)
  ) {
    return null
  }

  let rawUser: unknown
  try {
    rawUser = JSON.parse(userValue) as unknown
  } catch {
    return null
  }

  const parsedUser = telegramUserSchema.safeParse(rawUser)
  if (!parsedUser.success) {
    return null
  }

  return {
    telegramId: parsedUser.data.id,
    firstName: parsedUser.data.first_name,
    lastName: parsedUser.data.last_name ?? null,
    username: parsedUser.data.username ?? null,
    photoUrl: parsedUser.data.photo_url ?? null,
  }
}
