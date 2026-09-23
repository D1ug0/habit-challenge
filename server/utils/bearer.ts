import { timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'
import { apiError } from './api-error'

export function requireBearer(event: H3Event, secret: string | undefined): void {
  if (!secret || secret.length < 32) apiError(503, 'NOT_CONFIGURED', 'Сервис не настроен')
  const token = getHeader(event, 'authorization')?.replace(/^Bearer /, '') ?? ''
  const expected = Buffer.from(secret)
  const provided = Buffer.from(token)
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    apiError(401, 'UNAUTHORIZED', 'Нет доступа')
  }
}
