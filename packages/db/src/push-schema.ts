import { sql } from 'drizzle-orm'
import { boolean, check, index, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

import { accounts, students } from './schema.ts'

export const pushSubscriptions = pgTable(
	'push_subscriptions',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		accountId: uuid('account_id')
			.notNull()
			.references(() => accounts.id, { onDelete: 'restrict' }),
		endpoint: text('endpoint').notNull(),
		p256dh: text('p256dh').notNull(),
		auth: text('auth').notNull(),
		deviceLabel: text('device_label'),
		secondTimeZone: text('second_time_zone'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
		lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
		failedAt: timestamp('failed_at', { withTimezone: true }),
		revokedAt: timestamp('revoked_at', { withTimezone: true }),
	},
	(table) => [
		uniqueIndex('push_subscriptions_endpoint_uq').on(table.endpoint),
		index('push_subscriptions_account_idx').on(table.accountId),
		check(
			'push_subscriptions_endpoint_ck',
			sql`char_length(${table.endpoint}) between 12 and 2048 and ${table.endpoint} like 'https://%'`
		),
		check('push_subscriptions_p256dh_ck', sql`char_length(${table.p256dh}) between 1 and 200`),
		check('push_subscriptions_auth_ck', sql`char_length(${table.auth}) between 1 and 100`),
		check(
			'push_subscriptions_device_label_ck',
			sql`${table.deviceLabel} is null or char_length(${table.deviceLabel}) between 1 and 120`
		),
		check(
			'push_subscriptions_second_time_zone_ck',
			sql`${table.secondTimeZone} is null or char_length(${table.secondTimeZone}) between 1 and 64`
		),
	]
)

export const pushDeliveries = pgTable(
	'push_deliveries',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		accountId: uuid('account_id')
			.notNull()
			.references(() => accounts.id, { onDelete: 'restrict' }),
		kind: text('kind').notNull(),
		key: text('key').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex('push_deliveries_key_uq').on(table.accountId, table.kind, table.key),
		check('push_deliveries_kind_ck', sql`${table.kind} in ('lesson_soon', 'pays_soon')`),
		check('push_deliveries_key_ck', sql`char_length(${table.key}) between 1 and 300`),
	]
)

export const pushPaymentAlerts = pgTable(
	'push_payment_alerts',
	{
		accountId: uuid('account_id')
			.notNull()
			.references(() => accounts.id, { onDelete: 'restrict' }),
		studentId: uuid('student_id')
			.notNull()
			.references(() => students.id, { onDelete: 'restrict' }),
		armed: boolean('armed').notNull(),
		lastState: text('last_state').notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		primaryKey({ name: 'push_payment_alerts_pk', columns: [table.accountId, table.studentId] }),
		check(
			'push_payment_alerts_last_state_ck',
			sql`${table.lastState} in ('plenty', 'pays_soon', 'none_left', 'owes', 'not_set')`
		),
	]
)
