import type {
  ChallengeDetails,
  ChallengeSummary,
  LeaderboardEntry,
  UserDto,
} from '#shared/types/api'
import type { CreateChallengeInput } from '#shared/schemas/challenge'
import {
  calculateProgress,
  calculateStreak,
  getChallengeEndDate,
  getChallengePhase,
  getCurrentChallengeDay,
  getTodayUtc,
  hasDailyCheckIn,
} from '#shared/domain/challenge'
import { canJoinChallenge, canPreviewChallenge, canViewChallenge } from '#shared/domain/permissions'
import type { Database } from '../database'
import {
  addParticipant,
  countParticipants,
  createChallengeRecord,
  findChallengeById,
  findChallengesForUser,
  findParticipants,
  findUserCheckIns,
  insertCheckIn,
  removeCheckIn,
} from '../repositories/challenge-repository'
import type { ChallengeRecord, CheckInRecord, ParticipantWithUser } from '../repositories/challenge-repository'
import { toUserDto } from '../repositories/user-repository'
import { apiError, isUniqueViolation } from '../utils/api-error'

function toCheckInDto(checkIn: CheckInRecord) {
  return {
    id: checkIn.id,
    date: checkIn.date,
    createdAt: checkIn.createdAt.toISOString(),
  }
}

async function toSummary(
  db: Database,
  challenge: ChallengeRecord,
  userId: string,
  today: string,
): Promise<ChallengeSummary> {
  const [userCheckIns, participantsCount] = await Promise.all([
    findUserCheckIns(db, challenge.id, userId),
    countParticipants(db, challenge.id),
  ])
  const checkInDates = userCheckIns.map(checkIn => checkIn.date)

  return {
    id: challenge.id,
    ownerId: challenge.ownerId,
    title: challenge.title,
    description: challenge.description,
    emoji: challenge.emoji,
    type: challenge.type,
    durationDays: challenge.durationDays,
    startDate: challenge.startDate,
    endDate: getChallengeEndDate(challenge.startDate, challenge.durationDays),
    createdAt: challenge.createdAt.toISOString(),
    progress: calculateProgress(checkInDates, challenge.durationDays),
    completedDays: new Set(checkInDates).size,
    streak: calculateStreak(checkInDates, today),
    currentDay: getCurrentChallengeDay(challenge.startDate, challenge.durationDays, today),
    phase: getChallengePhase(challenge.startDate, challenge.durationDays, today),
    checkedInToday: hasDailyCheckIn(checkInDates, today),
    participantsCount,
  }
}

async function makeLeaderboard(
  db: Database,
  challengeId: string,
  participants: ParticipantWithUser[],
  currentUserId: string,
  today: string,
): Promise<LeaderboardEntry[]> {
  const rows = await Promise.all(participants.map(async ({ user }) => {
    const participantCheckIns = await findUserCheckIns(db, challengeId, user.id)
    const dates = participantCheckIns.map(checkIn => checkIn.date)
    return {
      user: toUserDto(user),
      completedDays: new Set(dates).size,
      streak: calculateStreak(dates, today),
      isCurrentUser: user.id === currentUserId,
    }
  }))

  return rows
    .sort((left, right) => right.completedDays - left.completedDays
      || right.streak - left.streak
      || left.user.firstName.localeCompare(right.user.firstName))
    .map((entry, index) => ({ ...entry, rank: index + 1 }))
}

export async function listChallenges(db: Database, userId: string): Promise<ChallengeSummary[]> {
  const today = getTodayUtc()
  const records = await findChallengesForUser(db, userId)
  return Promise.all(records.map(challenge => toSummary(db, challenge, userId, today)))
}

export async function createChallenge(
  db: Database,
  owner: UserDto,
  input: CreateChallengeInput,
): Promise<ChallengeDetails> {
  const today = getTodayUtc()
  const latestStart = new Date()
  latestStart.setUTCFullYear(latestStart.getUTCFullYear() + 1)
  const latestStartDate = latestStart.toISOString().slice(0, 10)

  if (input.startDate < today || input.startDate > latestStartDate) {
    apiError(422, 'START_DATE_OUT_OF_RANGE', 'Дата старта должна быть в пределах ближайшего года')
  }

  const challenge = await createChallengeRecord(db, owner.id, input)
  return getChallengeDetails(db, challenge.id, owner, '')
}

export async function getChallengeDetails(
  db: Database,
  challengeId: string,
  currentUser: UserDto,
  botUsername: string,
): Promise<ChallengeDetails> {
  const challenge = await findChallengeById(db, challengeId)
  if (!challenge) {
    apiError(404, 'CHALLENGE_NOT_FOUND', 'Челлендж не найден')
  }

  const participants = await findParticipants(db, challengeId)
  const participantIds = participants.map(row => row.user.id)
  if (!canPreviewChallenge(currentUser.id, challenge, participantIds)) {
    apiError(403, 'CHALLENGE_ACCESS_DENIED', 'У вас нет доступа к этому челленджу')
  }

  const isParticipant = canViewChallenge(currentUser.id, challenge, participantIds)
  const today = getTodayUtc()
  const summary = await toSummary(db, challenge, currentUser.id, today)
  const checkIns = isParticipant ? await findUserCheckIns(db, challengeId, currentUser.id) : []
  const leaderboard = challenge.type === 'group' && isParticipant
    ? await makeLeaderboard(db, challengeId, participants, currentUser.id, today)
    : []

  return {
    ...summary,
    isOwner: challenge.ownerId === currentUser.id,
    isParticipant,
    checkIns: checkIns.map(toCheckInDto),
    leaderboard,
    inviteUrl: challenge.type === 'group' && isParticipant && botUsername
      ? `https://t.me/${botUsername}?startapp=challenge_${challenge.id}`
      : null,
  }
}

export async function checkInToday(
  db: Database,
  challengeId: string,
  currentUser: UserDto,
  botUsername: string,
): Promise<ChallengeDetails> {
  const challenge = await findChallengeById(db, challengeId)
  if (!challenge) {
    apiError(404, 'CHALLENGE_NOT_FOUND', 'Челлендж не найден')
  }

  const participants = await findParticipants(db, challengeId)
  const participantIds = participants.map(row => row.user.id)
  if (!canViewChallenge(currentUser.id, challenge, participantIds)) {
    apiError(403, 'NOT_A_PARTICIPANT', 'Сначала присоединитесь к челленджу')
  }

  const today = getTodayUtc()
  if (getChallengePhase(challenge.startDate, challenge.durationDays, today) !== 'active') {
    apiError(409, 'CHALLENGE_NOT_ACTIVE', 'Сегодня этот челлендж не активен')
  }

  const checkIns = await findUserCheckIns(db, challengeId, currentUser.id)
  if (hasDailyCheckIn(checkIns.map(checkIn => checkIn.date), today)) {
    apiError(409, 'ALREADY_CHECKED_IN', 'Сегодня уже отмечено')
  }

  try {
    await insertCheckIn(db, challengeId, currentUser.id, today)
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      apiError(409, 'ALREADY_CHECKED_IN', 'Сегодня уже отмечено')
    }
    throw error
  }

  return getChallengeDetails(db, challengeId, currentUser, botUsername)
}

export async function undoTodayCheckIn(
  db: Database,
  challengeId: string,
  currentUser: UserDto,
  botUsername: string,
): Promise<ChallengeDetails> {
  const challenge = await findChallengeById(db, challengeId)
  if (!challenge) {
    apiError(404, 'CHALLENGE_NOT_FOUND', 'Челлендж не найден')
  }

  const participants = await findParticipants(db, challengeId)
  if (!canViewChallenge(currentUser.id, challenge, participants.map(row => row.user.id))) {
    apiError(403, 'NOT_A_PARTICIPANT', 'У вас нет доступа к этому челленджу')
  }

  const removed = await removeCheckIn(db, challengeId, currentUser.id, getTodayUtc())
  if (!removed) {
    apiError(404, 'CHECK_IN_NOT_FOUND', 'Сегодняшняя отметка не найдена')
  }

  return getChallengeDetails(db, challengeId, currentUser, botUsername)
}

export async function joinChallenge(
  db: Database,
  challengeId: string,
  currentUser: UserDto,
  botUsername: string,
): Promise<{ challenge: ChallengeDetails, joined: boolean }> {
  const challenge = await findChallengeById(db, challengeId)
  if (!challenge) {
    apiError(404, 'CHALLENGE_NOT_FOUND', 'Челлендж не найден')
  }

  const participants = await findParticipants(db, challengeId)
  const participantIds = participants.map(row => row.user.id)
  if (challenge.type !== 'group') {
    apiError(403, 'PERSONAL_CHALLENGE', 'К личному челленджу нельзя присоединиться')
  }

  if (getChallengePhase(challenge.startDate, challenge.durationDays, getTodayUtc()) === 'completed') {
    apiError(409, 'CHALLENGE_COMPLETED', 'Этот челлендж уже завершён')
  }

  const joined = canJoinChallenge(currentUser.id, challenge, participantIds)
    ? await addParticipant(db, challengeId, currentUser.id)
    : false

  return {
    challenge: await getChallengeDetails(db, challengeId, currentUser, botUsername),
    joined,
  }
}
