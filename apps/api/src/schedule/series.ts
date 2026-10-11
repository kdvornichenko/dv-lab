import { eq, sql } from 'drizzle-orm'
import type { z } from 'zod'

import type { ScheduleSeries, endSeriesRequest, moveSeriesRequest } from '@dv-lab/contracts'
import type { ValidatedCalendarCommand } from '@dv-lab/contracts'
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

import { CommandFault } from '../calendar/journal.ts'
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

export type SeriesCommand = Extract<ValidatedCalendarCommand, { operation: 'move_series' | 'end_series' }>

export async function prepareSeriesChange(executor: DbExecutor, accountId: string, input: SeriesCommand, now: Date) {
	const time = await lockTeacherTimeContext(executor, accountId, input.input.expectedDefaultTimeZone, now)
	if (!time.ok) throw new CommandFault(time.error)
	const rule = await lockSeries(executor, input.seriesId)
	if (!rule) throw new CommandFault('history_only')
	const date = input.operation === 'move_series' ? input.input.from : input.input.lastOn
	const mode = input.operation === 'move_series' ? 'from' : 'through'
	const { naturalCutoff } = seriesCutBoundary(rule, date, time.context.defaultTimeZone, mode)
	const exceptions = await seriesExceptionsFrom(executor, rule.id, naturalCutoff)
	const marks = await seriesMarksFrom(executor, rule.id, naturalCutoff)
	if (input.operation === 'move_series') {
		const result = cutSeries(rule, exceptions, input.input, time.context, marks)
		if (result.kind !== 'ok')
			throw new CommandFault(
				result.kind === 'nonexistent_local_time' ? 'nonexistent_local_time' : 'precondition_failed'
			)
		return { rule, naturalCutoff, marks, oldEndsOn: result.oldEndsOn, newRule: result.newRule, lessons: result.lessons }
	}
	const result = endSeriesAt(rule, exceptions, input.input.lastOn, time.context, marks)
	if (result.kind !== 'ok') throw new CommandFault('precondition_failed')
	return { rule, naturalCutoff, marks, oldEndsOn: result.endsOn, newRule: null, lessons: result.lessons }
}

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
