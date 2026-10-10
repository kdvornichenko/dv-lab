import { eq, sql } from 'drizzle-orm'
import type { z } from 'zod'

import type { ScheduleSeries, endSeriesRequest, moveSeriesRequest } from '@dv-lab/contracts'
import { cutSeries, endSeriesAt } from '@dv-lab/core'
import { type Database, lessonSeries, lessons } from '@dv-lab/db'

import type { ChangeFailure } from './changes.ts'
import { lockSeries, seriesColumns, seriesExceptionsFrom, toSeriesRule } from './rows.ts'
import { toWireSeries } from './schedule.ts'

type MoveSeriesInput = z.output<typeof moveSeriesRequest>

type EndSeriesInput = z.output<typeof endSeriesRequest>

export type SeriesResult = { kind: 'ok'; series: ScheduleSeries } | ChangeFailure

export type MoveSeriesResult = SeriesResult | { kind: 'ends_before_new_day' } | { kind: 'today_passed' }

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
		if (result.lessons.length > 0) {
			await tx.insert(lessons).values(result.lessons.map((lesson) => ({ ...lesson, status: 'scheduled' })))
		}
		const [row] = await tx.insert(lessonSeries).values(result.newRule).returning(seriesColumns)
		if (!row) throw new Error('lesson series insert returned no row')
		return { kind: 'ok', series: toWireSeries(toSeriesRule(row)) }
	})
}

export function endSeries(db: Database, id: string, input: EndSeriesInput, now: Date): Promise<SeriesResult> {
	return db.transaction(async (tx): Promise<SeriesResult> => {
		const rule = await lockSeries(tx, id)
		if (rule === null) return { kind: 'not_found' }
		const result = endSeriesAt(rule, input.lastOn, now)
		if (result.kind !== 'ok') return { kind: result.kind }
		const [row] = await tx
			.update(lessonSeries)
			.set({ endsOn: result.endsOn, updatedAt: sql`now()` })
			.where(eq(lessonSeries.id, id))
			.returning(seriesColumns)
		if (!row) throw new Error('lesson series update returned no row')
		return { kind: 'ok', series: toWireSeries(toSeriesRule(row)) }
	})
}
