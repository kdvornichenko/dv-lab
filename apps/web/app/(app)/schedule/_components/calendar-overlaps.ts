import { calendarEventFor, canEditCalendarEvent, type CalendarLesson } from '@/lib/lesson-actions'

import type { CalendarSeriesContext, GoogleScheduleWindow, ScheduleOccurrenceRef } from '@dv-lab/contracts'

export type CalendarTarget = ScheduleOccurrenceRef | { kind: 'rule'; seriesId: string } | { kind: 'new' }

export function calendarVersionFor(
	window: GoogleScheduleWindow,
	target: CalendarTarget,
	selection: {
		series?: CalendarSeriesContext
		previous?: CalendarLesson | null
		expectedStartsAt?: string
	} = {}
): string | null {
	if (window.read.state !== 'fresh') return null
	if (target.kind === 'new') return window.read.revision
	if (target.kind === 'rule') {
		const current = window.series.find((context) => context.series.id === target.seriesId)
		return current && selection.series && JSON.stringify(current.series) === JSON.stringify(selection.series.series)
			? current.version
			: null
	}
	const current = calendarEventFor(window, target)
	const previous = selection.previous
	if (!current || !canEditCalendarEvent(current, window) || previous === null) return null
	if (
		previous &&
		(current.when.startsAt !== previous.when.startsAt ||
			current.when.endsAt !== previous.when.endsAt ||
			current.status !== previous.status)
	)
		return null
	if (selection.expectedStartsAt && selection.expectedStartsAt !== current.when.startsAt) return null
	return current.binding.version
}
