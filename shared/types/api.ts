export type ChallengeType = 'personal' | 'group'
export type ChallengePhase = 'scheduled' | 'active' | 'completed'

export interface UserDto {
  id: string
  telegramId: string
  username: string | null
  firstName: string
  lastName: string | null
  photoUrl: string | null
  timeZone: string
  reminderEnabled: boolean
  reminderHour: number
  createdAt: string
}

export interface ParticipantUserDto {
  id: string
  firstName: string
  photoUrl: string | null
}

export interface AuthResponse {
  user: UserDto
  mode: 'telegram' | 'demo'
}

export interface ChallengeSummary {
  id: string
  ownerId: string
  title: string
  description: string | null
  emoji: string
  type: ChallengeType
  durationDays: number
  startDate: string
  endDate: string
  timeZone: string
  isPrivate: boolean
  finishedAt: string | null
  createdAt: string
  progress: number
  completedDays: number
  streak: number
  currentDay: number
  phase: ChallengePhase
  checkedInToday: boolean
  participantsCount: number
}

export interface CheckInDto {
  id: string
  date: string
  createdAt: string
}

export interface LeaderboardEntry {
  user: ParticipantUserDto
  completedDays: number
  streak: number
  rank: number
  isCurrentUser: boolean
}

export interface ChallengeDetails extends ChallengeSummary {
  isOwner: boolean
  isParticipant: boolean
  checkIns: CheckInDto[]
  leaderboard: LeaderboardEntry[]
  leaderboardHasMore: boolean
  inviteUrl: string | null
}

export interface ChallengeListResponse {
  challenges: ChallengeSummary[]
  page: number
  hasMore: boolean
}

export interface ChallengeDetailsResponse {
  challenge: ChallengeDetails
}

export interface CheckInResponse {
  challenge: ChallengeDetails
}

export interface JoinChallengeResponse {
  challenge: ChallengeDetails
  joined: boolean
}

export interface LeaveChallengeResponse {
  left: true
}

export interface ApiErrorData {
  code: string
  message: string
  issues?: Record<string, string>
}

export interface AnalyticsResponse {
  totalCheckIns: number
  last7Days: number
  last30Days: number
  activeChallenges: number
  completedChallenges: number
  days: Array<{ date: string; count: number }>
}
