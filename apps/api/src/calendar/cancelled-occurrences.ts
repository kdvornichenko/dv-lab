import { and, desc, eq } from 'drizzle-orm'

import {
	googleCommands,
	googleCommandStages,
	googleEventMappings,
	lessonExceptions,
	lessonSeries,
	type DbExecutor,
	type googleReadWindows,
} from '@dv-lab/db'

import { cancellationAcknowledgement } from './command-result.ts'
import type { CommandRow } from './journal.ts'
import type { ReadEventRow } from './read-state.ts'

export async function cancelledOccurrences(
	executor: DbExecutor,
	window: typeof googleReadWindows.$inferSelect
): Promise<(ReadEventRow & { cancellationBaselineFingerprint: string })[]> {
	const commands = await executor
		.select()
		.from(googleCommands)
		.where(
			and(
				eq(googleCommands.accountId, window.accountId),
				eq(googleCommands.connectionId, window.connectionId),
				eq(googleCommands.state, 'applied')
			)
		)
		.orderBy(desc(googleCommands.appliedAt))
	const seen = new Set<string>()
	const result: (ReadEventRow & { cancellationBaselineFingerprint: string })[] = []
	for (const command of commands) {
		const input = command.plan.input
		if (input.operation !== 'move' && input.operation !== 'cancel' && input.operation !== 'restore') continue
		if (input.ref.kind !== 'series') continue
		const key = `${input.ref.seriesId}:${input.ref.originalOn}`
		if (seen.has(key)) continue
		seen.add(key)
		if (input.operation !== 'cancel') continue
		const event = await cancelledOccurrence(executor, window, command)
		if (event) result.push(event)
	}
	return result
}

async function cancelledOccurrence(
	executor: DbExecutor,
	window: typeof googleReadWindows.$inferSelect,
	command: CommandRow
) {
	const input = command.plan.input
	if (input.operation !== 'cancel' || input.ref.kind !== 'series') return null
	const [mapping] = await executor
		.select()
		.from(googleEventMappings)
		.where(
			and(
				eq(googleEventMappings.accountId, window.accountId),
				eq(googleEventMappings.connectionId, window.connectionId),
				eq(googleEventMappings.calendarId, window.calendarId),
				eq(googleEventMappings.entityKind, 'occurrence'),
				eq(googleEventMappings.localEntityId, input.ref.seriesId),
				eq(googleEventMappings.originalOn, input.ref.originalOn),
				eq(googleEventMappings.state, 'active')
			)
		)
	if (!mapping) return null
	const stages = await executor
		.select()
		.from(googleCommandStages)
		.where(
			and(
				eq(googleCommandStages.commandId, command.id),
				eq(googleCommandStages.kind, 'write'),
				eq(googleCommandStages.state, 'acknowledged')
			)
		)
	const ack = cancellationAcknowledgement(stages[0]?.acknowledgement, mapping.eventId)
	const baseline = ack?.kind === 'event' ? ack.event : ack?.baselineEvent
	if (!ack || !baseline?.start || !baseline.end || !('dateTime' in baseline.start) || !('dateTime' in baseline.end))
		return null
	const [exception] = await executor
		.select()
		.from(lessonExceptions)
		.where(
			and(eq(lessonExceptions.seriesId, input.ref.seriesId), eq(lessonExceptions.originalOn, input.ref.originalOn))
		)
	const [series] = await executor.select().from(lessonSeries).where(eq(lessonSeries.id, input.ref.seriesId))
	if (
		!series ||
		exception?.kind !== 'cancelled' ||
		new Date(baseline.start.dateTime) >= window.windowEnd ||
		new Date(baseline.end.dateTime) <= window.windowStart
	)
		return null
	return {
		...baseline,
		status: 'cancelled' as const,
		etag: ack.kind === 'cancellation' ? (ack.response.etag ?? baseline.etag) : baseline.etag,
		cancellationBaselineFingerprint: ack.unownedWritableFingerprint,
		id: command.id,
		accountId: window.accountId,
		connectionId: window.connectionId,
		windowId: window.id,
		generation: window.generation,
		snapshotRevision: window.snapshotRevision,
		localRef: input.ref,
		studentId: series.studentId,
		representationGeneration: mapping.representationGeneration,
		commandId: command.id,
		bindingKind: 'lesson' as const,
	}
}

export async function withCancelledOccurrences(
	executor: DbExecutor,
	window: typeof googleReadWindows.$inferSelect,
	events: ReadEventRow[]
) {
	for (const event of await cancelledOccurrences(executor, window)) {
		const index = events.findIndex((item) => item.eventId === event.eventId)
		if (index < 0) events.push(event)
		else if (events[index].status === 'cancelled' && !events[index].start) events[index] = event
	}
}
