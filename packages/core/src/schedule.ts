import { addDays, firstOnOrAfter, weekdayOf, windowDates, zonedInstant, zonedParts, type Weekday } from './zoned.ts'

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
	| { seriesId: string; originalOn: string; kind: 'cancelled'; startsAt?: Date; durationMinutes?: number }
	| { seriesId: string; originalOn: string; kind: 'restored' }
	| { seriesId: string; originalOn: string; kind: 'moved'; startsAt: Date; durationMinutes: number }

export type SingleLesson = {
	id: string
	studentId: string
	startsAt: Date
	durationMinutes: number
	status: 'scheduled' | 'cancelled'
}

export type OccurrenceRef =
	{ kind: 'single'; lessonId: string } | { kind: 'series'; seriesId: string; originalOn: string }

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
	const own =
		exception !== undefined && exception.seriesId === rule.id && exception.originalOn === date ? exception : null
	if (own?.kind === 'moved') {
		return { ...base, startsAt: own.startsAt, durationMinutes: own.durationMinutes, status: 'moved' }
	}
	if (own?.kind === 'cancelled' && own.startsAt !== undefined && own.durationMinutes !== undefined) {
		return { ...base, startsAt: own.startsAt, durationMinutes: own.durationMinutes, status: 'cancelled' }
	}
	return {
		...base,
		startsAt: naturalStart,
		durationMinutes: rule.durationMinutes,
		status: own?.kind === 'cancelled' ? 'cancelled' : 'scheduled',
	}
}

export function movedAway(occurrence: Pick<Occurrence, 'naturalStart' | 'startsAt'>): boolean {
	return occurrence.startsAt.getTime() !== occurrence.naturalStart.getTime()
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
			const away = movedAway(occurrence)
			blocks.push({
				key: occurrence.key,
				ref: occurrence.ref,
				studentId: occurrence.studentId,
				startsAt: occurrence.naturalStart,
				durationMinutes: away ? rule.durationMinutes : occurrence.durationMinutes,
				status: away ? 'moved' : occurrence.status,
				movedTo: away ? occurrence.startsAt : null,
				movedFrom: null,
			})
		}
	}
	for (const exception of exceptions) {
		if (exception.kind === 'restored') continue
		const rule = rules.get(exception.seriesId)
		if (rule === undefined) continue
		const occurrence = occurrenceAt(rule, exception.originalOn, exception)
		if (occurrence === null || !movedAway(occurrence) || !inWindow(occurrence.startsAt, from, to)) continue
		blocks.push({
			key: occurrence.key,
			ref: occurrence.ref,
			studentId: occurrence.studentId,
			startsAt: occurrence.startsAt,
			durationMinutes: occurrence.durationMinutes,
			status: occurrence.status === 'cancelled' ? 'cancelled' : 'scheduled',
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

const SEARCH_DAYS = 366

const laterDate = (left: string, right: string) => (left > right ? left : right)

const todayOf = (now: Date) => zonedParts(now, SCHEDULE_TIME_ZONE).date

export function nextSeriesDate(rule: SeriesTiming, now: Date): string | null {
	const start = laterDate(todayOf(now), rule.startsOn)
	const limit = addDays(start, SEARCH_DAYS)
	for (let date = firstOnOrAfter(start, rule.weekday); date <= limit; date = addDays(date, 7)) {
		if (!isSeriesDate(rule, date)) return null
		if (canChange(seriesStart(rule, date), now)) return date
	}
	return null
}

export function lastSeriesDateOnOrBefore(rule: SeriesTiming, date: string): string | null {
	const end = rule.endsOn !== null && rule.endsOn < date ? rule.endsOn : date
	const candidate = addDays(end, -((weekdayOf(end) - rule.weekday + 7) % 7))
	return isSeriesDate(rule, candidate) ? candidate : null
}

export function nextLessons(input: ScheduleInput & { now: Date }): Map<string, Date> {
	const { series, exceptions, lessons, now } = input
	const index = exceptionIndex(exceptions)
	const rules = new Map(series.map((rule) => [rule.id, rule]))
	const next = new Map<string, Date>()
	const offer = (studentId: string, startsAt: Date) => {
		if (startsAt.getTime() < now.getTime()) return
		const current = next.get(studentId)
		if (current === undefined || startsAt.getTime() < current.getTime()) next.set(studentId, startsAt)
	}
	const today = todayOf(now)
	for (const rule of series) {
		const start = laterDate(today, rule.startsOn)
		const limit = addDays(start, SEARCH_DAYS)
		for (let date = firstOnOrAfter(start, rule.weekday); date <= limit; date = addDays(date, 7)) {
			const occurrence = occurrenceAt(rule, date, index.get(seriesKey(rule.id, date)))
			if (occurrence === null) break
			if (occurrence.status === 'scheduled' && occurrence.startsAt.getTime() >= now.getTime()) {
				offer(rule.studentId, occurrence.startsAt)
				break
			}
		}
	}
	for (const exception of exceptions) {
		if (exception.kind !== 'moved') continue
		const rule = rules.get(exception.seriesId)
		if (rule === undefined) continue
		const occurrence = occurrenceAt(rule, exception.originalOn, exception)
		if (occurrence?.status === 'moved') offer(rule.studentId, occurrence.startsAt)
	}
	for (const lesson of lessons) {
		if (lesson.status === 'scheduled') offer(lesson.studentId, lesson.startsAt)
	}
	return next
}

export type OverlapItem = { key: string; startsAt: Date; durationMinutes: number; status: BlockStatus }

export function overlaps<T extends OverlapItem>(
	items: readonly T[],
	candidate: { startsAt: Date; durationMinutes: number },
	excludeKey?: string
): T[] {
	const start = candidate.startsAt.getTime()
	const end = start + candidate.durationMinutes * 60000
	return items.filter((item) => {
		if (item.status !== 'scheduled' || item.key === excludeKey) return false
		const itemStart = item.startsAt.getTime()
		return itemStart < end && start < itemStart + item.durationMinutes * 60000
	})
}

export function emptySeriesEnd(rule: Pick<SeriesRule, 'startsOn'>): string {
	return addDays(rule.startsOn, -1)
}

export function hasOccurrences(rule: Pick<SeriesRule, 'startsOn' | 'endsOn'>): boolean {
	return rule.endsOn === null || rule.endsOn >= rule.startsOn
}

export type NewSeriesRule = Omit<SeriesRule, 'id'>

export type CutLesson = { studentId: string; startsAt: Date; durationMinutes: number }

export type SeriesChange = { from: string; weekday: Weekday; startTime: string }

export type CutSeriesResult =
	| { kind: 'invalid' }
	| { kind: 'changed' }
	| { kind: 'ends_before_new_day'; endsOn: string }
	| { kind: 'ok'; oldEndsOn: string; newRule: NewSeriesRule; lessons: CutLesson[] }

export function cutSeries(
	rule: SeriesRule,
	exceptions: readonly SeriesException[],
	change: SeriesChange,
	now: Date
): CutSeriesResult {
	const { from, weekday, startTime } = change
	const today = todayOf(now)
	if (from < today) return { kind: 'invalid' }
	if (rule.endsOn !== null && rule.endsOn < from) return { kind: 'changed' }
	if (weekday === rule.weekday && startTime === rule.startTime) return { kind: 'invalid' }
	if (from === today && isSeriesDate(rule, today) && !canChange(seriesStart(rule, today), now)) {
		return { kind: 'changed' }
	}
	const startsOn = nextSeriesDate({ weekday, startTime, startsOn: from, endsOn: null }, now)
	if (startsOn === null) return { kind: 'invalid' }
	const endsOn =
		rule.endsOn === null ? null : lastSeriesDateOnOrBefore({ weekday, startTime, startsOn, endsOn: null }, rule.endsOn)
	if (rule.endsOn !== null && endsOn === null) return { kind: 'ends_before_new_day', endsOn: rule.endsOn }
	const tail: SeriesRule = { ...rule, startsOn: laterDate(rule.startsOn, from) }
	const lessons: CutLesson[] = []
	for (const exception of exceptions) {
		const occurrence = occurrenceAt(tail, exception.originalOn, exception)
		if (occurrence?.status !== 'moved') continue
		lessons.push({
			studentId: rule.studentId,
			startsAt: occurrence.startsAt,
			durationMinutes: occurrence.durationMinutes,
		})
	}
	return {
		kind: 'ok',
		oldEndsOn: laterDate(addDays(from, -1), emptySeriesEnd(rule)),
		newRule: {
			studentId: rule.studentId,
			weekday,
			startTime,
			durationMinutes: rule.durationMinutes,
			startsOn,
			endsOn,
		},
		lessons,
	}
}

export type EndSeriesResult = { kind: 'invalid' } | { kind: 'changed' } | { kind: 'ok'; endsOn: string }

export function endSeriesAt(rule: SeriesTiming, lastOn: string, now: Date): EndSeriesResult {
	const today = todayOf(now)
	if (rule.endsOn !== null && rule.endsOn < today) return { kind: 'changed' }
	if (lastOn < today) return { kind: 'invalid' }
	if (rule.endsOn !== null && lastOn > rule.endsOn) return { kind: 'invalid' }
	return { kind: 'ok', endsOn: lastSeriesDateOnOrBefore(rule, lastOn) ?? emptySeriesEnd(rule) }
}
