import type { ChallengePhase } from '../types/api'
import { getDateInTimeZone } from './time'

const dayMilliseconds = 86_400_000

function asUtcDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`)
}

export function getTodayUtc(now = new Date()): string {
  return getDateInTimeZone('UTC', now)
}

export function addDays(date: string, amount: number): string {
  const result = asUtcDate(date)
  result.setUTCDate(result.getUTCDate() + amount)
  return result.toISOString().slice(0, 10)
}

export function getChallengeEndDate(startDate: string, durationDays: number): string {
  return addDays(startDate, durationDays - 1)
}

export function getChallengePhase(
  startDate: string,
  durationDays: number,
  today: string,
  finishedAt: Date | null = null,
): ChallengePhase {
  if (finishedAt) {
    return 'completed'
  }
  if (today < startDate) {
    return 'scheduled'
  }

  if (today > getChallengeEndDate(startDate, durationDays)) {
    return 'completed'
  }

  return 'active'
}

export function getCurrentChallengeDay(
  startDate: string,
  durationDays: number,
  today: string,
): number {
  if (today < startDate) {
    return 0
  }

  const elapsed =
    Math.floor((asUtcDate(today).valueOf() - asUtcDate(startDate).valueOf()) / dayMilliseconds) + 1
  return Math.min(durationDays, elapsed)
}

export function calculateProgress(checkInDates: readonly string[], durationDays: number): number {
  const completedDays = new Set(checkInDates).size
  return Math.min(100, Math.round((completedDays / durationDays) * 100))
}

export function calculateStreak(checkInDates: readonly string[], today: string): number {
  const uniqueDates = new Set(checkInDates)
  let cursor = uniqueDates.has(today) ? today : addDays(today, -1)

  if (!uniqueDates.has(cursor)) {
    return 0
  }

  let streak = 0
  while (uniqueDates.has(cursor)) {
    streak += 1
    cursor = addDays(cursor, -1)
  }

  return streak
}

export function hasDailyCheckIn(checkInDates: readonly string[], date: string): boolean {
  return checkInDates.includes(date)
}

export function canCheckIn(
  startDate: string,
  durationDays: number,
  checkInDates: readonly string[],
  today: string,
): boolean {
  return (
    getChallengePhase(startDate, durationDays, today) === 'active' &&
    !hasDailyCheckIn(checkInDates, today)
  )
}
