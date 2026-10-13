import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import {
	googleSeriesRule,
	googleCommandPlan,
	googleConnections,
	googleStageRequest,
	students,
	type DbExecutor,
} from '@dv-lab/db'

import { rowForLocal } from '../calendar/event-mapping.ts'
import { currentConnection } from '../calendar/google-access.ts'
import type { InstanceEvidence } from '../calendar/instance-observation.ts'
import { CommandFault, commandHash, digest, unresolvedCommands } from '../calendar/journal.ts'
import { insideSyncWindow, syncFacts, syncRevision } from '../calendar/projection.ts'
import { eventVersion, type CalendarReadContext } from '../calendar/read-state.ts'
import type { PreparedCalendarCommand } from './command-plan.ts'
import { occurrenceChange } from './occurrence-change.ts'
import type { SingleCommand } from './single-command.ts'

export async function prepareOccurrenceCommand(
	executor: DbExecutor,
	input: SingleCommand,
	context: CalendarReadContext,
	evidence: InstanceEvidence
): Promise<PreparedCalendarCommand> {
	if (input.ref.kind !== 'series') throw new CommandFault('precondition_failed')
	const [connection] = await executor
		.select()
		.from(googleConnections)
		.where(currentConnection(context.accountId))
		.for('update')
	if (!connection?.calendarId || connection.state !== 'connected') throw new CommandFault('connection_required')
	if ((await unresolvedCommands(executor, context.accountId)).length) throw new CommandFault('command_pending')
	const { target, observation } = evidence
	const precondition = observation
		? {
				eventId: target.row.eventId,
				etag: observation.event.etag,
				unownedWritableFingerprint: observation.unownedWritableFingerprint,
				unownedWritable: observation.unownedWritable,
			}
		: {
				eventId: target.row.eventId,
				etag: target.row.etag,
				unownedWritableFingerprint: null,
				unownedWritable: null,
			}
	const current = await rowForLocal(executor, connection.id, input.ref)
	if (
		target.mapping.connectionId !== connection.id ||
		current?.mapping.id !== target.mapping.id ||
		current.row.eventId !== target.row.eventId ||
		eventVersion(current.row) !== input.input.expectedVersion
	)
		throw new CommandFault('precondition_failed')
	const change = await occurrenceChange(executor, context.accountId, input, context.now)
	if (JSON.stringify(change.rule) !== JSON.stringify(target.rule)) throw new CommandFault('precondition_failed')
	const sync = await syncFacts(executor, connection.id)
	const { occurrence } = change
	if (
		!insideSyncWindow(
			sync,
			occurrence.startsAt,
			new Date(occurrence.startsAt.getTime() + occurrence.durationMinutes * 60000)
		) ||
		!insideSyncWindow(sync, change.startsAt, new Date(change.startsAt.getTime() + change.durationMinutes * 60000))
	)
		throw new CommandFault('outside_sync_window')
	const [student] = await executor
		.select({ status: students.status })
		.from(students)
		.where(eq(students.id, change.rule.studentId))
		.for('update')
	if (!student || student.status !== 'active') throw new CommandFault('invalid_request', 400)
	const id = randomUUID()
	const { requestId, expectedVersion, ...value } = input.input
	const plan = googleCommandPlan.parse({
		version: 1,
		input: {
			operation: input.operation,
			ref: input.ref,
			input: value,
		},
		capturedTimeZone: change.rule.timeZone,
		capturedRule: googleSeriesRule.parse({
			weekday: change.rule.weekday,
			startTime: change.rule.startTime,
			timeZone: change.rule.timeZone,
			durationMinutes: change.rule.durationMinutes,
			startsOn: change.rule.startsOn,
			endsOn: change.rule.endsOn,
		}),
		reservations: [],
		lineage: [
			{
				from: input.ref,
				to: input.ref,
				startsAt: change.startsAt.toISOString(),
				timeZone: change.rule.timeZone,
				durationMinutes: change.durationMinutes,
				beforeStartsAt: change.occurrence.startsAt.toISOString(),
				beforeDurationMinutes: change.occurrence.durationMinutes,
				beforeStatus: change.occurrence.status,
				...(change.clearMark ? { clearMark: true } : {}),
			},
		],
		preconditions: [precondition],
		affectedRefs: [input.ref],
		oldEndsOn: null,
		newRule: null,
	})
	const payload = {
		status: input.operation === 'cancel' ? ('cancelled' as const) : ('confirmed' as const),
		...(input.operation === 'cancel'
			? {}
			: {
					start: { dateTime: change.startsAt.toISOString(), timeZone: change.rule.timeZone },
					end: {
						dateTime: new Date(change.startsAt.getTime() + change.durationMinutes * 60000).toISOString(),
						timeZone: change.rule.timeZone,
					},
				}),
	}
	const stageDigest = digest(JSON.stringify({ eventId: target.row.eventId, ...payload }))
	const request = googleStageRequest.parse({
		method: 'patch',
		eventId: target.row.eventId,
		ifMatch: plan.preconditions[0].etag,
		instance: {
			masterEventId: target.mapping.eventId,
			originalOn: input.ref.originalOn,
			originalStartTime: { dateTime: target.natural.toISOString(), timeZone: change.rule.timeZone },
			lookupVerified: evidence.lookupVerified,
		},
		...(input.operation === 'cancel' && observation
			? {
					cancellationBaseline: {
						unownedWritableFingerprint: observation.unownedWritableFingerprint,
						unownedWritable: observation.unownedWritable,
						baselineEvent: observation.event,
					},
				}
			: {}),
		digest: stageDigest,
		payload: {
			...payload,
			markers: {
				entityKind: 'occurrence',
				localEntityId: input.ref.seriesId,
				representationGeneration: target.mapping.representationGeneration,
				commandId: id,
				stage: 0,
				digest: stageDigest,
				schemaVersion: 1,
			},
		},
	})
	if (request.method !== 'patch') throw new CommandFault('precondition_failed')
	return {
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
		recoveryRequired: !evidence.lookupVerified,
		recoveryIssue: evidence.lookupVerified ? undefined : 'external_change',
	}
}
