import type { ChallengeListResponse } from '#shared/types/api'
import { getDatabase } from '../../database'
import { listChallenges } from '../../services/challenge-service'
import { requireUser } from '../../utils/session'

export default defineEventHandler(async (event): Promise<ChallengeListResponse> => {
  const user = await requireUser(event)
  return { challenges: await listChallenges(getDatabase(event), user.id) }
})
