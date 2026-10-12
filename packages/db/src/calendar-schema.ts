import { sql } from 'drizzle-orm'
import {
	bigint,
	check,
	date,
	foreignKey,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	unique,
	uniqueIndex,
	uuid,
} from 'drizzle-orm/pg-core'

import type {
	GoogleCommandPlan,
	GoogleCredentialEnvelope,
	GoogleEventTime,
	GoogleStageAcknowledgement,
	GoogleStageAttempt,
	GoogleStageRequest,
} from './calendar-values.ts'
import { accounts, students } from './schema.ts'

export const googleConnections = pgTable(
	'google_connections',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		accountId: uuid('account_id')
			.notNull()
			.references(() => accounts.id, { onDelete: 'restrict' }),
		calendarId: text('calendar_id'),
		calendarLabel: text('calendar_label'),
		calendarTimeZone: text('calendar_time_zone'),
		historyCutoverAt: timestamp('history_cutover_at', { withTimezone: true }),
		generation: bigint('generation', { mode: 'number' }).notNull().default(0),
		credentialGeneration: bigint('credential_generation', { mode: 'number' }).notNull().default(0),
		state: text('state', {
			enum: [
				'not_connected',
				'connected',
				'reconnect_required',
				'permission_required',
				'disconnecting',
				'disconnect_failed',
			],
		})
			.notNull()
			.default('not_connected'),
		issue: text('issue'),
		disconnectResolution: text('disconnect_resolution', { enum: ['none', 'provider_confirmed', 'operator_confirmed'] })
			.notNull()
			.default('none'),
		encryptedRefreshToken: jsonb('encrypted_refresh_token').$type<GoogleCredentialEnvelope>(),
		credentialMode: text('credential_mode', { enum: ['active', 'revoke_only'] }),
		revokeAttemptId: uuid('revoke_attempt_id'),
		revokeStartedAt: timestamp('revoke_started_at', { withTimezone: true }),
		revokeFinishedAt: timestamp('revoke_finished_at', { withTimezone: true }),
		revokeAttemptCount: integer('revoke_attempt_count').notNull().default(0),
		snapshotRevision: bigint('snapshot_revision', { mode: 'bigint' }).notNull().default(0n),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		unique('google_connections_account_uq').on(t.accountId),
		unique('google_connections_owner_uq').on(t.accountId, t.id),
		unique('google_connections_calendar_uq').on(t.accountId, t.id, t.calendarId),
		check(
			'google_connections_generation_ck',
			sql`${t.generation} between 0 and 9007199254740991 and ${t.credentialGeneration} between 0 and 9007199254740991 and ${t.snapshotRevision} >= 0`
		),
		check(
			'google_connections_state_ck',
			sql`${t.state} in ('not_connected', 'connected', 'reconnect_required', 'permission_required', 'disconnecting', 'disconnect_failed')`
		),
		check(
			'google_connections_issue_ck',
			sql`${t.issue} is null or ${t.issue} in ('connection_required', 'reconnect_required', 'permission_required', 'provider_unavailable', 'command_pending', 'external_change', 'disconnect_failed', 'invalid_provider_data', 'history_only')`
		),
		check(
			'google_connections_target_ck',
			sql`(${t.calendarId} is null) = (${t.calendarLabel} is null) and (${t.calendarId} is null) = (${t.calendarTimeZone} is null) and (${t.calendarId} is null) = (${t.historyCutoverAt} is null)`
		),
		check(
			'google_connections_credentials_ck',
			sql`(${t.encryptedRefreshToken} is null) = (${t.credentialMode} is null) and (${t.credentialMode} is null or ${t.credentialMode} in ('active', 'revoke_only'))`
		),
		check(
			'google_connections_envelope_ck',
			sql`${t.encryptedRefreshToken} is null or (jsonb_typeof(${t.encryptedRefreshToken}) = 'object' and ${t.encryptedRefreshToken} ?& array['keyId', 'nonce', 'tag', 'ciphertext'])`
		),
		check(
			'google_connections_connected_ck',
			sql`${t.state} <> 'connected' or (${t.calendarId} is not null and ${t.credentialMode} = 'active' and ${t.encryptedRefreshToken} is not null)`
		),
		check(
			'google_connections_disconnected_ck',
			sql`${t.state} <> 'not_connected' or ${t.encryptedRefreshToken} is null`
		),
		check(
			'google_connections_revoking_ck',
			sql`${t.state} not in ('disconnecting', 'disconnect_failed') or (${t.credentialMode} = 'revoke_only' and ${t.encryptedRefreshToken} is not null)`
		),
		check(
			'google_connections_resolution_ck',
			sql`${t.disconnectResolution} in ('none', 'provider_confirmed', 'operator_confirmed') and (${t.disconnectResolution} = 'none' or (${t.state} = 'not_connected' and ${t.encryptedRefreshToken} is null and (${t.revokeAttemptId} is null or ${t.revokeFinishedAt} is not null)))`
		),
		check(
			'google_connections_revoke_ck',
			sql`${t.revokeAttemptCount} >= 0 and (${t.revokeAttemptId} is null) = (${t.revokeStartedAt} is null) and (${t.revokeFinishedAt} is null or (${t.revokeStartedAt} is not null and ${t.revokeFinishedAt} >= ${t.revokeStartedAt}))`
		),
	]
)

export const googleOAuthFlows = pgTable(
	'google_oauth_flows',
	{
		stateDigest: text('state_digest').primaryKey(),
		accountId: uuid('account_id').notNull(),
		connectionId: uuid('connection_id').notNull(),
		sessionTokenHash: text('session_token_hash').notNull(),
		sessionEpoch: integer('session_epoch').notNull(),
		generation: bigint('generation', { mode: 'number' }).notNull(),
		encryptedVerifier: jsonb('encrypted_verifier').$type<GoogleCredentialEnvelope>(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		consumedAt: timestamp('consumed_at', { withTimezone: true }),
	},
	(t) => [
		foreignKey({
			name: 'google_oauth_flows_owner_fk',
			columns: [t.accountId, t.connectionId],
			foreignColumns: [googleConnections.accountId, googleConnections.id],
		}).onDelete('restrict'),
		index('google_oauth_flows_owner_idx').on(t.accountId, t.expiresAt),
		check(
			'google_oauth_flows_digest_ck',
			sql`${t.stateDigest} ~ '^[0-9a-f]{64}$' and ${t.sessionTokenHash} ~ '^[0-9a-f]{64}$'`
		),
		check(
			'google_oauth_flows_generation_ck',
			sql`${t.generation} between 0 and 9007199254740991 and ${t.sessionEpoch} >= 0`
		),
		check(
			'google_oauth_flows_lifetime_ck',
			sql`${t.expiresAt} > ${t.createdAt} and (${t.consumedAt} is null or ${t.consumedAt} >= ${t.createdAt})`
		),
		check(
			'google_oauth_flows_verifier_ck',
			sql`(${t.consumedAt} is null) = (${t.encryptedVerifier} is not null) and (${t.encryptedVerifier} is null or (jsonb_typeof(${t.encryptedVerifier}) = 'object' and ${t.encryptedVerifier} ?& array['keyId', 'nonce', 'tag', 'ciphertext']))`
		),
	]
)

export const googleCommands = pgTable(
	'google_commands',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		accountId: uuid('account_id').notNull(),
		connectionId: uuid('connection_id').notNull(),
		calendarId: text('calendar_id').notNull(),
		requestId: uuid('request_id').notNull(),
		inputHash: text('input_hash').notNull(),
		expectedVersion: text('expected_version').notNull(),
		baseRevision: bigint('base_revision', { mode: 'bigint' }).notNull(),
		generation: bigint('generation', { mode: 'number' }).notNull(),
		operation: text('operation', {
			enum: ['create', 'move', 'cancel', 'restore', 'move_series', 'end_series'],
		}).notNull(),
		plan: jsonb('plan').$type<GoogleCommandPlan>().notNull(),
		state: text('state', {
			enum: [
				'pending',
				'dispatching',
				'outcome_unknown',
				'projection_pending',
				'applied',
				'failed',
				'partial_recovery',
				'recovery_required',
			],
		})
			.notNull()
			.default('pending'),
		effect: text('effect', { enum: ['none', 'unknown', 'partial', 'confirmed'] })
			.notNull()
			.default('none'),
		issue: text('issue'),
		confirmedRevision: bigint('confirmed_revision', { mode: 'bigint' }),
		nextAction: text('next_action', { enum: ['wait', 'refresh', 'retry_new_command', 'resume_recovery', 'none'] })
			.notNull()
			.default('wait'),
		dispatchDeadline: timestamp('dispatch_deadline', { withTimezone: true }).notNull(),
		dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
		acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
		appliedAt: timestamp('applied_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		foreignKey({
			name: 'google_commands_calendar_fk',
			columns: [t.accountId, t.connectionId, t.calendarId],
			foreignColumns: [googleConnections.accountId, googleConnections.id, googleConnections.calendarId],
		}).onDelete('restrict'),
		unique('google_commands_request_uq').on(t.accountId, t.requestId),
		unique('google_commands_owner_uq').on(t.accountId, t.connectionId, t.id),
		index('google_commands_unresolved_idx')
			.on(t.connectionId, t.createdAt)
			.where(sql`${t.state} not in ('applied', 'failed')`),
		check(
			'google_commands_identity_ck',
			sql`${t.inputHash} ~ '^[0-9a-f]{64}$' and char_length(${t.expectedVersion}) between 1 and 2048`
		),
		check(
			'google_commands_generation_ck',
			sql`${t.generation} between 0 and 9007199254740991 and ${t.baseRevision} >= 0 and (${t.confirmedRevision} is null or ${t.confirmedRevision} >= ${t.baseRevision})`
		),
		check(
			'google_commands_operation_ck',
			sql`${t.operation} in ('create', 'move', 'cancel', 'restore', 'move_series', 'end_series') and (jsonb_typeof(${t.plan}) = 'object' and ${t.plan}->>'version' = '1' and ${t.plan}->'input'->>'operation' = ${t.operation}) is true`
		),
		check(
			'google_commands_state_ck',
			sql`${t.state} in ('pending', 'dispatching', 'outcome_unknown', 'projection_pending', 'applied', 'failed', 'partial_recovery', 'recovery_required') and ${t.effect} in ('none', 'unknown', 'partial', 'confirmed')`
		),
		check(
			'google_commands_issue_ck',
			sql`${t.issue} is null or ${t.issue} in ('connection_required', 'reconnect_required', 'permission_required', 'provider_unavailable', 'command_pending', 'external_change', 'disconnect_failed', 'invalid_provider_data', 'history_only', 'precondition_failed', 'not_applied')`
		),
		check(
			'google_commands_action_ck',
			sql`${t.nextAction} in ('wait', 'refresh', 'retry_new_command', 'resume_recovery', 'none')`
		),
		check(
			'google_commands_applied_ck',
			sql`(${t.state} = 'applied') = (${t.appliedAt} is not null) and (${t.state} = 'applied') = (${t.confirmedRevision} is not null) and (${t.state} <> 'applied' or (${t.effect} = 'confirmed' and ${t.issue} is null and ${t.acknowledgedAt} is not null and ${t.nextAction} = 'none'))`
		),
		check(
			'google_commands_effect_ck',
			sql`(${t.state} not in ('pending', 'failed') or ${t.effect} = 'none') and (${t.state} <> 'projection_pending' or (${t.effect} = 'confirmed' and ${t.acknowledgedAt} is not null)) and (${t.state} <> 'outcome_unknown' or ${t.effect} in ('unknown', 'partial')) and (${t.state} <> 'partial_recovery' or ${t.effect} = 'partial')`
		),
		check(
			'google_commands_time_ck',
			sql`${t.dispatchDeadline} > ${t.createdAt} and (${t.dispatchedAt} is null or ${t.dispatchedAt} >= ${t.createdAt}) and (${t.acknowledgedAt} is null or (${t.dispatchedAt} is not null and ${t.acknowledgedAt} >= ${t.dispatchedAt})) and (${t.appliedAt} is null or ${t.appliedAt} >= ${t.acknowledgedAt})`
		),
	]
)

export const googleCommandStages = pgTable(
	'google_command_stages',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		accountId: uuid('account_id').notNull(),
		connectionId: uuid('connection_id').notNull(),
		commandId: uuid('command_id').notNull(),
		stage: integer('stage').notNull(),
		previousStage: integer('previous_stage'),
		generation: bigint('generation', { mode: 'number' }).notNull(),
		kind: text('kind', {
			enum: ['write', 'verify', 'trim', 'cancel_tail', 'detach', 'create_master', 'restore_prefix'],
		}).notNull(),
		request: jsonb('request').$type<GoogleStageRequest>().notNull(),
		state: text('state', { enum: ['pending', 'dispatching', 'outcome_unknown', 'acknowledged', 'failed'] })
			.notNull()
			.default('pending'),
		effect: text('effect', { enum: ['none', 'unknown', 'confirmed'] })
			.notNull()
			.default('none'),
		attempts: jsonb('attempts').$type<GoogleStageAttempt[]>().notNull().default([]),
		acknowledgement: jsonb('acknowledgement').$type<GoogleStageAcknowledgement>(),
		acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		foreignKey({
			name: 'google_command_stages_owner_fk',
			columns: [t.accountId, t.connectionId, t.commandId],
			foreignColumns: [googleCommands.accountId, googleCommands.connectionId, googleCommands.id],
		}).onDelete('restrict'),
		unique('google_command_stages_position_uq').on(t.commandId, t.stage),
		check(
			'google_command_stages_position_ck',
			sql`${t.stage} >= 0 and (${t.previousStage} is null or ${t.previousStage} between 0 and ${t.stage} - 1) and ${t.generation} between 0 and 9007199254740991`
		),
		check(
			'google_command_stages_kind_ck',
			sql`${t.kind} in ('write', 'verify', 'trim', 'cancel_tail', 'detach', 'create_master', 'restore_prefix')`
		),
		check(
			'google_command_stages_state_ck',
			sql`${t.state} in ('pending', 'dispatching', 'outcome_unknown', 'acknowledged', 'failed') and ${t.effect} in ('none', 'unknown', 'confirmed')`
		),
		check(
			'google_command_stages_ack_ck',
			sql`(${t.state} = 'acknowledged') = (${t.acknowledgement} is not null) and (${t.state} = 'acknowledged') = (${t.acknowledgedAt} is not null) and (${t.state} <> 'acknowledged' or ${t.effect} = 'confirmed')`
		),
		check(
			'google_command_stages_effect_ck',
			sql`(${t.state} not in ('pending', 'failed') or ${t.effect} = 'none') and (${t.state} <> 'outcome_unknown' or ${t.effect} = 'unknown')`
		),
		check(
			'google_command_stages_payload_ck',
			sql`jsonb_typeof(${t.request}) = 'object' and jsonb_typeof(${t.attempts}) = 'array' and (${t.acknowledgement} is null or jsonb_typeof(${t.acknowledgement}) = 'object')`
		),
	]
)

export const googleEventMappings = pgTable(
	'google_event_mappings',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		accountId: uuid('account_id').notNull(),
		connectionId: uuid('connection_id').notNull(),
		calendarId: text('calendar_id').notNull(),
		entityKind: text('entity_kind', { enum: ['single', 'series', 'occurrence'] }).notNull(),
		localEntityId: uuid('local_entity_id').notNull(),
		originalOn: date('original_on'),
		studentId: uuid('student_id')
			.notNull()
			.references(() => students.id, { onDelete: 'restrict' }),
		eventId: text('event_id').notNull(),
		recurringEventId: text('recurring_event_id'),
		originalStartTime: jsonb('original_start_time').$type<GoogleEventTime>(),
		representationGeneration: bigint('representation_generation', { mode: 'number' }).notNull(),
		commandId: uuid('command_id').notNull(),
		state: text('state', { enum: ['reserved', 'active', 'retired'] })
			.notNull()
			.default('reserved'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		retiredAt: timestamp('retired_at', { withTimezone: true }),
	},
	(t) => [
		foreignKey({
			name: 'google_event_mappings_calendar_fk',
			columns: [t.accountId, t.connectionId, t.calendarId],
			foreignColumns: [googleConnections.accountId, googleConnections.id, googleConnections.calendarId],
		}).onDelete('restrict'),
		foreignKey({
			name: 'google_event_mappings_command_fk',
			columns: [t.accountId, t.connectionId, t.commandId],
			foreignColumns: [googleCommands.accountId, googleCommands.connectionId, googleCommands.id],
		}).onDelete('restrict'),
		unique('google_event_mappings_generation_uq')
			.on(t.connectionId, t.entityKind, t.localEntityId, t.originalOn, t.representationGeneration)
			.nullsNotDistinct(),
		unique('google_event_mappings_provider_uq').on(t.connectionId, t.calendarId, t.eventId),
		uniqueIndex('google_event_mappings_active_entity_uq')
			.on(t.connectionId, t.entityKind, t.localEntityId)
			.where(sql`${t.originalOn} is null and ${t.state} in ('reserved', 'active')`),
		uniqueIndex('google_event_mappings_active_occurrence_uq')
			.on(t.connectionId, t.localEntityId, t.originalOn)
			.where(sql`${t.entityKind} = 'occurrence' and ${t.state} in ('reserved', 'active')`),
		check(
			'google_event_mappings_identity_ck',
			sql`${t.entityKind} in ('single', 'series', 'occurrence') and (${t.entityKind} = 'occurrence') = (${t.originalOn} is not null) and (${t.entityKind} = 'occurrence') = (${t.recurringEventId} is not null) and (${t.entityKind} = 'occurrence') = (${t.originalStartTime} is not null)`
		),
		check('google_event_mappings_generation_ck', sql`${t.representationGeneration} between 0 and 9007199254740991`),
		check(
			'google_event_mappings_state_ck',
			sql`${t.state} in ('reserved', 'active', 'retired') and (${t.state} = 'retired') = (${t.retiredAt} is not null) and (${t.retiredAt} is null or ${t.retiredAt} >= ${t.createdAt})`
		),
	]
)
