import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { scheduleDate } from '@dv-lab/core'
import {
	googleCommandPlan,
	googleConnections,
	googleSeriesRule,
	googleStageRequest,
	students,
	type GoogleObservedResource,
	type GoogleCommandPlan,
	type DbExecutor,
} from '@dv-lab/db'

import { currentConnection } from '../calendar/credentials.ts'
import { CommandFault, commandHash, digest, unresolvedCommands } from '../calendar/journal.ts'
import type { CalendarReadContext } from '../calendar/read-state.ts'
import { masterRepresentation } from '../calendar/recurring.ts'
import type { SeriesEvidence } from '../calendar/series-observation.ts'
import { lockTeacherTimeContext } from '../settings/settings.ts'
import type { PreparedCalendarCommand } from './command-plan.ts'
import { lockSeries } from './rows.ts'
import type { SeriesCommand } from './series.ts'

function ruleValue(rule: NonNullable<GoogleCommandPlan['capturedRule']>) {
	const { weekday, startTime, timeZone, durationMinutes, startsOn, endsOn } = rule
	return googleSeriesRule.parse({ weekday, startTime, timeZone, durationMinutes, startsOn, endsOn })
}

function reservation(connectionId: string, calendarId: string, entityKind: 'single' | 'series') {
	const localEntityId = randomUUID()
	return {
		entityKind,
		localEntityId,
		representationGeneration: 0,
		eventId: `dv${digest(JSON.stringify([connectionId, calendarId, entityKind, localEntityId, 0]))}`,
	}
}

export function cutWrite(
	commandId: string,
	stage: number,
	source: GoogleObservedResource,
	identity: { entityKind: 'single' | 'series' | 'occurrence'; localEntityId: string; representationGeneration: number },
	recurrence?: string[]
) {
	const payload = recurrence ? { recurrence, status: 'confirmed' as const } : { status: 'cancelled' as const }
	const requestDigest = digest(JSON.stringify({ eventId: source.event.eventId, ...payload }))
	const original = source.event.originalStartTime
	const instance =
		source.event.recurringEventId && original && 'dateTime' in original
			? {
					masterEventId: source.event.recurringEventId,
					originalOn: scheduleDate(new Date(original.dateTime), original.timeZone),
					originalStartTime: original,
					lookupVerified: true,
				}
			: undefined
	const request = googleStageRequest.parse({
		method: 'patch',
		instance,
		eventId: source.event.eventId,
		ifMatch: source.event.etag,
		digest: requestDigest,
		...(recurrence
			? {}
			: {
					cancellationBaseline: {
						baselineEvent: source.event,
						unownedWritableFingerprint: source.unownedWritableFingerprint,
						unownedWritable: source.unownedWritable,
					},
				}),
		payload: { ...payload, markers: { ...identity, commandId, stage, digest: requestDigest, schemaVersion: 1 } },
	})
	if (request.method !== 'patch') throw new CommandFault('precondition_failed')
	return request
}

export async function prepareSeriesCommand(
	executor: DbExecutor,
	input: SeriesCommand,
	context: CalendarReadContext,
	evidence: SeriesEvidence
): Promise<PreparedCalendarCommand> {
	const [connection] = await executor
		.select()
		.from(googleConnections)
		.where(currentConnection(context.accountId))
		.for('update')
	if (!connection?.calendarId || connection.state !== 'connected' || connection.id !== evidence.mapping.connectionId)
		throw new CommandFault('connection_required')
	if ((await unresolvedCommands(executor, context.accountId)).length) throw new CommandFault('command_pending')
	const settings = await lockTeacherTimeContext(
		executor,
		context.accountId,
		input.input.expectedDefaultTimeZone,
		context.now
	)
	if (!settings.ok) throw new CommandFault(settings.error)
	const locked = await lockSeries(executor, input.seriesId)
	if (!locked || JSON.stringify(locked) !== JSON.stringify(evidence.prepared.rule))
		throw new CommandFault('precondition_failed')
	const [student] = await executor
		.select({ status: students.status })
		.from(students)
		.where(eq(students.id, locked.studentId))
		.for('update')
	if (!student || student.status !== 'active') throw new CommandFault('invalid_request', 400)
	const id = randomUUID()
	const calendarId = connection.calendarId
	const old = evidence.prepared
	const detached = old.lessons.map(() => reservation(connection.id, calendarId, 'single'))
	const replacement = old.newRule ? reservation(connection.id, connection.calendarId, 'series') : null
	const { requestId, expectedVersion, ...value } = input.input
	const plan = googleCommandPlan.parse({
		version: 1,
		input: { operation: input.operation, seriesId: input.seriesId, ...value },
		capturedTimeZone: locked.timeZone,
		capturedRule: ruleValue(locked),
		reservations: [...detached, ...(replacement ? [replacement] : [])],
		lineage: old.lessons.map((lesson, index) => ({
			from: { kind: 'series', seriesId: input.seriesId, originalOn: lesson.originalOn },
			to: { kind: 'single', lessonId: detached[index].localEntityId },
			startsAt: lesson.startsAt.toISOString(),
			timeZone: lesson.timeZone,
			durationMinutes: lesson.durationMinutes,
			status: lesson.status ?? 'scheduled',
		})),
		preconditions: [evidence.master, ...evidence.prefix, ...evidence.tail].map((source) => ({
			eventId: source.event.eventId,
			etag: source.event.etag,
			unownedWritableFingerprint: source.unownedWritableFingerprint,
			unownedWritable: source.unownedWritable,
		})),
		affectedRefs: [
			{ kind: 'series', seriesId: input.seriesId, originalOn: old.naturalCutoff },
			...detached.map((item) => ({ kind: 'single', lessonId: item.localEntityId })),
			...(replacement && old.newRule
				? [{ kind: 'series', seriesId: replacement.localEntityId, originalOn: old.newRule.startsOn }]
				: []),
		],
		oldEndsOn: old.oldEndsOn,
		newRule: old.newRule ? ruleValue(old.newRule) : null,
		cut: {
			studentId: locked.studentId,
			cutoff: old.naturalCutoff,
			master: evidence.master,
			prefix: evidence.prefix,
			cancelledPrefix: evidence.cancelledPrefix,
			tail: evidence.tail,
			cancelledTail: evidence.cancelledTail,
			preparedMarks: [...old.marks].map(([originalOn, kind]) => ({ originalOn, kind })),
			familyIds: evidence.familyIds,
		},
	})
	const tail = evidence.tail.find((item) => item.event.status !== 'cancelled')
	const trimmed = masterRepresentation({ ...plan.capturedRule!, endsOn: old.oldEndsOn })
	const request = tail
		? cutWrite(id, 1, tail, {
				entityKind: 'occurrence',
				localEntityId: input.seriesId,
				representationGeneration: evidence.mapping.representationGeneration,
			})
		: cutWrite(
				id,
				1,
				evidence.master,
				{
					entityKind: 'series',
					localEntityId: input.seriesId,
					representationGeneration: evidence.mapping.representationGeneration,
				},
				trimmed?.recurrence
			)
	return {
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
}
