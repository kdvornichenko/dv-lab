import { eq, sql } from 'drizzle-orm'
import type { z } from 'zod'

import type { ScheduleLesson, lessonActionRequest, moveLessonRequest } from '@dv-lab/contracts'
import {
	type LessonOutcome,
	type MarkKind,
	type Occurrence,
	type SeriesRule,
	lessonActions,
	occurrenceAt,
	occurrenceOutcome,
	localTimeCandidates,
	canChange,
} from '@dv-lab/core'
import { type DbExecutor, lessons } from '@dv-lab/db'

import { lockTeacherTimeContext } from '../settings/settings.ts'
import { lessonColumns, lockLesson, lockSeries, markOf, seriesException, toSingleLesson } from './rows.ts'
import { toWireLesson } from './schedule.ts'

type MoveInput = z.output<typeof moveLessonRequest>

type ActionInput = z.output<typeof lessonActionRequest>

export type ChangeFailure =
	| { kind: 'not_found' }
	| { kind: 'changed' }
	| { kind: 'invalid' }
	| { kind: 'not_started' }
	| { kind: 'default_time_zone_changed' }
	| { kind: 'nonexistent_local_time' }

export type LessonResult = { kind: 'ok'; lesson: ScheduleLesson } | ChangeFailure

const NOT_FOUND = { kind: 'not_found' } as const

const CHANGED = { kind: 'changed' } as const

const INVALID = { kind: 'invalid' } as const

export function stale(expected: string | undefined, startsAt: Date): boolean {
	return expected !== undefined && new Date(expected).getTime() !== startsAt.getTime()
}

type LessonChange = 'move' | 'cancel' | 'restore'

function refusal(
	change: LessonChange,
	outcome: LessonOutcome,
	startsAt: Date,
	expected: string | undefined,
	now: Date
): ChangeFailure | null {
	if (stale(expected, startsAt)) return CHANGED
	return lessonActions(outcome, startsAt, now)[change] ? null : CHANGED
}

export function clearsMark(change: LessonChange, mark: MarkKind | null, target: Date, now: Date): boolean {
	return change === 'move' && mark === 'no_show' && canChange(target, now)
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

export async function applyLessonChange(
	executor: DbExecutor,
	id: string,
	set: { startsAt: Date; durationMinutes?: number } | { status: 'scheduled' | 'cancelled' }
): Promise<LessonResult> {
	const [row] = await executor
		.update(lessons)
		.set({ ...set, updatedAt: sql`now()` })
		.where(eq(lessons.id, id))
		.returning(lessonColumns)
	if (!row) throw new Error('lesson update returned no row')
	return { kind: 'ok', lesson: toWireLesson(toSingleLesson(row)) }
}

export async function prepareLessonChange(
	executor: DbExecutor,
	accountId: string,
	id: string,
	change: LessonChange,
	input: MoveInput | ActionInput,
	now: Date
) {
	const lesson = await lockLesson(executor, id)
	if (!lesson) return NOT_FOUND
	const mark = await markOf(executor, { kind: 'single', lessonId: lesson.id })
	if (mark === 'done') return { kind: 'lesson_done' as const }
	const outcome = occurrenceOutcome(lesson, mark)
	const refused = refusal(change, outcome, lesson.startsAt, input.expectedStartsAt, now)
	if (refused) return refused
	let startsAt = lesson.startsAt
	let durationMinutes = lesson.durationMinutes
	if (change === 'move' && 'date' in input) {
		const time = await lockTeacherTimeContext(executor, accountId, input.expectedDefaultTimeZone, now)
		if (!time.ok) return { kind: time.error }
		const target = localTimeCandidates(input.date, input.startTime, time.context.defaultTimeZone)[0]
		if (!target) return { kind: 'nonexistent_local_time' as const }
		const length = input.durationMinutes ?? lesson.durationMinutes
		if (target.getTime() === startsAt.getTime() && length === lesson.durationMinutes) return INVALID
		startsAt = target
		durationMinutes = length
	}
	return {
		kind: 'ok' as const,
		lesson,
		startsAt,
		durationMinutes,
		clearMark: clearsMark(change, mark, startsAt, now),
	}
}
