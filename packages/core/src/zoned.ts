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

export function sameTimeZone(left: string, right: string): boolean {
	return formatter(left).resolvedOptions().timeZone === formatter(right).resolvedOptions().timeZone
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

export function localTimeCandidates(date: string, time: string, zone: string): readonly Date[] {
	const [year, month, day] = dateParts(date)
	const wall = utcMs(year, month, day, Number(time.slice(0, 2)), Number(time.slice(3, 5)))
	const offsets = new Set<number>()
	for (let hours = -48; hours <= 48; hours += 6) offsets.add(offsetMs(wall + hours * 3600000, zone))
	const candidates: Date[] = []
	for (const offset of offsets) {
		const candidate = new Date(wall - offset)
		const parts = zonedParts(candidate, zone)
		if (parts.date === date && parts.time === time) candidates.push(candidate)
	}
	return candidates.sort((left, right) => left.getTime() - right.getTime())
}

export function zonedInstant(date: string, time: string, zone: string): Date {
	const first = localTimeCandidates(date, time, zone)[0]
	if (first === undefined) throw new RangeError('nonexistent_local_time')
	return first
}

export function startOfZonedDay(date: string, zone: string): Date {
	const midnight = localTimeCandidates(date, '00:00', zone)[0]
	if (midnight !== undefined) return midnight
	const [year, month, day] = dateParts(date)
	const wall = utcMs(year, month, day)
	let before = wall - 48 * 3600000
	let after = wall + 48 * 3600000
	while (after - before > 1) {
		const middle = Math.floor((before + after) / 2)
		if (zonedParts(new Date(middle), zone).date < date) before = middle
		else after = middle
	}
	return new Date(after)
}

export function windowDates(from: Date, to: Date, zone: string): string[] {
	if (to.getTime() <= from.getTime()) return []
	const last = zonedParts(new Date(to.getTime() - 1), zone).date
	const dates: string[] = []
	for (let date = zonedParts(from, zone).date; date <= last; date = addDays(date, 1)) dates.push(date)
	return dates
}
