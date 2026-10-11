import { and, desc, eq, inArray } from 'drizzle-orm'

import { googleCommands, googleCommandStages, lessons, type DbExecutor, type googleReadWindows } from '@dv-lab/db'

import { cancellationAcknowledgement } from './command-result.ts'
import { loadMappings } from './event-mapping.ts'
import type { ReadEventRow } from './read-state.ts'

export async function withCancelledSingles(
	executor: DbExecutor,
	window: typeof googleReadWindows.$inferSelect,
	events: ReadEventRow[]
) {
	for (const event of await cancelledSingles(executor, window)) {
		const index = events.findIndex((item) => item.eventId === event.eventId)
		if (index < 0) events.push(event)
		else if (events[index].status === 'cancelled' && !events[index].start) events[index] = event
	}
	return events
}

export async function cancelledSingles(
	executor: DbExecutor,
	window: typeof googleReadWindows.$inferSelect
): Promise<(ReadEventRow & { cancellationBaselineFingerprint: string })[]> {
	const snapshot = await loadMappings(executor, window.accountId, window.connectionId)
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
	const cancelled = commands.filter((command) => {
		const input = command.plan.input
		if (input.operation !== 'cancel' && input.operation !== 'restore' && input.operation !== 'move') return false
		if (input.ref.kind !== 'single' || seen.has(input.ref.lessonId)) return false
		seen.add(input.ref.lessonId)
		return input.operation === 'cancel'
	})
	if (!cancelled.length) return []
	const stages = await executor
		.select()
		.from(googleCommandStages)
		.where(
			and(
				inArray(
					googleCommandStages.commandId,
					cancelled.map((command) => command.id)
				),
				eq(googleCommandStages.kind, 'write'),
				eq(googleCommandStages.state, 'acknowledged')
			)
		)
	const lessonIds = cancelled.flatMap((command) =>
		command.plan.affectedRefs.flatMap((ref) => (ref.kind === 'single' ? [ref.lessonId] : []))
	)
	const rows = await executor.select().from(lessons).where(inArray(lessons.id, lessonIds))
	return cancelled.flatMap((command) => {
		const lineage = command.plan.lineage[0]
		const ref = lineage?.to
		if (ref?.kind !== 'single') return []
		const mapping = snapshot.mappings.find(
			(item) => item.localEntityId === ref.lessonId && item.state === 'active' && item.calendarId === window.calendarId
		)
		const ack = cancellationAcknowledgement(
			stages.find((stage) => stage.commandId === command.id)?.acknowledgement,
			mapping?.eventId ?? ''
		)
		const baseline = ack?.kind === 'event' ? ack.event : ack?.baselineEvent
		const lesson = rows.find((row) => row.id === ref.lessonId && row.status === 'cancelled')
		if (!mapping || !lesson || !ack || !baseline) return []
		const end = new Date(lesson.startsAt.getTime() + lesson.durationMinutes * 60000)
		if (lesson.startsAt >= window.windowEnd || end <= window.windowStart) return []
		return [
			{
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
				start: { dateTime: lesson.startsAt.toISOString(), timeZone: lesson.timeZone },
				end: { dateTime: end.toISOString(), timeZone: lesson.timeZone },
				localRef: ref,
				studentId: lesson.studentId,
				representationGeneration: mapping.representationGeneration,
				commandId: command.id,
				bindingKind: 'lesson' as const,
			},
		]
	})
}
