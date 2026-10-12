import { and, asc, eq, gt, gte, inArray, isNotNull, lt, ne, sql } from 'drizzle-orm'

import { googleCalendarEvents, googleSyncState, type DbExecutor } from '@dv-lab/db'

import type { ProviderEvent } from './provider-events.ts'

export type ProjectionRow = typeof googleCalendarEvents.$inferSelect
export type SyncFacts = typeof googleSyncState.$inferSelect
export type ProjectionRange = { start: Date; end: Date }

const family = sql<string>`coalesce(${googleCalendarEvents.recurringEventId}, ${googleCalendarEvents.eventId})`

export async function syncFacts(executor: DbExecutor, connectionId: string): Promise<SyncFacts | null> {
	const [row] = await executor.select().from(googleSyncState).where(eq(googleSyncState.connectionId, connectionId))
	return row ?? null
}

export function weekRows(executor: DbExecutor, connectionId: string, range: ProjectionRange): Promise<ProjectionRow[]> {
	return executor
		.select()
		.from(googleCalendarEvents)
		.where(
			and(
				eq(googleCalendarEvents.connectionId, connectionId),
				ne(googleCalendarEvents.rowKind, 'master'),
				isNotNull(googleCalendarEvents.startsAt),
				isNotNull(googleCalendarEvents.endsAt),
				lt(googleCalendarEvents.startsAt, range.end),
				gt(googleCalendarEvents.endsAt, range.start)
			)
		)
		.orderBy(asc(googleCalendarEvents.startsAt), asc(googleCalendarEvents.eventId))
}

export async function nextRows(
	executor: DbExecutor,
	connectionId: string,
	now: Date,
	eventIds: readonly string[]
): Promise<ProjectionRow[]> {
	if (!eventIds.length) return []
	return executor
		.selectDistinctOn([family])
		.from(googleCalendarEvents)
		.where(
			and(
				eq(googleCalendarEvents.connectionId, connectionId),
				inArray(family, [...new Set(eventIds)]),
				ne(googleCalendarEvents.rowKind, 'master'),
				ne(googleCalendarEvents.status, 'cancelled'),
				isNotNull(googleCalendarEvents.endsAt),
				gte(googleCalendarEvents.startsAt, now)
			)
		)
		.orderBy(family, asc(googleCalendarEvents.startsAt), asc(googleCalendarEvents.eventId))
}

export async function rowByKey(
	executor: DbExecutor,
	connectionId: string,
	eventKey: string
): Promise<ProjectionRow | null> {
	const [row] = await executor
		.select()
		.from(googleCalendarEvents)
		.where(and(eq(googleCalendarEvents.connectionId, connectionId), eq(googleCalendarEvents.eventKey, eventKey)))
	return row ?? null
}

export async function masterRow(
	executor: DbExecutor,
	connectionId: string,
	recurringEventId: string
): Promise<ProjectionRow | null> {
	const [row] = await executor
		.select()
		.from(googleCalendarEvents)
		.where(
			and(
				eq(googleCalendarEvents.connectionId, connectionId),
				eq(googleCalendarEvents.eventId, recurringEventId),
				eq(googleCalendarEvents.rowKind, 'master')
			)
		)
	return row ?? null
}

export function rowEvent(row: ProjectionRow): ProviderEvent {
	return {
		eventId: row.eventId,
		etag: row.etag,
		recurringEventId: row.recurringEventId,
		originalStartTime: row.originalStart,
		summary: row.summary,
		start: row.start,
		end: row.end,
		status: row.status,
		transparency: row.transparency,
		eventType: row.eventType,
	}
}
