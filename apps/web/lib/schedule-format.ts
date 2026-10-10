import { zoneCaption } from '@/lib/time-zones'

import { SCHEDULE_TIME_ZONE, addDays, zonedInstant, zonedParts } from '@dv-lab/core'

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

export function weekEyebrow(monday: string, currentMonday: string): string {
	if (monday === currentMonday) return 'This week'
	return monday < currentMonday ? 'Past week' : 'Coming weeks'
}

export function formatTime(instant: Date, zone: string): string {
	return zonedParts(instant, zone).time
}

export function hourLabel(hour: number): string {
	return `${String(hour).padStart(2, '0')}:00`
}

export function gutterLabel(monday: string, hour: number, zone: string): string {
	const instant = zonedInstant(monday, hourLabel(hour), SCHEDULE_TIME_ZONE)
	const parts = zonedParts(instant, zone)
	if (parts.minutes === 0) return WEEKDAY_NAMES[parts.weekday - 1]
	return parts.time
}

export function weekdayName(weekday: number): string {
	return WEEKDAY_LONG[weekday - 1]
}

export function weekdayPlural(weekday: number): string {
	return `${weekdayName(weekday)}s`
}

function dateOf(instant: Date, zone: string): string {
	return zonedParts(instant, zone).date
}

export function yearInZone(instant: Date, zone: string = SCHEDULE_TIME_ZONE): number {
	return yearOf(dateOf(instant, zone))
}

export function formatRange(start: Date, minutes: number, zone: string): string {
	const end = new Date(start.getTime() + minutes * 60000)
	return `${formatTime(start, zone)}–${formatTime(end, zone)}`
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

export function seriesPhrase(weekday: number, time: string): string {
	return `Every ${weekdayName(weekday)} at ${time}`
}

export function weekPhrase(monday: string): string {
	const sunday = addDays(monday, 6)
	const left = dayOf(monday)
	const right = dayOf(sunday)
	if (yearOf(monday) !== yearOf(sunday)) {
		return `Week of ${left} ${monthLong(monday)} ${yearOf(monday)} to ${right} ${monthLong(sunday)} ${yearOf(sunday)}`
	}
	if (monthLong(monday) !== monthLong(sunday)) {
		return `Week of ${left} ${monthLong(monday)} to ${right} ${monthLong(sunday)} ${yearOf(sunday)}`
	}
	return `Week of ${left} to ${right} ${monthLong(sunday)} ${yearOf(sunday)}`
}

export function lessonCount(count: number): string {
	if (count === 0) return 'no lessons'
	return count === 1 ? '1 lesson' : `${count} lessons`
}

export function weekSummary(blocks: readonly { status: string; studentId: string }[]): string {
	const planned = blocks.filter((block) => block.status === 'scheduled')
	const cancelled = blocks.filter((block) => block.status === 'cancelled').length
	if (planned.length === 0 && cancelled === 0) return 'No lessons this week'
	const students = new Set(planned.map((block) => block.studentId)).size
	const lessons = `${planned.length} ${planned.length === 1 ? 'lesson' : 'lessons'}`
	const people = `${students} ${students === 1 ? 'student' : 'students'}`
	const base = `${lessons} with ${people}`
	return cancelled > 0 ? `${base} · ${cancelled} cancelled` : base
}

export function secondRange(start: Date, minutes: number, zone: string | null): string | null {
	if (zone === null) return null
	return `${formatRange(start, minutes, zone)} ${zoneCaption(zone, start, 'toolbar')}`
}

export function weeksBetween(fromMonday: string, toMonday: string): number {
	return Math.round((Date.parse(`${toMonday}T00:00:00Z`) - Date.parse(`${fromMonday}T00:00:00Z`)) / (7 * 86400000))
}
