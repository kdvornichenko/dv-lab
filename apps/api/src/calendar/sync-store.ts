import { and, eq, getColumns, inArray, isNotNull, isNull, lt, ne, not, or, sql, type SQL } from 'drizzle-orm'
import { isDeepStrictEqual } from 'node:util'

import { SYNC_WINDOW_WEEKS } from '@dv-lab/contracts'
import { addDays, mondayOf, scheduleToday, startOfZonedDay } from '@dv-lab/core'
import {
	googleCalendarEvents,
	googleConnections,
	googleSyncState,
	type Database,
	type DbExecutor,
	type GoogleEventTime,
	type GoogleSyncPaletteColor,
} from '@dv-lab/db'

import { readTeacherSettings } from '../settings/settings.ts'
import { boundRowCondition } from './event-mapping.ts'
import type { ChannelPair } from './gateway-sync.ts'
import { upsertEventFacts, type EventFact, type SyncFacts } from './projection.ts'

export type SyncWindow = { start: Date; end: Date }
export type SyncClaim = SyncFacts & { claimedUntil: Date; generation: number; calendarTimeZone: string }
export type SyncIssue = NonNullable<SyncFacts['issue']>
export type SyncPass = {
	kind: 'full' | 'incremental'
	facts: readonly EventFact[]
	nextSyncToken: string
	skipped: number
	truncated: number
	pollMinutes: { channel: number; none: number }
	window?: SyncWindow
	nextFullAt?: Date
	palette?: GoogleSyncPaletteColor[]
	calendarColor?: string | null
}
export type PassResult =
	| { applied: false }
	| { applied: true; upserted: number; removed: number; skipped: number; truncated: number; unseenBound: string[] }

const e = googleCalendarEvents
const s = googleSyncState
const c = googleConnections
const CLAIM_UNTIL = sql`date_trunc('milliseconds', now() + interval '2 minutes')`
const ID_CHUNK = 1000
const UNSEEN_LIMIT = 50
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const currentConnection = and(
	eq(c.id, s.connectionId),
	eq(c.accountId, s.accountId),
	eq(c.calendarId, s.calendarId),
	eq(c.state, 'connected'),
	isNull(c.retiredAt)
)
const due = sql`(${s.nextPollAt} <= now() or (${s.failureCount} = 0 and (${s.requestedSeq} > ${s.processedSeq} or ${s.nextFullAt} <= now())))`

export function syncWindow(now: Date, zone: string): SyncWindow {
	const monday = mondayOf(scheduleToday(now, zone))
	return {
		start: startOfZonedDay(addDays(monday, -SYNC_WINDOW_WEEKS.back * 7), zone),
		end: startOfZonedDay(addDays(monday, SYNC_WINDOW_WEEKS.ahead * 7), zone),
	}
}

export async function ensureSyncRow(
	executor: DbExecutor,
	connection: { id: string; accountId: string; calendarId: string },
	now: Date
) {
	const { defaultTimeZone } = await readTeacherSettings(executor, connection.accountId)
	const window = syncWindow(now, defaultTimeZone)
	await executor
		.insert(s)
		.values({
			connectionId: connection.id,
			accountId: connection.accountId,
			calendarId: connection.calendarId,
			windowStart: window.start,
			windowEnd: window.end,
			nextPollAt: sql`now()`,
			nextFullAt: sql`now()`,
		})
		.onConflictDoNothing()
}

export async function ensureSyncRows(db: Database, now: Date) {
	const missing = await db
		.select({ id: c.id, accountId: c.accountId, calendarId: c.calendarId })
		.from(c)
		.where(
			and(
				eq(c.state, 'connected'),
				isNull(c.retiredAt),
				isNotNull(c.calendarId),
				sql`not exists (select 1 from ${s} where ${s.connectionId} = ${c.id})`
			)
		)
	for (const row of missing) {
		if (row.calendarId)
			await ensureSyncRow(db, { id: row.id, accountId: row.accountId, calendarId: row.calendarId }, now)
	}
	return missing.length
}

export async function retireSyncRow(executor: DbExecutor, connectionId: string): Promise<ChannelPair[]> {
	const [row] = await executor.select().from(s).where(eq(s.connectionId, connectionId)).for('update')
	if (!row) return []
	const pairs: ChannelPair[] = []
	if (row.channelId && row.channelResourceId) pairs.push({ id: row.channelId, resourceId: row.channelResourceId })
	if (row.retiringChannelId && row.retiringResourceId)
		pairs.push({ id: row.retiringChannelId, resourceId: row.retiringResourceId })
	await executor
		.update(s)
		.set({
			channelId: null,
			channelResourceId: null,
			channelTokenHash: null,
			channelExpiresAt: null,
			retiringChannelId: null,
			retiringResourceId: null,
			claimedUntil: null,
			updatedAt: sql`now()`,
		})
		.where(eq(s.connectionId, connectionId))
	return pairs
}

export async function notificationTarget(
	executor: DbExecutor,
	channelId: string
): Promise<{ connectionId: string; tokenHash: string } | null> {
	if (!UUID.test(channelId)) return null
	const [row] = await executor
		.select({ connectionId: s.connectionId, tokenHash: s.channelTokenHash })
		.from(s)
		.innerJoin(c, currentConnection)
		.where(eq(s.channelId, channelId))
	return row?.tokenHash ? { connectionId: row.connectionId, tokenHash: row.tokenHash } : null
}

export async function requestPass(executor: DbExecutor, channelId: string): Promise<string | null> {
	if (!UUID.test(channelId)) return null
	const [row] = await executor
		.update(s)
		.set({ requestedSeq: sql`${s.requestedSeq} + 1`, updatedAt: sql`now()` })
		.from(c)
		.where(and(currentConnection, or(eq(s.channelId, channelId), eq(s.retiringChannelId, channelId))))
		.returning({ connectionId: s.connectionId })
	return row?.connectionId ?? null
}

export async function claim(db: Database, connectionId: string | null): Promise<SyncClaim[]> {
	const rows = await db
		.update(s)
		.set({ claimedUntil: CLAIM_UNTIL, updatedAt: sql`now()` })
		.from(c)
		.where(
			and(
				currentConnection,
				or(isNull(s.claimedUntil), sql`${s.claimedUntil} < now()`),
				due,
				connectionId === null ? undefined : eq(s.connectionId, connectionId)
			)
		)
		.returning({ ...getColumns(s), generation: c.generation, calendarTimeZone: c.calendarTimeZone })
	return rows.flatMap((row) =>
		row.claimedUntil
			? [{ ...row, claimedUntil: row.claimedUntil, calendarTimeZone: row.calendarTimeZone ?? 'UTC' }]
			: []
	)
}

function owned(current: SyncClaim) {
	return and(eq(s.connectionId, current.connectionId), eq(s.claimedUntil, current.claimedUntil))
}

export async function startFull(db: Database, current: SyncClaim, options: { tokenGone: boolean }) {
	const [row] = await db
		.update(s)
		.set({
			epoch: sql`${s.epoch} + 1`,
			fullStartedAt: sql`now()`,
			...(options.tokenGone ? { syncToken: null } : {}),
			updatedAt: sql`now()`,
		})
		.where(owned(current))
		.returning()
	return row ? { ...current, ...row, claimedUntil: current.claimedUntil } : null
}

export async function releaseClaim(db: Database, current: SyncClaim) {
	await db
		.update(s)
		.set({ claimedUntil: null, updatedAt: sql`now()` })
		.where(owned(current))
}

export async function recordFailure(db: Database, current: SyncClaim, issue: SyncIssue) {
	await db
		.update(s)
		.set({
			issue,
			failureCount: sql`${s.failureCount} + 1`,
			nextPollAt: sql`now() + least(interval '30 minutes', interval '1 minute' * power(2, least(${s.failureCount}, 5)))`,
			claimedUntil: null,
			fullStartedAt: null,
			updatedAt: sql`now()`,
		})
		.where(owned(current))
}

function instant(time: GoogleEventTime): Date {
	return 'dateTime' in time ? new Date(time.dateTime) : startOfZonedDay(time.date, time.timeZone)
}

type Span = { start: Date; end: Date | null }

function factSpan(fact: EventFact, stored: boolean): Span | null {
	if (fact.start && fact.end) return { start: instant(fact.start), end: instant(fact.end) }
	if (!stored && fact.originalStartTime) return { start: instant(fact.originalStartTime), end: null }
	return null
}

function intersects(span: Span, window: SyncWindow) {
	if (span.end === null) return span.start >= window.start && span.start < window.end
	return span.start < window.end && span.end > window.start
}

const insideWindow = (window: SyncWindow): SQL =>
	sql`(${e.startsAt} < ${window.end} and coalesce(${e.endsAt}, ${e.startsAt} + interval '1 millisecond') > ${window.start})`

type StoredFact = { etag: string; status: string; googleUpdatedAt: Date | null; bound: boolean; master: boolean }

async function storedFacts(executor: DbExecutor, connectionId: string, ids: readonly string[]) {
	const stored = new Map<string, StoredFact>()
	const unique = [...new Set(ids)]
	for (let index = 0; index < unique.length; index += ID_CHUNK) {
		const rows = await executor
			.select({
				eventId: e.eventId,
				etag: e.etag,
				status: e.status,
				googleUpdatedAt: e.googleUpdatedAt,
				rowKind: e.rowKind,
				bound: sql<boolean>`${boundRowCondition(connectionId)}`,
			})
			.from(e)
			.where(and(eq(e.connectionId, connectionId), inArray(e.eventId, unique.slice(index, index + ID_CHUNK))))
		for (const row of rows)
			stored.set(row.eventId, {
				etag: row.etag,
				status: row.status,
				googleUpdatedAt: row.googleUpdatedAt,
				bound: Boolean(row.bound),
				master: row.rowKind === 'master',
			})
	}
	return stored
}

function refreshed(fact: EventFact, stored: StoredFact): EventFact {
	if (
		stored.status === 'cancelled' &&
		fact.status === 'cancelled' &&
		fact.etag !== undefined &&
		fact.etag !== stored.etag &&
		stored.googleUpdatedAt !== null &&
		fact.factAt < stored.googleUpdatedAt
	)
		return { ...fact, factAt: stored.googleUpdatedAt }
	return fact
}

export async function masterCandidates(
	executor: DbExecutor,
	connectionId: string,
	facts: readonly EventFact[],
	limit: number
): Promise<string[]> {
	const instances = facts.filter((fact) => typeof fact.recurringEventId === 'string')
	const stored = await storedFacts(executor, connectionId, [
		...instances.map((fact) => fact.eventId),
		...instances.map((fact) => fact.recurringEventId as string),
	])
	const missing = new Set<string>()
	const changed = new Set<string>()
	for (const fact of instances) {
		const family = fact.recurringEventId as string
		if (fact.status !== 'cancelled' && !stored.get(family)?.master) missing.add(family)
		const row = stored.get(fact.eventId)
		if (!row || (fact.etag !== undefined && row.etag !== fact.etag)) changed.add(family)
	}
	const orphans = await executor
		.selectDistinct({ family: e.recurringEventId })
		.from(e)
		.where(
			and(
				eq(e.connectionId, connectionId),
				isNotNull(e.recurringEventId),
				ne(e.status, 'cancelled'),
				sql`not exists (select 1 from ${e} as m where m.connection_id = ${connectionId} and m.event_id = ${e.recurringEventId} and m.row_kind = 'master')`
			)
		)
		.limit(limit)
	for (const row of orphans) if (row.family) missing.add(row.family)
	return [...new Set([...missing, ...changed])].slice(0, limit)
}

async function lockedClaim(executor: DbExecutor, current: SyncClaim) {
	const [connection] = await executor.select().from(c).where(eq(c.id, current.connectionId)).for('update')
	if (
		!connection ||
		connection.state !== 'connected' ||
		connection.retiredAt !== null ||
		connection.accountId !== current.accountId ||
		connection.generation !== current.generation ||
		connection.calendarId !== current.calendarId
	)
		return null
	const [row] = await executor.select().from(s).where(eq(s.connectionId, current.connectionId)).for('update')
	return row ?? null
}

async function unseenBound(executor: DbExecutor, connectionId: string, epoch: number, window: SyncWindow) {
	const rows = await executor
		.select({ eventId: e.eventId })
		.from(e)
		.where(
			and(
				eq(e.connectionId, connectionId),
				lt(e.seenEpoch, epoch),
				ne(e.rowKind, 'master'),
				ne(e.status, 'cancelled'),
				insideWindow(window),
				boundRowCondition(connectionId)
			)
		)
		.orderBy(e.startsAt, e.eventId)
		.limit(UNSEEN_LIMIT)
	return rows.map((row) => row.eventId)
}

function cleanup(executor: DbExecutor, connectionId: string, epoch: number, window: SyncWindow) {
	const outside = sql`(${e.startsAt} is null or ${e.startsAt} >= ${window.end} or coalesce(${e.endsAt}, ${e.startsAt} + interval '1 millisecond') <= ${window.start})`
	const liveFamily = sql`(${e.rowKind} = 'master' and exists (select 1 from ${e} as i where i.connection_id = ${connectionId} and i.recurring_event_id = ${e.eventId} and i.seen_epoch = ${epoch}))`
	return executor
		.delete(e)
		.where(
			and(
				eq(e.connectionId, connectionId),
				not(boundRowCondition(connectionId)),
				not(liveFamily),
				or(lt(e.seenEpoch, epoch), outside)
			)
		)
		.returning({ eventId: e.eventId })
}

export function applyPass(db: Database, current: SyncClaim, pass: SyncPass): Promise<PassResult> {
	return db.transaction(async (tx) => {
		const row = await lockedClaim(tx, current)
		if (
			!row ||
			row.claimedUntil?.getTime() !== current.claimedUntil.getTime() ||
			row.epoch !== current.epoch ||
			row.syncToken !== current.syncToken
		)
			return { applied: false }
		const window = pass.window ?? { start: row.windowStart, end: row.windowEnd }
		const target = { accountId: current.accountId, connectionId: current.connectionId, calendarId: current.calendarId }
		const stored = await storedFacts(
			tx,
			current.connectionId,
			pass.facts.map((fact) => fact.eventId)
		)
		const keep: EventFact[] = []
		const outside: string[] = []
		for (const fact of pass.facts) {
			const known = stored.get(fact.eventId)
			if (fact.master || known?.bound) {
				keep.push(known ? refreshed(fact, known) : fact)
				continue
			}
			const span = factSpan(fact, known !== undefined)
			if (span && !intersects(span, window)) {
				if (known) outside.push(fact.eventId)
				continue
			}
			if (!span && !known) continue
			keep.push(known ? refreshed(fact, known) : fact)
		}
		const upsert = await upsertEventFacts(tx, target, keep, { seenEpoch: current.epoch })
		let removed = 0
		for (let index = 0; index < outside.length; index += ID_CHUNK) {
			const deleted = await tx
				.delete(e)
				.where(
					and(
						eq(e.connectionId, current.connectionId),
						inArray(e.eventId, outside.slice(index, index + ID_CHUNK)),
						not(boundRowCondition(current.connectionId))
					)
				)
				.returning({ eventId: e.eventId })
			removed += deleted.length
		}
		if (pass.kind === 'full') removed += (await cleanup(tx, current.connectionId, current.epoch, window)).length
		const paletteChanged =
			(pass.palette !== undefined && !isDeepStrictEqual(pass.palette, row.palette)) ||
			(pass.calendarColor !== undefined && pass.calendarColor !== row.calendarColor)
		const raise = !upsert.inserted && !upsert.changed && (removed > 0 || paletteChanged)
		const full = pass.kind === 'full'
		await tx
			.update(s)
			.set({
				syncToken: pass.nextSyncToken,
				processedSeq: sql`greatest(${s.processedSeq}, ${current.requestedSeq})`,
				...(raise ? { revision: sql`${s.revision} + 1` } : {}),
				...(full && pass.window ? { windowStart: pass.window.start, windowEnd: pass.window.end } : {}),
				...(full ? { lastFullAt: sql`now()` } : { lastIncrementalAt: sql`now()` }),
				...(full && pass.nextFullAt ? { nextFullAt: pass.nextFullAt } : {}),
				...(pass.palette !== undefined ? { palette: pass.palette, paletteFetchedAt: sql`now()` } : {}),
				...(pass.calendarColor !== undefined ? { calendarColor: pass.calendarColor } : {}),
				nextPollAt: sql`now() + case when ${s.channelId} is not null and ${s.channelExpiresAt} > now() then make_interval(mins => ${pass.pollMinutes.channel}) else make_interval(mins => ${pass.pollMinutes.none}) end`,
				issue: null,
				failureCount: 0,
				skippedCount: pass.skipped,
				fullStartedAt: null,
				claimedUntil: null,
				updatedAt: sql`now()`,
			})
			.where(eq(s.connectionId, current.connectionId))
		return {
			applied: true,
			upserted: upsert.inserted + upsert.changed,
			removed,
			skipped: pass.skipped,
			truncated: pass.truncated,
			unseenBound: await unseenBound(tx, current.connectionId, current.epoch, window),
		}
	})
}

export type InboundCursor = { family: string; rank: number; eventId: string }
export type InboundRow = InboundCursor & { etag: string }

const family = sql<string>`coalesce(${e.recurringEventId}, ${e.eventId})`
const rank = sql<number>`(case when ${e.rowKind} = 'master' then 0 else 1 end)`

export async function inboundWork(
	executor: DbExecutor,
	connectionId: string,
	after: InboundCursor | null,
	limit: number
): Promise<{ rows: InboundRow[]; next: InboundCursor | null }> {
	const rows = await executor
		.select({ eventId: e.eventId, etag: e.etag, family, rank: sql<number>`${rank}::int` })
		.from(e)
		.where(
			and(
				eq(e.connectionId, connectionId),
				boundRowCondition(connectionId),
				sql`${e.etag} is distinct from ${e.inboundAppliedEtag}`,
				after
					? sql`(${family}, ${rank}, ${e.eventId}) > (${after.family}::text, ${after.rank}::int, ${after.eventId}::text)`
					: undefined
			)
		)
		.orderBy(family, rank, e.eventId)
		.limit(limit)
	const last = rows.at(-1)
	return {
		rows,
		next: rows.length === limit && last ? { family: last.family, rank: last.rank, eventId: last.eventId } : null,
	}
}

export async function markInboundApplied(
	executor: DbExecutor,
	connectionId: string,
	rows: readonly { eventId: string; etag: string }[]
) {
	let stamped = 0
	for (const row of rows) {
		const updated = await executor
			.update(e)
			.set({ inboundAppliedEtag: row.etag })
			.where(and(eq(e.connectionId, connectionId), eq(e.eventId, row.eventId), eq(e.etag, row.etag)))
			.returning({ eventId: e.eventId })
		stamped += updated.length
	}
	return stamped
}

export function applyReads(db: Database, current: SyncClaim, facts: readonly EventFact[]) {
	return db.transaction(async (tx) => {
		const [connection] = await tx.select().from(c).where(eq(c.id, current.connectionId)).for('update')
		if (
			!connection ||
			connection.state !== 'connected' ||
			connection.retiredAt !== null ||
			connection.generation !== current.generation ||
			connection.calendarId !== current.calendarId
		)
			return null
		return upsertEventFacts(
			tx,
			{ accountId: current.accountId, connectionId: current.connectionId, calendarId: current.calendarId },
			facts,
			{ seenEpoch: current.epoch }
		)
	})
}
