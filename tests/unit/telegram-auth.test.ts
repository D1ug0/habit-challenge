import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { validateTelegramInitData } from '../../server/utils/telegram-auth'

const token = '123456:TEST_TOKEN_FOR_SIGNATURE'
const now = new Date('2026-09-11T12:00:00.000Z')

function makeInitData(overrides: Record<string, string> = {}): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(now.valueOf() / 1000)),
    query_id: 'AAEAAAE',
    user: JSON.stringify({ id: 123456789, first_name: 'Мария', username: 'maria' }),
    ...overrides,
  })
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(token).digest()
  params.set('hash', createHmac('sha256', secret).update(dataCheckString).digest('hex'))
  return params.toString()
}

describe('проверка Telegram initData', () => {
  it('принимает корректно подписанные и свежие данные', () => {
    expect(validateTelegramInitData(makeInitData(), token, 3600, now)).toEqual({
      telegramId: '123456789',
      firstName: 'Мария',
      lastName: null,
      username: 'maria',
      photoUrl: null,
    })
  })

  it('отклоняет подменённые данные', () => {
    const initData = makeInitData().replace('maria', 'attacker')
    expect(validateTelegramInitData(initData, token, 3600, now)).toBeNull()
  })

  it('отклоняет устаревшие данные', () => {
    const oldAuthDate = String(Math.floor(now.valueOf() / 1000) - 3601)
    expect(
      validateTelegramInitData(makeInitData({ auth_date: oldAuthDate }), token, 3600, now),
    ).toBeNull()
  })
})
