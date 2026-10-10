import { sql } from 'drizzle-orm'
import type { z } from 'zod'

import type { ScheduleMark, markLessonRequest } from '@dv-lab/contracts'
import { type LessonOutcome, countsAsLesson, lessonActions, occurrenceOutcome } from '@dv-lab/core'
import { type Database, lessonMarks } from '@dv-lab/db'

import { type ChangeFailure, lockOccurrence, stale } from './changes.ts'
import { markOf, toMarkKind, toWireMark, toWireOutcome } from './rows.ts'

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

export function markOccurrence(
	db: Database,
	seriesId: string,
	originalOn: string,
	input: MarkInput,
	now: Date
): Promise<MarkResult> {
	return db.transaction(async (tx): Promise<MarkResult> => {
		const locked = await lockOccurrence(tx, seriesId, originalOn)
		if (locked === null) return NOT_FOUND
		const { occurrence } = locked
		if (occurrence === null) return CHANGED
		const current = occurrenceOutcome(occurrence, await markOf(tx, occurrence.ref))
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
		if (!row) throw new Error('lesson mark upsert returned no row')
		const stored = toMarkKind(row.kind)
		return {
			kind: 'ok',
			mark: {
				ref: occurrence.ref,
				kind: toWireMark(stored),
				outcome: toWireOutcome(occurrenceOutcome(occurrence, stored)),
			},
		}
	})
}
