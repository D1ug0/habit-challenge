import type { H3Event } from 'h3'
import type { ApiErrorData } from '#shared/types/api'

interface RateLimitBucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, RateLimitBucket>()

export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): number | null {
  if (buckets.size >= 10_000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey)
    }
    if (buckets.size >= 10_000) buckets.delete(buckets.keys().next().value as string)
  }

  const current = buckets.get(key)
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return null
  }

  current.count += 1
  if (current.count <= limit) return null
  return Math.max(1, Math.ceil((current.resetAt - now) / 1000))
}

function enforceRateLimit(event: H3Event, key: string, limit: number, windowMs: number): void {
  const retryAfter = consumeRateLimit(key, limit, windowMs)
  if (retryAfter === null) return

  setResponseHeader(event, 'Retry-After', retryAfter)
  throw createError({
    statusCode: 429,
    message: 'Слишком много запросов',
    data: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Слишком много запросов. Попробуйте немного позже.',
    } satisfies ApiErrorData,
  })
}

export function enforceAuthRateLimit(event: H3Event): void {
  const clientIp = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  enforceRateLimit(event, `auth:${clientIp}`, 20, 60_000)
}

export function enforceMutationRateLimit(event: H3Event, userId: string): void {
  enforceRateLimit(event, `mutation:${userId}`, 120, 60_000)
}
