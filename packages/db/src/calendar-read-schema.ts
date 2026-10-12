import { sql } from 'drizzle-orm'
import {
	bigint,
	boolean,
	check,
	foreignKey,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
} from 'drizzle-orm/pg-core'

import { googleCommands, googleConnections } from './calendar-schema.ts'
import type { GoogleEventTime, GoogleLocalRef } from './calendar-values.ts'
import { students } from './schema.ts'

export const googleReadWindows = pgTable(
	'google_read_windows',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		accountId: uuid('account_id').notNull(),
		connectionId: uuid('connection_id').notNull(),
		calendarId: text('calendar_id').notNull(),
		generation: bigint('generation', { mode: 'number' }).notNull(),
		snapshotRevision: bigint('snapshot_revision', { mode: 'bigint' }).notNull(),
		windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
		windowEnd: timestamp('window_end', { withTimezone: true }).notNull(),
		displayTimeZone: text('display_time_zone').notNull(),
		calendarTimeZone: text('calendar_time_zone').notNull(),
		fetchedAt: timestamp('fetched_at', { withTimezone: true }),
		coverageState: text('coverage_state', { enum: ['incomplete', 'complete'] })
			.notNull()
			.default('incomplete'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		foreignKey({
			name: 'google_read_windows_calendar_fk',
			columns: [t.accountId, t.connectionId, t.calendarId],
			foreignColumns: [googleConnections.accountId, googleConnections.id, googleConnections.calendarId],
		}).onDelete('restrict'),
		unique('google_read_windows_snapshot_uq').on(t.accountId, t.connectionId, t.id, t.generation, t.snapshotRevision),
		unique('google_read_windows_revision_uq').on(
			t.connectionId,
			t.windowStart,
			t.windowEnd,
			t.displayTimeZone,
			t.snapshotRevision
		),
		index('google_read_windows_complete_idx')
			.on(t.accountId, t.windowStart, t.windowEnd, t.snapshotRevision)
			.where(sql`${t.coverageState} = 'complete'`),
		check(
			'google_read_windows_generation_ck',
			sql`${t.generation} between 0 and 9007199254740991 and ${t.snapshotRevision} >= 0`
		),
		check('google_read_windows_range_ck', sql`${t.windowStart} < ${t.windowEnd}`),
		check(
			'google_read_windows_coverage_ck',
			sql`${t.coverageState} in ('incomplete', 'complete') and (${t.coverageState} = 'complete') = (${t.fetchedAt} is not null)`
		),
	]
)

export const googleReadEvents = pgTable(
	'google_read_events',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		accountId: uuid('account_id').notNull(),
		connectionId: uuid('connection_id').notNull(),
		windowId: uuid('window_id').notNull(),
		generation: bigint('generation', { mode: 'number' }).notNull(),
		snapshotRevision: bigint('snapshot_revision', { mode: 'bigint' }).notNull(),
		eventId: text('event_id').notNull(),
		etag: text('etag').notNull(),
		recurringEventId: text('recurring_event_id'),
		originalStartTime: jsonb('original_start_time').$type<GoogleEventTime>(),
		summary: text('summary'),
		start: jsonb('start').$type<GoogleEventTime>(),
		end: jsonb('end').$type<GoogleEventTime>(),
		status: text('status', { enum: ['confirmed', 'tentative', 'cancelled'] }).notNull(),
		transparency: text('transparency', { enum: ['opaque', 'transparent'] }).notNull(),
		eventType: text('event_type').notNull(),
		localRef: jsonb('local_ref').$type<GoogleLocalRef>(),
		studentId: uuid('student_id').references(() => students.id, { onDelete: 'restrict' }),
		representationGeneration: bigint('representation_generation', { mode: 'number' }),
		commandId: uuid('command_id'),
		bindingKind: text('binding_kind', { enum: ['lesson', 'transition', 'external'] }).notNull(),
	},
	(t) => [
		foreignKey({
			name: 'google_read_events_snapshot_fk',
			columns: [t.accountId, t.connectionId, t.windowId, t.generation, t.snapshotRevision],
			foreignColumns: [
				googleReadWindows.accountId,
				googleReadWindows.connectionId,
				googleReadWindows.id,
				googleReadWindows.generation,
				googleReadWindows.snapshotRevision,
			],
		}).onDelete('restrict'),
		foreignKey({
			name: 'google_read_events_command_fk',
			columns: [t.accountId, t.connectionId, t.commandId],
			foreignColumns: [googleCommands.accountId, googleCommands.connectionId, googleCommands.id],
		}).onDelete('restrict'),
		unique('google_read_events_window_event_uq').on(t.windowId, t.eventId),
		index('google_read_events_student_idx').on(t.accountId, t.studentId, t.snapshotRevision),
		check(
			'google_read_events_status_ck',
			sql`${t.status} in ('confirmed', 'tentative', 'cancelled') and ${t.transparency} in ('opaque', 'transparent')`
		),
		check(
			'google_read_events_time_ck',
			sql`(${t.start} is null) = (${t.end} is null) and (${t.status} = 'cancelled' or ${t.start} is not null) and (${t.recurringEventId} is null) = (${t.originalStartTime} is null)`
		),
		check(
			'google_read_events_binding_ck',
			sql`(${t.bindingKind} = 'external' and ${t.localRef} is null and ${t.studentId} is null and ${t.representationGeneration} is null and ${t.commandId} is null) or (${t.bindingKind} in ('lesson', 'transition') and ${t.localRef} is not null and ${t.studentId} is not null and ${t.representationGeneration} is not null and (${t.bindingKind} <> 'transition' or ${t.commandId} is not null))`
		),
		check(
			'google_read_events_representation_ck',
			sql`${t.representationGeneration} is null or ${t.representationGeneration} between 0 and 9007199254740991`
		),
	]
)

export const googleNextLessons = pgTable(
	'google_next_lessons',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		accountId: uuid('account_id').notNull(),
		connectionId: uuid('connection_id').notNull(),
		calendarId: text('calendar_id').notNull(),
		studentId: uuid('student_id')
			.notNull()
			.references(() => students.id, { onDelete: 'restrict' }),
		generation: bigint('generation', { mode: 'number' }).notNull(),
		revision: bigint('revision', { mode: 'bigint' }).notNull(),
		asOf: timestamp('as_of', { withTimezone: true }).notNull(),
		result: text('result', { enum: ['known', 'none', 'unknown'] }).notNull(),
		startsAt: timestamp('starts_at', { withTimezone: true }),
		checkedAt: timestamp('checked_at', { withTimezone: true }).notNull(),
		completePrefix: boolean('complete_prefix').notNull(),
		endOfList: boolean('end_of_list').notNull(),
	},
	(t) => [
		foreignKey({
			name: 'google_next_lessons_calendar_fk',
			columns: [t.accountId, t.connectionId, t.calendarId],
			foreignColumns: [googleConnections.accountId, googleConnections.id, googleConnections.calendarId],
		}).onDelete('restrict'),
		unique('google_next_lessons_snapshot_uq').on(t.accountId, t.studentId, t.generation, t.revision, t.asOf),
		index('google_next_lessons_student_idx').on(t.accountId, t.studentId, t.checkedAt),
		check(
			'google_next_lessons_generation_ck',
			sql`${t.generation} between 0 and 9007199254740991 and ${t.revision} >= 0`
		),
		check(
			'google_next_lessons_result_ck',
			sql`${t.result} in ('known', 'none', 'unknown') and (${t.result} = 'known') = (${t.startsAt} is not null) and (${t.startsAt} is null or ${t.startsAt} >= ${t.asOf})`
		),
		check(
			'google_next_lessons_proof_ck',
			sql`(${t.result} = 'unknown' or ${t.completePrefix}) and (${t.result} <> 'none' or ${t.endOfList}) and (not ${t.endOfList} or ${t.completePrefix})`
		),
	]
)
