import { createHmac, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'
import type { UserDto } from '#shared/types/api'
import { getDatabase } from '../database'
import { findUserById, toUserDto } from '../repositories/user-repository'
import { apiError } from './api-error'
import { getServerConfig } from './config'

const sessionCookieName = 'hc_session'

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function setUserSession(event: H3Event, userId: string): void {
  const config = getServerConfig(event)
  const expiresAt = Math.floor(Date.now() / 1000) + config.authMaxAgeSeconds
  const payload = `${userId}.${expiresAt}`
  const token = `${payload}.${sign(payload, config.authSessionSecret)}`

  setCookie(event, sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: config.authMaxAgeSeconds,
  })
}

function readUserId(event: H3Event): string | null {
  const token = getCookie(event, sessionCookieName)
  if (!token) {
    return null
  }

  const [userId, expiresAtValue, signature] = token.split('.')
  if (!userId || !expiresAtValue || !signature) {
    return null
  }

  const expiresAt = Number(expiresAtValue)
  if (!Number.isInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    return null
  }

  const config = getServerConfig(event)
  const payload = `${userId}.${expiresAtValue}`
  const expected = Buffer.from(sign(payload, config.authSessionSecret))
  const received = Buffer.from(signature)

  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return null
  }

  return userId
}

export async function requireUser(event: H3Event): Promise<UserDto> {
  const userId = readUserId(event)
  if (!userId) {
    apiError(401, 'AUTH_REQUIRED', 'Сначала откройте приложение через Telegram')
  }

  const user = await findUserById(getDatabase(event), userId)
  if (!user) {
    apiError(401, 'SESSION_INVALID', 'Сессия устарела, откройте приложение заново')
  }

  return toUserDto(user)
}
