import { sql } from 'drizzle-orm'
import { getDatabase } from '../database'

export default defineEventHandler(
  async (event): Promise<{ status: 'ok'; database: 'connected'; timestamp: string }> => {
    try {
      await getDatabase(event).execute(sql`select 1`)
    } catch (error: unknown) {
      if (process.env.NODE_ENV === 'production') {
        console.error(
          JSON.stringify({
            type: 'health_check_failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
        )
      }
      throw createError({ statusCode: 503, message: 'Database is unavailable' })
    }

    return {
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    }
  },
)
