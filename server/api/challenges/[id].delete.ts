import { getDatabase } from '../../database'
import { deleteChallenge } from '../../services/challenge-service'
import { getChallengeId } from '../../utils/route'
import { requireUser } from '../../utils/session'

export default defineEventHandler(async (event): Promise<{ deleted: true }> => {
  const user = await requireUser(event)
  await deleteChallenge(getDatabase(event), getChallengeId(event), user)
  return { deleted: true }
})
