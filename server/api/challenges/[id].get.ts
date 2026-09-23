import type { ChallengeDetailsResponse } from '#shared/types/api'
import { getDatabase } from '../../database'
import { getChallengeDetails } from '../../services/challenge-service'
import { getServerConfig } from '../../utils/config'
import { getChallengeId } from '../../utils/route'
import { inviteTokenSchema } from '#shared/schemas/challenge'
import { requireUser } from '../../utils/session'

export default defineEventHandler(async (event): Promise<ChallengeDetailsResponse> => {
  const user = await requireUser(event)
  const challengeId = getChallengeId(event)
  const config = getServerConfig(event)
  const tokenResult = inviteTokenSchema.safeParse(getQuery(event).inviteToken)
  return {
    challenge: await getChallengeDetails(
      getDatabase(event),
      challengeId,
      user,
      config.telegramBotUsername,
      tokenResult.success ? tokenResult.data : undefined,
    ),
  }
})
