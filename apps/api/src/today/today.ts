import type { ScheduleSeries, TodayResponse } from '@dv-lab/contracts'
import {
	MARK_LOOKBACK_DAYS,
	SCHEDULE_TIME_ZONE,
	addDays,
	needsMark,
	paysSoonList,
	scheduleToday,
	zonedInstant,
} from '@dv-lab/core'
import type { DbExecutor } from '@dv-lab/db'

import { listCards } from '../cards/cards.ts'
import { readWindow } from '../schedule/schedule.ts'
import { readPaysSoonLessons } from '../settings/settings.ts'

const midnight = (date: string) => zonedInstant(date, '00:00', SCHEDULE_TIME_ZONE)

function uniqueSeries(...lists: ScheduleSeries[][]): ScheduleSeries[] {
	const byId = new Map<string, ScheduleSeries>()
	for (const list of lists) for (const series of list) byId.set(series.id, series)
	return [...byId.values()]
}

export async function readToday(executor: DbExecutor, accountId: string, now: Date): Promise<TodayResponse> {
	const date = scheduleToday(now)
	const dayStart = midnight(date)
	const day = await readWindow(executor, dayStart, midnight(addDays(date, 1)), now)
	const past = await readWindow(executor, midnight(addDays(date, -MARK_LOOKBACK_DAYS)), dayStart, now)
	const earlier = past.blocks.filter((block) =>
		needsMark(
			{ outcome: block.outcome, startsAt: new Date(block.startsAt) },
			{ status: block.studentStatus, openingOn: block.ledger.openingOn },
			now
		)
	)
	const earlierSeries = new Set(earlier.flatMap((block) => (block.ref.kind === 'series' ? [block.ref.seriesId] : [])))
	const paysSoonLessons = await readPaysSoonLessons(executor, accountId)
	const cards = await listCards(executor)
	return {
		date,
		lessons: day.blocks,
		earlier,
		series: uniqueSeries(
			day.series,
			past.series.filter((series) => earlierSeries.has(series.id))
		),
		paysSoon: paysSoonList(cards.students, paysSoonLessons),
		paysSoonLessons,
	}
}
