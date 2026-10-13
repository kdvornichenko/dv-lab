import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import type { ValidatedCalendarCommand } from '@dv-lab/contracts'
import { canChange } from '@dv-lab/core'
import {
	googleCommandPlan,
	googleConnections,
	googleEventMappings,
	googleStageRequest,
	students,
	type DbExecutor,
} from '@dv-lab/db'

import { cancelledSingleBaseline } from '../calendar/cancelled-singles.ts'
import { replacementCommand, rowForLocal } from '../calendar/event-mapping.ts'
import type { GoogleGateway } from '../calendar/gateway.ts'
import { currentConnection } from '../calendar/google-access.ts'
import { CommandFault, commandHash, digest, unresolvedCommands } from '../calendar/journal.ts'
import { syncRevision } from '../calendar/projection.ts'
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
	const local = await rowForLocal(executor, mapping.connectionId, input.ref)
	if (
		local?.kind !== 'single' ||
		local.mapping.id !== mapping.id ||
		local.row.eventType !== 'default' ||
		eventVersion(local.row) !== input.input.expectedVersion
	)
		throw new CommandFault('precondition_failed')
	const cancellationBaselineFingerprint =
		local.row.status === 'cancelled'
			? await cancelledSingleBaseline(executor, mapping, input.ref.lessonId, local.row.eventId)
			: undefined
	return { mapping, row: local.row, cancellationBaselineFingerprint }
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
		.where(currentConnection(context.accountId))
		.for('update')
	if (!connection?.calendarId || connection.state !== 'connected') throw new CommandFault('connection_required')
	if ((await unresolvedCommands(executor, context.accountId)).length) throw new CommandFault('command_pending')
	const target = await singleTarget(executor, context.accountId, input)
	if (target.mapping.connectionId !== connection.id || target.mapping.calendarId !== connection.calendarId)
		throw new CommandFault('precondition_failed')
	validateEvidence(evidence, target, input)
	if (
		target.row.start &&
		'dateTime' in target.row.start &&
		!canChange(new Date(target.row.start.dateTime), context.now)
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
				durationMinutes: change.durationMinutes,
			},
		],
		preconditions: [singlePrecondition(evidence, target.mapping.eventId, target.row.etag)],
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
						dateTime: new Date(change.startsAt.getTime() + change.durationMinutes * 60000).toISOString(),
						timeZone: change.lesson.timeZone,
					},
				}),
		status: input.operation === 'cancel' ? ('cancelled' as const) : ('confirmed' as const),
	}
	const stageDigest = digest(JSON.stringify({ eventId: target.mapping.eventId, ...payload }))
	const request = googleStageRequest.parse({
		method: 'patch',
		eventId: target.mapping.eventId,
		ifMatch: plan.preconditions[0].etag,
		...(input.operation === 'cancel'
			? {
					cancellationBaseline: {
						unownedWritableFingerprint: plan.preconditions[0].unownedWritableFingerprint,
						unownedWritable: plan.preconditions[0].unownedWritable,
						baselineEvent: evidence.kind === 'present' ? evidence.observation.event : undefined,
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
		baseRevision: await syncRevision(executor, connection.id),
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

function singlePrecondition(evidence: SingleEvidence, eventId: string, etag: string) {
	const observed = evidence.kind === 'present' ? evidence.observation : evidence.cancellation
	return {
		eventId,
		etag: evidence.kind === 'present' ? evidence.observation.event.etag : etag,
		unownedWritableFingerprint: observed.unownedWritableFingerprint,
		unownedWritable: observed.unownedWritable ?? null,
	}
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
		if (input.operation !== 'restore' || target.row.status !== 'cancelled') throw new CommandFault('external_change')
		return
	}
	const observed = evidence.observation
	validateObservedRevision(observed, target, input)
	const markers = observed.privateProperties
	if (input.operation === 'restore' && observed.event.status === 'cancelled' && !markers.dvLocalId) return
	if (
		markers.dvLocalId !== target.mapping.localEntityId ||
		markers.dvKind !== 'single' ||
		markers.dvGeneration !== String(target.mapping.representationGeneration)
	)
		throw new CommandFault('external_change')
}

function validateObservedRevision(
	observed: SingleObservation,
	target: Awaited<ReturnType<typeof singleTarget>>,
	input: SingleCommand
) {
	if (observed.event.eventId !== target.mapping.eventId) throw new CommandFault('external_change')
	if (observed.event.etag === target.row.etag) return
	if (
		input.operation === 'restore' &&
		observed.event.status === 'cancelled' &&
		target.cancellationBaselineFingerprint === observed.unownedWritableFingerprint
	)
		return
	throw new CommandFault('external_change')
}
