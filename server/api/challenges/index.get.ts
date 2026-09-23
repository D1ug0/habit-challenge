import type { ChallengeListResponse } from '#shared/types/api'
import { listQuerySchema } from '#shared/schemas/challenge'
import { getDatabase } from '../../database'
import { listChallenges } from '../../services/challenge-service'
import { requireUser } from '../../utils/session'

export default defineEventHandler(async (event): Promise<ChallengeListResponse> => {
  const user = await requireUser(event)
  const query = listQuerySchema.safeParse(getQuery(event))
  if (!query.success) throw createError({ statusCode: 400, message: 'Некорректная страница' })
  return listChallenges(getDatabase(event), user, query.data.page)
})
