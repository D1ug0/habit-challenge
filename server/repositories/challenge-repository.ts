import { and, asc, count, desc, eq, inArray } from 'drizzle-orm'
import type { CreateChallengeInput } from '#shared/schemas/challenge'
import type { Database } from '../database'
import { challengeParticipants, challenges, checkIns, users } from '../database/schema'

export type ChallengeRecord = typeof challenges.$inferSelect
export type ParticipantRecord = typeof challengeParticipants.$inferSelect
export type CheckInRecord = typeof checkIns.$inferSelect

export interface ParticipantWithUser {
  participant: ParticipantRecord
  user: typeof users.$inferSelect
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
    .where(and(eq(challenges.id, challengeId), eq(challenges.ownerId, ownerId)))
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

export async function findChallengeCheckIns(
  db: Database,
  challengeId: string,
): Promise<CheckInRecord[]> {
  return db
    .select()
    .from(checkIns)
    .where(eq(checkIns.challengeId, challengeId))
    .orderBy(desc(checkIns.date))
}

export async function insertCheckIn(
  db: Database,
  challengeId: string,
  userId: string,
  date: string,
): Promise<void> {
  await db.insert(checkIns).values({ challengeId, userId, date })
}

export async function removeCheckIn(
  db: Database,
  challengeId: string,
  userId: string,
  date: string,
): Promise<boolean> {
  const deleted = await db
    .delete(checkIns)
    .where(
      and(
        eq(checkIns.challengeId, challengeId),
        eq(checkIns.userId, userId),
        eq(checkIns.date, date),
      ),
    )
    .returning({ id: checkIns.id })
  return deleted.length > 0
}

export async function addParticipant(
  db: Database,
  challengeId: string,
  userId: string,
): Promise<boolean> {
  const inserted = await db
    .insert(challengeParticipants)
    .values({ challengeId, userId })
    .onConflictDoNothing()
    .returning({ id: challengeParticipants.id })
  return inserted.length > 0
}

export async function removeParticipantAndCheckIns(
  db: Database,
  challengeId: string,
  userId: string,
): Promise<boolean> {
  const deletedParticipants = await db
    .delete(challengeParticipants)
    .where(
      and(
        eq(challengeParticipants.challengeId, challengeId),
        eq(challengeParticipants.userId, userId),
      ),
    )
    .returning({ id: challengeParticipants.id })

  return deletedParticipants.length > 0
}
