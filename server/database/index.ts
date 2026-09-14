import type { H3Event } from 'h3'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'
import { getServerConfig } from '../utils/config'

export type Database = NodePgDatabase<typeof schema>

let pool: Pool | undefined
let database: Database | undefined

export function getDatabase(event: H3Event): Database {
  if (!database) {
    const config = getServerConfig(event)
    pool = new Pool({ connectionString: config.databaseUrl, max: 10 })
    database = drizzle(pool, { schema })
  }

  return database
}
