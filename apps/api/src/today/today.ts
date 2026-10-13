import type { ScheduleSeries, TodayResponse } from '@dv-lab/contracts'
import {
	MARK_LOOKBACK_DAYS,
	addDays,
	lessonDay,
	mondayOf,
	needsMark,
	paysSoonList,
	scheduleWeekRange,
	startOfLessonDay,
	startOfZonedDay,
} from '@dv-lab/core'
import type { DbExecutor } from '@dv-lab/db'

import { readCalendarWindow } from '../calendar/read-model.ts'
import type { CalendarReadSelection } from '../calendar/read-state.ts'
import type { CardReadContext } from '../cards/card-facts.ts'
import { listCards } from '../cards/cards.ts'
import { filterHistoryBlocks } from '../schedule/rows.ts'
import { readWindow } from '../schedule/schedule.ts'
import type { TeacherTimeContext } from '../settings/settings.ts'
import { calendarLessons } from './calendar-lessons.ts'

export function todayWindow(context: TeacherTimeContext): Extract<CalendarReadSelection, { kind: 'window' }> {
	const date = lessonDay(context.now, context.defaultTimeZone)
	return {
		kind: 'window',
		...scheduleWeekRange(mondayOf(date), context.defaultTimeZone),
		displayTimeZone: context.defaultTimeZone,
	}
}

function uniqueSeries(...lists: ScheduleSeries[][]): ScheduleSeries[] {
	const byId = new Map<string, ScheduleSeries>()
	for (const list of lists) for (const series of list) byId.set(series.id, series)
	return [...byId.values()]
}

export async function readToday(
	executor: DbExecutor,
	context: CardReadContext,
	paysSoonLessons: number
): Promise<TodayResponse> {
	const { now, defaultTimeZone } = context
	const date = lessonDay(now, defaultTimeZone)
	const dayStart = startOfLessonDay(date, defaultTimeZone)
	const dayEnd = startOfLessonDay(addDays(date, 1), defaultTimeZone)
	const calendar = await readCalendarWindow(executor, context, todayWindow(context))
	const upcoming = await calendarLessons(executor, calendar.events, now, dayEnd)
	const day = await readWindow(executor, dayStart, new Date(now.getTime() + 1), context)
	const past = await readWindow(
		executor,
		startOfZonedDay(addDays(date, -MARK_LOOKBACK_DAYS), defaultTimeZone),
		dayStart,
		context
	)
	const history = await filterHistoryBlocks(executor, context.accountId, [...day.blocks, ...past.blocks])
	const allowed = new Set(history.map((block) => block.key))
	const lessons = [...day.blocks.filter((block) => allowed.has(block.key)), ...upcoming].sort((left, right) =>
		left.startsAt.localeCompare(right.startsAt)
	)
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
		calendarRead: calendar.read,
		calendarWrite: calendar.write,
		lessons,
		earlier,
		series: uniqueSeries(
			day.series.filter((series) => daySeries.has(series.id)),
			past.series.filter((series) => earlierSeries.has(series.id)),
			calendar.series.map((item) => item.series).filter((series) => daySeries.has(series.id))
		),
		paysSoon: paysSoonList(cards.students, paysSoonLessons),
		paysSoonLessons,
	}
}
