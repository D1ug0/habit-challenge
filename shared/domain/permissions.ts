import type { ChallengeType } from '../types/api'

interface ChallengeAccess {
  ownerId: string
  type: ChallengeType
}

export function isChallengeParticipant(userId: string, participantIds: readonly string[]): boolean {
  return participantIds.includes(userId)
}

export function canViewChallenge(
  userId: string,
  challenge: ChallengeAccess,
  participantIds: readonly string[],
): boolean {
  return challenge.ownerId === userId || isChallengeParticipant(userId, participantIds)
}

export function canPreviewChallenge(userId: string, challenge: ChallengeAccess, participantIds: readonly string[]): boolean {
  return challenge.type === 'group' || canViewChallenge(userId, challenge, participantIds)
}

export function canJoinChallenge(
  userId: string,
  challenge: ChallengeAccess,
  participantIds: readonly string[],
): boolean {
  return challenge.type === 'group'
    && challenge.ownerId !== userId
    && !isChallengeParticipant(userId, participantIds)
}
