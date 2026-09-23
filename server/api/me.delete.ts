import { getDatabase } from '../database'
import { deleteUserAccount } from '../repositories/user-repository'
import { apiError } from '../utils/api-error'
import { clearUserSession, requireUser } from '../utils/session'
import { enforceMutationRateLimit } from '../utils/rate-limit'

export default defineEventHandler(async (event): Promise<{ deleted: true }> => {
  const user = await requireUser(event)
  await enforceMutationRateLimit(event, user.id)
  if (user.telegramId === '999000001') {
    apiError(403, 'DEMO_ACCOUNT', 'Общий demo-аккаунт удалить нельзя')
  }
  await deleteUserAccount(getDatabase(event), user.id)
  await clearUserSession(event)
  return { deleted: true }
})
