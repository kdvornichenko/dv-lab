import { SCHEDULE_TIME_ZONE, addDays, zonedInstant, zonedParts } from '@dv-lab/core'

const dash = ' – '

const monthShortFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short' })
const monthLongFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long' })
const weekdayShortFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' })

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

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
