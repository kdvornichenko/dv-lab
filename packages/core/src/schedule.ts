import { weekdayOf, windowDates, zonedInstant, type Weekday } from './zoned.ts'

export const SCHEDULE_TIME_ZONE = 'Asia/Ho_Chi_Minh'

export type SeriesRule = {
	id: string
	studentId: string
	weekday: Weekday
	startTime: string
	durationMinutes: number
	startsOn: string
	endsOn: string | null
}

export type SeriesTiming = Pick<SeriesRule, 'weekday' | 'startTime' | 'startsOn' | 'endsOn'>

export type SeriesException =
	| { seriesId: string; originalOn: string; kind: 'cancelled' }
	| { seriesId: string; originalOn: string; kind: 'restored' }
	| { seriesId: string; originalOn: string; kind: 'moved'; startsAt: Date; durationMinutes: number }

export type SingleLesson = {
	id: string
	studentId: string
	startsAt: Date
	durationMinutes: number
	status: 'scheduled' | 'cancelled'
}

export type OccurrenceRef = { kind: 'single'; lessonId: string } | { kind: 'series'; seriesId: string; originalOn: string }

export type BlockStatus = 'scheduled' | 'cancelled' | 'moved'

export type ScheduleBlock = {
	key: string
	ref: OccurrenceRef
	studentId: string
	startsAt: Date
	durationMinutes: number
	status: BlockStatus
	movedTo: Date | null
	movedFrom: Date | null
}

export type Occurrence = {
	key: string
	ref: OccurrenceRef
	studentId: string
	naturalStart: Date
	startsAt: Date
	durationMinutes: number
	status: BlockStatus
}

export type ScheduleInput = {
	series: readonly SeriesRule[]
	exceptions: readonly SeriesException[]
	lessons: readonly SingleLesson[]
}

export function canChange(startsAt: Date, now: Date): boolean {
	return startsAt.getTime() > now.getTime()
}

export function occurrenceKey(ref: OccurrenceRef): string {
	return ref.kind === 'single' ? `l:${ref.lessonId}` : `s:${ref.seriesId}:${ref.originalOn}`
}

const seriesKey = (seriesId: string, originalOn: string) => occurrenceKey({ kind: 'series', seriesId, originalOn })

function exceptionIndex(exceptions: readonly SeriesException[]): Map<string, SeriesException> {
	const index = new Map<string, SeriesException>()
	for (const exception of exceptions) index.set(seriesKey(exception.seriesId, exception.originalOn), exception)
	return index
}

function inWindow(instant: Date, from: Date, to: Date): boolean {
	return instant.getTime() >= from.getTime() && instant.getTime() < to.getTime()
}

export function isSeriesDate(rule: SeriesTiming, date: string): boolean {
	if (weekdayOf(date) !== rule.weekday) return false
	if (date < rule.startsOn) return false
	return rule.endsOn === null || date <= rule.endsOn
}

export function seriesStart(rule: Pick<SeriesRule, 'startTime'>, date: string): Date {
	return zonedInstant(date, rule.startTime, SCHEDULE_TIME_ZONE)
}

export function occurrenceAt(rule: SeriesRule, date: string, exception?: SeriesException): Occurrence | null {
	if (!isSeriesDate(rule, date)) return null
	const ref: OccurrenceRef = { kind: 'series', seriesId: rule.id, originalOn: date }
	const naturalStart = seriesStart(rule, date)
	const base = { key: occurrenceKey(ref), ref, studentId: rule.studentId, naturalStart }
	const own = exception !== undefined && exception.seriesId === rule.id && exception.originalOn === date ? exception : null
	if (own?.kind === 'moved') {
		return { ...base, startsAt: own.startsAt, durationMinutes: own.durationMinutes, status: 'moved' }
	}
	return {
		...base,
		startsAt: naturalStart,
		durationMinutes: rule.durationMinutes,
		status: own?.kind === 'cancelled' ? 'cancelled' : 'scheduled',
	}
}

function byStart(left: ScheduleBlock, right: ScheduleBlock): number {
	const delta = left.startsAt.getTime() - right.startsAt.getTime()
	if (delta !== 0) return delta
	return left.key < right.key ? -1 : left.key > right.key ? 1 : 0
}

export function scheduleWindow(input: ScheduleInput & { from: Date; to: Date }): ScheduleBlock[] {
	const { series, exceptions, lessons, from, to } = input
	const index = exceptionIndex(exceptions)
	const rules = new Map(series.map((rule) => [rule.id, rule]))
	const blocks: ScheduleBlock[] = []
	for (const date of windowDates(from, to, SCHEDULE_TIME_ZONE)) {
		for (const rule of series) {
			const occurrence = occurrenceAt(rule, date, index.get(seriesKey(rule.id, date)))
			if (occurrence === null || !inWindow(occurrence.naturalStart, from, to)) continue
			const moved = occurrence.status === 'moved'
			blocks.push({
				key: occurrence.key,
				ref: occurrence.ref,
				studentId: occurrence.studentId,
				startsAt: occurrence.naturalStart,
				durationMinutes: moved ? rule.durationMinutes : occurrence.durationMinutes,
				status: occurrence.status,
				movedTo: moved ? occurrence.startsAt : null,
				movedFrom: null,
			})
		}
	}
	for (const exception of exceptions) {
		if (exception.kind !== 'moved') continue
		const rule = rules.get(exception.seriesId)
		if (rule === undefined) continue
		const occurrence = occurrenceAt(rule, exception.originalOn, exception)
		if (occurrence === null || occurrence.status !== 'moved' || !inWindow(occurrence.startsAt, from, to)) continue
		blocks.push({
			key: occurrence.key,
			ref: occurrence.ref,
			studentId: occurrence.studentId,
			startsAt: occurrence.startsAt,
			durationMinutes: occurrence.durationMinutes,
			status: 'scheduled',
			movedTo: null,
			movedFrom: occurrence.naturalStart,
		})
	}
	for (const lesson of lessons) {
		if (!inWindow(lesson.startsAt, from, to)) continue
		const ref: OccurrenceRef = { kind: 'single', lessonId: lesson.id }
		blocks.push({
			key: occurrenceKey(ref),
			ref,
			studentId: lesson.studentId,
			startsAt: lesson.startsAt,
			durationMinutes: lesson.durationMinutes,
			status: lesson.status,
			movedTo: null,
			movedFrom: null,
		})
	}
	return blocks.sort(byStart)
}
