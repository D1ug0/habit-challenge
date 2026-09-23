import { z } from 'zod'
import { getDatabase } from '../../../../database'
import { banParticipant } from '../../../../services/challenge-service'
import { apiError } from '../../../../utils/api-error'
import { getChallengeId } from '../../../../utils/route'
import { requireUser } from '../../../../utils/session'
import { enforceMutationRateLimit } from '../../../../utils/rate-limit'

export default defineEventHandler(async (event): Promise<{ removed: true }> => {
  const user = await requireUser(event)
  await enforceMutationRateLimit(event, user.id)
  const result = z.uuid().safeParse(getRouterParam(event, 'userId'))
  if (!result.success) apiError(400, 'INVALID_USER_ID', 'Некорректный идентификатор участника')
  await banParticipant(getDatabase(event), getChallengeId(event), result.data, user)
  return { removed: true }
})
