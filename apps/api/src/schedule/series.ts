import type { ValidatedCalendarCommand } from '@dv-lab/contracts'
import { cutSeries, endSeriesAt, seriesCutBoundary } from '@dv-lab/core'
import type { DbExecutor } from '@dv-lab/db'

import { CommandFault } from '../calendar/journal.ts'
import { lockTeacherTimeContext } from '../settings/settings.ts'
import { lockSeries, seriesExceptionsFrom, seriesMarksFrom } from './rows.ts'

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
