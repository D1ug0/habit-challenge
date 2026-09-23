import { describe, expect, it } from 'vitest'
import { getHourInTimeZone } from '../../server/services/reminder-service'

describe('час напоминания', () => {
  it('учитывает местный час пользователя при одном UTC-моменте', () => {
    const now = new Date('2026-09-23T16:30:00.000Z')
    expect(getHourInTimeZone('Europe/Moscow', now)).toBe(19)
    expect(getHourInTimeZone('America/New_York', now)).toBe(12)
  })
})
