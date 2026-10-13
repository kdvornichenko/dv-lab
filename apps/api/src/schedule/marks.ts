import { and, eq, sql } from 'drizzle-orm'
import type { z } from 'zod'

import type { ScheduleMark, markLessonRequest } from '@dv-lab/contracts'
import {
	type LessonOutcome,
	type Occurrence,
	type OccurrenceRef,
	countsAsLesson,
	lessonActions,
	occurrenceOutcome,
	occurrenceKey,
} from '@dv-lab/core'
import { type Database, type DbExecutor, lessonMarks } from '@dv-lab/db'

import { historyEligibility, lockHistoryConnection } from '../calendar/history.ts'
import { type ChangeFailure, lockOccurrence, stale } from './changes.ts'
import { lockLesson, markOf, toMarkKind, toWireMark, toWireOutcome } from './rows.ts'

type MarkInput = z.output<typeof markLessonRequest>

type MarkResult = { kind: 'ok'; mark: ScheduleMark } | ChangeFailure

const NOT_FOUND = { kind: 'not_found' } as const

const CHANGED = { kind: 'changed' } as const

const NOT_STARTED = { kind: 'not_started' } as const

function markRefusal(outcome: LessonOutcome, startsAt: Date, expected: string | undefined, now: Date) {
	if (stale(expected, startsAt)) return CHANGED
	if (lessonActions(outcome, startsAt, now).mark) return null
	return countsAsLesson(outcome) ? NOT_STARTED : CHANGED
}

function savedMark(ref: OccurrenceRef, subject: Pick<Occurrence, 'status'>, row: { kind: string } | undefined) {
	if (!row) throw new Error('lesson mark upsert returned no row')
	const stored = toMarkKind(row.kind)
	return {
		kind: 'ok',
		mark: { ref, kind: toWireMark(stored), outcome: toWireOutcome(occurrenceOutcome(subject, stored)) },
	} satisfies MarkResult
}

export async function settleMarkAfterMove(executor: DbExecutor, ref: OccurrenceRef): Promise<void> {
	const key =
		ref.kind === 'series'
			? and(eq(lessonMarks.seriesId, ref.seriesId), eq(lessonMarks.originalOn, ref.originalOn))
			: eq(lessonMarks.lessonId, ref.lessonId)
	await executor
		.update(lessonMarks)
		.set({ kind: 'none', updatedAt: sql`now()` })
		.where(and(key, eq(lessonMarks.kind, 'no_show')))
}

export function markOccurrence(
	db: Database,
	accountId: string,
	seriesId: string,
	originalOn: string,
	input: MarkInput,
	now: Date
): Promise<MarkResult> {
	return db.transaction(async (tx): Promise<MarkResult> => {
		await lockHistoryConnection(tx, accountId)
		const locked = await lockOccurrence(tx, seriesId, originalOn)
		if (locked === null) return NOT_FOUND
		const { occurrence } = locked
		if (occurrence === null) return CHANGED
		const mark = await markOf(tx, occurrence.ref)
		const eligible = await historyEligibility(tx, accountId, [{ ...occurrence, mark }], 'write')
		if (!eligible.has(occurrenceKey(occurrence.ref))) return CHANGED
		const current = occurrenceOutcome(occurrence, mark)
		const refused = markRefusal(current, occurrence.startsAt, input.expectedStartsAt, now)
		if (refused !== null) return refused
		const kind = toMarkKind(input.kind)
		const [row] = await tx
			.insert(lessonMarks)
			.values({ seriesId, originalOn, kind })
			.onConflictDoUpdate({
				target: [lessonMarks.seriesId, lessonMarks.originalOn],
				set: { kind, updatedAt: sql`now()` },
			})
			.returning({ kind: lessonMarks.kind })
		return savedMark(occurrence.ref, occurrence, row)
	})
}

export function markLesson(
	db: Database,
	accountId: string,
	id: string,
	input: MarkInput,
	now: Date
): Promise<MarkResult> {
	return db.transaction(async (tx): Promise<MarkResult> => {
		await lockHistoryConnection(tx, accountId)
		const lesson = await lockLesson(tx, id)
		if (lesson === null) return NOT_FOUND
		const ref: OccurrenceRef = { kind: 'single', lessonId: id }
		const mark = await markOf(tx, ref)
		const eligible = await historyEligibility(tx, accountId, [{ ...lesson, ref, mark }], 'write')
		if (!eligible.has(occurrenceKey(ref))) return CHANGED
		const current = occurrenceOutcome(lesson, mark)
		const refused = markRefusal(current, lesson.startsAt, input.expectedStartsAt, now)
		if (refused !== null) return refused
		const kind = toMarkKind(input.kind)
		const [row] = await tx
			.insert(lessonMarks)
			.values({ lessonId: id, kind })
			.onConflictDoUpdate({ target: lessonMarks.lessonId, set: { kind, updatedAt: sql`now()` } })
			.returning({ kind: lessonMarks.kind })
		return savedMark(ref, lesson, row)
	})
}
