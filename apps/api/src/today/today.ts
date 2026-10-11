import type { ScheduleSeries, TodayResponse } from '@dv-lab/contracts'
import { MARK_LOOKBACK_DAYS, addDays, needsMark, paysSoonList, scheduleToday, startOfZonedDay } from '@dv-lab/core'
import type { DbExecutor } from '@dv-lab/db'

import { listCards } from '../cards/cards.ts'
import { filterHistoryBlocks } from '../schedule/rows.ts'
import { readWindow } from '../schedule/schedule.ts'
import type { TeacherTimeContext } from '../settings/settings.ts'

function uniqueSeries(...lists: ScheduleSeries[][]): ScheduleSeries[] {
	const byId = new Map<string, ScheduleSeries>()
	for (const list of lists) for (const series of list) byId.set(series.id, series)
	return [...byId.values()]
}

export async function readToday(
	executor: DbExecutor,
	context: TeacherTimeContext & { accountId: string },
	paysSoonLessons: number
): Promise<TodayResponse> {
	const { now, defaultTimeZone } = context
	const date = scheduleToday(now, defaultTimeZone)
	const dayStart = startOfZonedDay(date, defaultTimeZone)
	const day = await readWindow(executor, dayStart, startOfZonedDay(addDays(date, 1), defaultTimeZone), context)
	const past = await readWindow(
		executor,
		startOfZonedDay(addDays(date, -MARK_LOOKBACK_DAYS), defaultTimeZone),
		dayStart,
		context
	)
	const history = await filterHistoryBlocks(executor, context.accountId, [...day.blocks, ...past.blocks])
	const allowed = new Set(history.map((block) => block.key))
	const lessons = day.blocks.filter((block) => allowed.has(block.key))
	const daySeries = new Set(lessons.flatMap((block) => (block.ref.kind === 'series' ? [block.ref.seriesId] : [])))
	const earlier = past.blocks
		.filter((block) => allowed.has(block.key))
		.filter((block) =>
			needsMark(
				{ outcome: block.outcome, startsAt: new Date(block.startsAt) },
				{ status: block.studentStatus, openingOn: block.ledger.openingOn },
				now,
				defaultTimeZone
			)
		)
	const earlierSeries = new Set(earlier.flatMap((block) => (block.ref.kind === 'series' ? [block.ref.seriesId] : [])))
	const cards = await listCards(executor, context)
	return {
		date,
		defaultTimeZone,
		asOf: now.toISOString(),
		lessons,
		earlier,
		series: uniqueSeries(
			day.series.filter((series) => daySeries.has(series.id)),
			past.series.filter((series) => earlierSeries.has(series.id))
		),
		paysSoon: paysSoonList(cards.students, paysSoonLessons),
		paysSoonLessons,
	}
}
