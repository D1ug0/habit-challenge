import type { ChallengeSummary } from '#shared/types/api'

function getDailyPriority(challenge: ChallengeSummary): number {
  if (challenge.phase === 'active') {
    return challenge.checkedInToday ? 1 : 0
  }

  return challenge.phase === 'scheduled' ? 2 : 3
}

export function sortChallengesForDashboard(
  challenges: readonly ChallengeSummary[],
): ChallengeSummary[] {
  return [...challenges].sort((left, right) => {
    const priorityDifference = getDailyPriority(left) - getDailyPriority(right)
    if (priorityDifference !== 0) return priorityDifference

    return right.createdAt.localeCompare(left.createdAt)
  })
}
