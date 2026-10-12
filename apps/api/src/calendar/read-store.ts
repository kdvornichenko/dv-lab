import { and, eq, sql } from 'drizzle-orm'

import type { CalendarSeriesContext } from '@dv-lab/contracts'
import {
	googleConnections,
	googleReadEvents,
	googleReadWindows,
	googleNextLessons,
	type Database,
	type DbExecutor,
} from '@dv-lab/db'

import { loadMappings, type BoundEvent, type MappingSnapshot } from './event-mapping.ts'
import type { ConnectionRow } from './google-access.ts'
import type { NextProof } from './read-pages.ts'
import { opaqueVersion, recordRead, type CalendarReadContext, type WindowSelection } from './read-state.ts'

export async function advanceCommandRevision(
	tx: DbExecutor,
	accountId: string,
	connectionId: string,
	generation: number
) {
	const [row] = await tx
		.update(googleConnections)
		.set({
			snapshotRevision: sql`${googleConnections.snapshotRevision} + 1`,
			updatedAt: sql`now()`,
		})
		.where(
			and(
				eq(googleConnections.id, connectionId),
				eq(googleConnections.accountId, accountId),
				eq(googleConnections.generation, generation),
				eq(googleConnections.state, 'connected')
			)
		)
		.returning({ revision: googleConnections.snapshotRevision })
	if (!row) throw new Error('Calendar projection generation changed')
	return row.revision
}

export function mappingFingerprint(snapshot: MappingSnapshot): string {
	return opaqueVersion([
		JSON.stringify(snapshot.mappings.toSorted((a, b) => a.id.localeCompare(b.id))),
		JSON.stringify(snapshot.commands.toSorted((a, b) => a.id.localeCompare(b.id))),
		JSON.stringify([...snapshot.series].sort(([a], [b]) => a.localeCompare(b))),
	])
}

async function publicationRevision(
	tx: DbExecutor,
	context: CalendarReadContext,
	connection: ConnectionRow,
	mappings: MappingSnapshot
) {
	const [current] = await tx
		.select()
		.from(googleConnections)
		.where(and(eq(googleConnections.id, connection.id), eq(googleConnections.accountId, context.accountId)))
		.for('update')
	if (
		!current ||
		current.state !== 'connected' ||
		current.generation !== connection.generation ||
		current.snapshotRevision !== connection.snapshotRevision
	)
		return null
	const latest = await loadMappings(tx, context.accountId, connection.id)
	if (mappingFingerprint(latest) !== mappingFingerprint(mappings)) return null
	return connection.snapshotRevision + 1n
}

export async function publishWindow(input: {
	db: Database
	context: CalendarReadContext
	selection: WindowSelection
	connection: ConnectionRow
	mappings: MappingSnapshot
	events: readonly BoundEvent[]
	timeZone: string
	series: CalendarSeriesContext[]
}) {
	const { db, context, selection, connection } = input
	if (!connection.calendarId) return
	const calendarId = connection.calendarId
	const result = await db.transaction(async (tx) => {
		const revision = await publicationRevision(tx, context, connection, input.mappings)
		if (revision === null) return null
		const [window] = await tx
			.insert(googleReadWindows)
			.values({
				accountId: context.accountId,
				connectionId: connection.id,
				calendarId,
				generation: connection.generation,
				snapshotRevision: revision,
				windowStart: selection.start,
				windowEnd: selection.end,
				displayTimeZone: selection.displayTimeZone,
				calendarTimeZone: input.timeZone,
				fetchedAt: new Date(),
				coverageState: 'complete',
			})
			.returning({ id: googleReadWindows.id })
		if (!window) throw new Error('Calendar publication failed')
		for (let offset = 0; offset < input.events.length; offset += 500) {
			await tx.insert(googleReadEvents).values(
				input.events.slice(offset, offset + 500).map((event) => ({
					...event,
					accountId: context.accountId,
					connectionId: connection.id,
					windowId: window.id,
					generation: connection.generation,
					snapshotRevision: revision,
				}))
			)
		}
		await tx
			.update(googleConnections)
			.set({ snapshotRevision: revision, issue: null, updatedAt: sql`now()` })
			.where(eq(googleConnections.id, connection.id))
		return { windowId: window.id, revision }
	})
	if (!result) return recordRead(context, 'external_change')
	recordRead(context, {
		...result,
		connectionId: connection.id,
		generation: connection.generation,
		checkedAt: new Date(),
		emptyStudentIds: [],
		series: input.series.map((item) => ({
			...item,
			version: opaqueVersion([item.version, connection.id, connection.generation, result.revision]),
		})),
	})
}

export async function publishNext(input: {
	db: Database
	context: CalendarReadContext
	connection: ConnectionRow
	mappings: MappingSnapshot
	proofs: readonly NextProof[]
	emptyStudentIds: readonly string[]
}) {
	const { db, context, connection } = input
	if (!connection.calendarId) return
	const calendarId = connection.calendarId
	const checkedAt = new Date()
	const revision = await db.transaction(async (tx) => {
		const revision = await publicationRevision(tx, context, connection, input.mappings)
		if (revision === null) return null
		for (let offset = 0; offset < input.proofs.length; offset += 500) {
			await tx.insert(googleNextLessons).values(
				input.proofs.slice(offset, offset + 500).map((proof) => ({
					...proof,
					accountId: context.accountId,
					connectionId: connection.id,
					calendarId,
					generation: connection.generation,
					revision,
					asOf: context.now,
					checkedAt,
				}))
			)
		}
		await tx
			.update(googleConnections)
			.set({ snapshotRevision: revision, updatedAt: sql`now()` })
			.where(eq(googleConnections.id, connection.id))
		return revision
	})
	if (revision === null) return recordRead(context, 'external_change')
	recordRead(context, {
		connectionId: connection.id,
		generation: connection.generation,
		revision,
		windowId: null,
		series: [],
		checkedAt,
		emptyStudentIds: input.emptyStudentIds,
	})
}
