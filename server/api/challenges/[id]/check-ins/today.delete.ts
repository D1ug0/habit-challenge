import type { CheckInResponse } from '#shared/types/api'
import { getDatabase } from '../../../../database'
import { undoTodayCheckIn } from '../../../../services/challenge-service'
import { getServerConfig } from '../../../../utils/config'
import { getChallengeId } from '../../../../utils/route'
import { enforceMutationRateLimit } from '../../../../utils/rate-limit'
import { requireUser } from '../../../../utils/session'

export default defineEventHandler(async (event): Promise<CheckInResponse> => {
  const user = await requireUser(event)
  await enforceMutationRateLimit(event, user.id)
  const config = getServerConfig(event)
  return {
    challenge: await undoTodayCheckIn(
      getDatabase(event),
      getChallengeId(event),
      user,
      config.telegramBotUsername,
    ),
  }
})
