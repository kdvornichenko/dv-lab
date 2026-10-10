export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type ZonedParts = { date: string; time: string; weekday: Weekday; minutes: number }

type WallParts = { year: number; month: number; day: number; hour: number; minute: number; second: number }

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(zone: string): Intl.DateTimeFormat {
	let found = formatters.get(zone)
	if (!found) {
		found = new Intl.DateTimeFormat('en-US', {
			timeZone: zone,
			hourCycle: 'h23',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		})
		formatters.set(zone, found)
	}
	return found
}

function wallParts(instant: number, zone: string): WallParts {
	const parts: Record<string, string> = {}
	for (const part of formatter(zone).formatToParts(instant)) parts[part.type] = part.value
	return {
		year: Number(parts.year),
		month: Number(parts.month),
		day: Number(parts.day),
		hour: Number(parts.hour) % 24,
		minute: Number(parts.minute),
		second: Number(parts.second),
	}
}

function utcMs(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): number {
	const date = new Date(0)
	date.setUTCFullYear(year, month - 1, day)
	date.setUTCHours(hour, minute, second, 0)
	return date.getTime()
}

function offsetMs(instant: number, zone: string): number {
	const wall = wallParts(instant, zone)
	const asUtc = utcMs(wall.year, wall.month, wall.day, wall.hour, wall.minute, wall.second)
	return asUtc - Math.floor(instant / 1000) * 1000
}

const pad = (value: number, length = 2) => String(value).padStart(length, '0')

function dateParts(date: string): [number, number, number] {
	return [Number(date.slice(0, 4)), Number(date.slice(5, 7)), Number(date.slice(8, 10))]
}

function utcDate(year: number, month: number, day: number): string {
	return new Date(utcMs(year, month, day)).toISOString().slice(0, 10)
}

export function addDays(date: string, days: number): string {
	const [year, month, day] = dateParts(date)
	return utcDate(year, month, day + days)
}

export function weekdayOf(date: string): Weekday {
	const [year, month, day] = dateParts(date)
	return (((new Date(utcMs(year, month, day)).getUTCDay() + 6) % 7) + 1) as Weekday
}

export function mondayOf(date: string): string {
	return addDays(date, 1 - weekdayOf(date))
}

export function firstOnOrAfter(date: string, weekday: Weekday): string {
	return addDays(date, (weekday - weekdayOf(date) + 7) % 7)
}

export function zonedParts(instant: Date, zone: string): ZonedParts {
	const wall = wallParts(instant.getTime(), zone)
	const date = `${pad(wall.year, 4)}-${pad(wall.month)}-${pad(wall.day)}`
	return {
		date,
		time: `${pad(wall.hour)}:${pad(wall.minute)}`,
		weekday: weekdayOf(date),
		minutes: wall.hour * 60 + wall.minute,
	}
}

export function zonedInstant(date: string, time: string, zone: string): Date {
	const [year, month, day] = dateParts(date)
	const wall = utcMs(year, month, day, Number(time.slice(0, 2)), Number(time.slice(3, 5)))
	const first = wall - offsetMs(wall, zone)
	const second = wall - offsetMs(first, zone)
	return new Date(second)
}

export function windowDates(from: Date, to: Date, zone: string): string[] {
	if (to.getTime() <= from.getTime()) return []
	const last = zonedParts(new Date(to.getTime() - 1), zone).date
	const dates: string[] = []
	for (let date = zonedParts(from, zone).date; date <= last; date = addDays(date, 1)) dates.push(date)
	return dates
}
