import type { ChallengeDetailsResponse } from '#shared/types/api'
import { createChallengeSchema } from '#shared/schemas/challenge'
import { getDatabase } from '../../database'
import { createChallenge } from '../../services/challenge-service'
import { parseBody } from '../../utils/api-error'
import { enforceMutationRateLimit } from '../../utils/rate-limit'
import { requireUser } from '../../utils/session'

export default defineEventHandler(async (event): Promise<ChallengeDetailsResponse> => {
  const [user, body] = await Promise.all([
    requireUser(event),
    parseBody(event, createChallengeSchema),
  ])
  await enforceMutationRateLimit(event, user.id)
  return { challenge: await createChallenge(getDatabase(event), user, body) }
})
