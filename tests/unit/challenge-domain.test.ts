import { describe, expect, it } from 'vitest'
import {
  calculateProgress,
  calculateStreak,
  canCheckIn,
  getChallengeEndDate,
  getChallengePhase,
  getCurrentChallengeDay,
  hasDailyCheckIn,
} from '../../shared/domain/challenge'

describe('расчёт streak', () => {
  it('считает непрерывную серию, включая сегодня', () => {
    expect(calculateStreak(['2026-09-08', '2026-09-09', '2026-09-10'], '2026-09-10')).toBe(3)
  })

  it('не обнуляет серию до конца текущего дня', () => {
    expect(calculateStreak(['2026-09-08', '2026-09-09'], '2026-09-10')).toBe(2)
  })

  it('обнуляет серию после пропуска дня', () => {
    expect(calculateStreak(['2026-09-07', '2026-09-08'], '2026-09-10')).toBe(0)
  })
})

describe('прогресс', () => {
  it('считает только уникальные дни и ограничивает результат 100 процентами', () => {
    const days = ['2026-09-01', '2026-09-01', '2026-09-02', '2026-09-03']
    expect(calculateProgress(days, 7)).toBe(43)
    expect(calculateProgress([...days, '04', '05', '06', '07', '08', '09'], 7)).toBe(100)
  })
})

describe('границы челленджа', () => {
  it('считает последний день включительно', () => {
    expect(getChallengeEndDate('2026-09-01', 7)).toBe('2026-09-07')
    expect(getChallengePhase('2026-09-01', 7, '2026-08-31')).toBe('scheduled')
    expect(getChallengePhase('2026-09-01', 7, '2026-09-07')).toBe('active')
    expect(getChallengePhase('2026-09-01', 7, '2026-09-08')).toBe('completed')
    expect(getCurrentChallengeDay('2026-09-01', 7, '2026-08-31')).toBe(0)
    expect(getCurrentChallengeDay('2026-09-01', 7, '2026-09-20')).toBe(7)
  })
})

describe('один check-in в день', () => {
  it('отклоняет повторный check-in', () => {
    const dates = ['2026-09-10']
    expect(hasDailyCheckIn(dates, '2026-09-10')).toBe(true)
    expect(canCheckIn('2026-09-01', 14, dates, '2026-09-10')).toBe(false)
  })

  it('отклоняет check-in вне периода челленджа', () => {
    expect(canCheckIn('2026-09-10', 7, [], '2026-09-09')).toBe(false)
    expect(canCheckIn('2026-09-10', 7, [], '2026-09-17')).toBe(false)
  })
})
