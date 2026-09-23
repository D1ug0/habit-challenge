import { and, asc, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'
import type { CreateChallengeInput, EditChallengeInput } from '#shared/schemas/challenge'
import type { DashboardStats } from '#shared/types/api'
import { getChallengePhase } from '../../shared/domain/challenge'
import { getDateInTimeZone } from '../../shared/domain/time'
import type { Database } from '../database'
import {
  challengeBans,
  challengeParticipants,
  challenges,
  checkIns,
  users,
} from '../database/schema'

export type ChallengeRecord = typeof challenges.$inferSelect
export type ParticipantRecord = typeof challengeParticipants.$inferSelect
export type CheckInRecord = typeof checkIns.$inferSelect

export interface ParticipantWithUser {
  participant: ParticipantRecord
  user: typeof users.$inferSelect
}

export interface LeaderboardRecord {
  userId: string
  firstName: string
  photoUrl: string | null
  completedDays: number
  streak: number
}

export async function findLeaderboardPage(
  db: Database,
  challengeId: string,
  page: number,
  pageSize: number,
): Promise<LeaderboardRecord[]> {
  const result = await db.execute<{
    user_id: string
    first_name: string
    photo_url: string | null
    completed_days: string
    streak: string
  }>(sql`
    with dated as (
      select ci.user_id, ci.date,
        row_number() over (partition by ci.user_id order by ci.date desc) as rn,
        max(ci.date) over (partition by ci.user_id) as latest
      from check_ins ci where ci.challenge_id = ${challengeId}
    ), scored as (
      select p.user_id,
        count(d.date) as completed_days,
        count(d.date) filter (where d.date =
          (case when d.latest = (now() at time zone c.time_zone)::date
            then (now() at time zone c.time_zone)::date
            else (now() at time zone c.time_zone)::date - 1 end) - (d.rn - 1)::integer
        ) as streak
      from challenge_participants p
      join challenges c on c.id = p.challenge_id
      left join dated d on d.user_id = p.user_id
      where p.challenge_id = ${challengeId}
      group by p.user_id, c.time_zone
    )
    select u.id as user_id, u.first_name, u.photo_url,
      s.completed_days, s.streak
    from scored s join users u on u.id = s.user_id
    order by s.completed_days desc, s.streak desc, u.first_name asc, u.id asc
    limit ${pageSize} offset ${(page - 1) * pageSize}
  `)
  return result.rows.map((row) => ({
    userId: row.user_id,
    firstName: row.first_name,
    photoUrl: row.photo_url,
    completedDays: Number(row.completed_days),
    streak: Number(row.streak),
  }))
}

export async function createChallengeRecord(
  db: Database,
  ownerId: string,
  timeZone: string,
  input: CreateChallengeInput,
): Promise<ChallengeRecord> {
  return db.transaction(async (transaction) => {
    const [challenge] = await transaction
      .insert(challenges)
      .values({
        ownerId,
        title: input.title,
        description: input.description || null,
        emoji: input.emoji,
        type: input.type,
        isPrivate: input.type === 'group' && input.isPrivate,
        inviteToken:
          input.type === 'group' && input.isPrivate ? randomBytes(8).toString('hex') : null,
        durationDays: input.durationDays,
        startDate: input.startDate,
        timeZone,
      })
      .returning()

    if (!challenge) {
      throw new Error('Не удалось создать челлендж')
    }

    await transaction.insert(challengeParticipants).values({
      challengeId: challenge.id,
      userId: ownerId,
    })

    return challenge
  })
}

export async function editChallengeRecord(
  db: Database,
  challengeId: string,
  ownerId: string,
  input: EditChallengeInput,
): Promise<boolean> {
  const updated = await db
    .update(challenges)
    .set({
      title: input.title,
      description: input.description || null,
      emoji: input.emoji,
    })
    .where(and(eq(challenges.id, challengeId), eq(challenges.ownerId, ownerId)))
    .returning({ id: challenges.id })
  return updated.length > 0
}

export async function removeAndBanParticipant(
  db: Database,
  challengeId: string,
  userId: string,
): Promise<boolean> {
  return db.transaction(async (transaction) => {
    const [challenge] = await transaction
      .select()
      .from(challenges)
      .where(eq(challenges.id, challengeId))
      .for('update')
    if (
      !challenge ||
      getChallengePhase(
        challenge.startDate,
        challenge.durationDays,
        getDateInTimeZone(challenge.timeZone),
        challenge.finishedAt,
      ) === 'completed'
    )
      return false
    await transaction.insert(challengeBans).values({ challengeId, userId }).onConflictDoNothing()
    await transaction
      .delete(challengeParticipants)
      .where(
        and(
          eq(challengeParticipants.challengeId, challengeId),
          eq(challengeParticipants.userId, userId),
        ),
      )
    return true
  })
}

export async function findBannedUsers(
  db: Database,
  challengeId: string,
): Promise<Array<{ id: string; firstName: string }>> {
  return db
    .select({ id: users.id, firstName: users.firstName })
    .from(challengeBans)
    .innerJoin(users, eq(users.id, challengeBans.userId))
    .where(eq(challengeBans.challengeId, challengeId))
    .orderBy(asc(challengeBans.createdAt))
}

export async function unbanUser(db: Database, challengeId: string, userId: string): Promise<void> {
  await db
    .delete(challengeBans)
    .where(and(eq(challengeBans.challengeId, challengeId), eq(challengeBans.userId, userId)))
}

export async function findChallengesForUser(
  db: Database,
  userId: string,
): Promise<ChallengeRecord[]> {
  const rows = await db
    .select({ challenge: challenges })
    .from(challengeParticipants)
    .innerJoin(challenges, eq(challenges.id, challengeParticipants.challengeId))
    .where(eq(challengeParticipants.userId, userId))
    .orderBy(desc(challenges.createdAt))

  return rows.map((row) => row.challenge)
}

export async function findChallengesForUserPage(
  db: Database,
  userId: string,
  page: number,
  pageSize: number,
): Promise<ChallengeRecord[]> {
  const rows = await db
    .select({ challenge: challenges })
    .from(challengeParticipants)
    .innerJoin(challenges, eq(challenges.id, challengeParticipants.challengeId))
    .where(eq(challengeParticipants.userId, userId))
    .orderBy(desc(challenges.createdAt), desc(challenges.id))
    .limit(pageSize + 1)
    .offset((page - 1) * pageSize)
  return rows.map((row) => row.challenge)
}

export async function findDashboardStats(db: Database, userId: string): Promise<DashboardStats> {
  const result = await db.execute<{
    total_challenges: string
    active_challenges: string
    best_streak: string
  }>(sql`
    with membership as (
      select c.id, c.time_zone, c.start_date, c.duration_days, c.finished_at
      from challenge_participants p
      join challenges c on c.id = p.challenge_id
      where p.user_id = ${userId}
    ), dated as (
      select ci.challenge_id, ci.date,
        row_number() over (partition by ci.challenge_id order by ci.date desc) as rn,
        max(ci.date) over (partition by ci.challenge_id) as latest
      from check_ins ci
      join membership m on m.id = ci.challenge_id
      where ci.user_id = ${userId}
    ), streaks as (
      select m.id,
        count(d.date) filter (where d.date =
          (case when d.latest = (now() at time zone m.time_zone)::date
            then (now() at time zone m.time_zone)::date
            else (now() at time zone m.time_zone)::date - 1 end) - (d.rn - 1)::integer
        ) as streak
      from membership m
      left join dated d on d.challenge_id = m.id
      group by m.id, m.time_zone
    )
    select count(*) as total_challenges,
      count(*) filter (where m.finished_at is null
        and (now() at time zone m.time_zone)::date between m.start_date
          and m.start_date + (m.duration_days - 1)) as active_challenges,
      coalesce(max(s.streak), 0) as best_streak
    from membership m
    left join streaks s on s.id = m.id
  `)
  const row = result.rows[0]
  return {
    totalChallenges: Number(row?.total_challenges ?? 0),
    activeChallenges: Number(row?.active_challenges ?? 0),
    bestStreak: Number(row?.best_streak ?? 0),
  }
}

export async function findChallengeById(
  db: Database,
  challengeId: string,
): Promise<ChallengeRecord | null> {
  const [challenge] = await db
    .select()
    .from(challenges)
    .where(eq(challenges.id, challengeId))
    .limit(1)
  return challenge ?? null
}

export async function finishChallengeRecord(
  db: Database,
  challengeId: string,
  ownerId: string,
): Promise<boolean> {
  const updated = await db
    .update(challenges)
    .set({ finishedAt: new Date() })
    .where(
      and(
        eq(challenges.id, challengeId),
        eq(challenges.ownerId, ownerId),
        isNull(challenges.finishedAt),
      ),
    )
    .returning({ id: challenges.id })
  return updated.length > 0
}

export async function deleteChallengeRecord(
  db: Database,
  challengeId: string,
  ownerId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(challenges)
    .where(and(eq(challenges.id, challengeId), eq(challenges.ownerId, ownerId)))
    .returning({ id: challenges.id })
  return deleted.length > 0
}

export async function findParticipants(
  db: Database,
  challengeId: string,
): Promise<ParticipantWithUser[]> {
  return db
    .select({ participant: challengeParticipants, user: users })
    .from(challengeParticipants)
    .innerJoin(users, eq(users.id, challengeParticipants.userId))
    .where(eq(challengeParticipants.challengeId, challengeId))
    .orderBy(asc(challengeParticipants.joinedAt))
}

export async function countParticipants(db: Database, challengeId: string): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(challengeParticipants)
    .where(eq(challengeParticipants.challengeId, challengeId))
  return result?.count ?? 0
}

export async function isUserParticipant(
  db: Database,
  challengeId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: challengeParticipants.id })
    .from(challengeParticipants)
    .where(
      and(
        eq(challengeParticipants.challengeId, challengeId),
        eq(challengeParticipants.userId, userId),
      ),
    )
    .limit(1)
  return Boolean(row)
}

export async function countParticipantsForChallenges(
  db: Database,
  challengeIds: readonly string[],
): Promise<Map<string, number>> {
  if (challengeIds.length === 0) return new Map()

  const rows = await db
    .select({ challengeId: challengeParticipants.challengeId, count: count() })
    .from(challengeParticipants)
    .where(inArray(challengeParticipants.challengeId, [...challengeIds]))
    .groupBy(challengeParticipants.challengeId)

  return new Map(rows.map((row) => [row.challengeId, row.count]))
}

export async function findUserCheckIns(
  db: Database,
  challengeId: string,
  userId: string,
): Promise<CheckInRecord[]> {
  return db
    .select()
    .from(checkIns)
    .where(and(eq(checkIns.challengeId, challengeId), eq(checkIns.userId, userId)))
    .orderBy(desc(checkIns.date))
}

export async function findUserCheckInsForChallenges(
  db: Database,
  challengeIds: readonly string[],
  userId: string,
): Promise<CheckInRecord[]> {
  if (challengeIds.length === 0) return []

  return db
    .select()
    .from(checkIns)
    .where(and(inArray(checkIns.challengeId, [...challengeIds]), eq(checkIns.userId, userId)))
    .orderBy(desc(checkIns.date))
}

export async function insertCheckInIfActive(
  db: Database,
  challengeId: string,
  userId: string,
): Promise<'created' | 'missing' | 'inactive' | 'not-participant' | 'duplicate'> {
  return db.transaction(async (transaction) => {
    const [challenge] = await transaction
      .select()
      .from(challenges)
      .where(eq(challenges.id, challengeId))
      .for('update')
    if (!challenge) return 'missing'
    const challengeToday = getDateInTimeZone(challenge.timeZone)
    if (
      getChallengePhase(
        challenge.startDate,
        challenge.durationDays,
        challengeToday,
        challenge.finishedAt,
      ) !== 'active'
    )
      return 'inactive'
    const [participant] = await transaction
      .select({ id: challengeParticipants.id })
      .from(challengeParticipants)
      .where(
        and(
          eq(challengeParticipants.challengeId, challengeId),
          eq(challengeParticipants.userId, userId),
        ),
      )
      .for('update')
    if (!participant) return 'not-participant'
    const [created] = await transaction
      .insert(checkIns)
      .values({ challengeId, userId, date: challengeToday })
      .onConflictDoNothing()
      .returning({ id: checkIns.id })
    return created ? 'created' : 'duplicate'
  })
}

export async function addParticipantIfActive(
  db: Database,
  challengeId: string,
  userId: string,
  inviteToken?: string,
): Promise<
  'joined' | 'already' | 'missing' | 'not-group' | 'inactive' | 'banned' | 'invite-required'
> {
  return db.transaction(async (transaction) => {
    const [challenge] = await transaction
      .select()
      .from(challenges)
      .where(eq(challenges.id, challengeId))
      .for('update')
    if (!challenge) return 'missing'
    if (challenge.type !== 'group') return 'not-group'
    if (
      getChallengePhase(
        challenge.startDate,
        challenge.durationDays,
        getDateInTimeZone(challenge.timeZone),
        challenge.finishedAt,
      ) === 'completed'
    )
      return 'inactive'
    const [ban] = await transaction
      .select({ userId: challengeBans.userId })
      .from(challengeBans)
      .where(and(eq(challengeBans.challengeId, challengeId), eq(challengeBans.userId, userId)))
      .limit(1)
    if (ban) return 'banned'
    const [participant] = await transaction
      .select({ id: challengeParticipants.id })
      .from(challengeParticipants)
      .where(
        and(
          eq(challengeParticipants.challengeId, challengeId),
          eq(challengeParticipants.userId, userId),
        ),
      )
      .limit(1)
    if (participant) return 'already'
    if (challenge.isPrivate && challenge.inviteToken !== inviteToken) return 'invite-required'
    const [created] = await transaction
      .insert(challengeParticipants)
      .values({ challengeId, userId })
      .onConflictDoNothing()
      .returning({ id: challengeParticipants.id })
    return created ? 'joined' : 'already'
  })
}

export async function removeTodayCheckInIfActive(
  db: Database,
  challengeId: string,
  userId: string,
): Promise<'removed' | 'missing' | 'inactive' | 'not-participant' | 'not-found'> {
  return db.transaction(async (transaction) => {
    const [challenge] = await transaction
      .select()
      .from(challenges)
      .where(eq(challenges.id, challengeId))
      .for('update')
    if (!challenge) return 'missing'
    const challengeToday = getDateInTimeZone(challenge.timeZone)
    if (
      getChallengePhase(
        challenge.startDate,
        challenge.durationDays,
        challengeToday,
        challenge.finishedAt,
      ) !== 'active'
    )
      return 'inactive'
    const [participant] = await transaction
      .select({ id: challengeParticipants.id })
      .from(challengeParticipants)
      .where(
        and(
          eq(challengeParticipants.challengeId, challengeId),
          eq(challengeParticipants.userId, userId),
        ),
      )
      .for('update')
    if (!participant) return 'not-participant'
    const deleted = await transaction
      .delete(checkIns)
      .where(
        and(
          eq(checkIns.challengeId, challengeId),
          eq(checkIns.userId, userId),
          eq(checkIns.date, challengeToday),
        ),
      )
      .returning({ id: checkIns.id })
    return deleted.length ? 'removed' : 'not-found'
  })
}

export async function removeParticipantIfActive(
  db: Database,
  challengeId: string,
  userId: string,
): Promise<'removed' | 'missing' | 'inactive' | 'not-participant'> {
  return db.transaction(async (transaction) => {
    const [challenge] = await transaction
      .select()
      .from(challenges)
      .where(eq(challenges.id, challengeId))
      .for('update')
    if (!challenge) return 'missing'
    if (
      getChallengePhase(
        challenge.startDate,
        challenge.durationDays,
        getDateInTimeZone(challenge.timeZone),
        challenge.finishedAt,
      ) === 'completed'
    )
      return 'inactive'
    const deleted = await transaction
      .delete(challengeParticipants)
      .where(
        and(
          eq(challengeParticipants.challengeId, challengeId),
          eq(challengeParticipants.userId, userId),
        ),
      )
      .returning({ id: challengeParticipants.id })
    return deleted.length ? 'removed' : 'not-participant'
  })
}
