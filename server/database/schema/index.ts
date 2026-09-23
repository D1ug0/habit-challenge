import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  foreignKey,
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
    timeZone: varchar('time_zone', { length: 64 }).default('UTC').notNull(),
    reminderEnabled: boolean('reminder_enabled').default(false).notNull(),
    reminderHour: integer('reminder_hour').default(19).notNull(),
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
    isPrivate: boolean('is_private').default(false).notNull(),
    inviteToken: varchar('invite_token', { length: 32 }),
    durationDays: integer('duration_days').notNull(),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    timeZone: varchar('time_zone', { length: 64 }).default('UTC').notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('challenges_owner_id_index').on(table.ownerId),
    check('challenges_duration_days_check', sql`${table.durationDays} in (7, 14, 30)`),
  ],
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
    foreignKey({
      columns: [table.challengeId, table.userId],
      foreignColumns: [challengeParticipants.challengeId, challengeParticipants.userId],
      name: 'check_ins_challenge_participant_fk',
    }).onDelete('cascade'),
    index('check_ins_challenge_id_index').on(table.challengeId),
  ],
)

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('sessions_user_id_index').on(table.userId)],
)

export const challengeBans = pgTable(
  'challenge_bans',
  {
    challengeId: uuid('challenge_id')
      .notNull()
      .references(() => challenges.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('challenge_bans_challenge_user_unique').on(table.challengeId, table.userId),
  ],
)

export const reminderDeliveries = pgTable(
  'reminder_deliveries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    status: varchar('status', { length: 16 }).default('pending').notNull(),
    claimedAt: timestamp('claimed_at', { withTimezone: true }).defaultNow().notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
  },
  (table) => [uniqueIndex('reminder_deliveries_user_date_unique').on(table.userId, table.date)],
)

export const rateLimitBuckets = pgTable(
  'rate_limit_buckets',
  {
    key: varchar('key', { length: 128 }).primaryKey(),
    count: integer('count').notNull(),
    resetAt: timestamp('reset_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('rate_limit_buckets_reset_at_index').on(table.resetAt)],
)
