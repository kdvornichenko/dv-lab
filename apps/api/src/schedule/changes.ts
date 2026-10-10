import { eq, sql } from 'drizzle-orm'
import type { z } from 'zod'

import type { ScheduleLesson, ScheduleOccurrence, lessonActionRequest, moveLessonRequest } from '@dv-lab/contracts'
import {
	type MarkKind,
	type Occurrence,
	SCHEDULE_TIME_ZONE,
	type SeriesException,
	type SeriesRule,
	canChange,
	movedAway,
	occurrenceAt,
	occurrenceOutcome,
	scheduleToday,
	zonedInstant,
} from '@dv-lab/core'
import { type Database, type DbExecutor, lessonExceptions, lessons } from '@dv-lab/db'

import {
	exceptionColumns,
	lessonColumns,
	lockLesson,
	lockSeries,
	markOf,
	seriesException,
	toSeriesException,
	toSingleLesson,
	toWireOutcome,
} from './rows.ts'
import { toWireLesson } from './schedule.ts'

type MoveInput = z.output<typeof moveLessonRequest>

type ActionInput = z.output<typeof lessonActionRequest>

export type ChangeFailure =
	| { kind: 'not_found' }
	| { kind: 'changed' }
	| { kind: 'invalid' }
	| { kind: 'in_past' }
	| { kind: 'target_in_past' }
	| { kind: 'not_started' }

export type OccurrenceResult = { kind: 'ok'; occurrence: ScheduleOccurrence } | ChangeFailure

export type LessonResult = { kind: 'ok'; lesson: ScheduleLesson } | ChangeFailure

const NOT_FOUND = { kind: 'not_found' } as const

const CHANGED = { kind: 'changed' } as const

const INVALID = { kind: 'invalid' } as const

const IN_PAST = { kind: 'in_past' } as const

const TARGET_IN_PAST = { kind: 'target_in_past' } as const

export function stale(expected: string | undefined, startsAt: Date): boolean {
	return expected !== undefined && new Date(expected).getTime() !== startsAt.getTime()
}

function refusal(allowed: boolean, startsAt: Date, expected: string | undefined, now: Date): ChangeFailure | null {
	if (!allowed || stale(expected, startsAt)) return CHANGED
	return canChange(startsAt, now) ? null : IN_PAST
}

function moveTarget(input: MoveInput, now: Date): Date | null {
	if (input.date < scheduleToday(now)) return null
	const target = zonedInstant(input.date, input.startTime, SCHEDULE_TIME_ZONE)
	return canChange(target, now) ? target : null
}

type LockedOccurrence = { rule: SeriesRule; occurrence: Occurrence | null }

export async function lockOccurrence(
	executor: DbExecutor,
	seriesId: string,
	originalOn: string
): Promise<LockedOccurrence | null> {
	const rule = await lockSeries(executor, seriesId)
	if (rule === null) return null
	const exception = await seriesException(executor, seriesId, originalOn)
	return { rule, occurrence: occurrenceAt(rule, originalOn, exception ?? undefined) }
}

async function markException(
	executor: DbExecutor,
	rule: SeriesRule,
	exception: SeriesException,
	mark: MarkKind | null
) {
	const time =
		exception.kind === 'restored'
			? { startsAt: null, durationMinutes: null }
			: { startsAt: exception.startsAt ?? null, durationMinutes: exception.durationMinutes ?? null }
	const [row] = await executor
		.insert(lessonExceptions)
		.values({ seriesId: exception.seriesId, originalOn: exception.originalOn, kind: exception.kind, ...time })
		.onConflictDoUpdate({
			target: [lessonExceptions.seriesId, lessonExceptions.originalOn],
			set: { kind: exception.kind, ...time, updatedAt: sql`now()` },
		})
		.returning(exceptionColumns)
	if (!row) throw new Error('lesson exception upsert returned no row')
	const occurrence = occurrenceAt(rule, exception.originalOn, toSeriesException(row))
	if (occurrence === null) throw new Error('changed occurrence is outside its series')
	return {
		kind: 'ok',
		occurrence: {
			seriesId: rule.id,
			originalOn: exception.originalOn,
			status: occurrence.status,
			outcome: toWireOutcome(occurrenceOutcome(occurrence, mark)),
			startsAt: occurrence.startsAt.toISOString(),
		},
	} satisfies OccurrenceResult
}

export function moveOccurrence(
	db: Database,
	seriesId: string,
	originalOn: string,
	input: MoveInput,
	now: Date
): Promise<OccurrenceResult> {
	return db.transaction(async (tx): Promise<OccurrenceResult> => {
		const locked = await lockOccurrence(tx, seriesId, originalOn)
		if (locked === null) return NOT_FOUND
		const { rule, occurrence } = locked
		if (occurrence === null) return CHANGED
		const refused = refusal(occurrence.status !== 'cancelled', occurrence.startsAt, input.expectedStartsAt, now)
		if (refused !== null) return refused
		const target = moveTarget(input, now)
		if (target === null) return TARGET_IN_PAST
		if (target.getTime() === occurrence.startsAt.getTime()) return INVALID
		const exception: SeriesException =
			target.getTime() === occurrence.naturalStart.getTime()
				? { seriesId, originalOn, kind: 'restored' }
				: { seriesId, originalOn, kind: 'moved', startsAt: target, durationMinutes: occurrence.durationMinutes }
		return markException(tx, rule, exception, await markOf(tx, occurrence.ref))
	})
}

export function cancelOccurrence(
	db: Database,
	seriesId: string,
	originalOn: string,
	input: ActionInput,
	now: Date
): Promise<OccurrenceResult> {
	return db.transaction(async (tx): Promise<OccurrenceResult> => {
		const locked = await lockOccurrence(tx, seriesId, originalOn)
		if (locked === null) return NOT_FOUND
		const { rule, occurrence } = locked
		if (occurrence === null) return CHANGED
		const refused = refusal(occurrence.status !== 'cancelled', occurrence.startsAt, input.expectedStartsAt, now)
		if (refused !== null) return refused
		const exception: SeriesException = movedAway(occurrence)
			? {
					seriesId,
					originalOn,
					kind: 'cancelled',
					startsAt: occurrence.startsAt,
					durationMinutes: occurrence.durationMinutes,
				}
			: { seriesId, originalOn, kind: 'cancelled' }
		return markException(tx, rule, exception, await markOf(tx, occurrence.ref))
	})
}

export function restoreOccurrence(
	db: Database,
	seriesId: string,
	originalOn: string,
	input: ActionInput,
	now: Date
): Promise<OccurrenceResult> {
	return db.transaction(async (tx): Promise<OccurrenceResult> => {
		const locked = await lockOccurrence(tx, seriesId, originalOn)
		if (locked === null) return NOT_FOUND
		const { rule, occurrence } = locked
		if (occurrence === null) return CHANGED
		const refused = refusal(occurrence.status === 'cancelled', occurrence.startsAt, input.expectedStartsAt, now)
		if (refused !== null) return refused
		const exception: SeriesException = movedAway(occurrence)
			? {
					seriesId,
					originalOn,
					kind: 'moved',
					startsAt: occurrence.startsAt,
					durationMinutes: occurrence.durationMinutes,
				}
			: { seriesId, originalOn, kind: 'restored' }
		return markException(tx, rule, exception, await markOf(tx, occurrence.ref))
	})
}

async function saveLesson(
	executor: DbExecutor,
	id: string,
	set: { startsAt: Date } | { status: 'scheduled' | 'cancelled' }
): Promise<LessonResult> {
	const [row] = await executor
		.update(lessons)
		.set({ ...set, updatedAt: sql`now()` })
		.where(eq(lessons.id, id))
		.returning(lessonColumns)
	if (!row) throw new Error('lesson update returned no row')
	return { kind: 'ok', lesson: toWireLesson(toSingleLesson(row)) }
}

export function moveLesson(db: Database, id: string, input: MoveInput, now: Date): Promise<LessonResult> {
	return db.transaction(async (tx): Promise<LessonResult> => {
		const lesson = await lockLesson(tx, id)
		if (lesson === null) return NOT_FOUND
		const refused = refusal(lesson.status !== 'cancelled', lesson.startsAt, input.expectedStartsAt, now)
		if (refused !== null) return refused
		const target = moveTarget(input, now)
		if (target === null) return TARGET_IN_PAST
		if (target.getTime() === lesson.startsAt.getTime()) return INVALID
		return saveLesson(tx, id, { startsAt: target })
	})
}

export function cancelLesson(db: Database, id: string, input: ActionInput, now: Date): Promise<LessonResult> {
	return db.transaction(async (tx): Promise<LessonResult> => {
		const lesson = await lockLesson(tx, id)
		if (lesson === null) return NOT_FOUND
		const refused = refusal(lesson.status === 'scheduled', lesson.startsAt, input.expectedStartsAt, now)
		if (refused !== null) return refused
		return saveLesson(tx, id, { status: 'cancelled' })
	})
}

export function restoreLesson(db: Database, id: string, input: ActionInput, now: Date): Promise<LessonResult> {
	return db.transaction(async (tx): Promise<LessonResult> => {
		const lesson = await lockLesson(tx, id)
		if (lesson === null) return NOT_FOUND
		const refused = refusal(lesson.status === 'cancelled', lesson.startsAt, input.expectedStartsAt, now)
		if (refused !== null) return refused
		return saveLesson(tx, id, { status: 'scheduled' })
	})
}
