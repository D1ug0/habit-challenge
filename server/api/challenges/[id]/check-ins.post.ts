import type { CheckInResponse } from '#shared/types/api'
import { emptyMutationSchema } from '#shared/schemas/challenge'
import { getDatabase } from '../../../database'
import { checkInToday } from '../../../services/challenge-service'
import { parseBody } from '../../../utils/api-error'
import { getServerConfig } from '../../../utils/config'
import { getChallengeId } from '../../../utils/route'
import { enforceMutationRateLimit } from '../../../utils/rate-limit'
import { requireUser } from '../../../utils/session'

export default defineEventHandler(async (event): Promise<CheckInResponse> => {
  const [user] = await Promise.all([requireUser(event), parseBody(event, emptyMutationSchema)])
  await enforceMutationRateLimit(event, user.id)
  const config = getServerConfig(event)
  return {
    challenge: await checkInToday(
      getDatabase(event),
      getChallengeId(event),
      user,
      config.telegramBotUsername,
    ),
  }
})
