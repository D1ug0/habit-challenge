import { describe, expect, it } from 'vitest'
import { consumeRateLimit } from '../../server/utils/rate-limit'

describe('rate limit', () => {
  it('блокирует запросы сверх лимита до конца окна', () => {
    const key = `limit-${Math.random()}`

    expect(consumeRateLimit(key, 2, 10_000, 1_000)).toBeNull()
    expect(consumeRateLimit(key, 2, 10_000, 2_000)).toBeNull()
    expect(consumeRateLimit(key, 2, 10_000, 3_000)).toBe(8)
  })

  it('открывает новое окно после сброса', () => {
    const key = `reset-${Math.random()}`

    expect(consumeRateLimit(key, 1, 1_000, 1_000)).toBeNull()
    expect(consumeRateLimit(key, 1, 1_000, 1_500)).toBe(1)
    expect(consumeRateLimit(key, 1, 1_000, 2_000)).toBeNull()
  })
})
