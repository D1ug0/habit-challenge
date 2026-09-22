import { getDatabase } from '../../database'
import { deleteChallenge } from '../../services/challenge-service'
import { getChallengeId } from '../../utils/route'
import { enforceMutationRateLimit } from '../../utils/rate-limit'
import { requireUser } from '../../utils/session'

export default defineEventHandler(async (event): Promise<{ deleted: true }> => {
  const user = await requireUser(event)
  enforceMutationRateLimit(event, user.id)
  await deleteChallenge(getDatabase(event), getChallengeId(event), user)
  return { deleted: true }
})
