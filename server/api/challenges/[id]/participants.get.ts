import type { LeaderboardEntry } from '#shared/types/api'
import { getDatabase } from '../../../database'
import { getLeaderboardPage } from '../../../services/challenge-service'
import { listQuerySchema } from '#shared/schemas/challenge'
import { getChallengeId } from '../../../utils/route'
import { requireUser } from '../../../utils/session'

export default defineEventHandler(
  async (event): Promise<{ participants: LeaderboardEntry[]; hasMore: boolean }> => {
    const user = await requireUser(event)
    const query = listQuerySchema.safeParse(getQuery(event))
    if (!query.success) throw createError({ statusCode: 400, message: 'Некорректная страница' })
    return getLeaderboardPage(getDatabase(event), getChallengeId(event), user, query.data.page)
  },
)
