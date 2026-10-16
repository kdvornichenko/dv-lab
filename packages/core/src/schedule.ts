import {
	addDays,
	firstOnOrAfter,
	weekdayOf,
	windowDates,
	localTimeCandidates,
	zonedParts,
	type Weekday,
} from './zoned.ts'

export const SCHEDULE_TIME_ZONE = 'Asia/Ho_Chi_Minh'

export function scheduleDate(instant: Date, timeZone: string): string {
	return zonedParts(instant, timeZone).date
}

export function scheduleToday(now: Date, timeZone: string): string {
	return scheduleDate(now, timeZone)
}

export function isAfterScheduleToday(date: string, now: Date, timeZone: string): boolean {
	return date > scheduleToday(now, timeZone)
}

export type SeriesRule = {
	id: string
	studentId: string
	weekday: Weekday
	startTime: string
	timeZone: string
	durationMinutes: number
	startsOn: string
	endsOn: string | null
}

export type SeriesTiming = Pick<SeriesRule, 'weekday' | 'startTime' | 'timeZone' | 'startsOn' | 'endsOn'>

export type SeriesException =
	| { seriesId: string; originalOn: string; kind: 'cancelled'; startsAt?: Date; durationMinutes?: number }
	| { seriesId: string; originalOn: string; kind: 'restored' }
	| { seriesId: string; originalOn: string; kind: 'moved'; startsAt: Date; durationMinutes: number }

export type SingleLesson = {
	id: string
	studentId: string
	startsAt: Date
	timeZone: string
	durationMinutes: number
	status: 'scheduled' | 'cancelled'
}

export type OccurrenceRef =
	{ kind: 'single'; lessonId: string } | { kind: 'series'; seriesId: string; originalOn: string }

export type BlockStatus = 'scheduled' | 'cancelled' | 'moved'

export type MarkKind = 'done' | 'no_show' | 'none'

export type LessonOutcome = 'planned' | 'done' | 'no_show' | 'cancelled' | 'moved'

function markedOutcome(mark: MarkKind | null): LessonOutcome {
	return mark === 'done' || mark === 'no_show' ? mark : 'planned'
}

export function lessonOutcome(status: BlockStatus, mark: MarkKind | null): LessonOutcome {
	if (status === 'moved') return 'moved'
	if (status === 'cancelled') return 'cancelled'
	return markedOutcome(mark)
}

export function occurrenceOutcome(occurrence: Pick<Occurrence, 'status'>, mark: MarkKind | null): LessonOutcome {
	return occurrence.status === 'cancelled' ? 'cancelled' : markedOutcome(mark)
}

export function countsAsLesson(outcome: LessonOutcome): boolean {
	return outcome === 'planned' || outcome === 'done' || outcome === 'no_show'
}

export function isMarked(outcome: LessonOutcome): boolean {
	return outcome === 'done' || outcome === 'no_show'
}

export type LessonActions = { move: boolean; cancel: boolean; restore: boolean; mark: boolean; series: boolean }

export function lessonActions(outcome: LessonOutcome, mark: MarkKind | null, startsAt: Date, now: Date): LessonActions {
	const upcoming = canChange(startsAt, now)
	return {
		move: countsAsLesson(outcome) && outcome !== 'done',
		cancel: countsAsLesson(outcome) && outcome !== 'done',
		restore: outcome === 'cancelled' && mark !== 'done',
		mark: countsAsLesson(outcome) && (isMarked(outcome) || !upcoming),
		series: outcome !== 'moved' && upcoming,
	}
}

export function awaitsMark(outcome: LessonOutcome, startsAt: Date, now: Date): boolean {
	return outcome === 'planned' && !canChange(startsAt, now)
}

export type ScheduleBlock = {
	key: string
	ref: OccurrenceRef
	studentId: string
	startsAt: Date
	timeZone: string
	durationMinutes: number
	status: BlockStatus
	movedTo: Date | null
	movedFrom: Date | null
}

export type Occurrence = {
	key: string
	ref: OccurrenceRef
	studentId: string
	naturalStart: Date | null
	startsAt: Date
	timeZone: string
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

export function seriesStart(rule: Pick<SeriesRule, 'startTime' | 'timeZone'>, date: string): Date | null {
	return localTimeCandidates(date, rule.startTime, rule.timeZone)[0] ?? null
}

export function occurrenceAt(rule: SeriesRule, date: string, exception?: SeriesException): Occurrence | null {
	if (!isSeriesDate(rule, date)) return null
	const ref: OccurrenceRef = { kind: 'series', seriesId: rule.id, originalOn: date }
	const naturalStart = seriesStart(rule, date)
	const base = { key: occurrenceKey(ref), ref, studentId: rule.studentId, naturalStart, timeZone: rule.timeZone }
	const own =
		exception !== undefined && exception.seriesId === rule.id && exception.originalOn === date ? exception : null
	if (own?.kind === 'moved') {
		return { ...base, startsAt: own.startsAt, durationMinutes: own.durationMinutes, status: 'moved' }
	}
	if (naturalStart === null) return null
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
	return occurrence.naturalStart === null || occurrence.startsAt.getTime() !== occurrence.naturalStart.getTime()
}

function byStart(left: ScheduleBlock, right: ScheduleBlock): number {
	const delta = left.startsAt.getTime() - right.startsAt.getTime()
	if (delta !== 0) return delta
	return left.key < right.key ? -1 : left.key > right.key ? 1 : 0
}

function naturalBlock(occurrence: Occurrence, naturalStart: Date, naturalDurationMinutes: number): ScheduleBlock {
	const away = movedAway(occurrence)
	return {
		key: occurrence.key,
		ref: occurrence.ref,
		studentId: occurrence.studentId,
		startsAt: naturalStart,
		timeZone: occurrence.timeZone,
		durationMinutes: away ? naturalDurationMinutes : occurrence.durationMinutes,
		status: away ? 'moved' : occurrence.status,
		movedTo: away ? occurrence.startsAt : null,
		movedFrom: null,
	}
}

function destinationBlock(occurrence: Occurrence): ScheduleBlock {
	return {
		key: occurrence.key,
		ref: occurrence.ref,
		studentId: occurrence.studentId,
		startsAt: occurrence.startsAt,
		timeZone: occurrence.timeZone,
		durationMinutes: occurrence.durationMinutes,
		status: occurrence.status === 'cancelled' ? 'cancelled' : 'scheduled',
		movedTo: null,
		movedFrom: occurrence.naturalStart,
	}
}

export function scheduleWindow(input: ScheduleInput & { from: Date; to: Date }): ScheduleBlock[] {
	const { series, exceptions, lessons, from, to } = input
	const index = exceptionIndex(exceptions)
	const rules = new Map(series.map((rule) => [rule.id, rule]))
	const blocks: ScheduleBlock[] = []
	for (const rule of series) {
		for (const date of windowDates(from, to, rule.timeZone)) {
			const occurrence = occurrenceAt(rule, date, index.get(seriesKey(rule.id, date)))
			if (occurrence?.naturalStart == null || !inWindow(occurrence.naturalStart, from, to)) continue
			blocks.push(naturalBlock(occurrence, occurrence.naturalStart, rule.durationMinutes))
		}
	}
	for (const exception of exceptions) {
		if (exception.kind === 'restored') continue
		const rule = rules.get(exception.seriesId)
		if (rule === undefined) continue
		const occurrence = occurrenceAt(rule, exception.originalOn, exception)
		if (occurrence === null || !movedAway(occurrence) || !inWindow(occurrence.startsAt, from, to)) continue
		blocks.push(destinationBlock(occurrence))
	}
	for (const lesson of lessons) {
		if (!inWindow(lesson.startsAt, from, to)) continue
		const ref: OccurrenceRef = { kind: 'single', lessonId: lesson.id }
		blocks.push({
			key: occurrenceKey(ref),
			ref,
			studentId: lesson.studentId,
			startsAt: lesson.startsAt,
			timeZone: lesson.timeZone,
			durationMinutes: lesson.durationMinutes,
			status: lesson.status,
			movedTo: null,
			movedFrom: null,
		})
	}
	return blocks.sort(byStart)
}

export type OutcomeBlock = ScheduleBlock & { outcome: LessonOutcome }

export function withOutcomes(blocks: readonly ScheduleBlock[], marks: ReadonlyMap<string, MarkKind>): OutcomeBlock[] {
	return blocks.map((block) => ({ ...block, outcome: lessonOutcome(block.status, marks.get(block.key) ?? null) }))
}

const SEARCH_DAYS = 366

export const MARK_LOOKBACK_DAYS = 366

const laterDate = (left: string, right: string) => (left > right ? left : right)

export function nextSeriesDate(rule: SeriesTiming, now: Date): string | null {
	const start = laterDate(scheduleToday(now, rule.timeZone), rule.startsOn)
	const limit = addDays(start, SEARCH_DAYS)
	for (let date = firstOnOrAfter(start, rule.weekday); date <= limit; date = addDays(date, 7)) {
		if (!isSeriesDate(rule, date)) return null
		const startsAt = seriesStart(rule, date)
		if (startsAt !== null && canChange(startsAt, now)) return date
	}
	return null
}

export function lastSeriesDateOnOrBefore(rule: SeriesTiming, date: string): string | null {
	const end = rule.endsOn !== null && rule.endsOn < date ? rule.endsOn : date
	const candidate = addDays(end, -((weekdayOf(end) - rule.weekday + 7) % 7))
	return isSeriesDate(rule, candidate) ? candidate : null
}

export function nextSeriesReference(input: {
	rule: SeriesRule
	exceptions: readonly SeriesException[]
	now: Date
}): { originalOn: string; actualStartsAt: Date; ruleStartsAt: Date | null } | null {
	const { rule, exceptions, now } = input
	const index = exceptionIndex(exceptions)
	let next: { originalOn: string; actualStartsAt: Date; ruleStartsAt: Date | null } | null = null
	const offer = (originalOn: string, occurrence: Occurrence | null) => {
		if (occurrence === null || occurrence.status === 'cancelled') return
		if (occurrence.startsAt.getTime() < now.getTime()) return
		if (next !== null && next.actualStartsAt.getTime() <= occurrence.startsAt.getTime()) return
		next = { originalOn, actualStartsAt: occurrence.startsAt, ruleStartsAt: occurrence.naturalStart }
	}
	const start = laterDate(scheduleToday(now, rule.timeZone), rule.startsOn)
	const limit = addDays(start, SEARCH_DAYS)
	for (let date = firstOnOrAfter(start, rule.weekday); date <= limit; date = addDays(date, 7)) {
		if (!isSeriesDate(rule, date)) break
		const occurrence = occurrenceAt(rule, date, index.get(seriesKey(rule.id, date)))
		if (occurrence?.status === 'scheduled' && occurrence.startsAt.getTime() >= now.getTime()) {
			offer(date, occurrence)
			break
		}
	}
	for (const exception of exceptions) {
		if (exception.seriesId !== rule.id || exception.kind !== 'moved') continue
		offer(exception.originalOn, occurrenceAt(rule, exception.originalOn, exception))
	}
	return next
}

export function nextLessons(input: ScheduleInput & { now: Date }): Map<string, Date> {
	const { series, exceptions, lessons, now } = input
	const next = new Map<string, Date>()
	const offer = (studentId: string, startsAt: Date) => {
		if (startsAt.getTime() < now.getTime()) return
		const current = next.get(studentId)
		if (current === undefined || startsAt.getTime() < current.getTime()) next.set(studentId, startsAt)
	}
	for (const rule of series) {
		const reference = nextSeriesReference({ rule, exceptions, now })
		if (reference !== null) offer(rule.studentId, reference.actualStartsAt)
	}
	for (const lesson of lessons) {
		if (lesson.status === 'scheduled') offer(lesson.studentId, lesson.startsAt)
	}
	return next
}

export type OverlapItem = { key: string; startsAt: Date; durationMinutes: number; outcome: LessonOutcome }

export function overlaps<T extends OverlapItem>(
	items: readonly T[],
	candidate: { startsAt: Date; durationMinutes: number },
	excludeKey?: string
): T[] {
	const start = candidate.startsAt.getTime()
	const end = start + candidate.durationMinutes * 60000
	return items.filter((item) => {
		if (!countsAsLesson(item.outcome) || item.key === excludeKey) return false
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
