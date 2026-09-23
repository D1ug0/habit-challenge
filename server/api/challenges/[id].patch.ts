import type { ChallengeDetailsResponse } from '#shared/types/api'
import { editChallengeSchema } from '#shared/schemas/challenge'
import { getDatabase } from '../../database'
import { editChallenge } from '../../services/challenge-service'
import { parseBody } from '../../utils/api-error'
import { getServerConfig } from '../../utils/config'
import { getChallengeId } from '../../utils/route'
import { requireUser } from '../../utils/session'
import { enforceMutationRateLimit } from '../../utils/rate-limit'

export default defineEventHandler(async (event): Promise<ChallengeDetailsResponse> => {
  const [user, body] = await Promise.all([
    requireUser(event),
    parseBody(event, editChallengeSchema),
  ])
  await enforceMutationRateLimit(event, user.id)
  return {
    challenge: await editChallenge(
      getDatabase(event),
      getChallengeId(event),
      user,
      body,
      getServerConfig(event).telegramBotUsername,
    ),
  }
})
