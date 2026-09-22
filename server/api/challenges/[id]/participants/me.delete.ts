import type { LeaveChallengeResponse } from '#shared/types/api'
import { getDatabase } from '../../../../database'
import { leaveChallenge } from '../../../../services/challenge-service'
import { getChallengeId } from '../../../../utils/route'
import { requireUser } from '../../../../utils/session'

export default defineEventHandler(async (event): Promise<LeaveChallengeResponse> => {
  const user = await requireUser(event)
  await leaveChallenge(getDatabase(event), getChallengeId(event), user)
  return { left: true }
})
