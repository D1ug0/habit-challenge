import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const challengeType = pgEnum('challenge_type', ['personal', 'group'])

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    telegramId: varchar('telegram_id', { length: 32 }).notNull(),
    username: varchar('username', { length: 64 }),
    firstName: varchar('first_name', { length: 128 }).notNull(),
    lastName: varchar('last_name', { length: 128 }),
    photoUrl: text('photo_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('users_telegram_id_unique').on(table.telegramId)],
)

export const challenges = pgTable(
  'challenges',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    title: varchar('title', { length: 80 }).notNull(),
    description: text('description'),
    emoji: varchar('emoji', { length: 32 }).notNull(),
    type: challengeType('type').notNull(),
    durationDays: integer('duration_days').notNull(),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('challenges_owner_id_index').on(table.ownerId)],
)

export const challengeParticipants = pgTable(
  'challenge_participants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    challengeId: uuid('challenge_id')
      .notNull()
      .references(() => challenges.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('challenge_participants_challenge_user_unique').on(table.challengeId, table.userId),
    index('challenge_participants_user_id_index').on(table.userId),
  ],
)

export const checkIns = pgTable(
  'check_ins',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    challengeId: uuid('challenge_id')
      .notNull()
      .references(() => challenges.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('check_ins_challenge_user_date_unique').on(
      table.challengeId,
      table.userId,
      table.date,
    ),
    index('check_ins_challenge_id_index').on(table.challengeId),
  ],
)
