import { and, desc, eq, gte, lt, ne, or, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import {
	addDays,
	canChange,
	cutSeries,
	lastSeriesDateOnOrBefore,
	nextSeriesDate,
	occurrenceAt,
	scheduleDate,
	scheduleToday,
	type SeriesException,
	type SeriesRule,
} from '@dv-lab/core'
import {
	googleCalendarEvents,
	googleCommandPlan,
	googleConnections,
	googleEventMappings,
	lessonExceptions,
	lessons,
	lessonSeries,
	type DbExecutor,
} from '@dv-lab/db'

import { masterSeriesRule, type MasterRule } from '../calendar/assign.ts'
import { unresolvedCommands } from '../calendar/journal.ts'
import type { ProjectionRow } from '../calendar/projection.ts'
import type { MappingRow } from '../calendar/read-state.ts'
import { applyLessonChange, clearsMark } from './changes.ts'
import { settleMarkAfterMove } from './marks.ts'
import {
	lessonColumns,
	markOf,
	seriesColumns,
	seriesException,
	seriesExceptionsFrom,
	seriesMarksFrom,
	toSeriesRule,
	toSingleLesson,
} from './rows.ts'

export type InboundResult =
	'applied' | 'unchanged' | 'skipped_marked' | 'skipped_past' | 'skipped_pending' | 'skipped_locked'
export type InboundItem = { accountId: string; connectionId: string; eventId: string; now: Date }
export type InboundOutcome = { result: InboundResult; stamp: { eventId: string; etag: string } | null }

type Entity =
	| { kind: 'single'; lessonId: string }
	| { kind: 'occurrence'; seriesId: string; originalOn: string | null }
	| { kind: 'series'; mapping: MappingRow }
	| { kind: 'split'; parent: MappingRow }
type Locked<T> = T | 'locked' | null

const APPLIED = 'applied' as const
const UNCHANGED = 'unchanged' as const

async function lockedLesson(tx: DbExecutor, id: string): Promise<Locked<ReturnType<typeof toSingleLesson>>> {
	const [row] = await tx
		.select(lessonColumns)
		.from(lessons)
		.where(eq(lessons.id, id))
		.for('update', { skipLocked: true })
	if (row) return toSingleLesson(row)
	const [exists] = await tx.select({ id: lessons.id }).from(lessons).where(eq(lessons.id, id))
	return exists ? 'locked' : null
}

async function lockedSeries(tx: DbExecutor, id: string): Promise<Locked<SeriesRule>> {
	const [row] = await tx
		.select(seriesColumns)
		.from(lessonSeries)
		.where(eq(lessonSeries.id, id))
		.for('update', { skipLocked: true })
	if (row) return toSeriesRule(row)
	const [exists] = await tx.select({ id: lessonSeries.id }).from(lessonSeries).where(eq(lessonSeries.id, id))
	return exists ? 'locked' : null
}

function googleTime(row: ProjectionRow): { startsAt: Date; minutes: number } | null {
	const { start, end } = row
	if (row.allDay || !start || !end || !('dateTime' in start) || !('dateTime' in end)) return null
	const startsAt = new Date(start.dateTime)
	const minutes = Math.round((Date.parse(end.dateTime) - startsAt.getTime()) / 60000)
	return minutes > 0 ? { startsAt, minutes } : null
}

async function activeMappings(tx: DbExecutor, connectionId: string, row: ProjectionRow) {
	const byEvent = eq(googleEventMappings.eventId, row.eventId)
	return tx
		.select()
		.from(googleEventMappings)
		.where(
			and(
				eq(googleEventMappings.connectionId, connectionId),
				eq(googleEventMappings.state, 'active'),
				row.recurringEventId
					? or(
							byEvent,
							and(eq(googleEventMappings.entityKind, 'series'), eq(googleEventMappings.eventId, row.recurringEventId))
						)
					: byEvent
			)
		)
}

async function resolveEntity(tx: DbExecutor, connectionId: string, row: ProjectionRow): Promise<Entity | null> {
	const mappings = await activeMappings(tx, connectionId, row)
	const own = mappings.find((mapping) => mapping.eventId === row.eventId)
	if (row.rowKind === 'single')
		return own?.entityKind === 'single' ? { kind: 'single', lessonId: own.localEntityId } : null
	if (row.rowKind === 'master') {
		if (own?.entityKind === 'series') return { kind: 'series', mapping: own }
		if (own || row.markerKind !== 'series' || !row.markerLocalId || !row.startsAt) return null
		const [parent] = await tx
			.select({ mapping: googleEventMappings })
			.from(googleEventMappings)
			.innerJoin(
				googleCalendarEvents,
				and(
					eq(googleCalendarEvents.connectionId, googleEventMappings.connectionId),
					eq(googleCalendarEvents.eventId, googleEventMappings.eventId)
				)
			)
			.where(
				and(
					eq(googleEventMappings.connectionId, connectionId),
					eq(googleEventMappings.state, 'active'),
					eq(googleEventMappings.entityKind, 'series'),
					ne(googleEventMappings.eventId, row.eventId),
					eq(googleCalendarEvents.rowKind, 'master'),
					lt(googleCalendarEvents.startsAt, row.startsAt),
					or(
						eq(googleEventMappings.localEntityId, row.markerLocalId),
						and(
							eq(googleCalendarEvents.markerKind, 'series'),
							eq(googleCalendarEvents.markerLocalId, row.markerLocalId)
						)
					)
				)
			)
			.orderBy(desc(googleCalendarEvents.startsAt))
			.limit(1)
		return parent ? { kind: 'split', parent: parent.mapping } : null
	}
	if (own?.entityKind === 'occurrence')
		return { kind: 'occurrence', seriesId: own.localEntityId, originalOn: own.originalOn }
	const master = mappings.find((mapping) => mapping.entityKind === 'series' && mapping.eventId === row.recurringEventId)
	return !own && master ? { kind: 'occurrence', seriesId: master.localEntityId, originalOn: null } : null
}

async function pending(tx: DbExecutor, accountId: string, ids: readonly string[]) {
	const wanted = new Set(ids)
	for (const command of await unresolvedCommands(tx, accountId)) {
		const plan = googleCommandPlan.parse(command.plan)
		const input = plan.input
		const touched = [
			...plan.reservations.flatMap((item) => [item.localEntityId, item.eventId]),
			...plan.affectedRefs.map((ref) => (ref.kind === 'single' ? ref.lessonId : ref.seriesId)),
			...plan.preconditions.map((item) => item.eventId),
			...('ref' in input ? [input.ref.kind === 'single' ? input.ref.lessonId : input.ref.seriesId] : []),
			...('seriesId' in input ? [input.seriesId] : []),
			...('eventId' in input ? [input.eventId] : []),
			...(plan.cut ? [plan.cut.master.event.eventId] : []),
		]
		if (touched.some((id) => wanted.has(id))) return true
	}
	return false
}

async function writeException(
	tx: DbExecutor,
	seriesId: string,
	originalOn: string,
	kind: SeriesException['kind'],
	time: { startsAt: Date; durationMinutes: number } | null
) {
	const value = { kind, startsAt: time?.startsAt ?? null, durationMinutes: time?.durationMinutes ?? null }
	await tx
		.insert(lessonExceptions)
		.values({ seriesId, originalOn, ...value })
		.onConflictDoUpdate({
			target: [lessonExceptions.seriesId, lessonExceptions.originalOn],
			set: { ...value, updatedAt: sql`now()` },
		})
}

async function applySingle(tx: DbExecutor, row: ProjectionRow, lessonId: string, now: Date): Promise<InboundResult> {
	const lesson = await lockedLesson(tx, lessonId)
	if (lesson === 'locked') return 'skipped_locked'
	if (!lesson) return UNCHANGED
	const ref = { kind: 'single', lessonId } as const
	const mark = await markOf(tx, ref)
	if (mark === 'done') return 'skipped_marked'
	if (row.status === 'cancelled') {
		if (lesson.status === 'cancelled') return UNCHANGED
		await applyLessonChange(tx, lessonId, { status: 'cancelled' })
		return APPLIED
	}
	const google = googleTime(row)
	if (!google) return UNCHANGED
	let result: InboundResult = UNCHANGED
	if (lesson.status === 'cancelled') {
		await applyLessonChange(tx, lessonId, { status: 'scheduled' })
		result = APPLIED
	}
	if (google.startsAt.getTime() !== lesson.startsAt.getTime() || google.minutes !== lesson.durationMinutes) {
		await applyLessonChange(tx, lessonId, { startsAt: google.startsAt, durationMinutes: google.minutes })
		if (clearsMark('move', mark, google.startsAt, now)) await settleMarkAfterMove(tx, ref)
		result = APPLIED
	}
	return result
}

async function applyOccurrence(
	tx: DbExecutor,
	connectionId: string,
	row: ProjectionRow,
	entity: Extract<Entity, { kind: 'occurrence' }>,
	now: Date
): Promise<InboundResult> {
	const rule = await lockedSeries(tx, entity.seriesId)
	if (rule === 'locked') return 'skipped_locked'
	if (!rule) return UNCHANGED
	const original = row.originalStart
	const originalOn =
		entity.originalOn ??
		(original && 'dateTime' in original ? scheduleDate(new Date(original.dateTime), rule.timeZone) : null)
	if (!originalOn) return UNCHANGED
	if (entity.originalOn === null) {
		const [other] = await tx
			.select({ id: googleEventMappings.id })
			.from(googleEventMappings)
			.where(
				and(
					eq(googleEventMappings.connectionId, connectionId),
					eq(googleEventMappings.state, 'active'),
					eq(googleEventMappings.entityKind, 'occurrence'),
					eq(googleEventMappings.localEntityId, rule.id),
					eq(googleEventMappings.originalOn, originalOn)
				)
			)
		if (other) return UNCHANGED
	}
	const exception = await seriesException(tx, rule.id, originalOn)
	const occurrence = occurrenceAt(rule, originalOn, exception ?? undefined)
	if (!occurrence?.naturalStart) return UNCHANGED
	if (
		entity.originalOn === null &&
		(!original || !('dateTime' in original) || Date.parse(original.dateTime) !== occurrence.naturalStart.getTime())
	)
		return UNCHANGED
	const mark = await markOf(tx, occurrence.ref)
	if (mark === 'done') return 'skipped_marked'
	if (row.status === 'cancelled') {
		if (occurrence.status === 'cancelled') return UNCHANGED
		const kept =
			occurrence.status === 'moved'
				? { startsAt: occurrence.startsAt, durationMinutes: occurrence.durationMinutes }
				: null
		await writeException(tx, rule.id, originalOn, 'cancelled', kept)
		return APPLIED
	}
	const google = googleTime(row)
	if (!google) return UNCHANGED
	const natural =
		google.startsAt.getTime() === occurrence.naturalStart.getTime() && google.minutes === rule.durationMinutes
	if (natural) {
		if (!exception || exception.kind === 'restored') return UNCHANGED
		await writeException(tx, rule.id, originalOn, 'restored', null)
		if (clearsMark('move', mark, google.startsAt, now)) await settleMarkAfterMove(tx, occurrence.ref)
		return APPLIED
	}
	if (
		occurrence.status === 'moved' &&
		occurrence.startsAt.getTime() === google.startsAt.getTime() &&
		occurrence.durationMinutes === google.minutes
	)
		return UNCHANGED
	await writeException(tx, rule.id, originalOn, 'moved', {
		startsAt: google.startsAt,
		durationMinutes: google.minutes,
	})
	if (clearsMark('move', mark, google.startsAt, now)) await settleMarkAfterMove(tx, occurrence.ref)
	return APPLIED
}

function later(left: string, right: string) {
	return left > right ? left : right
}

async function frozenThrough(tx: DbExecutor, rule: SeriesRule, now: Date): Promise<string> {
	const open = { ...rule, endsOn: null }
	const anchor = nextSeriesDate(open, now)
	let frozen = anchor ? addDays(anchor, -1) : scheduleToday(now, rule.timeZone)
	frozen = later(frozen, addDays(rule.startsOn, -1))
	const after = addDays(frozen, 1)
	for (const date of (await seriesMarksFrom(tx, rule.id, after)).keys()) frozen = later(frozen, date)
	for (const exception of await seriesExceptionsFrom(tx, rule.id, after)) {
		const occurrence = occurrenceAt(open, exception.originalOn, exception)
		if (occurrence && !canChange(occurrence.startsAt, now)) frozen = later(frozen, exception.originalOn)
	}
	return frozen
}

function lastOn(rule: SeriesRule, endsOn: string | null): string | null {
	if (endsOn === null) return null
	return lastSeriesDateOnOrBefore({ ...rule, endsOn: null }, endsOn) ?? ''
}

async function setEndsOn(tx: DbExecutor, rule: SeriesRule, endsOn: string | null): Promise<InboundResult> {
	if (lastOn(rule, endsOn) === lastOn(rule, rule.endsOn)) return UNCHANGED
	await tx
		.update(lessonSeries)
		.set({ endsOn, updatedAt: sql`now()` })
		.where(eq(lessonSeries.id, rule.id))
	return APPLIED
}

async function retireTail(tx: DbExecutor, connectionId: string, seriesId: string, from: string) {
	await tx
		.update(googleEventMappings)
		.set({ state: 'retired', retiredAt: sql`now()` })
		.where(
			and(
				eq(googleEventMappings.connectionId, connectionId),
				eq(googleEventMappings.entityKind, 'occurrence'),
				eq(googleEventMappings.localEntityId, seriesId),
				eq(googleEventMappings.state, 'active'),
				gte(googleEventMappings.originalOn, from)
			)
		)
}

async function frozenTail(tx: DbExecutor, rule: SeriesRule, from: string, now: Date) {
	if ((await seriesMarksFrom(tx, rule.id, from)).size) return true
	const open = { ...rule, endsOn: null }
	return (await seriesExceptionsFrom(tx, rule.id, from)).some((exception) => {
		const occurrence = occurrenceAt(open, exception.originalOn, exception)
		return occurrence !== null && !canChange(occurrence.startsAt, now)
	})
}

async function insertSeries(tx: DbExecutor, rule: Omit<SeriesRule, 'id'>) {
	const id = randomUUID()
	await tx.insert(lessonSeries).values({ id, ...rule })
	return id
}

async function cutAt(
	tx: DbExecutor,
	connectionId: string,
	rule: SeriesRule,
	google: MasterRule,
	mapping: MappingRow,
	now: Date
): Promise<InboundResult> {
	const open = { ...rule, endsOn: null }
	const from = nextSeriesDate(open, now)
	if (!from) return UNCHANGED
	if (await frozenTail(tx, rule, from, now)) return 'skipped_marked'
	const cut = cutSeries(
		open,
		await seriesExceptionsFrom(tx, rule.id, from),
		{ from, weekday: google.weekday, startTime: google.startTime, durationMinutes: google.durationMinutes },
		{ now, defaultTimeZone: rule.timeZone }
	)
	if (cut.kind !== 'ok') return UNCHANGED
	const oldEndsOn = rule.endsOn !== null && rule.endsOn < cut.oldEndsOn ? rule.endsOn : cut.oldEndsOn
	const ended = await setEndsOn(tx, rule, oldEndsOn)
	if (google.until !== null && google.until < cut.newRule.startsOn) return ended
	const seriesId = await insertSeries(tx, { ...cut.newRule, endsOn: google.until })
	await tx
		.update(googleEventMappings)
		.set({ localEntityId: seriesId })
		.where(and(eq(googleEventMappings.id, mapping.id), eq(googleEventMappings.state, 'active')))
	await retireTail(tx, connectionId, rule.id, from)
	return APPLIED
}

async function applyMaster(
	tx: DbExecutor,
	connectionId: string,
	row: ProjectionRow,
	mapping: MappingRow,
	now: Date
): Promise<InboundResult> {
	const rule = await lockedSeries(tx, mapping.localEntityId)
	if (rule === 'locked') return 'skipped_locked'
	if (!rule) return UNCHANGED
	const frozen = await frozenThrough(tx, rule, now)
	const google = masterSeriesRule(row, rule.timeZone)
	if (!google) {
		if (rule.endsOn !== null && rule.endsOn <= frozen) return UNCHANGED
		return setEndsOn(tx, rule, frozen)
	}
	if (
		google.weekday !== rule.weekday ||
		google.startTime !== rule.startTime ||
		google.durationMinutes !== rule.durationMinutes
	)
		return cutAt(tx, connectionId, rule, google, mapping, now)
	if (google.until === null || (rule.endsOn !== null && google.until >= rule.endsOn))
		return setEndsOn(tx, rule, google.until)
	return setEndsOn(tx, rule, later(google.until, rule.endsOn !== null && rule.endsOn < frozen ? rule.endsOn : frozen))
}

async function applySplit(
	tx: DbExecutor,
	connectionId: string,
	row: ProjectionRow,
	parent: MappingRow,
	now: Date
): Promise<InboundResult> {
	const rule = await lockedSeries(tx, parent.localEntityId)
	if (rule === 'locked') return 'skipped_locked'
	if (!rule) return UNCHANGED
	const google = masterSeriesRule(row, rule.timeZone)
	if (!google) return UNCHANGED
	const candidate = { ...google, startsOn: google.startsOn, endsOn: null }
	const startsOn = nextSeriesDate(candidate, now)
	if (!startsOn || (google.until !== null && google.until < startsOn)) return UNCHANGED
	const frozen = await frozenThrough(tx, rule, now)
	const oldEndsOn = later(addDays(google.startsOn, -1), frozen)
	if (rule.endsOn === null || rule.endsOn > oldEndsOn) await setEndsOn(tx, rule, oldEndsOn)
	const seriesId = await insertSeries(tx, {
		studentId: rule.studentId,
		weekday: google.weekday,
		startTime: google.startTime,
		timeZone: rule.timeZone,
		durationMinutes: google.durationMinutes,
		startsOn,
		endsOn: google.until,
	})
	await tx.insert(googleEventMappings).values({
		accountId: parent.accountId,
		connectionId,
		calendarId: parent.calendarId,
		entityKind: 'series',
		localEntityId: seriesId,
		studentId: rule.studentId,
		eventId: row.eventId,
		representationGeneration: 0,
		commandId: parent.commandId,
		state: 'active',
	})
	await retireTail(tx, connectionId, rule.id, google.startsOn)
	return APPLIED
}

export async function applyInbound(tx: DbExecutor, item: InboundItem): Promise<InboundOutcome> {
	const [connection] = await tx
		.select()
		.from(googleConnections)
		.where(and(eq(googleConnections.id, item.connectionId), eq(googleConnections.accountId, item.accountId)))
		.for('update')
	if (!connection || connection.state !== 'connected' || connection.retiredAt !== null)
		return { result: UNCHANGED, stamp: null }
	const [row] = await tx
		.select()
		.from(googleCalendarEvents)
		.where(
			and(eq(googleCalendarEvents.connectionId, item.connectionId), eq(googleCalendarEvents.eventId, item.eventId))
		)
		.for('update')
	if (!row) return { result: UNCHANGED, stamp: null }
	const stamp = { eventId: row.eventId, etag: row.etag }
	const entity = await resolveEntity(tx, item.connectionId, row)
	if (!entity) return { result: UNCHANGED, stamp: row.markerLocalId || row.recurringEventId ? null : stamp }
	const local =
		entity.kind === 'single'
			? entity.lessonId
			: entity.kind === 'occurrence'
				? entity.seriesId
				: entity.kind === 'series'
					? entity.mapping.localEntityId
					: entity.parent.localEntityId
	const events = [row.eventId, ...(row.recurringEventId ? [row.recurringEventId] : [])]
	if (await pending(tx, item.accountId, [local, ...events])) return { result: 'skipped_pending', stamp: null }
	const result =
		entity.kind === 'single'
			? await applySingle(tx, row, entity.lessonId, item.now)
			: entity.kind === 'occurrence'
				? await applyOccurrence(tx, item.connectionId, row, entity, item.now)
				: entity.kind === 'series'
					? await applyMaster(tx, item.connectionId, row, entity.mapping, item.now)
					: await applySplit(tx, item.connectionId, row, entity.parent, item.now)
	return { result, stamp: result === APPLIED || result === UNCHANGED ? stamp : null }
}
