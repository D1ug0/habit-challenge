import type { AnalyticsResponse } from '#shared/types/api'
import { addDays, getChallengePhase } from '#shared/domain/challenge'
import { getDateInTimeZone } from '#shared/domain/time'
import { getDatabase } from '../database'
import {
  findChallengesForUser,
  findUserCheckInsForChallenges,
} from '../repositories/challenge-repository'
import { requireUser } from '../utils/session'

export default defineEventHandler(async (event): Promise<AnalyticsResponse> => {
  const user = await requireUser(event)
  const db = getDatabase(event)
  const challenges = await findChallengesForUser(db, user.id)
  const checkIns = await findUserCheckInsForChallenges(
    db,
    challenges.map((challenge) => challenge.id),
    user.id,
  )
  const today = getDateInTimeZone(user.timeZone)
  const days = Array.from({ length: 30 }, (_, index) => ({
    date: addDays(today, index - 29),
    count: 0,
  }))
  const counts = new Map(days.map((day) => [day.date, day]))
  for (const checkIn of checkIns) {
    const day = counts.get(checkIn.date)
    if (day) day.count += 1
  }
  const phase = (challenge: (typeof challenges)[number]) =>
    getChallengePhase(
      challenge.startDate,
      challenge.durationDays,
      getDateInTimeZone(challenge.timeZone),
      challenge.finishedAt,
    )
  return {
    totalCheckIns: checkIns.length,
    last7Days: days.slice(-7).reduce((sum, day) => sum + day.count, 0),
    last30Days: days.reduce((sum, day) => sum + day.count, 0),
    activeChallenges: challenges.filter((challenge) => phase(challenge) === 'active').length,
    completedChallenges: challenges.filter((challenge) => phase(challenge) === 'completed').length,
    days,
  }
})
