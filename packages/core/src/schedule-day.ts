import { addDays, localTimeCandidates, startOfZonedDay, zonedParts } from './zoned.ts'

export const DAY_START_MINUTES = 120

const DAY_MINUTES = 24 * 60

const pad = (value: number) => String(value).padStart(2, '0')

function clockOf(minutes: number): string {
	return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
}

export function lessonDay(instant: Date, zone: string): string {
	const parts = zonedParts(instant, zone)
	return parts.minutes < DAY_START_MINUTES ? addDays(parts.date, -1) : parts.date
}

export function lessonDayMinutes(instant: Date, zone: string): number {
	const parts = zonedParts(instant, zone)
	return parts.minutes < DAY_START_MINUTES
		? parts.minutes + DAY_MINUTES - DAY_START_MINUTES
		: parts.minutes - DAY_START_MINUTES
}

export function lessonDaySlot(day: string, minutes: number): { date: string; time: string } {
	const wall = minutes + DAY_START_MINUTES
	return wall >= DAY_MINUTES
		? { date: addDays(day, 1), time: clockOf(wall - DAY_MINUTES) }
		: { date: day, time: clockOf(wall) }
}

export function lessonDayPlace(date: string, time: string): { day: string; minutes: number } {
	const wall = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
	return wall < DAY_START_MINUTES
		? { day: addDays(date, -1), minutes: wall + DAY_MINUTES - DAY_START_MINUTES }
		: { day: date, minutes: wall - DAY_START_MINUTES }
}

export function lessonDayClock(minutes: number): string {
	return clockOf((minutes + DAY_START_MINUTES) % DAY_MINUTES)
}

export function startOfLessonDay(day: string, zone: string): Date {
	const exact = localTimeCandidates(day, clockOf(DAY_START_MINUTES), zone)[0]
	if (exact !== undefined) return exact
	let before = startOfZonedDay(day, zone).getTime()
	let after = startOfZonedDay(addDays(day, 1), zone).getTime()
	while (after - before > 1) {
		const middle = Math.floor((before + after) / 2)
		const parts = zonedParts(new Date(middle), zone)
		if (parts.date === day && parts.minutes < DAY_START_MINUTES) before = middle
		else after = middle
	}
	return new Date(after)
}

export function namedDateRange(date: string, now: Date, zone: string): { start: Date; end: Date } {
	const current = lessonDay(now, zone)
	const tonight = current !== date && zonedParts(now, zone).date === date
	return {
		start: tonight ? startOfLessonDay(current, zone) : startOfZonedDay(date, zone),
		end: startOfLessonDay(addDays(date, 1), zone),
	}
}

export function scheduleWeekRange(monday: string, zone: string): { start: Date; end: Date } {
	return { start: startOfZonedDay(monday, zone), end: startOfLessonDay(addDays(monday, 7), zone) }
}
