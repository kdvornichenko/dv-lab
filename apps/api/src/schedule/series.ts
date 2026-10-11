import { eq, sql } from 'drizzle-orm'
import type { z } from 'zod'

import type { ScheduleSeries, endSeriesRequest, moveSeriesRequest } from '@dv-lab/contracts'
import {
	type CutLesson,
	type MarkKind,
	type SeriesRule,
	cutSeries,
	endSeriesAt,
	nextSeriesReference,
	seriesCutBoundary,
} from '@dv-lab/core'
import { type Database, type DbExecutor, lessonMarks, lessonSeries, lessons } from '@dv-lab/db'

import { lockTeacherTimeContext } from '../settings/settings.ts'
import type { ChangeFailure } from './changes.ts'
import {
	lockSeries,
	seriesColumns,
	seriesExceptionsFrom,
	seriesMarksFrom,
	seriesReferenceExceptions,
	toSeriesRule,
} from './rows.ts'
import { toWireSeries } from './schedule.ts'

type MoveSeriesInput = z.output<typeof moveSeriesRequest>

type EndSeriesInput = z.output<typeof endSeriesRequest>

export type SeriesResult = { kind: 'ok'; series: ScheduleSeries } | ChangeFailure

export type MoveSeriesResult = SeriesResult | { kind: 'ends_before_new_day' } | { kind: 'today_passed' }

async function keepCutLessons(executor: DbExecutor, cut: readonly CutLesson[], marks: ReadonlyMap<string, MarkKind>) {
	for (const lesson of cut) {
		const [row] = await executor
			.insert(lessons)
			.values({
				studentId: lesson.studentId,
				startsAt: lesson.startsAt,
				timeZone: lesson.timeZone,
				durationMinutes: lesson.durationMinutes,
				status: lesson.status ?? 'scheduled',
			})
			.returning({ id: lessons.id })
		if (!row) throw new Error('lesson insert returned no row')
		const mark = marks.get(lesson.originalOn)
		if (mark !== undefined) await executor.insert(lessonMarks).values({ lessonId: row.id, kind: mark })
	}
}

async function wireSeries(executor: DbExecutor, rule: SeriesRule, now: Date): Promise<ScheduleSeries> {
	const exceptions = await seriesReferenceExceptions(executor, [rule.id])
	return toWireSeries(rule, nextSeriesReference({ rule, exceptions, now }))
}

export function moveSeries(
	db: Database,
	accountId: string,
	id: string,
	input: MoveSeriesInput,
	now = new Date()
): Promise<MoveSeriesResult> {
	return db.transaction(async (tx): Promise<MoveSeriesResult> => {
		const time = await lockTeacherTimeContext(tx, accountId, input.expectedDefaultTimeZone, now)
		if (!time.ok) return { kind: time.error }
		const rule = await lockSeries(tx, id)
		if (rule === null) return { kind: 'not_found' }
		const { naturalCutoff } = seriesCutBoundary(rule, input.from, time.context.defaultTimeZone, 'from')
		const exceptions = await seriesExceptionsFrom(tx, id, naturalCutoff)
		const marks = await seriesMarksFrom(tx, id, naturalCutoff)
		const result = cutSeries(rule, exceptions, input, time.context, marks)
		if (result.kind !== 'ok') return { kind: result.kind }
		await tx
			.update(lessonSeries)
			.set({ endsOn: result.oldEndsOn, updatedAt: sql`now()` })
			.where(eq(lessonSeries.id, id))
		await keepCutLessons(tx, result.lessons, marks)
		const [row] = await tx.insert(lessonSeries).values(result.newRule).returning(seriesColumns)
		if (!row) throw new Error('lesson series insert returned no row')
		return { kind: 'ok', series: await wireSeries(tx, toSeriesRule(row), time.context.now) }
	})
}

export function endSeries(
	db: Database,
	accountId: string,
	id: string,
	input: EndSeriesInput,
	now = new Date()
): Promise<SeriesResult> {
	return db.transaction(async (tx): Promise<SeriesResult> => {
		const time = await lockTeacherTimeContext(tx, accountId, input.expectedDefaultTimeZone, now)
		if (!time.ok) return { kind: time.error }
		const rule = await lockSeries(tx, id)
		if (rule === null) return { kind: 'not_found' }
		const { naturalCutoff } = seriesCutBoundary(rule, input.lastOn, time.context.defaultTimeZone, 'through')
		const exceptions = await seriesExceptionsFrom(tx, id, naturalCutoff)
		const marks = await seriesMarksFrom(tx, id, naturalCutoff)
		const result = endSeriesAt(rule, exceptions, input.lastOn, time.context, marks)
		if (result.kind !== 'ok') return { kind: result.kind }
		const [row] = await tx
			.update(lessonSeries)
			.set({ endsOn: result.endsOn, updatedAt: sql`now()` })
			.where(eq(lessonSeries.id, id))
			.returning(seriesColumns)
		if (!row) throw new Error('lesson series update returned no row')
		await keepCutLessons(tx, result.lessons, marks)
		return { kind: 'ok', series: await wireSeries(tx, toSeriesRule(row), time.context.now) }
	})
}
