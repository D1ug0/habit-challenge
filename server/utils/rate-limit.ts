import type { H3Event } from 'h3'
import { sql } from 'drizzle-orm'
import type { ApiErrorData } from '#shared/types/api'
import { getDatabase } from '../database'

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

export async function consumeDistributedRateLimit(
  event: H3Event,
  key: string,
  limit: number,
  windowMs: number,
): Promise<number | null> {
  const result = await getDatabase(event).execute<{ count: number; reset_at: Date }>(sql`
    insert into rate_limit_buckets (key, count, reset_at)
    values (${key}, 1, now() + (${windowMs} * interval '1 millisecond'))
    on conflict (key) do update set
      count = case when rate_limit_buckets.reset_at <= now() then 1 else rate_limit_buckets.count + 1 end,
      reset_at = case when rate_limit_buckets.reset_at <= now() then excluded.reset_at else rate_limit_buckets.reset_at end
    returning count, reset_at
  `)
  const row = result.rows[0]
  if (!row || Number(row.count) <= limit) return null
  return Math.max(1, Math.ceil((new Date(row.reset_at).valueOf() - Date.now()) / 1000))
}

async function enforceRateLimit(
  event: H3Event,
  key: string,
  limit: number,
  windowMs: number,
): Promise<void> {
  const retryAfter = await consumeDistributedRateLimit(event, key, limit, windowMs)
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

export async function enforceAuthRateLimit(event: H3Event): Promise<void> {
  const clientIp = getRequestIP(event) ?? 'unknown'
  await enforceRateLimit(event, `auth:${clientIp}`.slice(0, 128), 20, 60_000)
}

export async function enforceMutationRateLimit(event: H3Event, userId: string): Promise<void> {
  await enforceRateLimit(event, `mutation:${userId}`, 120, 60_000)
}
