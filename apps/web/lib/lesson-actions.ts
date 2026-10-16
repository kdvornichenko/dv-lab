import {
	timeZoneIdentity,
	type CalendarEditScope,
	type CalendarEventView,
	type CalendarIssue,
	type CalendarSeriesContext,
	type GoogleScheduleWindow,
	type ScheduleOccurrenceRef,
	type ScheduleSeries,
} from '@dv-lab/contracts'
import {
	awaitsMark,
	canChange,
	lessonActions,
	lessonOutcome,
	scheduleDate,
	seriesStart,
	type LessonActions,
	type LessonOutcome,
} from '@dv-lab/core'

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

function eventOutcome(event: CalendarLesson): LessonOutcome {
	return lessonOutcome(event.status === 'cancelled' ? 'cancelled' : 'scheduled', event.binding.mark)
}

export function eventActions(event: CalendarLesson, now: Date): LessonActions {
	return lessonActions(eventOutcome(event), event.binding.mark, new Date(event.when.startsAt), now)
}

export function eventAwaitsMark(event: CalendarEventView, now: Date): boolean {
	return calendarLesson(event) && awaitsMark(eventOutcome(event), new Date(event.when.startsAt), now)
}

export function changeableLesson(event: CalendarEventView, now: Date): event is CalendarLesson {
	return calendarLesson(event) && eventActions(event, now).move
}

export function startedLesson(event: CalendarLesson, now: Date): boolean {
	return !canChange(new Date(event.when.startsAt), now)
}

export function seriesScopesFor(
	event: CalendarLesson,
	context: CalendarSeriesContext | null
): readonly CalendarEditScope[] {
	const ref = event.binding.ref
	if (ref.kind !== 'series' || context === null || context.allFrom === null) return ['one']
	return ref.originalOn >= context.allFrom ? ['one', 'following', 'all'] : ['one']
}

export function writeIssueFor(
	event: CalendarEventView | null,
	window: GoogleScheduleWindow | null,
	blocked: boolean
): CalendarIssue | null {
	if (window === null) return 'provider_unavailable'
	if (window.write.state === 'blocked') return window.write.reason
	if (window.read.state !== 'fresh') return window.read.reason
	if (blocked) return 'command_pending'
	if (event === null) return 'history_only'
	return event.editBlock
}

export function canChangePlainEvent(event: CalendarEventView, window: GoogleScheduleWindow): boolean {
	return (
		window.read.state === 'fresh' &&
		window.write.state === 'ready' &&
		event.editBlock === null &&
		event.binding.kind === 'external' &&
		event.status !== 'cancelled'
	)
}

export function canEditPlainEvent(event: CalendarEventView, window: GoogleScheduleWindow): boolean {
	return canChangePlainEvent(event, window) && event.when.kind === 'timed'
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

export function seriesDateInZone(rule: ScheduleSeries, date: string, mainTimeZone: string): string | null {
	const instant = seriesStart(rule, date)
	return instant === null ? null : scheduleDate(instant, mainTimeZone)
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
