import type { JoinChallengeResponse } from '#shared/types/api'
import { joinChallengeSchema } from '#shared/schemas/challenge'
import { getDatabase } from '../../../database'
import { joinChallenge } from '../../../services/challenge-service'
import { parseBody } from '../../../utils/api-error'
import { getServerConfig } from '../../../utils/config'
import { getChallengeId } from '../../../utils/route'
import { enforceMutationRateLimit } from '../../../utils/rate-limit'
import { requireUser } from '../../../utils/session'

export default defineEventHandler(async (event): Promise<JoinChallengeResponse> => {
  const [user, body] = await Promise.all([
    requireUser(event),
    parseBody(event, joinChallengeSchema),
  ])
  await enforceMutationRateLimit(event, user.id)
  const config = getServerConfig(event)
  return joinChallenge(
    getDatabase(event),
    getChallengeId(event),
    user,
    config.telegramBotUsername,
    body.inviteToken,
  )
})
