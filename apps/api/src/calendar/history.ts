import { and, desc, eq, gt, inArray, lte, notInArray, or } from 'drizzle-orm'

import { occurrenceKey, type MarkKind, type OccurrenceRef } from '@dv-lab/core'
import {
	googleCommands,
	googleConnections,
	googleEventMappings,
	googleNextLessons,
	googleReadEvents,
	googleReadWindows,
	lessons,
	lessonSeries,
	type DbExecutor,
} from '@dv-lab/db'

import { currentConnection } from './credentials.ts'

type HistorySubject = {
	ref: OccurrenceRef
	studentId: string
	startsAt: Date
	durationMinutes: number
	mark: MarkKind | null
}

type HistoryConnection = typeof googleConnections.$inferSelect
type HistoryWindow = typeof googleReadWindows.$inferSelect
type HistoryEvent = typeof googleReadEvents.$inferSelect
type HistoryMapping = typeof googleEventMappings.$inferSelect
type NextHistory = typeof googleNextLessons.$inferSelect

function entityId(ref: OccurrenceRef) {
	return ref.kind === 'single' ? ref.lessonId : ref.seriesId
}

function mappingKey(mapping: HistoryMapping) {
	if (mapping.entityKind === 'single') return occurrenceKey({ kind: 'single', lessonId: mapping.localEntityId })
	return mapping.originalOn === null
		? `series:${mapping.localEntityId}`
		: occurrenceKey({ kind: 'series', seriesId: mapping.localEntityId, originalOn: mapping.originalOn })
}

export async function lockHistoryConnection(executor: DbExecutor, accountId: string) {
	await executor
		.select({ id: googleConnections.id })
		.from(googleConnections)
		.where(currentConnection(accountId))
		.for('share')
}

async function existingBefore(executor: DbExecutor, subjects: readonly HistorySubject[], cutoff: Date) {
	const singles = subjects.flatMap(({ ref }) => (ref.kind === 'single' ? [ref.lessonId] : []))
	const series = subjects.flatMap(({ ref }) => (ref.kind === 'series' ? [ref.seriesId] : []))
	const lessonRows = singles.length
		? await executor
				.select({ id: lessons.id })
				.from(lessons)
				.where(and(inArray(lessons.id, singles), lte(lessons.createdAt, cutoff)))
		: []
	const seriesRows = series.length
		? await executor
				.select({ id: lessonSeries.id })
				.from(lessonSeries)
				.where(and(inArray(lessonSeries.id, series), lte(lessonSeries.createdAt, cutoff)))
		: []
	return new Set([...lessonRows, ...seriesRows].map(({ id }) => id))
}

async function historyFacts(executor: DbExecutor, connection: HistoryConnection, subjects: readonly HistorySubject[]) {
	const owner = and(eq(googleCommands.accountId, connection.accountId), eq(googleCommands.connectionId, connection.id))
	const commands = await executor
		.select({ plan: googleCommands.plan })
		.from(googleCommands)
		.where(and(owner, notInArray(googleCommands.state, ['applied', 'failed'])))
	const mappings = await executor
		.select()
		.from(googleEventMappings)
		.where(
			and(
				eq(googleEventMappings.accountId, connection.accountId),
				eq(googleEventMappings.connectionId, connection.id),
				inArray(googleEventMappings.localEntityId, [...new Set(subjects.map(({ ref }) => entityId(ref)))])
			)
		)
	const pending = new Set(commands.flatMap(({ plan }) => plan.affectedRefs.map(occurrenceKey)))
	for (const mapping of mappings) if (mapping.state === 'reserved') pending.add(mappingKey(mapping))
	const times = subjects.map(({ startsAt }) => startsAt.getTime())
	const windows = await executor
		.select()
		.from(googleReadWindows)
		.where(
			and(
				eq(googleReadWindows.accountId, connection.accountId),
				eq(googleReadWindows.connectionId, connection.id),
				eq(googleReadWindows.coverageState, 'complete'),
				lte(googleReadWindows.windowStart, new Date(Math.max(...times))),
				gt(googleReadWindows.windowEnd, new Date(Math.min(...times)))
			)
		)
		.orderBy(desc(googleReadWindows.snapshotRevision))
	const ids = mappings.map(({ eventId }) => eventId)
	const studentIds = [...new Set(subjects.map(({ studentId }) => studentId))]
	const events = await executor
		.select()
		.from(googleReadEvents)
		.where(
			and(
				eq(googleReadEvents.accountId, connection.accountId),
				eq(googleReadEvents.connectionId, connection.id),
				or(
					inArray(googleReadEvents.studentId, studentIds),
					ids.length ? inArray(googleReadEvents.eventId, ids) : undefined,
					ids.length ? inArray(googleReadEvents.recurringEventId, ids) : undefined
				)
			)
		)
		.orderBy(desc(googleReadEvents.snapshotRevision))
	const next = await executor
		.select()
		.from(googleNextLessons)
		.where(
			and(
				eq(googleNextLessons.accountId, connection.accountId),
				eq(googleNextLessons.connectionId, connection.id),
				inArray(googleNextLessons.studentId, studentIds),
				lte(googleNextLessons.asOf, new Date(Math.max(...times))),
				eq(googleNextLessons.completePrefix, true)
			)
		)
	return { pending, mappings, windows, events, next }
}

function activeRepresentation(event: HistoryEvent, mappings: readonly HistoryMapping[]) {
	return mappings.some(
		(mapping) =>
			mapping.state === 'active' &&
			mapping.studentId === event.studentId &&
			mapping.representationGeneration === event.representationGeneration &&
			(mapping.eventId === event.eventId ||
				(mapping.entityKind === 'series' && mapping.eventId === event.recurringEventId))
	)
}

function confirms(event: HistoryEvent, subject: HistorySubject, mappings: readonly HistoryMapping[]) {
	if (event.bindingKind !== 'lesson' || event.status === 'cancelled' || !event.localRef) return false
	if (event.studentId !== subject.studentId || occurrenceKey(event.localRef) !== occurrenceKey(subject.ref))
		return false
	if (!event.start || !event.end || !('dateTime' in event.start) || !('dateTime' in event.end)) return false
	const start = new Date(event.start.dateTime).getTime()
	return (
		start === subject.startsAt.getTime() &&
		new Date(event.end.dateTime).getTime() - start === subject.durationMinutes * 60000 &&
		activeRepresentation(event, mappings)
	)
}

function confirmedHistory(
	subject: HistorySubject,
	facts: {
		windows: HistoryWindow[]
		events: HistoryEvent[]
		mappings: HistoryMapping[]
		next: NextHistory[]
	}
) {
	const window = facts.windows.find((item) => item.windowStart <= subject.startsAt && item.windowEnd > subject.startsAt)
	if (!window) return false
	const known = facts.events.find(
		(event) => event.localRef && occurrenceKey(event.localRef) === occurrenceKey(subject.ref)
	)
	if (!known) return false
	const latest = facts.events.find((event) => event.eventId === known.eventId)
	return Boolean(
		latest &&
		latest.snapshotRevision >= window.snapshotRevision &&
		confirms(latest, subject, facts.mappings) &&
		!facts.next.some((proof) => disprovesHistory(proof, latest, subject))
	)
}

function disprovesHistory(proof: NextHistory, event: HistoryEvent, subject: HistorySubject) {
	if (
		proof.studentId !== subject.studentId ||
		proof.revision <= event.snapshotRevision ||
		proof.asOf > subject.startsAt
	)
		return false
	return (
		proof.result === 'none' ||
		(proof.result === 'known' && proof.startsAt !== null && proof.startsAt > subject.startsAt)
	)
}

export async function historyEligibility(executor: DbExecutor, accountId: string, subjects: readonly HistorySubject[]) {
	const eligible = new Set<string>()
	if (subjects.length === 0) return eligible
	const [connection] = await executor.select().from(googleConnections).where(currentConnection(accountId))
	if (!connection?.historyCutoverAt) return new Set(subjects.map(({ ref }) => occurrenceKey(ref)))
	const cutoff = connection.historyCutoverAt
	const existing = await existingBefore(executor, subjects, cutoff)
	const facts = await historyFacts(executor, connection, subjects)
	for (const subject of subjects) {
		const id = entityId(subject.ref)
		if (subject.mark !== null) eligible.add(occurrenceKey(subject.ref))
		else if (
			!facts.pending.has(occurrenceKey(subject.ref)) &&
			!facts.pending.has(`series:${id}`) &&
			((subject.startsAt < cutoff && existing.has(id)) || confirmedHistory(subject, facts))
		)
			eligible.add(occurrenceKey(subject.ref))
	}
	return eligible
}
