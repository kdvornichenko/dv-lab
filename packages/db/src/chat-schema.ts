import { sql } from 'drizzle-orm'
import {
	type AnyPgColumn,
	bigint,
	check,
	date,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from 'drizzle-orm/pg-core'

import { accounts } from './schema.ts'

export const chatConversations = pgTable(
	'chat_conversations',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		accountId: uuid('account_id')
			.notNull()
			.references(() => accounts.id, { onDelete: 'restrict' }),
		title: text('title').notNull(),
		revision: integer('revision').notNull().default(1),
		modelOverride: text('model_override'),
		effortOverride: text('effort_override'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
	},
	(table) => [
		index('chat_conversations_account_updated_idx')
			.on(table.accountId, table.updatedAt.desc(), table.id)
			.where(sql`${table.deletedAt} is null`),
		check('chat_conversations_title_ck', sql`char_length(${table.title}) between 1 and 160`),
		check('chat_conversations_revision_ck', sql`${table.revision} >= 1`),
	]
)

export const chatMessages = pgTable(
	'chat_messages',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		accountId: uuid('account_id')
			.notNull()
			.references(() => accounts.id, { onDelete: 'restrict' }),
		conversationId: uuid('conversation_id')
			.notNull()
			.references(() => chatConversations.id, { onDelete: 'restrict' }),
		role: text('role').notNull(),
		body: text('body').notNull(),
		mentions: jsonb('mentions').$type<unknown>().notNull().default([]),
		blocks: jsonb('blocks').$type<unknown>().notNull().default([]),
		requestId: uuid('request_id'),
		requestDigest: text('request_digest'),
		replyTo: uuid('reply_to').references((): AnyPgColumn => chatMessages.id, { onDelete: 'restrict' }),
		createdAt: timestamp('created_at', { withTimezone: true })
			.default(sql`clock_timestamp()`)
			.notNull(),
		redactedAt: timestamp('redacted_at', { withTimezone: true }),
	},
	(table) => [
		uniqueIndex('chat_messages_account_request_uq').on(table.accountId, table.requestId),
		index('chat_messages_conversation_created_idx').on(table.conversationId, table.createdAt, table.id),
		index('chat_messages_reply_to_idx').on(table.replyTo),
		check('chat_messages_role_ck', sql`${table.role} in ('teacher', 'assistant')`),
		check(
			'chat_messages_body_ck',
			sql`(${table.role} = 'teacher' and char_length(${table.body}) between 1 and 20000) or (${table.role} = 'assistant' and char_length(${table.body}) <= 200000)`
		),
	]
)

export const chatActions = pgTable(
	'chat_actions',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		accountId: uuid('account_id')
			.notNull()
			.references(() => accounts.id, { onDelete: 'restrict' }),
		conversationId: uuid('conversation_id')
			.notNull()
			.references(() => chatConversations.id, { onDelete: 'restrict' }),
		messageId: uuid('message_id')
			.notNull()
			.references(() => chatMessages.id, { onDelete: 'restrict' }),
		kind: text('kind').notNull(),
		state: text('state').notNull(),
		target: jsonb('target').$type<unknown>(),
		before: jsonb('before').$type<unknown>(),
		after: jsonb('after').$type<unknown>(),
		result: jsonb('result').$type<unknown>().notNull(),
		calendarRequestId: uuid('calendar_request_id'),
		undoRequestId: uuid('undo_request_id'),
		undoCalendarRequestId: uuid('undo_calendar_request_id'),
		undoResult: jsonb('undo_result').$type<unknown>(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex('chat_actions_calendar_request_uq').on(table.calendarRequestId),
		uniqueIndex('chat_actions_undo_request_uq').on(table.undoRequestId),
		uniqueIndex('chat_actions_undo_calendar_request_uq').on(table.undoCalendarRequestId),
		index('chat_actions_conversation_idx').on(table.conversationId, table.createdAt),
		index('chat_actions_message_idx').on(table.messageId),
		check('chat_actions_kind_ck', sql`${table.kind} in ('mark', 'note', 'comment', 'calendar')`),
		check('chat_actions_state_ck', sql`${table.state} in ('proposed', 'submitted', 'applied', 'refused', 'undone')`),
	]
)

export const chatBudgetPeriods = pgTable(
	'chat_budget_periods',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		accountId: uuid('account_id')
			.notNull()
			.references(() => accounts.id, { onDelete: 'restrict' }),
		startsOn: date('starts_on', { mode: 'string' }).notNull(),
		endsBefore: date('ends_before', { mode: 'string' }).notNull(),
		timeZone: text('time_zone').notNull(),
		spentNano: bigint('spent_nano', { mode: 'bigint' }).notNull().default(0n),
		heldNano: bigint('held_nano', { mode: 'bigint' }).notNull().default(0n),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex('chat_budget_periods_account_starts_uq').on(table.accountId, table.startsOn),
		check('chat_budget_periods_spent_ck', sql`${table.spentNano} >= 0`),
		check('chat_budget_periods_held_ck', sql`${table.heldNano} >= 0`),
		check('chat_budget_periods_range_ck', sql`${table.endsBefore} > ${table.startsOn}`),
	]
)

export const chatUsageAttempts = pgTable(
	'chat_usage_attempts',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		accountId: uuid('account_id')
			.notNull()
			.references(() => accounts.id, { onDelete: 'restrict' }),
		conversationId: uuid('conversation_id')
			.notNull()
			.references(() => chatConversations.id, { onDelete: 'restrict' }),
		periodId: uuid('period_id')
			.notNull()
			.references(() => chatBudgetPeriods.id, { onDelete: 'restrict' }),
		model: text('model').notNull(),
		effort: text('effort').notNull(),
		pricing: jsonb('pricing').$type<unknown>().notNull(),
		maxInputTokens: integer('max_input_tokens').notNull(),
		maxOutputTokens: integer('max_output_tokens').notNull(),
		reservedNano: bigint('reserved_nano', { mode: 'bigint' }).notNull(),
		state: text('state').notNull(),
		usage: jsonb('usage').$type<unknown>(),
		costNano: bigint('cost_nano', { mode: 'bigint' }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index('chat_usage_attempts_conversation_idx').on(table.conversationId),
		index('chat_usage_attempts_period_idx').on(table.periodId, table.state),
		check(
			'chat_usage_attempts_state_ck',
			sql`${table.state} in ('reserved', 'dispatched', 'settled', 'unknown', 'released')`
		),
		check('chat_usage_attempts_reserved_ck', sql`${table.reservedNano} >= 0`),
		check('chat_usage_attempts_cost_ck', sql`${table.costNano} is null or ${table.costNano} >= 0`),
	]
)
