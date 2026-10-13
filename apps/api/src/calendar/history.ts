import { and, eq, inArray, lte, notInArray } from 'drizzle-orm'

import { occurrenceKey, type MarkKind, type OccurrenceRef } from '@dv-lab/core'
import {
	googleCommands,
	googleConnections,
	googleEventMappings,
	lessons,
	lessonSeries,
	type DbExecutor,
} from '@dv-lab/db'

import { rowForLocal } from './event-mapping.ts'
import { currentConnection } from './google-access.ts'

type HistorySubject = {
	ref: OccurrenceRef
	studentId: string
	startsAt: Date
	durationMinutes: number
	mark: MarkKind | null
}

type HistoryConnection = typeof googleConnections.$inferSelect
type HistoryMapping = typeof googleEventMappings.$inferSelect

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

async function pendingKeys(executor: DbExecutor, connection: HistoryConnection, subjects: readonly HistorySubject[]) {
	const commands = await executor
		.select({ plan: googleCommands.plan })
		.from(googleCommands)
		.where(
			and(
				eq(googleCommands.accountId, connection.accountId),
				eq(googleCommands.connectionId, connection.id),
				notInArray(googleCommands.state, ['applied', 'failed'])
			)
		)
	const mappings = await executor
		.select()
		.from(googleEventMappings)
		.where(
			and(
				eq(googleEventMappings.accountId, connection.accountId),
				eq(googleEventMappings.connectionId, connection.id),
				eq(googleEventMappings.state, 'reserved'),
				inArray(googleEventMappings.localEntityId, [...new Set(subjects.map(({ ref }) => entityId(ref)))])
			)
		)
	const pending = new Set(commands.flatMap(({ plan }) => plan.affectedRefs.map(occurrenceKey)))
	for (const mapping of mappings) pending.add(mappingKey(mapping))
	return pending
}

async function confirmedByProjection(executor: DbExecutor, connection: HistoryConnection, subject: HistorySubject) {
	const local = await rowForLocal(executor, connection.id, subject.ref)
	const row = local?.row
	if (!local || !row?.startsAt || !row.endsAt) return false
	return (
		local.mapping.studentId === subject.studentId &&
		row.status !== 'cancelled' &&
		row.eventType === 'default' &&
		row.startsAt.getTime() === subject.startsAt.getTime() &&
		row.endsAt.getTime() - row.startsAt.getTime() === subject.durationMinutes * 60000
	)
}

export async function historyEligibility(
	executor: DbExecutor,
	accountId: string,
	subjects: readonly HistorySubject[],
	mode: 'read' | 'write' = 'read'
) {
	const eligible = new Set<string>()
	if (subjects.length === 0) return eligible
	const [connection] = await executor.select().from(googleConnections).where(currentConnection(accountId))
	if (!connection?.historyCutoverAt) return new Set(subjects.map(({ ref }) => occurrenceKey(ref)))
	const cutoff = connection.historyCutoverAt
	const existing = await existingBefore(executor, subjects, cutoff)
	const pending = await pendingKeys(executor, connection, subjects)
	for (const subject of subjects) {
		const key = occurrenceKey(subject.ref)
		const unsettled = pending.has(key) || pending.has(`series:${entityId(subject.ref)}`)
		if (mode === 'write' && unsettled) continue
		if (subject.mark !== null) eligible.add(key)
		else if (unsettled) continue
		else if (subject.startsAt < cutoff && existing.has(entityId(subject.ref))) eligible.add(key)
		else if (await confirmedByProjection(executor, connection, subject)) eligible.add(key)
	}
	return eligible
}
