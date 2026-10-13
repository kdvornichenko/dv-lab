import { formatDate, mainRange, secondWhen, weekdayName } from '@/lib/schedule-format'
import { sameTimeZone } from '@/lib/time-zones'

import type { ScheduleSeries, ScheduleWeekday } from '@dv-lab/contracts'
import { cutSeries, firstOnOrAfter, scheduleDate, seriesStart } from '@dv-lab/core'

import { gapMessage, localTimeInput } from './schedule-form-context'

interface Draft {
	rule: ScheduleSeries
	from: string
	weekday: ScheduleWeekday | null
	time: string | null
	durationMinutes: number
	now: Date
	currentYear: number
	serverEnds: boolean
	serverStarted: boolean
	secondZone: string | null
	mainTimeZone: string
	asOf: string
	serverGap: boolean
}

export function seriesDateInZone(rule: ScheduleSeries, date: string, mainTimeZone: string): string | null {
	const instant = seriesStart(rule, date)
	return instant === null ? null : scheduleDate(instant, mainTimeZone)
}

export function seriesPreview(draft: Draft) {
	const {
		rule,
		from,
		weekday,
		time,
		durationMinutes,
		now,
		currentYear,
		serverStarted,
		secondZone,
		mainTimeZone,
		serverGap,
	} = draft
	const cut =
		from !== '' && weekday !== null && time !== null
			? cutSeries(
					rule,
					[],
					{ from, weekday, startTime: time, ...(durationMinutes !== rule.durationMinutes ? { durationMinutes } : {}) },
					{ now, defaultTimeZone: mainTimeZone }
				)
			: null
	const date = from === '' || weekday === null ? '' : firstOnOrAfter(from, weekday)
	const input = localTimeInput(cut?.kind === 'ok' ? cut.newRule.startsOn : date, time, draft)
	const rowError = seriesError(draft, cut)
	const startedToday = cut?.kind === 'today_passed' || serverStarted
	const errors = {
		from:
			from === ''
				? 'Choose a date.'
				: startedToday
					? "Today's lesson has already started. Choose a later date."
					: undefined,
		day: weekday === null ? 'Choose a day.' : undefined,
		time: time === null ? 'Choose a start time.' : serverGap ? gapMessage(mainTimeZone) : input.error,
	}
	const preview =
		cut?.kind === 'ok' && input.instant !== null
			? `${formatDate(cut.newRule.startsOn, currentYear)}, ${mainRange(input.instant, durationMinutes, mainTimeZone, null)}`
			: null
	const zoneLine = input.instant === null ? null : secondWhen(input.instant, mainTimeZone, secondZone)
	return { errors, rowError, startedToday, preview, zoneLine, input }
}

function seriesError(draft: Draft, cut: ReturnType<typeof cutSeries> | null): string | undefined {
	const { rule, weekday, time, durationMinutes, currentYear, serverEnds, mainTimeZone } = draft
	const endsText = () => {
		const date = rule.endsOn === null ? null : seriesDateInZone(rule, rule.endsOn, mainTimeZone)
		const end = date === null ? 'This series has ended' : `This series ends on ${formatDate(date, currentYear)}`
		return `${end}; no ${weekdayName(weekday ?? rule.weekday)} falls between From and that date.`
	}
	if (
		cut?.kind === 'invalid' &&
		weekday === rule.weekday &&
		time === rule.startTime &&
		durationMinutes === rule.durationMinutes &&
		sameTimeZone(mainTimeZone, rule.timeZone)
	) {
		return 'Choose a different day, time or length.'
	}
	if (cut?.kind === 'ends_before_new_day' || serverEnds) return endsText()
	if (cut?.kind === 'invalid' || cut?.kind === 'changed') return 'Choose a date within this series.'
	return undefined
}
