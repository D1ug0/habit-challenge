import { describe, expect, it } from 'vitest'
import type { ChallengeSummary } from '../../shared/types/api'
import { sortChallengesForDashboard } from '../../app/entities/challenge/model/sort-challenges'

function makeChallenge(
  id: string,
  phase: ChallengeSummary['phase'],
  checkedInToday: boolean,
  createdAt: string,
): ChallengeSummary {
  return {
    id,
    ownerId: 'user-1',
    title: id,
    description: null,
    emoji: '🌱',
    type: 'personal',
    durationDays: 7,
    startDate: '2026-09-01',
    endDate: '2026-09-07',
    finishedAt: null,
    createdAt,
    progress: 0,
    completedDays: 0,
    streak: 0,
    currentDay: 1,
    phase,
    checkedInToday,
    participantsCount: 1,
  }
}

describe('порядок челленджей на главном экране', () => {
  it('сначала показывает активные челленджи без сегодняшней отметки', () => {
    const challenges = [
      makeChallenge('completed', 'completed', false, '2026-09-20T10:00:00.000Z'),
      makeChallenge('done', 'active', true, '2026-09-21T10:00:00.000Z'),
      makeChallenge('todo-old', 'active', false, '2026-09-19T10:00:00.000Z'),
      makeChallenge('scheduled', 'scheduled', false, '2026-09-22T10:00:00.000Z'),
      makeChallenge('todo-new', 'active', false, '2026-09-22T10:00:00.000Z'),
    ]

    expect(sortChallengesForDashboard(challenges).map((challenge) => challenge.id)).toEqual([
      'todo-new',
      'todo-old',
      'done',
      'scheduled',
      'completed',
    ])
  })

  it('не меняет исходный массив', () => {
    const challenges = [
      makeChallenge('done', 'active', true, '2026-09-21T10:00:00.000Z'),
      makeChallenge('todo', 'active', false, '2026-09-20T10:00:00.000Z'),
    ]

    sortChallengesForDashboard(challenges)

    expect(challenges.map((challenge) => challenge.id)).toEqual(['done', 'todo'])
  })
})
