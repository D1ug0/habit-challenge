import type { LeaderboardEntry } from '#shared/types/api'
import { getDatabase } from '../../../database'
import { getChallengeDetails } from '../../../services/challenge-service'
import { apiError } from '../../../utils/api-error'
import { getServerConfig } from '../../../utils/config'
import { getChallengeId } from '../../../utils/route'
import { requireUser } from '../../../utils/session'

export default defineEventHandler(async (event): Promise<{ participants: LeaderboardEntry[] }> => {
  const user = await requireUser(event)
  const config = getServerConfig(event)
  const challenge = await getChallengeDetails(
    getDatabase(event),
    getChallengeId(event),
    user,
    config.telegramBotUsername,
  )

  if (!challenge.isParticipant) {
    apiError(403, 'NOT_A_PARTICIPANT', 'Сначала присоединитесь к челленджу')
  }

  return { participants: challenge.leaderboard }
})
