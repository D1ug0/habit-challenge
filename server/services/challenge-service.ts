import type {
  ChallengeDetails,
  ChallengeSummary,
  ChallengeListResponse,
  LeaderboardEntry,
  UserDto,
} from '#shared/types/api'
import type { CreateChallengeInput, EditChallengeInput } from '#shared/schemas/challenge'
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
  canManageChallenge,
  canPreviewChallenge,
  canViewChallenge,
} from '#shared/domain/permissions'
import type { Database } from '../database'
import {
  addParticipantIfActive,
  countParticipants,
  countParticipantsForChallenges,
  createChallengeRecord,
  editChallengeRecord,
  deleteChallengeRecord,
  findChallengeById,
  findDashboardStats,
  findBannedUsers,
  findLeaderboardPage,
  findChallengesForUserPage,
  findParticipants,
  findUserCheckIns,
  findUserCheckInsForChallenges,
  finishChallengeRecord,
  insertCheckInIfActive,
  isUserParticipant,
  removeTodayCheckInIfActive,
  removeParticipantIfActive,
  removeAndBanParticipant,
  unbanUser,
} from '../repositories/challenge-repository'
import type { ChallengeRecord, CheckInRecord } from '../repositories/challenge-repository'
import { apiError } from '../utils/api-error'

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
    isPrivate: challenge.isPrivate,
    finishedAt: challenge.finishedAt?.toISOString() ?? null,
    createdAt: challenge.createdAt.toISOString(),
    progress: calculateProgress(checkInDates, challenge.durationDays),
    completedDays: new Set(checkInDates).size,
    streak: calculateStreak(checkInDates, challengeToday),
    currentDay: getCurrentChallengeDay(challenge.startDate, challenge.durationDays, challengeToday),
    phase: getChallengePhase(
      challenge.startDate,
      challenge.durationDays,
      challengeToday,
      challenge.finishedAt,
    ),
    checkedInToday: hasDailyCheckIn(checkInDates, challengeToday),
    participantsCount,
  }
}

async function toSummary(
  db: Database,
  challenge: ChallengeRecord,
  userId: string,
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
    getDateInTimeZone(challenge.timeZone, now),
  )
}

async function makeLeaderboard(
  db: Database,
  challengeId: string,
  currentUserId: string,
  page = 1,
): Promise<LeaderboardEntry[]> {
  const pageSize = 20
  const rows = await findLeaderboardPage(db, challengeId, page, pageSize)
  return rows.map((row, index) => ({
    user: { id: row.userId, firstName: row.firstName, photoUrl: row.photoUrl },
    completedDays: row.completedDays,
    streak: row.streak,
    isCurrentUser: row.userId === currentUserId,
    rank: (page - 1) * pageSize + index + 1,
  }))
}

export async function getLeaderboardPage(
  db: Database,
  challengeId: string,
  currentUser: UserDto,
  page: number,
): Promise<{ participants: LeaderboardEntry[]; hasMore: boolean }> {
  const challenge = await findChallengeById(db, challengeId)
  if (!challenge) apiError(404, 'CHALLENGE_NOT_FOUND', 'Челлендж не найден')
  const [isParticipant, count] = await Promise.all([
    isUserParticipant(db, challengeId, currentUser.id),
    countParticipants(db, challengeId),
  ])
  if (!isParticipant && challenge.ownerId !== currentUser.id)
    apiError(403, 'NOT_A_PARTICIPANT', 'Сначала присоединитесь к челленджу')
  const rows =
    challenge.type === 'group' ? await makeLeaderboard(db, challengeId, currentUser.id, page) : []
  return { participants: rows, hasMore: count > page * 20 }
}

export async function listChallenges(
  db: Database,
  currentUser: UserDto,
  page = 1,
): Promise<ChallengeListResponse> {
  const pageSize = 20
  const [recordsWithExtra, stats] = await Promise.all([
    findChallengesForUserPage(db, currentUser.id, page, pageSize),
    findDashboardStats(db, currentUser.id),
  ])
  const hasMore = recordsWithExtra.length > pageSize
  const records = recordsWithExtra.slice(0, pageSize)
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
  const summaries = records.map((challenge) =>
    makeSummary(
      challenge,
      checkInsByChallenge.get(challenge.id) ?? [],
      participantCounts.get(challenge.id) ?? 0,
      getDateInTimeZone(challenge.timeZone, now),
    ),
  )
  return { challenges: summaries, page, hasMore, stats }
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
  inviteToken?: string,
): Promise<ChallengeDetails> {
  const challenge = await findChallengeById(db, challengeId)
  if (!challenge) {
    apiError(404, 'CHALLENGE_NOT_FOUND', 'Челлендж не найден')
  }

  const member = await isUserParticipant(db, challengeId, currentUser.id)
  const participantIds = member ? [currentUser.id] : []
  if (
    !canPreviewChallenge(currentUser.id, challenge, participantIds) ||
    (challenge.isPrivate &&
      !canViewChallenge(currentUser.id, challenge, participantIds) &&
      inviteToken !== challenge.inviteToken)
  ) {
    apiError(403, 'CHALLENGE_ACCESS_DENIED', 'У вас нет доступа к этому челленджу')
  }

  const isParticipant = canViewChallenge(currentUser.id, challenge, participantIds)
  const now = new Date()
  const summary = await toSummary(db, challenge, currentUser.id, now)
  const checkIns = isParticipant ? await findUserCheckIns(db, challengeId, currentUser.id) : []
  const leaderboard =
    challenge.type === 'group' && isParticipant
      ? await makeLeaderboard(db, challengeId, currentUser.id)
      : []

  return {
    ...summary,
    isOwner: challenge.ownerId === currentUser.id,
    isParticipant,
    checkIns: checkIns.map(toCheckInDto),
    leaderboard,
    leaderboardHasMore:
      challenge.type === 'group' && isParticipant && summary.participantsCount > 20,
    inviteUrl:
      challenge.type === 'group' && isParticipant && summary.phase !== 'completed' && botUsername
        ? `https://t.me/${botUsername}?startapp=challenge_${challenge.id}${challenge.isPrivate ? `_${challenge.inviteToken}` : ''}`
        : null,
  }
}

export async function checkInToday(
  db: Database,
  challengeId: string,
  currentUser: UserDto,
  botUsername: string,
): Promise<ChallengeDetails> {
  const status = await insertCheckInIfActive(db, challengeId, currentUser.id)
  if (status === 'missing') apiError(404, 'CHALLENGE_NOT_FOUND', 'Челлендж не найден')
  if (status === 'inactive')
    apiError(409, 'CHALLENGE_NOT_ACTIVE', 'Сегодня этот челлендж не активен')
  if (status === 'not-participant')
    apiError(403, 'NOT_A_PARTICIPANT', 'Сначала присоединитесь к челленджу')
  if (status === 'duplicate') apiError(409, 'ALREADY_CHECKED_IN', 'Сегодня уже отмечено')

  return getChallengeDetails(db, challengeId, currentUser, botUsername)
}

export async function undoTodayCheckIn(
  db: Database,
  challengeId: string,
  currentUser: UserDto,
  botUsername: string,
): Promise<ChallengeDetails> {
  const status = await removeTodayCheckInIfActive(db, challengeId, currentUser.id)
  if (status === 'missing') apiError(404, 'CHALLENGE_NOT_FOUND', 'Челлендж не найден')
  if (status === 'inactive')
    apiError(409, 'CHALLENGE_NOT_ACTIVE', 'Этот челлендж уже завершён или ещё не начался')
  if (status === 'not-participant')
    apiError(403, 'NOT_A_PARTICIPANT', 'У вас нет доступа к этому челленджу')
  if (status === 'not-found') apiError(404, 'CHECK_IN_NOT_FOUND', 'Сегодняшняя отметка не найдена')

  return getChallengeDetails(db, challengeId, currentUser, botUsername)
}

export async function joinChallenge(
  db: Database,
  challengeId: string,
  currentUser: UserDto,
  botUsername: string,
  inviteToken?: string,
): Promise<{ challenge: ChallengeDetails; joined: boolean }> {
  const status = await addParticipantIfActive(db, challengeId, currentUser.id, inviteToken)
  if (status === 'missing') apiError(404, 'CHALLENGE_NOT_FOUND', 'Челлендж не найден')
  if (status === 'not-group')
    apiError(403, 'PERSONAL_CHALLENGE', 'К личному челленджу нельзя присоединиться')
  if (status === 'inactive') apiError(409, 'CHALLENGE_COMPLETED', 'Этот челлендж уже завершён')
  if (status === 'banned')
    apiError(403, 'CHALLENGE_BANNED', 'Создатель ограничил участие в этом челлендже')
  if (status === 'invite-required')
    apiError(403, 'INVITE_REQUIRED', 'Для вступления нужна ссылка-приглашение')

  return {
    challenge: await getChallengeDetails(db, challengeId, currentUser, botUsername),
    joined: status === 'joined',
  }
}

export async function editChallenge(
  db: Database,
  challengeId: string,
  currentUser: UserDto,
  input: EditChallengeInput,
  botUsername: string,
): Promise<ChallengeDetails> {
  const challenge = await findChallengeById(db, challengeId)
  if (!challenge) apiError(404, 'CHALLENGE_NOT_FOUND', 'Челлендж не найден')
  if (!canManageChallenge(currentUser.id, challenge))
    apiError(403, 'CHALLENGE_ACCESS_DENIED', 'Изменять челлендж может только создатель')
  await editChallengeRecord(db, challengeId, currentUser.id, input)
  return getChallengeDetails(db, challengeId, currentUser, botUsername)
}

export async function banParticipant(
  db: Database,
  challengeId: string,
  participantId: string,
  currentUser: UserDto,
): Promise<void> {
  const challenge = await findChallengeById(db, challengeId)
  if (!challenge) apiError(404, 'CHALLENGE_NOT_FOUND', 'Челлендж не найден')
  if (!canManageChallenge(currentUser.id, challenge) || challenge.type !== 'group')
    apiError(403, 'CHALLENGE_ACCESS_DENIED', 'Управлять участниками может только создатель группы')
  if (
    getChallengePhase(
      challenge.startDate,
      challenge.durationDays,
      getDateInTimeZone(challenge.timeZone),
      challenge.finishedAt,
    ) === 'completed'
  )
    apiError(409, 'CHALLENGE_COMPLETED', 'Участников завершённого челленджа исключить нельзя')
  if (participantId === currentUser.id)
    apiError(403, 'OWNER_CANNOT_LEAVE', 'Создателя исключить нельзя')
  const participants = await findParticipants(db, challengeId)
  if (!participants.some(({ user }) => user.id === participantId))
    apiError(404, 'PARTICIPANT_NOT_FOUND', 'Участник не найден')
  if (!(await removeAndBanParticipant(db, challengeId, participantId)))
    apiError(409, 'CHALLENGE_COMPLETED', 'Участников завершённого челленджа исключить нельзя')
}

export async function listBans(
  db: Database,
  challengeId: string,
  currentUser: UserDto,
): Promise<Array<{ id: string; firstName: string }>> {
  const challenge = await findChallengeById(db, challengeId)
  if (!challenge) apiError(404, 'CHALLENGE_NOT_FOUND', 'Челлендж не найден')
  if (!canManageChallenge(currentUser.id, challenge))
    apiError(403, 'CHALLENGE_ACCESS_DENIED', 'Нет доступа')
  return findBannedUsers(db, challengeId)
}

export async function liftBan(
  db: Database,
  challengeId: string,
  userId: string,
  currentUser: UserDto,
): Promise<void> {
  const challenge = await findChallengeById(db, challengeId)
  if (!challenge) apiError(404, 'CHALLENGE_NOT_FOUND', 'Челлендж не найден')
  if (!canManageChallenge(currentUser.id, challenge))
    apiError(403, 'CHALLENGE_ACCESS_DENIED', 'Нет доступа')
  await unbanUser(db, challengeId, userId)
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

  if (challenge.type !== 'group') {
    apiError(403, 'PERSONAL_CHALLENGE', 'Из личного челленджа нельзя выйти')
  }
  if (challenge.ownerId === currentUser.id) {
    apiError(403, 'OWNER_CANNOT_LEAVE', 'Создатель не может покинуть свой челлендж')
  }
  if (!(await isUserParticipant(db, challengeId, currentUser.id))) {
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

  const status = await removeParticipantIfActive(db, challengeId, currentUser.id)
  if (status === 'inactive')
    apiError(409, 'CHALLENGE_COMPLETED', 'Завершённый челлендж нельзя покинуть')
  if (status === 'missing') apiError(404, 'CHALLENGE_NOT_FOUND', 'Челлендж не найден')
  if (status === 'not-participant') {
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
  if (!(await finishChallengeRecord(db, challengeId, currentUser.id))) {
    apiError(409, 'CHALLENGE_COMPLETED', 'Этот челлендж уже завершён')
  }
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
