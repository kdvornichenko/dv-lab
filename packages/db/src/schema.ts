import { sql } from 'drizzle-orm'
import { check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const appInfo = pgTable('app_info', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const accounts = pgTable(
	'accounts',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		login: text('login').notNull(),
		displayName: text('display_name').notNull(),
		role: text('role').notNull(),
		status: text('status').default('active').notNull(),
		passwordHash: text('password_hash').notNull(),
		authEpoch: integer('auth_epoch').default(0).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex('accounts_active_login_uq')
			.on(table.login)
			.where(sql`${table.status} = 'active'`),
		uniqueIndex('accounts_one_active_teacher_uq')
			.on(table.role)
			.where(sql`${table.role} = 'teacher' and ${table.status} = 'active'`),
		check('accounts_role_ck', sql`${table.role} in ('teacher', 'student')`),
		check('accounts_status_ck', sql`${table.status} in ('active', 'deactivated')`),
		check('accounts_auth_epoch_ck', sql`${table.authEpoch} >= 0`),
		check(
			'accounts_login_normalized_ck',
			sql`${table.login} = lower(btrim(${table.login})) and char_length(${table.login}) between 3 and 254`
		),
		check('accounts_student_login_ck', sql`${table.role} <> 'student' or ${table.login} ~ '^[a-z0-9._-]{3,32}$'`),
		check('accounts_display_name_ck', sql`char_length(${table.displayName}) between 1 and 80`),
	]
)

export const sessions = pgTable(
	'sessions',
	{
		tokenHash: text('token_hash').primaryKey(),
		accountId: uuid('account_id')
			.notNull()
			.references(() => accounts.id, { onDelete: 'restrict' }),
		authEpoch: integer('auth_epoch').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	},
	(table) => [
		index('sessions_account_idx').on(table.accountId),
		check('sessions_token_hash_ck', sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`),
	]
)

export const signInThrottles = pgTable(
	'sign_in_throttles',
	{
		keyHash: text('key_hash').primaryKey(),
		failureCount: integer('failure_count').notNull(),
		windowStartedAt: timestamp('window_started_at', { withTimezone: true }).notNull(),
		lockedUntil: timestamp('locked_until', { withTimezone: true }),
	},
	(table) => [
		index('sign_in_throttles_window_idx').on(table.windowStartedAt),
		check('sign_in_throttles_key_hash_ck', sql`${table.keyHash} ~ '^[0-9a-f]{64}$'`),
		check('sign_in_throttles_failure_count_ck', sql`${table.failureCount} >= 0`),
	]
)
