import type { ValidatedCalendarCommand } from '@dv-lab/contracts'
import {
	addDays,
	cutSeries,
	endSeriesAt,
	scheduleDate,
	seriesAllFrom,
	seriesCutBoundary,
	seriesStart,
	startOfZonedDay,
	type SeriesRule,
} from '@dv-lab/core'
import type { DbExecutor } from '@dv-lab/db'

import { CommandFault } from '../calendar/journal.ts'
import { insideSyncWindow, syncFacts } from '../calendar/projection.ts'
import { lockTeacherTimeContext } from '../settings/settings.ts'
import { heldSeriesDates, lockSeries, seriesExceptionsFrom, seriesMarksFrom } from './rows.ts'

export type SeriesCommand = Extract<ValidatedCalendarCommand, { operation: 'move_series' | 'end_series' }>

export async function seriesAnchor(
	executor: DbExecutor,
	rule: SeriesRule,
	connectionId: string | null
): Promise<string | null> {
	const held = await heldSeriesDates(executor, rule.id)
	const sync = connectionId === null ? null : await syncFacts(executor, connectionId)
	if (!sync) return seriesAllFrom(rule, held, rule.startsOn)
	const anchor = seriesAllFrom(rule, held, scheduleDate(sync.windowStart, rule.timeZone))
	const start = anchor === null ? null : seriesStart(rule, anchor)
	if (anchor === null || start === null || start.getTime() >= sync.windowStart.getTime()) return anchor
	return seriesAllFrom(rule, held, addDays(anchor, 1))
}

async function checkSeriesFrom(executor: DbExecutor, rule: SeriesRule, from: string, connectionId: string | null) {
	const anchor = await seriesAnchor(executor, rule, connectionId)
	if (anchor !== null && from >= anchor) return
	const sync = connectionId === null ? null : await syncFacts(executor, connectionId)
	const start = seriesStart(rule, from) ?? startOfZonedDay(from, rule.timeZone)
	throw new CommandFault(insideSyncWindow(sync, start, start) ? 'precondition_failed' : 'outside_sync_window')
}

export async function prepareSeriesChange(
	executor: DbExecutor,
	accountId: string,
	input: SeriesCommand,
	now: Date,
	connectionId: string | null = null
) {
	const time = await lockTeacherTimeContext(executor, accountId, input.input.expectedDefaultTimeZone, now)
	if (!time.ok) throw new CommandFault(time.error)
	const rule = await lockSeries(executor, input.seriesId)
	if (!rule) throw new CommandFault('history_only')
	if (input.operation === 'move_series') await checkSeriesFrom(executor, rule, input.input.from, connectionId)
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
