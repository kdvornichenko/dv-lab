import { sql } from 'drizzle-orm'
import {
	bigint,
	boolean,
	check,
	date,
	foreignKey,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	smallint,
	text,
	timestamp,
	unique,
	uuid,
} from 'drizzle-orm/pg-core'

import { googleConnections } from './calendar-schema.ts'
import type { GoogleEventTime } from './calendar-values.ts'

export type GoogleSyncPaletteColor = { id: string; background: string; foreground: string }

export const googleCalendarEvents = pgTable(
	'google_calendar_events',
	{
		accountId: uuid('account_id').notNull(),
		connectionId: uuid('connection_id').notNull(),
		calendarId: text('calendar_id').notNull(),
		eventId: text('event_id').notNull(),
		eventKey: text('event_key').notNull(),
		rowKind: text('row_kind', { enum: ['single', 'instance', 'master'] }).notNull(),
		etag: text('etag').notNull(),
		recurringEventId: text('recurring_event_id'),
		originalStart: jsonb('original_start').$type<GoogleEventTime>(),
		status: text('status', { enum: ['confirmed', 'tentative', 'cancelled'] }).notNull(),
		eventType: text('event_type').notNull(),
		start: jsonb('start').$type<GoogleEventTime>(),
		end: jsonb('end').$type<GoogleEventTime>(),
		startsAt: timestamp('starts_at', { withTimezone: true }),
		endsAt: timestamp('ends_at', { withTimezone: true }),
		allDay: boolean('all_day').notNull().default(false),
		summary: text('summary'),
		description: text('description'),
		location: text('location'),
		colorId: text('color_id'),
		transparency: text('transparency', { enum: ['opaque', 'transparent'] }).notNull(),
		markerLocalId: uuid('marker_local_id'),
		markerKind: text('marker_kind'),
		recurrenceKind: text('recurrence_kind', { enum: ['weekly', 'other'] }),
		recurrenceWeekday: smallint('recurrence_weekday'),
		recurrenceFrequency: text('recurrence_frequency', { enum: ['daily', 'weekly', 'monthly', 'yearly', 'custom'] }),
		recurrenceInterval: integer('recurrence_interval'),
		recurrenceUntil: date('recurrence_until'),
		googleUpdatedAt: timestamp('google_updated_at', { withTimezone: true }),
		seenEpoch: bigint('seen_epoch', { mode: 'number' }).notNull().default(0),
		inboundAppliedEtag: text('inbound_applied_etag'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		primaryKey({ name: 'google_calendar_events_pk', columns: [t.connectionId, t.eventId] }),
		foreignKey({
			name: 'google_calendar_events_calendar_fk',
			columns: [t.accountId, t.connectionId, t.calendarId],
			foreignColumns: [googleConnections.accountId, googleConnections.id, googleConnections.calendarId],
		}).onDelete('restrict'),
		unique('google_calendar_events_key_uq').on(t.connectionId, t.eventKey),
		index('google_calendar_events_starts_idx').on(t.connectionId, t.startsAt),
		index('google_calendar_events_recurring_idx').on(t.connectionId, t.recurringEventId),
		index('google_calendar_events_marker_idx').on(t.connectionId, t.markerLocalId),
		check(
			'google_calendar_events_kind_ck',
			sql`${t.rowKind} in ('single', 'instance', 'master') and ${t.status} in ('confirmed', 'tentative', 'cancelled') and ${t.transparency} in ('opaque', 'transparent')`
		),
		check(
			'google_calendar_events_time_ck',
			sql`${t.status} = 'cancelled' or (${t.start} is not null and ${t.end} is not null and ${t.startsAt} is not null and ${t.endsAt} is not null)`
		),
		check(
			'google_calendar_events_range_ck',
			sql`${t.startsAt} is null or ${t.endsAt} is null or ${t.startsAt} < ${t.endsAt}`
		),
		check('google_calendar_events_identity_ck', sql`char_length(${t.eventId}) between 1 and 1024 and ${t.etag} <> ''`),
		check(
			'google_calendar_events_text_ck',
			sql`(${t.description} is null or char_length(${t.description}) <= 8192) and (${t.location} is null or char_length(${t.location}) <= 1024)`
		),
		check(
			'google_calendar_events_recurrence_ck',
			sql`(${t.rowKind} = 'master' or (${t.recurrenceKind} is null and ${t.recurrenceWeekday} is null and ${t.recurrenceFrequency} is null and ${t.recurrenceInterval} is null and ${t.recurrenceUntil} is null)) and (${t.recurrenceKind} is null or ${t.recurrenceKind} in ('weekly', 'other')) and (${t.recurrenceFrequency} is null or ${t.recurrenceFrequency} in ('daily', 'weekly', 'monthly', 'yearly', 'custom')) and (${t.recurrenceWeekday} is null or (${t.recurrenceKind} = 'weekly' and ${t.recurrenceWeekday} between 1 and 7)) and (${t.recurrenceInterval} is null or ${t.recurrenceInterval} > 0)`
		),
	]
)

export const googleSyncState = pgTable(
	'google_sync_state',
	{
		connectionId: uuid('connection_id').primaryKey(),
		accountId: uuid('account_id').notNull(),
		calendarId: text('calendar_id').notNull(),
		syncToken: text('sync_token'),
		epoch: bigint('epoch', { mode: 'number' }).notNull().default(0),
		windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
		windowEnd: timestamp('window_end', { withTimezone: true }).notNull(),
		revision: bigint('revision', { mode: 'bigint' }).notNull().default(0n),
		requestedSeq: bigint('requested_seq', { mode: 'number' }).notNull().default(0),
		processedSeq: bigint('processed_seq', { mode: 'number' }).notNull().default(0),
		claimedUntil: timestamp('claimed_until', { withTimezone: true }),
		nextPollAt: timestamp('next_poll_at', { withTimezone: true }).notNull(),
		nextFullAt: timestamp('next_full_at', { withTimezone: true }).notNull(),
		fullStartedAt: timestamp('full_started_at', { withTimezone: true }),
		lastIncrementalAt: timestamp('last_incremental_at', { withTimezone: true }),
		lastFullAt: timestamp('last_full_at', { withTimezone: true }),
		issue: text('issue', {
			enum: ['provider_unavailable', 'invalid_provider_data', 'reconnect_required', 'permission_required'],
		}),
		failureCount: integer('failure_count').notNull().default(0),
		skippedCount: integer('skipped_count').notNull().default(0),
		palette: jsonb('palette').$type<GoogleSyncPaletteColor[]>(),
		paletteFetchedAt: timestamp('palette_fetched_at', { withTimezone: true }),
		calendarColor: text('calendar_color'),
		channelId: uuid('channel_id'),
		channelResourceId: text('channel_resource_id'),
		channelTokenHash: text('channel_token_hash'),
		channelExpiresAt: timestamp('channel_expires_at', { withTimezone: true }),
		retiringChannelId: uuid('retiring_channel_id'),
		retiringResourceId: text('retiring_resource_id'),
		watchIssue: text('watch_issue', { enum: ['watch_failed', 'stop_failed'] }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		foreignKey({
			name: 'google_sync_state_calendar_fk',
			columns: [t.accountId, t.connectionId, t.calendarId],
			foreignColumns: [googleConnections.accountId, googleConnections.id, googleConnections.calendarId],
		}).onDelete('restrict'),
		check(
			'google_sync_state_counters_ck',
			sql`${t.processedSeq} <= ${t.requestedSeq} and ${t.processedSeq} >= 0 and ${t.revision} >= 0 and ${t.epoch} >= 0 and ${t.failureCount} >= 0 and ${t.skippedCount} >= 0`
		),
		check('google_sync_state_window_ck', sql`${t.windowStart} < ${t.windowEnd}`),
		check(
			'google_sync_state_channel_ck',
			sql`((${t.channelId} is null) = (${t.channelResourceId} is null) and (${t.channelId} is null) = (${t.channelTokenHash} is null) and (${t.channelId} is null) = (${t.channelExpiresAt} is null)) and (${t.retiringChannelId} is null) = (${t.retiringResourceId} is null) and (${t.channelTokenHash} is null or ${t.channelTokenHash} ~ '^[0-9a-f]{64}$')`
		),
		check(
			'google_sync_state_issue_ck',
			sql`(${t.issue} is null or ${t.issue} in ('provider_unavailable', 'invalid_provider_data', 'reconnect_required', 'permission_required')) and (${t.watchIssue} is null or ${t.watchIssue} in ('watch_failed', 'stop_failed'))`
		),
		check(
			'google_sync_state_color_ck',
			sql`(${t.calendarColor} is null or ${t.calendarColor} ~ '^#[0-9a-fA-F]{6}$') and (${t.palette} is null or jsonb_typeof(${t.palette}) = 'array')`
		),
	]
)

export const googleEventIgnores = pgTable(
	'google_event_ignores',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		accountId: uuid('account_id').notNull(),
		connectionId: uuid('connection_id').notNull(),
		calendarId: text('calendar_id').notNull(),
		eventId: text('event_id').notNull(),
		requestId: uuid('request_id').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		foreignKey({
			name: 'google_event_ignores_calendar_fk',
			columns: [t.accountId, t.connectionId, t.calendarId],
			foreignColumns: [googleConnections.accountId, googleConnections.id, googleConnections.calendarId],
		}).onDelete('restrict'),
		unique('google_event_ignores_event_uq').on(t.connectionId, t.eventId),
		unique('google_event_ignores_request_uq').on(t.accountId, t.requestId),
		check('google_event_ignores_event_ck', sql`char_length(${t.eventId}) between 1 and 1024`),
	]
)
