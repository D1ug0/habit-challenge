import { and, eq, desc, gt } from 'drizzle-orm'
import { getDatabase } from '../../database'
import { sessions } from '../../database/schema'
import { readSessionId, requireUser } from '../../utils/session'

export default defineEventHandler(
  async (
    event,
  ): Promise<{
    sessions: Array<{ id: string; createdAt: string; expiresAt: string; current: boolean }>
  }> => {
    const user = await requireUser(event)
    const currentId = readSessionId(event)
    const rows = await getDatabase(event)
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, user.id), gt(sessions.expiresAt, new Date())))
      .orderBy(desc(sessions.createdAt))
    return {
      sessions: rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
        current: row.id === currentId,
      })),
    }
  },
)
