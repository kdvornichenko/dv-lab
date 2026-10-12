import { offsetLabel, zoneLabel } from '@/lib/time-zones'

import type { ScheduleSeriesReference } from '@dv-lab/contracts'
import { addDays, localTimeCandidates, zonedParts } from '@dv-lab/core'

const dash = ' – '

const monthShortFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short' })
const monthLongFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long' })
const weekdayShortFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' })
const weekdayLongFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' })

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const WEEKDAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

function calendarInstant(date: string): Date {
	return new Date(`${date}T12:00:00Z`)
}

function yearOf(date: string): number {
	return Number(date.slice(0, 4))
}

function dayOf(date: string): number {
	return Number(date.slice(8, 10))
}

function monthShort(date: string): string {
	return monthShortFormat.format(calendarInstant(date))
}

function monthLong(date: string): string {
	return monthLongFormat.format(calendarInstant(date))
}

export function weekdayShort(date: string): string {
	return weekdayShortFormat.format(calendarInstant(date))
}

export function weekdayCaps(date: string): string {
	return weekdayShort(date).toUpperCase()
}

export function dayNumber(date: string): number {
	return dayOf(date)
}

export function weekRange(monday: string): string {
	const sunday = addDays(monday, 6)
	if (yearOf(monday) !== yearOf(sunday)) {
		return `${dayOf(monday)} ${monthShort(monday)} ${yearOf(monday)}${dash}${dayOf(sunday)} ${monthShort(sunday)} ${yearOf(sunday)}`
	}
	if (monthShort(monday) !== monthShort(sunday)) {
		return `${dayOf(monday)} ${monthShort(monday)}${dash}${dayOf(sunday)} ${monthShort(sunday)}`
	}
	return `${dayOf(monday)}${dash}${dayOf(sunday)} ${monthShort(sunday)}`
}

export function weekTitle(monday: string): string {
	const range = weekRange(monday)
	return yearOf(monday) === yearOf(addDays(monday, 6)) ? `${range} ${yearOf(monday)}` : range
}

export function periodTitle(monday: string): string {
	const sunday = addDays(monday, 6)
	if (yearOf(monday) !== yearOf(sunday)) {
		return `${monthShort(monday)} ${yearOf(monday)}${dash}${monthShort(sunday)} ${yearOf(sunday)}`
	}
	if (monthShort(monday) !== monthShort(sunday)) {
		return `${monthShort(monday)}${dash}${monthShort(sunday)} ${yearOf(sunday)}`
	}
	return `${monthLong(monday)} ${yearOf(monday)}`
}

export function formatTime(instant: Date, zone: string): string {
	return zonedParts(instant, zone).time
}

export function hourLabel(hour: number): string {
	return `${String(hour).padStart(2, '0')}:00`
}

export function gutterLabel(monday: string, hour: number, mainTimeZone: string, secondTimeZone: string): string {
	const [instant] = localTimeCandidates(monday, hourLabel(hour), mainTimeZone)
	if (instant === undefined) return '—'
	const parts = zonedParts(instant, secondTimeZone)
	if (localTimeCandidates(parts.date, parts.time, secondTimeZone).length > 1) {
		return `${parts.time} ${offsetLabel(secondTimeZone, instant)}`
	}
	if (parts.minutes === 0) return WEEKDAY_NAMES[parts.weekday - 1]
	return parts.time
}

export function weekdayName(weekday: number): string {
	return WEEKDAY_LONG[weekday - 1]
}

function dateOf(instant: Date, zone: string): string {
	return zonedParts(instant, zone).date
}

export function yearInZone(instant: Date, zone: string): number {
	return yearOf(dateOf(instant, zone))
}

export function formatRange(start: Date, minutes: number, zone: string): string {
	const end = new Date(start.getTime() + minutes * 60000)
	const endDay = dateOf(start, zone) === dateOf(end, zone) ? '' : `${weekdayShort(dateOf(end, zone))} `
	return `${formatTime(start, zone)}–${endDay}${formatTime(end, zone)}`
}

function labelledRange(start: Date, minutes: number, zone: string): string {
	const end = new Date(start.getTime() + minutes * 60000)
	if (offsetLabel(zone, start) === offsetLabel(zone, end))
		return `${formatRange(start, minutes, zone)} ${zoneLabel(zone, start)}`
	const startLabel = zoneLabel(zone, start)
	const endLabel = zoneLabel(zone, end)
	const exact = startLabel === endLabel
	const endDay = dateOf(start, zone) === dateOf(end, zone) ? '' : `${weekdayShort(dateOf(end, zone))} `
	return `${formatTime(start, zone)} ${exact ? offsetLabel(zone, start) : startLabel}–${endDay}${formatTime(end, zone)} ${exact ? offsetLabel(zone, end) : endLabel}`
}

export function formatDayMonth(instant: Date, zone: string): string {
	const date = dateOf(instant, zone)
	return `${dayOf(date)} ${monthShort(date)}`
}

export function formatFullDate(instant: Date, zone: string, currentYear: number): string {
	const date = dateOf(instant, zone)
	const year = yearOf(date) === currentYear ? '' : ` ${yearOf(date)}`
	return `${weekdayLongFormat.format(calendarInstant(date))}, ${dayOf(date)} ${monthLong(date)}${year}`
}

export function formatDate(date: string, currentYear: number): string {
	const year = yearOf(date) === currentYear ? '' : ` ${yearOf(date)}`
	return `${weekdayShort(date)} ${dayOf(date)} ${monthShort(date)}${year}`
}

export function formatDay(instant: Date, zone: string, currentYear: number): string {
	return formatDate(dateOf(instant, zone), currentYear)
}

export function formatWhen(instant: Date, zone: string, currentYear: number): string {
	return `${formatDay(instant, zone, currentYear)}, ${formatTime(instant, zone)}`
}

export function seriesWhen(
	reference: ScheduleSeriesReference | null,
	mainTimeZone: string,
	secondTimeZone: string | null
): string | null {
	if (reference?.ruleStartsAt == null) return null
	const instant = new Date(reference.ruleStartsAt)
	const main = zonedParts(instant, mainTimeZone)
	return withSecond(
		`${weekdayName(main.weekday)} at ${main.time} ${zoneLabel(mainTimeZone, instant)}`,
		secondWhen(instant, mainTimeZone, secondTimeZone)
	)
}

export function seriesSecondLine(
	reference: ScheduleSeriesReference | null,
	mainTimeZone: string,
	secondTimeZone: string | null
): string | null {
	if (reference?.ruleStartsAt == null) return null
	return secondWhen(new Date(reference.ruleStartsAt), mainTimeZone, secondTimeZone)
}

export function lessonCount(count: number): string {
	if (count === 0) return 'no lessons'
	return count === 1 ? '1 lesson' : `${count} lessons`
}

export function secondRange(start: Date, minutes: number, mainTimeZone: string, zone: string | null): string | null {
	if (zone === null) return null
	const range = labelledRange(start, minutes, zone)
	const date = dateOf(start, zone)
	if (date === dateOf(start, mainTimeZone)) return range
	return `${weekdayShort(date)} ${range}`
}

export function secondWhen(instant: Date, mainTimeZone: string, zone: string | null): string | null {
	if (zone === null) return null
	const caption = zoneLabel(zone, instant)
	const time = formatTime(instant, zone)
	const date = dateOf(instant, zone)
	if (date === dateOf(instant, mainTimeZone)) return `${time} ${caption}`
	return `${weekdayShort(date)} ${time} ${caption}`
}

export function withSecond(main: string, second: string | null): string {
	return second === null ? main : `${main} (${second})`
}

export function mainWhen(
	instant: Date,
	mainTimeZone: string,
	secondTimeZone: string | null,
	currentYear: number
): string {
	return withSecond(
		`${formatWhen(instant, mainTimeZone, currentYear)} ${zoneLabel(mainTimeZone, instant)}`,
		secondWhen(instant, mainTimeZone, secondTimeZone)
	)
}

export function mainDayTime(instant: Date, mainTimeZone: string, secondTimeZone: string | null): string {
	const main = `${formatDayMonth(instant, mainTimeZone)}, ${formatTime(instant, mainTimeZone)} ${zoneLabel(mainTimeZone, instant)}`
	return withSecond(main, secondWhen(instant, mainTimeZone, secondTimeZone))
}

export function mainDayAt(instant: Date, mainTimeZone: string, secondTimeZone: string | null): string {
	const main = `${formatDayMonth(instant, mainTimeZone)} at ${formatTime(instant, mainTimeZone)} ${zoneLabel(mainTimeZone, instant)}`
	return withSecond(main, secondWhen(instant, mainTimeZone, secondTimeZone))
}

export function mainRange(start: Date, minutes: number, mainTimeZone: string, secondTimeZone: string | null): string {
	return withSecond(
		labelledRange(start, minutes, mainTimeZone),
		secondRange(start, minutes, mainTimeZone, secondTimeZone)
	)
}
