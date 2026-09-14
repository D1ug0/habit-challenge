import type { JoinChallengeResponse } from '#shared/types/api'
import { emptyMutationSchema } from '#shared/schemas/challenge'
import { getDatabase } from '../../../database'
import { joinChallenge } from '../../../services/challenge-service'
import { parseBody } from '../../../utils/api-error'
import { getServerConfig } from '../../../utils/config'
import { getChallengeId } from '../../../utils/route'
import { requireUser } from '../../../utils/session'

export default defineEventHandler(async (event): Promise<JoinChallengeResponse> => {
  const [user] = await Promise.all([
    requireUser(event),
    parseBody(event, emptyMutationSchema),
  ])
  const config = getServerConfig(event)
  return joinChallenge(
    getDatabase(event),
    getChallengeId(event),
    user,
    config.telegramBotUsername,
  )
})
