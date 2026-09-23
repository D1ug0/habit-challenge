import { sql } from 'drizzle-orm'
import { getDatabase } from '../database'
import { requireBearer } from '../utils/bearer'
import { getServerConfig } from '../utils/config'

export default defineEventHandler(async (event): Promise<string> => {
  requireBearer(event, getServerConfig(event).monitoringToken)
  const db = getDatabase(event)
  const [users, challenges, checkIns, sessions] = await Promise.all([
    db.execute<{ count: string }>(sql`select count(*) as count from users`),
    db.execute<{ count: string }>(sql`select count(*) as count from challenges`),
    db.execute<{ count: string }>(sql`select count(*) as count from check_ins`),
    db.execute<{ count: string }>(
      sql`select count(*) as count from sessions where expires_at > now()`,
    ),
  ])
  setResponseHeader(event, 'content-type', 'text/plain; version=0.0.4; charset=utf-8')
  return (
    [
      '# TYPE habit_users gauge',
      `habit_users ${users.rows[0]?.count ?? 0}`,
      '# TYPE habit_challenges gauge',
      `habit_challenges ${challenges.rows[0]?.count ?? 0}`,
      '# TYPE habit_check_ins gauge',
      `habit_check_ins ${checkIns.rows[0]?.count ?? 0}`,
      '# TYPE habit_active_sessions gauge',
      `habit_active_sessions ${sessions.rows[0]?.count ?? 0}`,
    ].join('\n') + '\n'
  )
})
