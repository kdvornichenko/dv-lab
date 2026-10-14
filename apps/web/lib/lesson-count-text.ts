import { SCHEDULE_TIME_ZONE } from '@dv-lab/core'

import { yearInZone } from './schedule-format'

const MONTHS = [
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
] as const

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

export type LessonCountMonth = { key: string; name: string; days: { day: number; date: string }[] }

export function lessonCountMonths(dates: Iterable<string>): LessonCountMonth[] {
	const byMonth = new Map<string, LessonCountMonth>()
	for (const date of [...new Set(dates)].sort()) {
		const key = date.slice(0, 7)
		const month = byMonth.get(key) ?? { key, name: MONTHS[Number(key.slice(5, 7)) - 1] ?? '', days: [] }
		month.days.push({ day: Number(date.slice(8, 10)), date })
		byMonth.set(key, month)
	}
	return [...byMonth.values()]
}

export function lessonCountLine(month: LessonCountMonth): string {
	return `${month.days.map((entry) => entry.day).join(', ')} - ${month.name}`
}

export function lessonCountText(dates: Iterable<string>): string {
	return lessonCountMonths(dates).map(lessonCountLine).join('\n')
}

export function datesPlural(total: number): string {
	return `${total} ${total === 1 ? 'date' : 'dates'}`
}

function dayShortMonth(date: string): { day: number; month: string; year: number } {
	return {
		day: Number(date.slice(8, 10)),
		month: SHORT_MONTHS[Number(date.slice(5, 7)) - 1] ?? '',
		year: Number(date.slice(0, 4)),
	}
}

export function periodText(from: string, to: string, joiner: string): string {
	const start = dayShortMonth(from)
	const end = dayShortMonth(to)
	const current = yearInZone(new Date(), SCHEDULE_TIME_ZONE)
	if (from === to) return `${start.day} ${start.month}${start.year === current ? '' : ` ${start.year}`}`
	if (start.year !== end.year)
		return `${start.day} ${start.month} ${start.year}${joiner}${end.day} ${end.month} ${end.year}`
	const year = start.year === current ? '' : ` ${start.year}`
	if (start.month === end.month) return `${start.day}${joiner}${end.day} ${end.month}${year}`
	return `${start.day} ${start.month}${joiner}${end.day} ${end.month}${year}`
}
