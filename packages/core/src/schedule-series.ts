import {
	canChange,
	emptySeriesEnd,
	hasOccurrences,
	lastSeriesDateOnOrBefore,
	nextSeriesDate,
	occurrenceAt,
	scheduleDate,
	scheduleToday,
	seriesStart,
	type MarkKind,
	type SeriesException,
	type SeriesRule,
	type SeriesTiming,
} from './schedule.ts'
import { addDays, firstOnOrAfter, sameTimeZone, startOfZonedDay, type Weekday } from './zoned.ts'

export type NewSeriesRule = Omit<SeriesRule, 'id'>

export type CutLesson = {
	studentId: string
	startsAt: Date
	timeZone: string
	durationMinutes: number
	originalOn: string
	status?: 'cancelled'
}

export type SeriesChange = { from: string; weekday: Weekday; startTime: string }

type SeriesContext = { now: Date; defaultTimeZone: string }

const laterDate = (left: string, right: string) => (left > right ? left : right)

export function seriesCutBoundary(
	rule: SeriesRule,
	date: string,
	defaultTimeZone: string,
	mode: 'from' | 'through'
): { instant: Date; naturalCutoff: string } {
	const instant = startOfZonedDay(mode === 'through' ? addDays(date, 1) : date, defaultTimeZone)
	const start = laterDate(rule.startsOn, scheduleDate(instant, rule.timeZone))
	let naturalCutoff = firstOnOrAfter(start, rule.weekday)
	for (;;) {
		const naturalStart = seriesStart(rule, naturalCutoff)
		if (naturalStart !== null && naturalStart.getTime() >= instant.getTime()) return { instant, naturalCutoff }
		naturalCutoff = addDays(naturalCutoff, 7)
	}
}

function preservedLessons(
	tail: SeriesRule,
	exceptions: readonly SeriesException[],
	marks: ReadonlyMap<string, MarkKind>
): CutLesson[] {
	const own = exceptions.filter((exception) => exception.seriesId === tail.id)
	const index = new Map(own.map((exception) => [exception.originalOn, exception]))
	const dates = new Set([...index.keys(), ...marks.keys()])
	const lessons: CutLesson[] = []
	for (const date of dates) {
		const exception = index.get(date)
		const occurrence = occurrenceAt(tail, date, exception)
		if (occurrence === null) continue
		const mark = marks.get(date)
		if (exception === undefined && (mark === undefined || mark === 'none')) continue
		lessons.push({
			studentId: tail.studentId,
			startsAt: occurrence.startsAt,
			timeZone: tail.timeZone,
			durationMinutes: occurrence.durationMinutes,
			originalOn: date,
			...(occurrence.status === 'cancelled' ? { status: 'cancelled' as const } : {}),
		})
	}
	return lessons
}

function finiteBoundary(rule: SeriesRule): { instant: Date; endsOn: string } | null {
	return rule.endsOn === null
		? null
		: { instant: startOfZonedDay(addDays(rule.endsOn, 1), rule.timeZone), endsOn: rule.endsOn }
}

function lastStartBefore(rule: SeriesTiming, boundary: Date): string | null {
	const before = scheduleDate(new Date(boundary.getTime() - 1), rule.timeZone)
	let date = lastSeriesDateOnOrBefore(rule, before)
	while (date !== null) {
		const start = seriesStart(rule, date)
		if (start !== null && start.getTime() < boundary.getTime()) return date
		date = lastSeriesDateOnOrBefore(rule, addDays(date, -7))
	}
	return null
}

export type CutSeriesResult =
	| { kind: 'invalid' }
	| { kind: 'changed' }
	| { kind: 'today_passed' }
	| { kind: 'nonexistent_local_time' }
	| { kind: 'ends_before_new_day'; endsOn: string }
	| { kind: 'ok'; oldEndsOn: string; newRule: NewSeriesRule; lessons: CutLesson[] }

function replacementRule(
	rule: SeriesRule,
	change: SeriesChange,
	context: SeriesContext,
	end: { instant: Date; endsOn: string } | null
):
	| { kind: 'ok'; rule: NewSeriesRule }
	| { kind: 'invalid' }
	| { kind: 'nonexistent_local_time' }
	| { kind: 'ends_before_new_day'; endsOn: string } {
	const { weekday, startTime, from } = change
	const candidate = { weekday, startTime, timeZone: context.defaultTimeZone, startsOn: from, endsOn: null }
	const first = firstOnOrAfter(from, weekday)
	if (seriesStart(candidate, first) === null) return { kind: 'nonexistent_local_time' }
	const startsOn = nextSeriesDate(candidate, context.now)
	if (startsOn === null) return { kind: 'invalid' }
	const endsOn = end === null ? null : lastStartBefore({ ...candidate, startsOn }, end.instant)
	if (end !== null && endsOn === null) return { kind: 'ends_before_new_day', endsOn: end.endsOn }
	return {
		kind: 'ok',
		rule: { ...candidate, studentId: rule.studentId, durationMinutes: rule.durationMinutes, startsOn, endsOn },
	}
}

export function cutSeries(
	rule: SeriesRule,
	exceptions: readonly SeriesException[],
	change: SeriesChange,
	context: SeriesContext,
	marks: ReadonlyMap<string, MarkKind> = new Map<string, MarkKind>()
): CutSeriesResult {
	if (!hasOccurrences(rule)) return { kind: 'changed' }
	const { now, defaultTimeZone } = context
	const today = scheduleToday(now, defaultTimeZone)
	if (change.from < today) return { kind: 'invalid' }
	const boundary = seriesCutBoundary(rule, change.from, defaultTimeZone, 'from')
	const end = finiteBoundary(rule)
	if (end !== null && end.instant.getTime() <= boundary.instant.getTime()) return { kind: 'changed' }
	if (
		change.weekday === rule.weekday &&
		change.startTime === rule.startTime &&
		sameTimeZone(defaultTimeZone, rule.timeZone)
	) {
		return { kind: 'invalid' }
	}
	const naturalStart = seriesStart(rule, boundary.naturalCutoff)
	if (change.from === today && naturalStart !== null && !canChange(naturalStart, now)) return { kind: 'today_passed' }
	const replacement = replacementRule(rule, change, context, end)
	if (replacement.kind !== 'ok') return replacement
	return {
		kind: 'ok',
		oldEndsOn: laterDate(addDays(boundary.naturalCutoff, -1), emptySeriesEnd(rule)),
		newRule: replacement.rule,
		lessons: preservedLessons({ ...rule, startsOn: boundary.naturalCutoff }, exceptions, marks),
	}
}

export type EndSeriesResult =
	{ kind: 'invalid' } | { kind: 'changed' } | { kind: 'ok'; endsOn: string; lessons: CutLesson[] }

export function endSeriesAt(
	rule: SeriesRule,
	exceptions: readonly SeriesException[],
	lastOn: string,
	context: SeriesContext,
	marks: ReadonlyMap<string, MarkKind> = new Map<string, MarkKind>()
): EndSeriesResult {
	if (!hasOccurrences(rule)) return { kind: 'changed' }
	const today = scheduleToday(context.now, context.defaultTimeZone)
	const end = finiteBoundary(rule)
	if (end !== null && end.instant.getTime() <= startOfZonedDay(today, context.defaultTimeZone).getTime())
		return { kind: 'changed' }
	if (lastOn < today) return { kind: 'invalid' }
	const boundary = seriesCutBoundary(rule, lastOn, context.defaultTimeZone, 'through')
	if (end !== null && boundary.instant.getTime() > end.instant.getTime()) return { kind: 'invalid' }
	const endsOn = lastStartBefore(rule, boundary.instant) ?? emptySeriesEnd(rule)
	return {
		kind: 'ok',
		endsOn,
		lessons: preservedLessons({ ...rule, startsOn: boundary.naturalCutoff }, exceptions, marks),
	}
}
