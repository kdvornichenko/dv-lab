import { formatDate, formatRange, secondWhen, weekdayName } from '@/lib/schedule-format'

import type { ScheduleSeries, ScheduleWeekday } from '@dv-lab/contracts'
import { SCHEDULE_TIME_ZONE, cutSeries, zonedInstant } from '@dv-lab/core'

interface Draft {
	rule: ScheduleSeries
	from: string
	weekday: ScheduleWeekday | null
	time: string | null
	now: Date
	currentYear: number
	serverEnds: boolean
	serverStarted: boolean
	secondZone: string | null
}

export function seriesPreview(draft: Draft) {
	const { rule, from, weekday, time, now, currentYear, serverStarted, secondZone } = draft
	const cut =
		from !== '' && weekday !== null && time !== null
			? cutSeries(rule, [], { from, weekday, startTime: time }, now)
			: null
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
		time: time === null ? 'Choose a start time.' : undefined,
	}
	const preview =
		cut?.kind === 'ok'
			? `${formatDate(cut.newRule.startsOn, currentYear)}, ${formatRange(
					zonedInstant(cut.newRule.startsOn, cut.newRule.startTime, SCHEDULE_TIME_ZONE),
					rule.durationMinutes,
					SCHEDULE_TIME_ZONE
				)}`
			: null

	const zoneDate = cut?.kind === 'ok' ? cut.newRule.startsOn : from
	const zoneLine =
		zoneDate !== '' && time !== null ? secondWhen(zonedInstant(zoneDate, time, SCHEDULE_TIME_ZONE), secondZone) : null

	return { errors, rowError, startedToday, preview, zoneLine }
}

function seriesError(draft: Draft, cut: ReturnType<typeof cutSeries> | null): string | undefined {
	const { rule, from, weekday, time, currentYear, serverEnds } = draft
	const endsText = (endsOn: string) =>
		`This series ends on ${formatDate(endsOn, currentYear)}; no ${weekdayName(weekday ?? rule.weekday)} falls between From and that date.`
	if (cut?.kind === 'invalid' && weekday === rule.weekday && time === rule.startTime) {
		return 'Choose a different day or time.'
	}
	if (cut?.kind === 'ends_before_new_day') return endsText(cut.endsOn)
	if (serverEnds) return endsText(rule.endsOn ?? from)
	return undefined
}
