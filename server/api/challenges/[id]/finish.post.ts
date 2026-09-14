import type { ChallengeDetailsResponse } from '#shared/types/api'
import { emptyMutationSchema } from '#shared/schemas/challenge'
import { getDatabase } from '../../../database'
import { finishChallenge } from '../../../services/challenge-service'
import { parseBody } from '../../../utils/api-error'
import { getServerConfig } from '../../../utils/config'
import { getChallengeId } from '../../../utils/route'
import { requireUser } from '../../../utils/session'

export default defineEventHandler(async (event): Promise<ChallengeDetailsResponse> => {
  const [user] = await Promise.all([requireUser(event), parseBody(event, emptyMutationSchema)])
  return {
    challenge: await finishChallenge(
      getDatabase(event),
      getChallengeId(event),
      user,
      getServerConfig(event).telegramBotUsername,
    ),
  }
})
