import { and, desc, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import type { ValidatedCalendarCommand } from '@dv-lab/contracts'
import { canChange } from '@dv-lab/core'
import {
	googleCommandPlan,
	googleConnections,
	googleEventMappings,
	googleReadEvents,
	googleReadWindows,
	googleStageRequest,
	students,
	type DbExecutor,
} from '@dv-lab/db'

import { cancelledSingles } from '../calendar/cancelled-singles.ts'
import { replacementCommand } from '../calendar/event-mapping.ts'
import type { GoogleGateway } from '../calendar/gateway.ts'
import { CommandFault, commandHash, digest, unresolvedCommands } from '../calendar/journal.ts'
import { eventVersion, type CalendarReadContext } from '../calendar/read-state.ts'
import type { SingleEvidence } from '../calendar/single-observation.ts'
import { prepareLessonChange } from './changes.ts'
import type { PreparedCalendarCommand } from './command-plan.ts'

export type SingleCommand = Extract<ValidatedCalendarCommand, { operation: 'move' | 'cancel' | 'restore' }>
export type SingleObservation = Awaited<ReturnType<GoogleGateway['observeEvent']>>

export async function singleTarget(executor: DbExecutor, accountId: string, input: SingleCommand) {
	if (input.ref.kind !== 'single') throw new CommandFault('history_only')
	const [mapping] = await executor
		.select()
		.from(googleEventMappings)
		.where(
			and(
				eq(googleEventMappings.accountId, accountId),
				eq(googleEventMappings.entityKind, 'single'),
				eq(googleEventMappings.localEntityId, input.ref.lessonId),
				eq(googleEventMappings.state, 'active')
			)
		)
	if (!mapping) throw new CommandFault('history_only')
	const rows = await executor
		.select()
		.from(googleReadEvents)
		.where(
			and(
				eq(googleReadEvents.accountId, accountId),
				eq(googleReadEvents.connectionId, mapping.connectionId),
				eq(googleReadEvents.eventId, mapping.eventId)
			)
		)
		.orderBy(desc(googleReadEvents.snapshotRevision))
	let event = rows.find((row) => eventVersion(row) === input.input.expectedVersion)
	if (!event && input.operation === 'restore') {
		const windows = await executor
			.select()
			.from(googleReadWindows)
			.where(
				and(
					eq(googleReadWindows.accountId, accountId),
					eq(googleReadWindows.connectionId, mapping.connectionId),
					eq(googleReadWindows.coverageState, 'complete')
				)
			)
			.orderBy(desc(googleReadWindows.snapshotRevision))
			.limit(1)
		if (windows[0])
			event = (await cancelledSingles(executor, windows[0])).find(
				(row) => row.eventId === mapping.eventId && eventVersion(row) === input.input.expectedVersion
			)
	}
	if (!event || event.bindingKind !== 'lesson') throw new CommandFault('precondition_failed')
	const [window] = await executor.select().from(googleReadWindows).where(eq(googleReadWindows.id, event.windowId))
	if (!window || window.coverageState !== 'complete') throw new CommandFault('precondition_failed')
	return { mapping, event, window }
}

export async function prepareSingleCommand(
	executor: DbExecutor,
	input: SingleCommand,
	context: CalendarReadContext,
	evidence: SingleEvidence
): Promise<PreparedCalendarCommand> {
	const [connection] = await executor
		.select()
		.from(googleConnections)
		.where(eq(googleConnections.accountId, context.accountId))
		.for('update')
	if (!connection?.calendarId || connection.state !== 'connected') throw new CommandFault('connection_required')
	if ((await unresolvedCommands(executor, context.accountId)).length) throw new CommandFault('command_pending')
	const target = await singleTarget(executor, context.accountId, input)
	if (
		target.event.snapshotRevision !== connection.snapshotRevision ||
		target.event.generation !== connection.generation
	)
		throw new CommandFault('precondition_failed')
	validateEvidence(evidence, target, input)
	if (
		target.event.start &&
		'dateTime' in target.event.start &&
		!canChange(new Date(target.event.start.dateTime), context.now)
	)
		throw new CommandFault('history_only')
	if (input.ref.kind !== 'single') throw new CommandFault('history_only')
	const change = await prepareLessonChange(
		executor,
		context.accountId,
		input.ref.lessonId,
		input.operation,
		input.input,
		context.now
	)
	if (change.kind !== 'ok') changeRefusal(change)
	const [student] = await executor
		.select({ name: students.displayName, status: students.status })
		.from(students)
		.where(eq(students.id, change.lesson.studentId))
		.for('update')
	if (!student || student.status !== 'active') throw new CommandFault('invalid_request', 400)
	const id = randomUUID()
	const { requestId, expectedVersion, ...value } = input.input
	const plan = googleCommandPlan.parse({
		version: 1,
		input: { operation: input.operation, ref: input.ref, input: value },
		capturedTimeZone: change.lesson.timeZone,
		capturedRule: null,
		reservations: [],
		lineage: [
			{
				from: input.ref,
				to: input.ref,
				startsAt: change.startsAt.toISOString(),
				timeZone: change.lesson.timeZone,
				durationMinutes: change.lesson.durationMinutes,
			},
		],
		preconditions: [
			{
				eventId: target.mapping.eventId,
				etag: target.event.etag,
				unownedWritableFingerprint:
					evidence.kind === 'present'
						? evidence.observation.unownedWritableFingerprint
						: evidence.cancellation.unownedWritableFingerprint,
			},
		],
		affectedRefs: [input.ref],
		oldEndsOn: null,
		newRule: null,
	})
	const payload = {
		...(input.operation === 'cancel'
			? {}
			: {
					summary: student.name,
					start: { dateTime: change.startsAt.toISOString(), timeZone: change.lesson.timeZone },
					end: {
						dateTime: new Date(change.startsAt.getTime() + change.lesson.durationMinutes * 60000).toISOString(),
						timeZone: change.lesson.timeZone,
					},
				}),
		status: input.operation === 'cancel' ? ('cancelled' as const) : ('confirmed' as const),
	}
	const stageDigest = digest(JSON.stringify({ eventId: target.mapping.eventId, ...payload }))
	const request = googleStageRequest.parse({
		method: 'patch',
		eventId: target.mapping.eventId,
		ifMatch: target.event.etag,
		...(input.operation === 'cancel'
			? {
					cancellationBaseline: {
						unownedWritableFingerprint: plan.preconditions[0].unownedWritableFingerprint,
					},
				}
			: {}),
		digest: stageDigest,
		payload: {
			...payload,
			markers: {
				entityKind: 'single',
				localEntityId: input.ref.lessonId,
				representationGeneration: target.mapping.representationGeneration,
				commandId: id,
				stage: 0,
				digest: stageDigest,
				schemaVersion: 1,
			},
		},
	})
	if (request.method !== 'patch') throw new CommandFault('invalid_request', 400)
	const prepared: PreparedCalendarCommand = {
		id,
		accountId: context.accountId,
		connectionId: connection.id,
		calendarId: connection.calendarId,
		requestId,
		inputHash: commandHash(input),
		expectedVersion,
		baseRevision: connection.snapshotRevision,
		generation: connection.generation,
		operation: input.operation,
		plan,
		request,
		createdAt: context.now,
		dispatchDeadline: new Date(context.now.getTime() + 30000),
	}
	if (evidence.kind === 'absent') return replacementCommand(executor, prepared, evidence.proof)
	return evidence.kind === 'unresolved' ? { ...prepared, recoveryRequired: true } : prepared
}

function changeRefusal(failure: Exclude<Awaited<ReturnType<typeof prepareLessonChange>>, { kind: 'ok' }>): never {
	if (failure.kind === 'history_only' || failure.kind === 'default_time_zone_changed')
		throw new CommandFault(failure.kind)
	if (failure.kind === 'nonexistent_local_time') throw new CommandFault(failure.kind, 400)
	throw new CommandFault('precondition_failed')
}

function validateEvidence(
	evidence: SingleEvidence,
	target: Awaited<ReturnType<typeof singleTarget>>,
	input: SingleCommand
) {
	if (evidence.kind !== 'present') {
		if (input.operation !== 'restore' || target.event.status !== 'cancelled') throw new CommandFault('external_change')
		return
	}
	const observed = evidence.observation
	if (observed.event.etag !== target.event.etag || observed.event.eventId !== target.mapping.eventId)
		throw new CommandFault('external_change')
	const markers = observed.privateProperties
	if (input.operation === 'restore' && observed.event.status === 'cancelled' && !markers.dvLocalId) return
	if (
		markers.dvLocalId !== target.mapping.localEntityId ||
		markers.dvKind !== 'single' ||
		markers.dvGeneration !== String(target.mapping.representationGeneration)
	)
		throw new CommandFault('external_change')
}
