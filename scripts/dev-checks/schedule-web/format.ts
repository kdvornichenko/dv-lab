import * as core from '../../../packages/core/src/index.ts'
import { VN } from './navigation.ts'

export function berlinFacts(monday: string) {
	const instant = core.zonedInstant(monday, '08:00', VN)
	const hour = new Intl.DateTimeFormat('en-GB', {
		timeZone: 'Europe/Berlin',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
	}).format(instant)
	const noon = core.zonedInstant(monday, '12:00', VN)
	const year = Number(monday.slice(0, 4))
	const standard = Math.min(
		zoneOffset('Europe/Berlin', new Date(Date.UTC(year, 0, 1))),
		zoneOffset('Europe/Berlin', new Date(Date.UTC(year, 6, 1)))
	)
	const label = zoneOffset('Europe/Berlin', noon) > standard ? 'CEST' : 'CET'
	return { hour, label }
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function dayNum(date: string) {
	return Number(date.slice(8, 10))
}

export function monthName(date: string) {
	return MONTHS[Number(date.slice(5, 7)) - 1]
}

export function expectedRange(monday: string) {
	const sunday = core.addDays(monday, 6)
	const left = `${dayNum(monday)}`
	if (monday.slice(0, 4) !== sunday.slice(0, 4)) {
		return `${left} ${monthName(monday)} ${monday.slice(0, 4)} – ${dayNum(sunday)} ${monthName(sunday)} ${sunday.slice(0, 4)}`
	}
	if (monthName(monday) !== monthName(sunday))
		return `${left} ${monthName(monday)} – ${dayNum(sunday)} ${monthName(sunday)}`
	return `${left} – ${dayNum(sunday)} ${monthName(sunday)}`
}

export function expectedNow(at?: Date | undefined) {
	return core.zonedParts(at ?? new Date(), VN)
}

export function expectedTitle(monday: string) {
	const sunday = core.addDays(monday, 6)
	if (monday.slice(0, 4) !== sunday.slice(0, 4)) {
		return `${monthName(monday)} ${monday.slice(0, 4)} – ${monthName(sunday)} ${sunday.slice(0, 4)}`
	}
	if (monthName(monday) !== monthName(sunday))
		return `${monthName(monday)} – ${monthName(sunday)} ${sunday.slice(0, 4)}`
	const long = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long' }).format(
		new Date(`${monday}T12:00:00Z`)
	)
	return `${long} ${monday.slice(0, 4)}`
}

export function quote(value: string) {
	return `'${String(value).replace(/'/g, "''")}'`
}

export function whenText(date: string, time: string) {
	return core.zonedInstant(date, time, VN).toISOString()
}

export function dayMonth(date: string) {
	return `${dayNum(date)} ${monthName(date)}`
}

export const MONTHS_LONG = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December',
]

export const WEEKDAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function fullDate(date: string) {
	return `${WEEKDAYS_LONG[core.weekdayOf(date) - 1]}, ${dayNum(date)} ${MONTHS_LONG[Number(date.slice(5, 7)) - 1]}`
}

export function shortDay(date: string) {
	return `${WEEKDAYS[core.weekdayOf(date) - 1]} ${dayMonth(date)}`
}

export function mediumDate(date: string) {
	return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(
		new Date(`${date}T12:00:00Z`)
	)
}

export function appDate(date: string, today: string) {
	return date.slice(0, 4) === today.slice(0, 4) ? shortDay(date) : `${shortDay(date)} ${date.slice(0, 4)}`
}

export function expectedWhen(iso: string, currentYear: number) {
	const parts = core.zonedParts(new Date(iso), VN)
	const year = Number(parts.date.slice(0, 4)) === currentYear ? '' : ` ${parts.date.slice(0, 4)}`
	return `${shortDay(parts.date)}${year}, ${parts.time}`
}

export const LABEL_TABLE: Record<string, string[]> = {
	'Europe/Moscow': ['MSK'],
	'Pacific/Auckland': ['NZST', 'NZDT'],
	'Europe/Berlin': ['CET', 'CEST'],
	'Asia/Kolkata': ['IST'],
	'Asia/Yekaterinburg': ['YEKT'],
}

export function expectedLabel(zone: string, instant: Date) {
	const known = LABEL_TABLE[zone]
	if (!known)
		return zone
			.split('/')
			.pop()!
			.replace(/[^A-Za-z]/g, '')
			.slice(0, 4)
			.toUpperCase()
	if (known.length === 1) return known[0]
	const year = instant.getUTCFullYear()
	const standard = Math.min(
		zoneOffset(zone, new Date(Date.UTC(year, 0, 1))),
		zoneOffset(zone, new Date(Date.UTC(year, 6, 1)))
	)
	return zoneOffset(zone, instant) > standard ? known[1] : known[0]
}

export function expectedSecond(iso: string, zone: string) {
	const instant = new Date(iso)
	const parts = core.zonedParts(instant, zone)
	const day = core.zonedParts(instant, VN).date === parts.date ? '' : `${WEEKDAYS[parts.weekday - 1]} `
	return `${day}${parts.time} ${expectedLabel(zone, instant)}`
}

export function zoneOffset(zone: string, at: Date | undefined) {
	const name = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' })
		.formatToParts(at)
		.find((part) => part.type === 'timeZoneName')!.value
	const match = /^GMT([+-])(\d+)(?::(\d+))?$/.exec(name)
	if (!match) return 0
	const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0)
	return match[1] === '-' ? -minutes : minutes
}
