import { z } from 'zod'
import { getDatabase } from '../../../../database'
import { liftBan } from '../../../../services/challenge-service'
import { apiError } from '../../../../utils/api-error'
import { enforceMutationRateLimit } from '../../../../utils/rate-limit'
import { getChallengeId } from '../../../../utils/route'
import { requireUser } from '../../../../utils/session'

export default defineEventHandler(async (event): Promise<{ removed: true }> => {
  const user = await requireUser(event)
  await enforceMutationRateLimit(event, user.id)
  const parsed = z.uuid().safeParse(getRouterParam(event, 'userId'))
  if (!parsed.success) apiError(400, 'INVALID_USER_ID', 'Некорректный идентификатор участника')
  await liftBan(getDatabase(event), getChallengeId(event), parsed.data, user)
  return { removed: true }
})
