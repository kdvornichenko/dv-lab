import { and, asc, eq, gt, gte, inArray, isNotNull, lt, ne, sql } from 'drizzle-orm'
import { isDeepStrictEqual } from 'node:util'

import { startOfZonedDay } from '@dv-lab/core'
import { googleCalendarEvents, googleSyncState, type DbExecutor, type GoogleEventTime } from '@dv-lab/db'

import type { ProviderEvent } from './provider-events.ts'
import { opaqueVersion } from './read-state.ts'

export type ProjectionRow = typeof googleCalendarEvents.$inferSelect
export type SyncFacts = typeof googleSyncState.$inferSelect
export type ProjectionRange = { start: Date; end: Date }
export type ProjectionTarget = { accountId: string; connectionId: string; calendarId: string }
export type MasterRecurrence = Pick<
	ProjectionRow,
	'recurrenceKind' | 'recurrenceWeekday' | 'recurrenceFrequency' | 'recurrenceInterval' | 'recurrenceUntil'
>
export type EventFact = {
	eventId: string
	status: ProjectionRow['status']
	factAt: Date
	etag?: string
	master?: boolean
	recurringEventId?: string | null
	originalStartTime?: GoogleEventTime | null
	eventType?: string
	start?: GoogleEventTime | null
	end?: GoogleEventTime | null
	summary?: string | null
	transparency?: ProjectionRow['transparency']
	description?: string | null
	location?: string | null
	colorId?: string | null
	markerLocalId?: string | null
	markerKind?: string | null
	recurrence?: MasterRecurrence
}
export type UpsertResult = { inserted: number; changed: number }

type RowValues = Omit<
	ProjectionRow,
	| 'createdAt'
	| 'updatedAt'
	| 'seenEpoch'
	| 'googleUpdatedAt'
	| 'inboundAppliedEtag'
	| 'accountId'
	| 'connectionId'
	| 'calendarId'
	| 'eventKey'
>

const INSERT_CHUNK = 500
const family = sql<string>`coalesce(${googleCalendarEvents.recurringEventId}, ${googleCalendarEvents.eventId})`
const NO_RECURRENCE: MasterRecurrence = {
	recurrenceKind: null,
	recurrenceWeekday: null,
	recurrenceFrequency: null,
	recurrenceInterval: null,
	recurrenceUntil: null,
}
const COMPARED = [
	'rowKind',
	'etag',
	'recurringEventId',
	'originalStart',
	'status',
	'eventType',
	'start',
	'end',
	'startsAt',
	'endsAt',
	'allDay',
	'summary',
	'description',
	'location',
	'colorId',
	'transparency',
	'markerLocalId',
	'markerKind',
	'recurrenceKind',
	'recurrenceWeekday',
	'recurrenceFrequency',
	'recurrenceInterval',
	'recurrenceUntil',
] as const

export async function syncFacts(executor: DbExecutor, connectionId: string): Promise<SyncFacts | null> {
	const [row] = await executor.select().from(googleSyncState).where(eq(googleSyncState.connectionId, connectionId))
	return row ?? null
}

export function insideSyncWindow(sync: SyncFacts | null, startsAt: Date, endsAt: Date): boolean {
	if (!sync) return true
	return startsAt.getTime() >= sync.windowStart.getTime() && endsAt.getTime() <= sync.windowEnd.getTime()
}

export async function syncRevision(executor: DbExecutor, connectionId: string): Promise<bigint> {
	const [row] = await executor
		.select({ revision: googleSyncState.revision })
		.from(googleSyncState)
		.where(eq(googleSyncState.connectionId, connectionId))
	return row?.revision ?? 0n
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

function instant(time: GoogleEventTime): Date {
	return 'dateTime' in time ? new Date(time.dateTime) : startOfZonedDay(time.date, time.timeZone)
}

function known<T>(value: T | undefined, stored: T | undefined, fallback: T): T {
	if (value !== undefined) return value
	return stored !== undefined ? stored : fallback
}

function rowKind(fact: EventFact, stored: ProjectionRow | undefined): ProjectionRow['rowKind'] {
	if (fact.master) return 'master'
	if (fact.status === 'cancelled' && stored) return stored.rowKind
	if (fact.recurringEventId !== undefined) return fact.recurringEventId ? 'instance' : 'single'
	return stored?.rowKind ?? 'single'
}

function times(fact: EventFact, stored: ProjectionRow | undefined) {
	if (fact.start && fact.end)
		return {
			start: fact.start,
			end: fact.end,
			startsAt: instant(fact.start),
			endsAt: instant(fact.end),
			allDay: 'date' in fact.start,
		}
	if (stored && (fact.status === 'cancelled' || (fact.start === undefined && fact.end === undefined)))
		return {
			start: stored.start,
			end: stored.end,
			startsAt: stored.startsAt,
			endsAt: stored.endsAt,
			allDay: stored.allDay,
		}
	if (fact.status !== 'cancelled' || !fact.originalStartTime) return null
	return {
		start: null,
		end: null,
		startsAt: instant(fact.originalStartTime),
		endsAt: null,
		allDay: 'date' in fact.originalStartTime,
	}
}

function nextValues(fact: EventFact, stored: ProjectionRow | undefined): RowValues | null {
	const etag = fact.etag ?? stored?.etag
	const when = times(fact, stored)
	if (!etag || !when) return null
	if (fact.status !== 'cancelled' && (!when.start || !when.end || !when.startsAt || !when.endsAt)) return null
	if (when.startsAt && when.endsAt && when.startsAt >= when.endsAt) return null
	const kind = rowKind(fact, stored)
	const recurrence =
		kind === 'master'
			? (fact.recurrence ?? (stored?.rowKind === 'master' ? recurrenceOf(stored) : NO_RECURRENCE))
			: NO_RECURRENCE
	return {
		eventId: fact.eventId,
		rowKind: kind,
		etag,
		recurringEventId: kind === 'master' ? null : known(fact.recurringEventId, stored?.recurringEventId, null),
		originalStart: known(fact.originalStartTime, stored?.originalStart, null),
		status: fact.status,
		eventType: known(fact.eventType, stored?.eventType, 'default'),
		...when,
		summary: known(fact.summary, stored?.summary, null),
		description: known(fact.description, stored?.description, null),
		location: known(fact.location, stored?.location, null),
		colorId: known(fact.colorId, stored?.colorId, null),
		transparency: known(fact.transparency, stored?.transparency, 'opaque'),
		markerLocalId: known(fact.markerLocalId, stored?.markerLocalId, null),
		markerKind: known(fact.markerKind, stored?.markerKind, null),
		...recurrence,
	}
}

function recurrenceOf(row: ProjectionRow): MasterRecurrence {
	return {
		recurrenceKind: row.recurrenceKind,
		recurrenceWeekday: row.recurrenceWeekday,
		recurrenceFrequency: row.recurrenceFrequency,
		recurrenceInterval: row.recurrenceInterval,
		recurrenceUntil: row.recurrenceUntil,
	}
}

function differs(stored: ProjectionRow, next: RowValues) {
	return COMPARED.some((field) => !isDeepStrictEqual(stored[field], next[field]))
}

function latestFacts(facts: readonly EventFact[]) {
	const latest = new Map<string, EventFact>()
	for (const fact of facts) {
		const current = latest.get(fact.eventId)
		if (!current || fact.factAt >= current.factAt) latest.set(fact.eventId, fact)
	}
	return [...latest.values()]
}

async function applyFacts(
	executor: DbExecutor,
	target: ProjectionTarget,
	facts: readonly EventFact[],
	epoch: number,
	seenEpoch: number | undefined,
	retry: boolean
): Promise<UpsertResult> {
	const ids = facts.map((fact) => fact.eventId)
	const stored = new Map(
		(
			await executor
				.select()
				.from(googleCalendarEvents)
				.where(
					and(eq(googleCalendarEvents.connectionId, target.connectionId), inArray(googleCalendarEvents.eventId, ids))
				)
				.for('update')
		).map((row) => [row.eventId, row])
	)
	let changed = 0
	const stamped: string[] = []
	const created: (RowValues & { factAt: Date })[] = []
	for (const fact of facts) {
		const row = stored.get(fact.eventId)
		if (row && row.googleUpdatedAt && fact.factAt < row.googleUpdatedAt) {
			stamped.push(fact.eventId)
			continue
		}
		const next = nextValues(fact, row)
		if (!next) {
			if (row) stamped.push(fact.eventId)
			continue
		}
		if (!row) {
			created.push({ ...next, factAt: fact.factAt })
			continue
		}
		if (!differs(row, next)) {
			stamped.push(fact.eventId)
			continue
		}
		await executor
			.update(googleCalendarEvents)
			.set({
				...next,
				googleUpdatedAt: fact.factAt,
				...(seenEpoch === undefined ? {} : { seenEpoch }),
				updatedAt: sql`now()`,
			})
			.where(
				and(eq(googleCalendarEvents.connectionId, target.connectionId), eq(googleCalendarEvents.eventId, fact.eventId))
			)
		changed += 1
	}
	let inserted = 0
	if (created.length) {
		const added = new Set<string>()
		for (let index = 0; index < created.length; index += INSERT_CHUNK) {
			const rows = await executor
				.insert(googleCalendarEvents)
				.values(
					created.slice(index, index + INSERT_CHUNK).map(({ factAt, ...values }) => ({
						...values,
						...target,
						eventKey: opaqueVersion([target.connectionId, values.eventId]),
						googleUpdatedAt: factAt,
						seenEpoch: seenEpoch ?? epoch,
					}))
				)
				.onConflictDoNothing()
				.returning({ eventId: googleCalendarEvents.eventId })
			for (const row of rows) added.add(row.eventId)
		}
		inserted = added.size
		const raced = facts.filter(
			(fact) => created.some((row) => row.eventId === fact.eventId) && !added.has(fact.eventId)
		)
		if (raced.length) {
			if (!retry) throw new Error('Calendar projection row changed during upsert')
			const again = await applyFacts(executor, target, raced, epoch, seenEpoch, false)
			inserted += again.inserted
			changed += again.changed
		}
	}
	if (seenEpoch !== undefined && stamped.length)
		await executor
			.update(googleCalendarEvents)
			.set({ seenEpoch })
			.where(
				and(
					eq(googleCalendarEvents.connectionId, target.connectionId),
					inArray(googleCalendarEvents.eventId, stamped),
					ne(googleCalendarEvents.seenEpoch, seenEpoch)
				)
			)
	return { inserted, changed }
}

export async function upsertEventFacts(
	executor: DbExecutor,
	target: ProjectionTarget,
	facts: readonly EventFact[],
	options: { seenEpoch?: number } = {}
): Promise<UpsertResult> {
	const latest = latestFacts(facts)
	if (!latest.length) return { inserted: 0, changed: 0 }
	const [sync] = await executor
		.select({ epoch: googleSyncState.epoch })
		.from(googleSyncState)
		.where(eq(googleSyncState.connectionId, target.connectionId))
	const result = await applyFacts(executor, target, latest, sync?.epoch ?? 0, options.seenEpoch, true)
	if (sync && (result.inserted || result.changed))
		await executor
			.update(googleSyncState)
			.set({ revision: sql`${googleSyncState.revision} + 1`, updatedAt: sql`now()` })
			.where(eq(googleSyncState.connectionId, target.connectionId))
	return result
}
