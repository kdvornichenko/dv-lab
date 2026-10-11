import {
	timeZoneIdentity,
	type CalendarEventView,
	type CalendarSeriesContext,
	type GoogleScheduleWindow,
	type ScheduleOccurrenceRef,
} from '@dv-lab/contracts'

export type CalendarLesson = CalendarEventView & {
	binding: Extract<CalendarEventView['binding'], { kind: 'lesson' }>
	when: Extract<CalendarEventView['when'], { kind: 'timed' }>
}

export function sameCalendarRef(left: ScheduleOccurrenceRef, right: ScheduleOccurrenceRef): boolean {
	if (left.kind === 'single') return right.kind === 'single' && left.lessonId === right.lessonId
	return right.kind === 'series' && left.seriesId === right.seriesId && left.originalOn === right.originalOn
}

export function calendarLesson(event: CalendarEventView): event is CalendarLesson {
	return event.binding.kind === 'lesson' && event.when.kind === 'timed'
}

export function canEditCalendarEvent(event: CalendarEventView, window: GoogleScheduleWindow): event is CalendarLesson {
	return (
		calendarLesson(event) && window.read.state === 'fresh' && window.write.state === 'ready' && event.editBlock === null
	)
}

export function calendarEventFor(window: GoogleScheduleWindow, ref: ScheduleOccurrenceRef) {
	return window.events.find(
		(event): event is CalendarLesson => calendarLesson(event) && sameCalendarRef(event.binding.ref, ref)
	)
}

export function calendarSeriesFor(
	window: GoogleScheduleWindow,
	event: CalendarEventView
): CalendarSeriesContext | null {
	if (event.binding.kind !== 'lesson' || event.binding.ref.kind !== 'series') return null
	const id = event.binding.ref.seriesId
	return window.series.find((context) => context.series.id === id) ?? null
}

export function staleCalendarWindow(data: GoogleScheduleWindow | null): GoogleScheduleWindow | null {
	if (data === null) return null
	return {
		...data,
		read:
			data.read.state === 'unavailable'
				? data.read
				: { ...data.read, state: 'last_known', reason: 'provider_unavailable' },
		write: { state: 'blocked', reason: 'provider_unavailable' },
	}
}

export function coveredCalendarWindow(data: GoogleScheduleWindow): GoogleScheduleWindow {
	if (data.read.state === 'unavailable') return data
	const range = data.snapshotRange
	if (
		range !== null &&
		timeZoneIdentity(range.timeZone) === timeZoneIdentity(data.requestedRange.timeZone) &&
		Date.parse(range.start) === Date.parse(data.requestedRange.start) &&
		Date.parse(range.end) === Date.parse(data.requestedRange.end)
	)
		return data
	return {
		...data,
		snapshotRange: null,
		events: [],
		series: [],
		read: { state: 'unavailable', reason: 'invalid_provider_data' },
		write: { state: 'blocked', reason: 'invalid_provider_data' },
	}
}
