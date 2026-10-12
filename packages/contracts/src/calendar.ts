import { z } from 'zod'

import {
	CLOCK_TIME_PATTERN,
	REPEATS,
	createLessonRequest,
	endSeriesRequest,
	lessonActionRequest,
	moveLessonRequest,
	moveSeriesRequest,
	type ScheduleOccurrenceRef,
	type ScheduleSeries,
} from './schedule.ts'
import { isIsoDate, isTimeZone, LESSON_MINUTES_MIN } from './students.ts'

export const calendarIssue = z.enum([
	'connection_required',
	'reconnect_required',
	'permission_required',
	'provider_unavailable',
	'command_pending',
	'external_change',
	'disconnect_failed',
	'invalid_provider_data',
	'history_only',
	'outside_sync_window',
	'unsupported_recurrence',
	'read_only_event',
])

export type CalendarIssue = z.infer<typeof calendarIssue>

export const calendarDate = z.string().refine(isIsoDate)
export const calendarInstant = z.iso.datetime({ offset: true })
export const calendarTimeZone = z.string().refine(isTimeZone)
export const calendarVersion = z
	.string()
	.min(1)
	.max(2048)
	.regex(/^[\x21-\x7e]+$/)
export const calendarRevision = z
	.string()
	.regex(/^(0|[1-9]\d{0,18})$/)
	.pipe(z.string().refine((value) => BigInt(value) <= 9223372036854775807n))

const generation = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)

export const googleConnectionState = z.enum([
	'not_connected',
	'connected',
	'reconnect_required',
	'permission_required',
	'disconnecting',
	'disconnect_failed',
])
export const googleDisconnectResolution = z.enum(['none', 'provider_confirmed', 'operator_confirmed'])
export const googleConnectionAction = z.enum([
	'connect',
	'reconnect',
	'disconnect',
	'retry_disconnect',
	'confirm_revoked',
	'switch',
])

const connectionActions: Record<
	z.infer<typeof googleConnectionState>,
	readonly z.infer<typeof googleConnectionAction>[]
> = {
	not_connected: ['connect', 'switch'],
	connected: ['disconnect', 'switch'],
	reconnect_required: ['reconnect', 'disconnect', 'switch'],
	permission_required: ['reconnect', 'disconnect', 'switch'],
	disconnecting: [],
	disconnect_failed: ['retry_disconnect', 'confirm_revoked'],
}

export const googleConnectionSnapshot = z
	.strictObject({
		state: googleConnectionState,
		calendar: z.strictObject({ id: z.string().min(1), label: z.string(), timeZone: calendarTimeZone }).nullable(),
		generation,
		issue: calendarIssue.nullable(),
		pendingCommandCount: z.number().int().nonnegative(),
		disconnectResolution: googleDisconnectResolution,
		allowedActions: z.array(googleConnectionAction),
	})
	.refine((value) => value.state !== 'connected' || value.calendar !== null)
	.refine((value) => value.allowedActions.every((action) => connectionActions[value.state].includes(action)))
	.refine((value) => value.disconnectResolution === 'none' || value.state === 'not_connected')
	.refine((value) => value.calendar !== null || !value.allowedActions.includes('switch'))

export type GoogleConnectionSnapshot = z.infer<typeof googleConnectionSnapshot>

export const calendarReadStatus = z.discriminatedUnion('state', [
	z.strictObject({ state: z.literal('fresh'), fetchedAt: calendarInstant, revision: calendarRevision }),
	z.strictObject({
		state: z.literal('last_known'),
		fetchedAt: calendarInstant,
		revision: calendarRevision,
		reason: calendarIssue,
	}),
	z.strictObject({ state: z.literal('unavailable'), reason: calendarIssue }),
])

export type CalendarReadStatus = z.infer<typeof calendarReadStatus>

export const calendarOccurrenceRef = z.discriminatedUnion('kind', [
	z.strictObject({ kind: z.literal('single'), lessonId: z.uuid() }),
	z.strictObject({ kind: z.literal('series'), seriesId: z.uuid(), originalOn: calendarDate }),
]) satisfies z.ZodType<ScheduleOccurrenceRef>

const eventWhen = z.discriminatedUnion('kind', [
	z
		.strictObject({
			kind: z.literal('timed'),
			startsAt: calendarInstant,
			endsAt: calendarInstant,
			timeZone: calendarTimeZone,
		})
		.refine((value) => Date.parse(value.startsAt) < Date.parse(value.endsAt)),
	z
		.strictObject({
			kind: z.literal('all_day'),
			startsOn: calendarDate,
			endsBefore: calendarDate,
			timeZone: calendarTimeZone,
		})
		.refine((value) => value.startsOn < value.endsBefore),
])

export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/)

export const calendarEventColor = z.strictObject({
	id: z.string().nullable(),
	background: hexColor.nullable(),
	foreground: hexColor.nullable(),
	custom: z.boolean(),
})
export type CalendarEventColor = z.infer<typeof calendarEventColor>

export const calendarEventView = z.strictObject({
	eventKey: z.string().min(1),
	version: calendarVersion,
	title: z.string().nullable(),
	when: eventWhen,
	status: z.enum(['confirmed', 'tentative', 'cancelled']),
	blocksTime: z.boolean(),
	color: calendarEventColor,
	location: z.string().nullable(),
	seriesMember: z.boolean(),
	binding: z.discriminatedUnion('kind', [
		z.strictObject({
			kind: z.literal('lesson'),
			ref: calendarOccurrenceRef,
			studentId: z.uuid(),
			version: calendarVersion,
		}),
		z.strictObject({ kind: z.literal('transition'), commandId: z.uuid() }),
		z.strictObject({ kind: z.literal('external') }),
	]),
	editBlock: calendarIssue.nullable(),
})

export type CalendarEventView = z.infer<typeof calendarEventView>

export const calendarRange = z
	.strictObject({ start: calendarInstant, end: calendarInstant, timeZone: calendarTimeZone })
	.refine((value) => Date.parse(value.start) < Date.parse(value.end))

export type CalendarRange = z.infer<typeof calendarRange>

const scheduleSeries = z.strictObject({
	id: z.uuid(),
	studentId: z.uuid(),
	weekday: z.literal([1, 2, 3, 4, 5, 6, 7]),
	startTime: z.string().regex(CLOCK_TIME_PATTERN),
	timeZone: calendarTimeZone,
	durationMinutes: z.number().int().min(LESSON_MINUTES_MIN),
	startsOn: calendarDate,
	endsOn: calendarDate.nullable(),
	referenceOccurrence: z
		.strictObject({
			originalOn: calendarDate,
			actualStartsAt: calendarInstant,
			ruleStartsAt: calendarInstant.nullable(),
		})
		.nullable(),
}) satisfies z.ZodType<ScheduleSeries>

export type CalendarSeriesContext = { series: ScheduleSeries; version: string }
export const calendarSeriesContext = z.strictObject({
	series: scheduleSeries,
	version: calendarVersion,
}) satisfies z.ZodType<CalendarSeriesContext>

export const calendarWriteStatus = z.discriminatedUnion('state', [
	z.strictObject({ state: z.literal('ready') }),
	z.strictObject({ state: z.literal('blocked'), reason: calendarIssue }),
])

export const googleScheduleWindow = z
	.strictObject({
		requestedRange: calendarRange,
		snapshotRange: calendarRange.nullable(),
		connection: googleConnectionSnapshot,
		read: calendarReadStatus,
		events: z.array(calendarEventView),
		series: z.array(calendarSeriesContext),
		write: calendarWriteStatus,
	})
	.refine(
		(value) => value.write.state !== 'ready' || (value.read.state === 'fresh' && value.connection.state === 'connected')
	)
	.refine((value) =>
		value.read.state === 'unavailable'
			? value.snapshotRange === null && value.events.length === 0 && value.series.length === 0
			: value.snapshotRange !== null
	)

export type GoogleScheduleWindow = z.infer<typeof googleScheduleWindow>

export const nextLessonRead = z
	.discriminatedUnion('result', [
		z.strictObject({ status: calendarReadStatus, result: z.literal('known'), startsAt: calendarInstant }),
		z.strictObject({ status: calendarReadStatus, result: z.literal('none'), startsAt: z.null() }),
		z.strictObject({ status: calendarReadStatus, result: z.literal('unknown'), startsAt: z.null() }),
	])
	.refine((value) => value.status.state !== 'unavailable' || value.result === 'unknown')

export type NextLessonRead = z.infer<typeof nextLessonRead>

export const calendarCommandOperation = z.enum([
	'create',
	'move',
	'cancel',
	'restore',
	'move_series',
	'end_series',
	'event_create',
	'event_update',
	'event_delete',
	'assign',
])
export const calendarCommandEffect = z.enum(['none', 'unknown', 'partial', 'confirmed'])
export const calendarCommandState = z.enum([
	'pending',
	'dispatching',
	'outcome_unknown',
	'projection_pending',
	'applied',
	'failed',
	'partial_recovery',
	'recovery_required',
])
export const calendarCommandIssue = z.union([calendarIssue, z.enum(['precondition_failed', 'not_applied'])])
export const calendarCommandNextAction = z.enum(['wait', 'refresh', 'retry_new_command', 'resume_recovery', 'none'])

export const calendarCommandReceipt = z
	.strictObject({
		commandId: z.uuid(),
		statusUrl: z.string().regex(/^\/api\/google\/commands\/[0-9a-f-]+$/),
	})
	.refine((value) => value.statusUrl === `/api/google/commands/${value.commandId}`)

export type CalendarCommandReceipt = z.infer<typeof calendarCommandReceipt>

export const calendarCommandSnapshot = z
	.strictObject({
		commandId: z.uuid(),
		requestId: z.uuid(),
		generation,
		expectedVersion: calendarVersion,
		operation: calendarCommandOperation,
		effect: calendarCommandEffect,
		state: calendarCommandState,
		issue: calendarCommandIssue.nullable(),
		confirmedRevision: calendarRevision.nullable(),
		affectedRefs: z.array(calendarOccurrenceRef),
		nextAction: calendarCommandNextAction,
	})
	.refine((value) => (value.state === 'applied') === (value.confirmedRevision !== null))
	.refine(
		(value) =>
			value.state !== 'applied' || (value.effect === 'confirmed' && value.issue === null && value.nextAction === 'none')
	)
	.refine((value) => value.state !== 'projection_pending' || value.effect === 'confirmed')
	.refine((value) => value.state !== 'failed' || value.effect === 'none')

export type CalendarCommandSnapshot = z.infer<typeof calendarCommandSnapshot>

export const calendarCommandMeta = z.strictObject({ requestId: z.uuid(), expectedVersion: calendarVersion })
export type CalendarCommandMeta = z.infer<typeof calendarCommandMeta>

export const createCalendarLessonRequest = createLessonRequest.extend(calendarCommandMeta.shape).strict()
export const moveCalendarLessonRequest = moveLessonRequest.extend(calendarCommandMeta.shape).strict()
export const calendarLessonActionRequest = lessonActionRequest.extend(calendarCommandMeta.shape).strict()
export const moveCalendarSeriesRequest = moveSeriesRequest.extend(calendarCommandMeta.shape).strict()
export const endCalendarSeriesRequest = endSeriesRequest.extend(calendarCommandMeta.shape).strict()

const eventKey = z.string().min(1).max(1024)
const eventColorId = z.string().min(1).max(64)
const eventClock = z.string().regex(CLOCK_TIME_PATTERN)
const eventMinutes = z.number().int().min(LESSON_MINUTES_MIN)
const eventTitle = z.string().trim().min(1).max(1024)
const eventDescription = z.string().max(8192)
const eventLocation = z.string().max(1024)

export const calendarEditScope = z.enum(['one', 'following', 'all'])
export type CalendarEditScope = z.infer<typeof calendarEditScope>

export const createCalendarEventRequest = z.strictObject({
	requestId: z.uuid(),
	title: eventTitle,
	date: calendarDate,
	startTime: eventClock,
	durationMinutes: eventMinutes,
	repeats: z.enum(REPEATS),
	colorId: eventColorId.nullable(),
	description: eventDescription.nullable(),
	location: eventLocation.nullable(),
	expectedDefaultTimeZone: calendarTimeZone,
})
export type CreateCalendarEventRequest = z.infer<typeof createCalendarEventRequest>

export const createCalendarEventCommand = createCalendarEventRequest.extend(calendarCommandMeta.shape).strict()

export const updateCalendarEventRequest = z.strictObject({
	requestId: z.uuid(),
	expectedVersion: calendarVersion,
	scope: calendarEditScope,
	changes: z
		.strictObject({
			title: eventTitle.optional(),
			date: calendarDate.optional(),
			startTime: eventClock.optional(),
			durationMinutes: eventMinutes.optional(),
			repeats: z.enum(REPEATS).optional(),
			colorId: eventColorId.nullable().optional(),
			description: eventDescription.nullable().optional(),
			location: eventLocation.nullable().optional(),
		})
		.refine((changes) => Object.values(changes).some((value) => value !== undefined)),
})
export type UpdateCalendarEventRequest = z.infer<typeof updateCalendarEventRequest>

export const deleteCalendarEventRequest = z.strictObject({
	requestId: z.uuid(),
	expectedVersion: calendarVersion,
	scope: calendarEditScope,
})
export type DeleteCalendarEventRequest = z.infer<typeof deleteCalendarEventRequest>

export const validatedCalendarCommand = z.discriminatedUnion('operation', [
	z.strictObject({ operation: z.literal('create'), input: createCalendarLessonRequest }),
	z.strictObject({ operation: z.literal('move'), ref: calendarOccurrenceRef, input: moveCalendarLessonRequest }),
	z.strictObject({ operation: z.literal('cancel'), ref: calendarOccurrenceRef, input: calendarLessonActionRequest }),
	z.strictObject({ operation: z.literal('restore'), ref: calendarOccurrenceRef, input: calendarLessonActionRequest }),
	z.strictObject({ operation: z.literal('move_series'), seriesId: z.uuid(), input: moveCalendarSeriesRequest }),
	z.strictObject({ operation: z.literal('end_series'), seriesId: z.uuid(), input: endCalendarSeriesRequest }),
	z.strictObject({ operation: z.literal('event_create'), input: createCalendarEventCommand }),
	z.strictObject({ operation: z.literal('event_update'), eventKey, input: updateCalendarEventRequest }),
	z.strictObject({ operation: z.literal('event_delete'), eventKey, input: deleteCalendarEventRequest }),
])

export type ValidatedCalendarCommand = z.infer<typeof validatedCalendarCommand>

export const googleConflictEvent = calendarEventView.extend({ matchedStartsAt: z.array(calendarInstant).min(1) })
export type GoogleConflictEvent = z.infer<typeof googleConflictEvent>

export const googleConflictResult = z.discriminatedUnion('state', [
	z.strictObject({ state: z.literal('not_checked'), inputKey: z.string().min(1) }),
	z.strictObject({
		state: z.literal('complete'),
		complete: z.literal(true),
		inputKey: z.string().min(1),
		checkedRange: calendarRange,
		checkedAt: calendarInstant,
		events: z.array(googleConflictEvent),
	}),
	z.strictObject({ state: z.literal('unavailable'), inputKey: z.string().min(1), reason: calendarIssue }),
])

export type GoogleConflictResult = z.infer<typeof googleConflictResult>

export const googleConflictRequest = z.strictObject({
	proposal: z.discriminatedUnion('operation', [
		z.strictObject({ operation: z.literal('create'), input: createLessonRequest.strict() }),
		z.strictObject({ operation: z.literal('move'), input: moveLessonRequest.strict() }),
		z.strictObject({ operation: z.literal('move_series'), input: moveSeriesRequest.strict() }),
	]),
	editedRef: calendarOccurrenceRef.optional(),
	expectedVersion: calendarVersion,
	checkThrough: calendarDate.optional(),
})

export const googleCommandByRequestParams = z.strictObject({ requestId: z.uuid() })
export const googleCommandParams = z.strictObject({ commandId: z.uuid() })
export const googleUnresolvedCommandsQuery = z.strictObject({ state: z.literal('unresolved') })
export const googleUnresolvedCommandsResponse = z.strictObject({ commands: z.array(calendarCommandSnapshot) })
export const googleResumeCommandRequest = z.strictObject({})
export const googleConnectRequest = z.strictObject({})
export const googleDisconnectRequest = z.strictObject({})
export const googleConfirmRevokedRequest = z.strictObject({ confirmed: z.literal(true) })

const oauthState = z
	.string()
	.min(32)
	.max(512)
	.regex(/^[A-Za-z0-9_-]+$/)
export const googleCallbackQuery = z.union([
	z.object({ state: oauthState, code: z.string().min(1).max(4096), error: z.never().optional() }),
	z.object({
		state: oauthState,
		error: z
			.string()
			.min(1)
			.max(128)
			.regex(/^[a-z_]+$/),
		code: z.never().optional(),
	}),
])
