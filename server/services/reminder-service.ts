import { eq, sql } from 'drizzle-orm'
import { getDateInTimeZone } from '../../shared/domain/time'
import { getChallengePhase } from '../../shared/domain/challenge'
import type { Database } from '../database'
import { reminderDeliveries, users } from '../database/schema'
import {
  findChallengesForUser,
  findUserCheckInsForChallenges,
} from '../repositories/challenge-repository'

export function getHourInTimeZone(timeZone: string, now: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(now),
  )
}

async function hasUncheckedActiveChallenge(
  db: Database,
  userId: string,
  now: Date,
): Promise<boolean> {
  const challenges = await findChallengesForUser(db, userId)
  const active = challenges.filter(
    (challenge) =>
      getChallengePhase(
        challenge.startDate,
        challenge.durationDays,
        getDateInTimeZone(challenge.timeZone, now),
        challenge.finishedAt,
      ) === 'active',
  )
  if (active.length === 0) return false
  const checkIns = await findUserCheckInsForChallenges(
    db,
    active.map((challenge) => challenge.id),
    userId,
  )
  const activeDates = new Map(
    active.map((challenge) => [challenge.id, getDateInTimeZone(challenge.timeZone, now)]),
  )
  const checked = new Set(
    checkIns
      .filter((checkIn) => checkIn.date === activeDates.get(checkIn.challengeId))
      .map((checkIn) => checkIn.challengeId),
  )
  return active.some((challenge) => !checked.has(challenge.id))
}

export async function sendDueReminders(
  db: Database,
  botToken: string,
  now = new Date(),
): Promise<{ sent: number; failed: number }> {
  const candidates = await db.select().from(users).where(eq(users.reminderEnabled, true))
  let sent = 0
  let failed = 0
  for (const user of candidates) {
    if (getHourInTimeZone(user.timeZone, now) !== user.reminderHour) continue
    if (!(await hasUncheckedActiveChallenge(db, user.id, now))) continue
    const date = getDateInTimeZone(user.timeZone, now)
    const claimResult = await db.execute<{ id: string }>(sql`
      insert into reminder_deliveries (user_id, date, status, claimed_at)
      values (${user.id}, ${date}, 'pending', now())
      on conflict (user_id, date) do update set claimed_at = excluded.claimed_at
      where reminder_deliveries.status = 'pending'
        and reminder_deliveries.claimed_at < now() - interval '15 minutes'
      returning id
    `)
    const claim = claimResult.rows[0]
    if (!claim) continue
    let delivered = false
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: user.telegramId,
          text: 'Пора отметить привычку в Habit Challenge 🌱',
        }),
        signal: AbortSignal.timeout(10_000),
      })
      const result: unknown = await response.json()
      if (
        !response.ok ||
        typeof result !== 'object' ||
        result === null ||
        !('ok' in result) ||
        result.ok !== true
      )
        throw new Error(`Telegram HTTP ${response.status}`)
      delivered = true
      await db
        .update(reminderDeliveries)
        .set({ status: 'sent', sentAt: new Date() })
        .where(eq(reminderDeliveries.id, claim.id))
      sent += 1
    } catch (error: unknown) {
      failed += 1
      if (!delivered) await db.delete(reminderDeliveries).where(eq(reminderDeliveries.id, claim.id))
      console.error(
        JSON.stringify({
          type: 'reminder_failed',
          userId: user.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
      )
    }
  }
  return { sent, failed }
}
