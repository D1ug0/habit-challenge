import { createHmac, timingSafeEqual } from 'node:crypto'
import { and, eq, gt } from 'drizzle-orm'
import type { H3Event } from 'h3'
import type { UserDto } from '#shared/types/api'
import { getDatabase } from '../database'
import { sessions } from '../database/schema'
import { findUserById, toUserDto } from '../repositories/user-repository'
import { apiError } from './api-error'
import { getServerConfig } from './config'

const sessionCookieName = 'hc_session'

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export async function setUserSession(event: H3Event, userId: string): Promise<void> {
  const config = getServerConfig(event)
  const existingSessionId = readSessionId(event)
  if (existingSessionId) {
    const [existingSession] = await getDatabase(event)
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          eq(sessions.id, existingSessionId),
          eq(sessions.userId, userId),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .limit(1)
    if (existingSession) return
  }
  const expiresAt = Math.floor(Date.now() / 1000) + config.authMaxAgeSeconds
  const [session] = await getDatabase(event)
    .insert(sessions)
    .values({ userId, expiresAt: new Date(expiresAt * 1000) })
    .returning({ id: sessions.id })
  if (!session) throw new Error('Не удалось создать сессию')
  const payload = `${session.id}.${expiresAt}`
  const token = `${payload}.${sign(payload, config.authSessionSecret)}`

  setCookie(event, sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: config.authMaxAgeSeconds,
  })
}

export function readSessionId(event: H3Event): string | null {
  const token = getCookie(event, sessionCookieName)
  if (!token) {
    return null
  }

  const [sessionId, expiresAtValue, signature] = token.split('.')
  if (!sessionId || !expiresAtValue || !signature) {
    return null
  }

  const expiresAt = Number(expiresAtValue)
  if (!Number.isInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    return null
  }

  const config = getServerConfig(event)
  const payload = `${sessionId}.${expiresAtValue}`
  const expected = Buffer.from(sign(payload, config.authSessionSecret))
  const received = Buffer.from(signature)

  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return null
  }

  return sessionId
}

export async function requireUser(event: H3Event): Promise<UserDto> {
  const sessionId = readSessionId(event)
  if (!sessionId) {
    apiError(401, 'AUTH_REQUIRED', 'Сначала откройте приложение через Telegram')
  }

  const [session] = await getDatabase(event)
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
    .limit(1)
  if (!session) apiError(401, 'SESSION_INVALID', 'Сессия устарела, откройте приложение заново')
  const user = await findUserById(getDatabase(event), session.userId)
  if (!user) {
    apiError(401, 'SESSION_INVALID', 'Сессия устарела, откройте приложение заново')
  }

  return toUserDto(user)
}

export async function clearUserSession(event: H3Event): Promise<void> {
  const sessionId = readSessionId(event)
  if (sessionId) await getDatabase(event).delete(sessions).where(eq(sessions.id, sessionId))
  deleteCookie(event, sessionCookieName, { path: '/' })
}
