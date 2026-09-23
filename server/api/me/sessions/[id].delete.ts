import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDatabase } from '../../../database'
import { sessions } from '../../../database/schema'
import { apiError } from '../../../utils/api-error'
import { readSessionId, requireUser } from '../../../utils/session'
import { enforceMutationRateLimit } from '../../../utils/rate-limit'

export default defineEventHandler(async (event): Promise<{ revoked: true; current: boolean }> => {
  const user = await requireUser(event)
  await enforceMutationRateLimit(event, user.id)
  const parsed = z.uuid().safeParse(getRouterParam(event, 'id'))
  if (!parsed.success) apiError(400, 'INVALID_SESSION_ID', 'Некорректный идентификатор сессии')
  const deleted = await getDatabase(event)
    .delete(sessions)
    .where(and(eq(sessions.id, parsed.data), eq(sessions.userId, user.id)))
    .returning({ id: sessions.id })
  if (!deleted.length) apiError(404, 'SESSION_NOT_FOUND', 'Сессия не найдена')
  const current = readSessionId(event) === parsed.data
  if (current) deleteCookie(event, 'hc_session', { path: '/' })
  return { revoked: true, current }
})
