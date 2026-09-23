import { lt } from 'drizzle-orm'
import { getDatabase } from '../../database'
import { rateLimitBuckets, sessions } from '../../database/schema'
import { requireBearer } from '../../utils/bearer'
import { getServerConfig } from '../../utils/config'

export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  requireBearer(event, getServerConfig(event).reminderJobSecret)
  const db = getDatabase(event)
  await Promise.all([
    db.delete(sessions).where(lt(sessions.expiresAt, new Date())),
    db
      .delete(rateLimitBuckets)
      .where(lt(rateLimitBuckets.resetAt, new Date(Date.now() - 86_400_000))),
  ])
  return { ok: true }
})
