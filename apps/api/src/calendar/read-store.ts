import { and, eq, sql } from 'drizzle-orm'

import type { CalendarSeriesContext } from '@dv-lab/contracts'
import { googleConnections, googleReadEvents, googleReadWindows, type Database } from '@dv-lab/db'

import type { ConnectionRow } from './credentials.ts'
import { loadMappings, type BoundEvent, type MappingSnapshot } from './event-mapping.ts'
import { opaqueVersion, recordRead, type CalendarReadContext, type WindowSelection } from './read-state.ts'

export function mappingFingerprint(snapshot: MappingSnapshot): string {
	return opaqueVersion([
		JSON.stringify(snapshot.mappings.toSorted((a, b) => a.id.localeCompare(b.id))),
		JSON.stringify(snapshot.commands.toSorted((a, b) => a.id.localeCompare(b.id))),
		JSON.stringify([...snapshot.series].sort(([a], [b]) => a.localeCompare(b))),
	])
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
		if (mappingFingerprint(latest) !== mappingFingerprint(input.mappings)) return null
		const revision = connection.snapshotRevision + 1n
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
		series: input.series.map((item) => ({
			...item,
			version: opaqueVersion([item.version, connection.id, connection.generation, result.revision]),
		})),
	})
}
