import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { timeZoneIdentity, type CalendarIssue, type ValidatedCalendarCommand } from '@dv-lab/contracts'
import { canChange, localTimeCandidates } from '@dv-lab/core'
import {
	googleCommandPlan,
	googleConnections,
	googleReadEvents,
	googleReadWindows,
	googleStageRequest,
	students,
	type DbExecutor,
	type GoogleCommandPlan,
	type GoogleStageRequest,
} from '@dv-lab/db'

import { currentConnection } from '../calendar/google-access.ts'
import type { InstanceEvidence } from '../calendar/instance-observation.ts'
import { CommandFault, commandHash, digest, unresolvedCommands } from '../calendar/journal.ts'
import type { CalendarReadContext } from '../calendar/read-state.ts'
import type { SeriesEvidence } from '../calendar/series-observation.ts'
import type { AbsenceProof, SingleEvidence } from '../calendar/single-observation.ts'
import { lockTeacherTimeContext } from '../settings/settings.ts'
import { prepareOccurrenceCommand } from './occurrence-command.ts'
import { recurringCreation } from './recurring-command.ts'
import { prepareSeriesCommand } from './series-command.ts'
import { prepareSingleCommand } from './single-command.ts'

export type PreparedCalendarCommand = {
	id: string
	accountId: string
	connectionId: string
	calendarId: string
	requestId: string
	inputHash: string
	expectedVersion: string
	baseRevision: bigint
	generation: number
	operation: ValidatedCalendarCommand['operation']
	plan: GoogleCommandPlan
	request: Extract<GoogleStageRequest, { method: 'insert' | 'patch' }>
	dispatchDeadline: Date
	createdAt: Date
	absenceProof?: AbsenceProof
	recoveryRequired?: boolean
	recoveryIssue?: CalendarIssue
}

export async function commandWindow(
	executor: DbExecutor,
	accountId: string,
	connectionId: string,
	expectedVersion: string
) {
	if (!/^(0|[1-9]\d{0,18})$/.test(expectedVersion)) throw new CommandFault('precondition_failed')
	const [window] = await executor
		.select()
		.from(googleReadWindows)
		.where(
			and(
				eq(googleReadWindows.accountId, accountId),
				eq(googleReadWindows.connectionId, connectionId),
				eq(googleReadWindows.snapshotRevision, BigInt(expectedVersion)),
				eq(googleReadWindows.coverageState, 'complete')
			)
		)
	if (!window) throw new CommandFault('precondition_failed')
	return window
}

export async function prepareScheduleCommand(
	executor: DbExecutor,
	input: ValidatedCalendarCommand,
	context: CalendarReadContext,
	observed?: SingleEvidence | InstanceEvidence | SeriesEvidence
): Promise<PreparedCalendarCommand> {
	if ((input.operation === 'move_series' || input.operation === 'end_series') && observed?.kind === 'series')
		return prepareSeriesCommand(executor, input, context, observed)
	if (
		(input.operation === 'move' || input.operation === 'cancel' || input.operation === 'restore') &&
		observed?.kind === 'instance'
	)
		return prepareOccurrenceCommand(executor, input, context, observed)
	if (
		(input.operation === 'move' || input.operation === 'cancel' || input.operation === 'restore') &&
		observed &&
		observed.kind !== 'instance' &&
		observed.kind !== 'series'
	)
		return prepareSingleCommand(executor, input, context, observed)
	return prepareCreateCommand(executor, input, context)
}

async function prepareCreateCommand(
	executor: DbExecutor,
	input: ValidatedCalendarCommand,
	context: CalendarReadContext
): Promise<PreparedCalendarCommand> {
	if (input.operation !== 'create') throw new CommandFault('history_only')
	const { connection, timeZone } = await lockCreationContext(executor, input, context)
	const startsAt = localTimeCandidates(input.input.date, input.input.startTime, timeZone)[0]
	if (!startsAt) throw new CommandFault('nonexistent_local_time', 400)
	if (!canChange(startsAt, context.now)) throw new CommandFault('history_only')
	const [student] = await executor
		.select({ name: students.displayName, status: students.status })
		.from(students)
		.where(eq(students.id, input.input.studentId))
		.for('update')
	if (!student || student.status !== 'active') throw new CommandFault('invalid_request', 400)
	const window = await commandWindow(executor, context.accountId, connection.id, input.input.expectedVersion)
	const endsAt = new Date(startsAt.getTime() + input.input.durationMinutes * 60000)
	validateCreationWindow(connection, window, startsAt, endsAt, timeZone)
	const events = await executor.select().from(googleReadEvents).where(eq(googleReadEvents.windowId, window.id))
	const recurring =
		input.input.repeats === 'weekly' ? await recurringCreation(executor, input, timeZone, connection) : null
	return buildCreation(input, context, connection, timeZone, startsAt, endsAt, student.name, events, recurring)
}

async function lockCreationContext(
	executor: DbExecutor,
	input: Extract<ValidatedCalendarCommand, { operation: 'create' }>,
	context: CalendarReadContext
) {
	const [connection] = await executor
		.select()
		.from(googleConnections)
		.where(currentConnection(context.accountId))
		.for('update')
	if (!connection?.calendarId || connection.state !== 'connected') throw new CommandFault('connection_required')
	if (connection.snapshotRevision.toString() !== input.input.expectedVersion)
		throw new CommandFault('precondition_failed')
	if ((await unresolvedCommands(executor, context.accountId)).length) throw new CommandFault('command_pending')
	const settings = await lockTeacherTimeContext(
		executor,
		context.accountId,
		input.input.expectedDefaultTimeZone,
		context.now
	)
	if (!settings.ok) throw new CommandFault(settings.error)
	return {
		connection: { ...connection, calendarId: connection.calendarId },
		timeZone: settings.context.defaultTimeZone,
	}
}

function validateCreationWindow(
	connection: typeof googleConnections.$inferSelect,
	window: typeof googleReadWindows.$inferSelect,
	startsAt: Date,
	endsAt: Date,
	timeZone: string
) {
	if (
		startsAt < window.windowStart ||
		endsAt > window.windowEnd ||
		timeZoneIdentity(window.displayTimeZone) !== timeZoneIdentity(timeZone)
	)
		throw new CommandFault('precondition_failed')
	if (window.generation !== connection.generation || window.connectionId !== connection.id)
		throw new CommandFault('precondition_failed')
}

function buildCreation(
	input: Extract<ValidatedCalendarCommand, { operation: 'create' }>,
	context: CalendarReadContext,
	connection: Awaited<ReturnType<typeof lockCreationContext>>['connection'],
	timeZone: string,
	startsAt: Date,
	endsAt: Date,
	studentName: string,
	events: (typeof googleReadEvents.$inferSelect)[],
	recurring: Awaited<ReturnType<typeof recurringCreation>> | null
): PreparedCalendarCommand {
	const id = randomUUID()
	const localEntityId = randomUUID()
	const reservation = {
		entityKind: recurring ? ('series' as const) : ('single' as const),
		localEntityId,
		representationGeneration: 0,
		eventId: `dv${digest(JSON.stringify([connection.id, connection.calendarId, recurring ? 'series' : 'single', localEntityId, 0]))}`,
	}
	const { requestId, expectedVersion, ...value } = input.input
	const plan = googleCommandPlan.parse({
		version: 1,
		input: { operation: 'create', ...value },
		capturedTimeZone: timeZone,
		capturedRule: recurring?.rule ?? null,
		reservations: [reservation],
		lineage: [],
		preconditions: events.map((event) => ({
			eventId: event.eventId,
			etag: event.etag,
			unownedWritableFingerprint: digest(event.etag),
		})),
		affectedRefs: [
			recurring
				? { kind: 'series', seriesId: localEntityId, originalOn: recurring.rule.startsOn }
				: { kind: 'single', lessonId: localEntityId },
		],
		oldEndsOn: null,
		newRule: null,
	})
	const payload = {
		summary: studentName,
		start: { dateTime: startsAt.toISOString(), timeZone },
		end: { dateTime: endsAt.toISOString(), timeZone },
		status: 'confirmed' as const,
		...(recurring
			? { start: recurring.master.start, end: recurring.master.end, recurrence: recurring.master.recurrence }
			: {}),
	}
	const stageDigest = digest(JSON.stringify({ eventId: reservation.eventId, ...payload }))
	const request = googleStageRequest.parse({
		method: 'insert',
		eventId: reservation.eventId,
		digest: stageDigest,
		payload: {
			...payload,
			markers: {
				entityKind: reservation.entityKind,
				localEntityId,
				representationGeneration: 0,
				commandId: id,
				stage: 0,
				digest: stageDigest,
				schemaVersion: 1,
			},
		},
	})
	if (request.method !== 'insert') throw new CommandFault('invalid_request', 400)
	return {
		id,
		accountId: context.accountId,
		connectionId: connection.id,
		calendarId: connection.calendarId,
		requestId,
		expectedVersion,
		inputHash: commandHash(input),
		baseRevision: connection.snapshotRevision,
		generation: connection.generation,
		operation: 'create',
		plan,
		request,
		createdAt: context.now,
		dispatchDeadline: new Date(context.now.getTime() + 30000),
	}
}
