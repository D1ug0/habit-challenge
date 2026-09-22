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
  addDays,
  getChallengeEndDate,
  getChallengePhase,
  getCurrentChallengeDay,
  hasDailyCheckIn,
} from '#shared/domain/challenge'
import { getDateInTimeZone } from '#shared/domain/time'
import {
  canJoinChallenge,
  canLeaveChallenge,
  canManageChallenge,
  canPreviewChallenge,
  canViewChallenge,
} from '#shared/domain/permissions'
import type { Database } from '../database'
import {
  addParticipant,
  countParticipants,
  countParticipantsForChallenges,
  createChallengeRecord,
  deleteChallengeRecord,
  findChallengeById,
  findChallengeCheckIns,
  findChallengesForUser,
  findParticipants,
  findUserCheckIns,
  findUserCheckInsForChallenges,
  finishChallengeRecord,
  insertCheckIn,
  removeCheckIn,
  removeParticipantAndCheckIns,
} from '../repositories/challenge-repository'
import type {
  ChallengeRecord,
  CheckInRecord,
  ParticipantWithUser,
} from '../repositories/challenge-repository'
import { toParticipantUserDto } from '../repositories/user-repository'
import { apiError, isUniqueViolation } from '../utils/api-error'

function toCheckInDto(checkIn: CheckInRecord) {
  return {
    id: checkIn.id,
    date: checkIn.date,
    createdAt: checkIn.createdAt.toISOString(),
  }
}

function makeSummary(
  challenge: ChallengeRecord,
  userCheckIns: CheckInRecord[],
  participantsCount: number,
  userToday: string,
  challengeToday: string,
): ChallengeSummary {
  const checkInDates = userCheckIns.map((checkIn) => checkIn.date)

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
    timeZone: challenge.timeZone,
    finishedAt: challenge.finishedAt?.toISOString() ?? null,
    createdAt: challenge.createdAt.toISOString(),
    progress: calculateProgress(checkInDates, challenge.durationDays),
    completedDays: new Set(checkInDates).size,
    streak: calculateStreak(checkInDates, userToday),
    currentDay: getCurrentChallengeDay(challenge.startDate, challenge.durationDays, challengeToday),
    phase: getChallengePhase(
      challenge.startDate,
      challenge.durationDays,
      challengeToday,
      challenge.finishedAt,
    ),
    checkedInToday: hasDailyCheckIn(checkInDates, userToday),
    participantsCount,
  }
}

async function toSummary(
  db: Database,
  challenge: ChallengeRecord,
  userId: string,
  userTimeZone: string,
  now: Date,
): Promise<ChallengeSummary> {
  const [userCheckIns, participantsCount] = await Promise.all([
    findUserCheckIns(db, challenge.id, userId),
    countParticipants(db, challenge.id),
  ])

  return makeSummary(
    challenge,
    userCheckIns,
    participantsCount,
    getDateInTimeZone(userTimeZone, now),
    getDateInTimeZone(challenge.timeZone, now),
  )
}

async function makeLeaderboard(
  db: Database,
  challengeId: string,
  participants: ParticipantWithUser[],
  currentUserId: string,
  now: Date,
): Promise<LeaderboardEntry[]> {
  const challengeCheckIns = await findChallengeCheckIns(db, challengeId)
  const datesByUser = new Map<string, string[]>()
  for (const checkIn of challengeCheckIns) {
    const dates = datesByUser.get(checkIn.userId) ?? []
    dates.push(checkIn.date)
    datesByUser.set(checkIn.userId, dates)
  }

  const rows = participants.map(({ user }) => {
    const dates = datesByUser.get(user.id) ?? []
    return {
      user: toParticipantUserDto(user),
      completedDays: new Set(dates).size,
      streak: calculateStreak(dates, getDateInTimeZone(user.timeZone, now)),
      isCurrentUser: user.id === currentUserId,
    }
  })

  return rows
    .sort(
      (left, right) =>
        right.completedDays - left.completedDays ||
        right.streak - left.streak ||
        left.user.firstName.localeCompare(right.user.firstName),
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }))
}

export async function listChallenges(
  db: Database,
  currentUser: UserDto,
): Promise<ChallengeSummary[]> {
  const records = await findChallengesForUser(db, currentUser.id)
  const challengeIds = records.map((challenge) => challenge.id)
  const [checkIns, participantCounts] = await Promise.all([
    findUserCheckInsForChallenges(db, challengeIds, currentUser.id),
    countParticipantsForChallenges(db, challengeIds),
  ])
  const checkInsByChallenge = new Map<string, CheckInRecord[]>()
  for (const checkIn of checkIns) {
    const challengeCheckIns = checkInsByChallenge.get(checkIn.challengeId) ?? []
    challengeCheckIns.push(checkIn)
    checkInsByChallenge.set(checkIn.challengeId, challengeCheckIns)
  }

  const now = new Date()
  const userToday = getDateInTimeZone(currentUser.timeZone, now)
  return records.map((challenge) =>
    makeSummary(
      challenge,
      checkInsByChallenge.get(challenge.id) ?? [],
      participantCounts.get(challenge.id) ?? 0,
      userToday,
      getDateInTimeZone(challenge.timeZone, now),
    ),
  )
}

export async function createChallenge(
  db: Database,
  owner: UserDto,
  input: CreateChallengeInput,
): Promise<ChallengeDetails> {
  const today = getDateInTimeZone(owner.timeZone)
  const latestStartDate = addDays(today, 365)

  if (input.startDate < today || input.startDate > latestStartDate) {
    apiError(422, 'START_DATE_OUT_OF_RANGE', 'Дата старта должна быть в пределах ближайшего года')
  }

  const challenge = await createChallengeRecord(db, owner.id, owner.timeZone, input)
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
  const participantIds = participants.map((row) => row.user.id)
  if (!canPreviewChallenge(currentUser.id, challenge, participantIds)) {
    apiError(403, 'CHALLENGE_ACCESS_DENIED', 'У вас нет доступа к этому челленджу')
  }

  const isParticipant = canViewChallenge(currentUser.id, challenge, participantIds)
  const now = new Date()
  const summary = await toSummary(db, challenge, currentUser.id, currentUser.timeZone, now)
  const checkIns = isParticipant ? await findUserCheckIns(db, challengeId, currentUser.id) : []
  const leaderboard =
    challenge.type === 'group' && isParticipant
      ? await makeLeaderboard(db, challengeId, participants, currentUser.id, now)
      : []

  return {
    ...summary,
    isOwner: challenge.ownerId === currentUser.id,
    isParticipant,
    checkIns: checkIns.map(toCheckInDto),
    leaderboard,
    inviteUrl:
      challenge.type === 'group' && isParticipant && summary.phase !== 'completed' && botUsername
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
  const participantIds = participants.map((row) => row.user.id)
  if (!canViewChallenge(currentUser.id, challenge, participantIds)) {
    apiError(403, 'NOT_A_PARTICIPANT', 'Сначала присоединитесь к челленджу')
  }

  const now = new Date()
  const challengeToday = getDateInTimeZone(challenge.timeZone, now)
  const userToday = getDateInTimeZone(currentUser.timeZone, now)
  if (
    getChallengePhase(
      challenge.startDate,
      challenge.durationDays,
      challengeToday,
      challenge.finishedAt,
    ) !== 'active'
  ) {
    apiError(409, 'CHALLENGE_NOT_ACTIVE', 'Сегодня этот челлендж не активен')
  }

  const checkIns = await findUserCheckIns(db, challengeId, currentUser.id)
  if (
    hasDailyCheckIn(
      checkIns.map((checkIn) => checkIn.date),
      userToday,
    )
  ) {
    apiError(409, 'ALREADY_CHECKED_IN', 'Сегодня уже отмечено')
  }

  try {
    await insertCheckIn(db, challengeId, currentUser.id, userToday)
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
  if (
    !canViewChallenge(
      currentUser.id,
      challenge,
      participants.map((row) => row.user.id),
    )
  ) {
    apiError(403, 'NOT_A_PARTICIPANT', 'У вас нет доступа к этому челленджу')
  }

  if (
    getChallengePhase(
      challenge.startDate,
      challenge.durationDays,
      getDateInTimeZone(challenge.timeZone),
      challenge.finishedAt,
    ) !== 'active'
  ) {
    apiError(409, 'CHALLENGE_NOT_ACTIVE', 'Этот челлендж уже завершён или ещё не начался')
  }

  const removed = await removeCheckIn(
    db,
    challengeId,
    currentUser.id,
    getDateInTimeZone(currentUser.timeZone),
  )
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
): Promise<{ challenge: ChallengeDetails; joined: boolean }> {
  const challenge = await findChallengeById(db, challengeId)
  if (!challenge) {
    apiError(404, 'CHALLENGE_NOT_FOUND', 'Челлендж не найден')
  }

  const participants = await findParticipants(db, challengeId)
  const participantIds = participants.map((row) => row.user.id)
  if (challenge.type !== 'group') {
    apiError(403, 'PERSONAL_CHALLENGE', 'К личному челленджу нельзя присоединиться')
  }

  if (
    getChallengePhase(
      challenge.startDate,
      challenge.durationDays,
      getDateInTimeZone(challenge.timeZone),
      challenge.finishedAt,
    ) === 'completed'
  ) {
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

export async function leaveChallenge(
  db: Database,
  challengeId: string,
  currentUser: UserDto,
): Promise<void> {
  const challenge = await findChallengeById(db, challengeId)
  if (!challenge) {
    apiError(404, 'CHALLENGE_NOT_FOUND', 'Челлендж не найден')
  }

  const participants = await findParticipants(db, challengeId)
  const participantIds = participants.map((row) => row.user.id)

  if (challenge.type !== 'group') {
    apiError(403, 'PERSONAL_CHALLENGE', 'Из личного челленджа нельзя выйти')
  }
  if (challenge.ownerId === currentUser.id) {
    apiError(403, 'OWNER_CANNOT_LEAVE', 'Создатель не может покинуть свой челлендж')
  }
  if (!canLeaveChallenge(currentUser.id, challenge, participantIds)) {
    apiError(403, 'NOT_A_PARTICIPANT', 'Вы не участвуете в этом челлендже')
  }
  if (
    getChallengePhase(
      challenge.startDate,
      challenge.durationDays,
      getDateInTimeZone(challenge.timeZone),
      challenge.finishedAt,
    ) === 'completed'
  ) {
    apiError(409, 'CHALLENGE_COMPLETED', 'Завершённый челлендж нельзя покинуть')
  }

  const removed = await removeParticipantAndCheckIns(db, challengeId, currentUser.id)
  if (!removed) {
    apiError(409, 'PARTICIPANT_ALREADY_LEFT', 'Вы уже покинули этот челлендж')
  }
}

export async function finishChallenge(
  db: Database,
  challengeId: string,
  currentUser: UserDto,
  botUsername: string,
): Promise<ChallengeDetails> {
  const challenge = await findChallengeById(db, challengeId)
  if (!challenge) apiError(404, 'CHALLENGE_NOT_FOUND', 'Челлендж не найден')
  if (!canManageChallenge(currentUser.id, challenge)) {
    apiError(403, 'CHALLENGE_ACCESS_DENIED', 'Завершить челлендж может только создатель')
  }
  if (
    getChallengePhase(
      challenge.startDate,
      challenge.durationDays,
      getDateInTimeZone(challenge.timeZone),
      challenge.finishedAt,
    ) === 'completed'
  ) {
    apiError(409, 'CHALLENGE_COMPLETED', 'Этот челлендж уже завершён')
  }
  await finishChallengeRecord(db, challengeId, currentUser.id)
  return getChallengeDetails(db, challengeId, currentUser, botUsername)
}

export async function deleteChallenge(
  db: Database,
  challengeId: string,
  currentUser: UserDto,
): Promise<void> {
  const challenge = await findChallengeById(db, challengeId)
  if (!challenge) apiError(404, 'CHALLENGE_NOT_FOUND', 'Челлендж не найден')
  if (!canManageChallenge(currentUser.id, challenge)) {
    apiError(403, 'CHALLENGE_ACCESS_DENIED', 'Удалить челлендж может только создатель')
  }
  await deleteChallengeRecord(db, challengeId, currentUser.id)
}
