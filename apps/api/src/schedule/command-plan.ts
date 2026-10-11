import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { timeZoneIdentity, type ValidatedCalendarCommand } from '@dv-lab/contracts'
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

import { CommandFault, commandHash, digest, unresolvedCommands } from '../calendar/journal.ts'
import type { CalendarReadContext } from '../calendar/reads.ts'
import { lockTeacherTimeContext } from '../settings/settings.ts'
import { prepareSingleCommand, type SingleObservation } from './single-command.ts'

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
	operation: 'create' | 'move' | 'cancel' | 'restore'
	plan: GoogleCommandPlan
	request: Extract<GoogleStageRequest, { method: 'insert' | 'patch' }>
	dispatchDeadline: Date
	createdAt: Date
}

export async function commandWindow(executor: DbExecutor, accountId: string, expectedVersion: string) {
	if (!/^(0|[1-9]\d{0,18})$/.test(expectedVersion)) throw new CommandFault('precondition_failed')
	const [window] = await executor
		.select()
		.from(googleReadWindows)
		.where(
			and(
				eq(googleReadWindows.accountId, accountId),
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
	observed?: SingleObservation
): Promise<PreparedCalendarCommand> {
	if ((input.operation === 'move' || input.operation === 'cancel' || input.operation === 'restore') && observed)
		return prepareSingleCommand(executor, input, context, observed)
	return prepareCreateCommand(executor, input, context)
}

async function prepareCreateCommand(
	executor: DbExecutor,
	input: ValidatedCalendarCommand,
	context: CalendarReadContext
): Promise<PreparedCalendarCommand> {
	if (input.operation !== 'create' || input.input.repeats !== 'once') throw new CommandFault('history_only')
	const [connection] = await executor
		.select()
		.from(googleConnections)
		.where(eq(googleConnections.accountId, context.accountId))
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
	const timeZone = settings.context.defaultTimeZone
	const startsAt = localTimeCandidates(input.input.date, input.input.startTime, timeZone)[0]
	if (!startsAt) throw new CommandFault('nonexistent_local_time', 400)
	if (!canChange(startsAt, context.now)) throw new CommandFault('history_only')
	const [student] = await executor
		.select({ name: students.displayName, status: students.status })
		.from(students)
		.where(eq(students.id, input.input.studentId))
		.for('update')
	if (!student || student.status !== 'active') throw new CommandFault('invalid_request', 400)
	const window = await commandWindow(executor, context.accountId, input.input.expectedVersion)
	const endsAt = new Date(startsAt.getTime() + input.input.durationMinutes * 60000)
	if (
		startsAt < window.windowStart ||
		endsAt > window.windowEnd ||
		timeZoneIdentity(window.displayTimeZone) !== timeZoneIdentity(timeZone)
	)
		throw new CommandFault('precondition_failed')
	if (window.generation !== connection.generation || window.connectionId !== connection.id)
		throw new CommandFault('precondition_failed')
	const events = await executor.select().from(googleReadEvents).where(eq(googleReadEvents.windowId, window.id))
	const id = randomUUID()
	const localEntityId = randomUUID()
	const reservation = {
		entityKind: 'single' as const,
		localEntityId,
		representationGeneration: 0,
		eventId: `dv${digest(JSON.stringify([connection.id, connection.calendarId, 'single', localEntityId, 0]))}`,
	}
	const { requestId, expectedVersion, ...value } = input.input
	const plan = googleCommandPlan.parse({
		version: 1,
		input: { operation: 'create', ...value },
		capturedTimeZone: timeZone,
		capturedRule: null,
		reservations: [reservation],
		lineage: [],
		preconditions: events.map((event) => ({
			eventId: event.eventId,
			etag: event.etag,
			unownedWritableFingerprint: digest(event.etag),
		})),
		affectedRefs: [{ kind: 'single', lessonId: localEntityId }],
		oldEndsOn: null,
		newRule: null,
	})
	const payload = {
		summary: student.name,
		start: { dateTime: startsAt.toISOString(), timeZone },
		end: { dateTime: endsAt.toISOString(), timeZone },
		status: 'confirmed' as const,
	}
	const stageDigest = digest(JSON.stringify({ eventId: reservation.eventId, ...payload }))
	const request = googleStageRequest.parse({
		method: 'insert',
		eventId: reservation.eventId,
		digest: stageDigest,
		payload: {
			...payload,
			markers: {
				entityKind: 'single',
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
