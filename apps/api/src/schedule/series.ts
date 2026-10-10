import { eq, sql } from 'drizzle-orm'
import type { z } from 'zod'

import type { ScheduleSeries, endSeriesRequest, moveSeriesRequest } from '@dv-lab/contracts'
import { type CutLesson, cutSeries, endSeriesAt } from '@dv-lab/core'
import { type Database, type DbExecutor, lessonMarks, lessonSeries, lessons } from '@dv-lab/db'

import type { ChangeFailure } from './changes.ts'
import { lockSeries, markOf, seriesColumns, seriesExceptionsFrom, toSeriesRule } from './rows.ts'
import { toWireSeries } from './schedule.ts'

type MoveSeriesInput = z.output<typeof moveSeriesRequest>

type EndSeriesInput = z.output<typeof endSeriesRequest>

export type SeriesResult = { kind: 'ok'; series: ScheduleSeries } | ChangeFailure

export type MoveSeriesResult = SeriesResult | { kind: 'ends_before_new_day' } | { kind: 'today_passed' }

async function keepCutLessons(executor: DbExecutor, seriesId: string, cut: readonly CutLesson[]) {
	for (const lesson of cut) {
		const [row] = await executor
			.insert(lessons)
			.values({
				studentId: lesson.studentId,
				startsAt: lesson.startsAt,
				durationMinutes: lesson.durationMinutes,
				status: 'scheduled',
			})
			.returning({ id: lessons.id })
		if (!row) throw new Error('lesson insert returned no row')
		const mark = await markOf(executor, { kind: 'series', seriesId, originalOn: lesson.originalOn })
		if (mark !== null) await executor.insert(lessonMarks).values({ lessonId: row.id, kind: mark })
	}
}

export function moveSeries(db: Database, id: string, input: MoveSeriesInput, now: Date): Promise<MoveSeriesResult> {
	return db.transaction(async (tx): Promise<MoveSeriesResult> => {
		const rule = await lockSeries(tx, id)
		if (rule === null) return { kind: 'not_found' }
		const exceptions = await seriesExceptionsFrom(tx, id, input.from)
		const result = cutSeries(rule, exceptions, input, now)
		if (result.kind !== 'ok') return { kind: result.kind }
		await tx
			.update(lessonSeries)
			.set({ endsOn: result.oldEndsOn, updatedAt: sql`now()` })
			.where(eq(lessonSeries.id, id))
		await keepCutLessons(tx, id, result.lessons)
		const [row] = await tx.insert(lessonSeries).values(result.newRule).returning(seriesColumns)
		if (!row) throw new Error('lesson series insert returned no row')
		return { kind: 'ok', series: toWireSeries(toSeriesRule(row)) }
	})
}

export function endSeries(db: Database, id: string, input: EndSeriesInput, now: Date): Promise<SeriesResult> {
	return db.transaction(async (tx): Promise<SeriesResult> => {
		const rule = await lockSeries(tx, id)
		if (rule === null) return { kind: 'not_found' }
		const exceptions = await seriesExceptionsFrom(tx, id, input.lastOn)
		const result = endSeriesAt(rule, exceptions, input.lastOn, now)
		if (result.kind !== 'ok') return { kind: result.kind }
		const [row] = await tx
			.update(lessonSeries)
			.set({ endsOn: result.endsOn, updatedAt: sql`now()` })
			.where(eq(lessonSeries.id, id))
			.returning(seriesColumns)
		if (!row) throw new Error('lesson series update returned no row')
		await keepCutLessons(tx, id, result.lessons)
		return { kind: 'ok', series: toWireSeries(toSeriesRule(row)) }
	})
}
