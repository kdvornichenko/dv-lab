import { and, eq, gte, inArray, isNull, lt, lte, or } from 'drizzle-orm'

import {
	type LessonMarkKind,
	MARK_KINDS,
	type ScheduleLessonActions,
	type ScheduleLessonOutcome,
} from '@dv-lab/contracts'
import {
	type BalanceCard,
	type BalanceLesson,
	type LessonActions,
	type LessonOutcome,
	type MarkKind,
	type OccurrenceRef,
	SCHEDULE_TIME_ZONE,
	type SeriesException,
	type SeriesRule,
	type SingleLesson,
	type Weekday,
	occurrenceAt,
	occurrenceKey,
	occurrenceOutcome,
	scheduleDate,
	windowDates,
} from '@dv-lab/core'
import {
	type Database,
	type DbExecutor,
	lessonExceptions,
	lessonMarks,
	lessonSeries,
	lessons,
	type students,
} from '@dv-lab/db'

type ScheduleRange = { from: Date; to: Date | null; studentIds?: readonly string[] }

type ScheduleRows = { series: SeriesRule[]; exceptions: SeriesException[]; lessons: SingleLesson[] }

export const seriesColumns = {
	id: lessonSeries.id,
	studentId: lessonSeries.studentId,
	weekday: lessonSeries.weekday,
	startTime: lessonSeries.startTime,
	durationMinutes: lessonSeries.durationMinutes,
	startsOn: lessonSeries.startsOn,
	endsOn: lessonSeries.endsOn,
}

export const exceptionColumns = {
	seriesId: lessonExceptions.seriesId,
	originalOn: lessonExceptions.originalOn,
	kind: lessonExceptions.kind,
	startsAt: lessonExceptions.startsAt,
	durationMinutes: lessonExceptions.durationMinutes,
}

export const lessonColumns = {
	id: lessons.id,
	studentId: lessons.studentId,
	startsAt: lessons.startsAt,
	durationMinutes: lessons.durationMinutes,
	status: lessons.status,
}

const markColumns = {
	seriesId: lessonMarks.seriesId,
	originalOn: lessonMarks.originalOn,
	lessonId: lessonMarks.lessonId,
	kind: lessonMarks.kind,
}

type SeriesRecord = Pick<typeof lessonSeries.$inferSelect, keyof typeof seriesColumns>

type ExceptionRecord = Pick<typeof lessonExceptions.$inferSelect, keyof typeof exceptionColumns>

type LessonRecord = Pick<typeof lessons.$inferSelect, keyof typeof lessonColumns>

type MarkRecord = Pick<typeof lessonMarks.$inferSelect, keyof typeof markColumns>

type BalanceRecord = Pick<typeof students.$inferSelect, 'openingBalanceMinutes' | 'openingBalanceOn' | 'noShowDeducts'>

type Mirror<Core, Wire> = [Core] extends [Wire] ? ([Wire] extends [Core] ? Wire : never) : never

export function toMarkKind(value: string): MarkKind {
	const known = MARK_KINDS.find((kind) => kind === value)
	if (known === undefined) throw new Error('unexpected lesson mark kind')
	return known
}

export function toWireOutcome(outcome: LessonOutcome): Mirror<LessonOutcome, ScheduleLessonOutcome> {
	return outcome
}

export function toWireMark(mark: MarkKind): Mirror<MarkKind, LessonMarkKind>
export function toWireMark(mark: MarkKind | null): Mirror<MarkKind, LessonMarkKind> | null
export function toWireMark(mark: MarkKind | null): Mirror<MarkKind, LessonMarkKind> | null {
	return mark
}

export function toWireActions(actions: LessonActions): Mirror<LessonActions, ScheduleLessonActions> {
	return { move: actions.move, cancel: actions.cancel, restore: actions.restore, mark: actions.mark }
}

export function toBalanceCard(row: BalanceRecord): BalanceCard {
	return {
		openingMinutes: row.openingBalanceMinutes,
		openingOn: row.openingBalanceOn,
		noShowDeducts: row.noShowDeducts,
	}
}

const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7]

function toWeekday(value: number): Weekday {
	const known = WEEKDAYS.find((weekday) => weekday === value)
	if (known === undefined) throw new Error('unexpected series weekday')
	return known
}

export function toSeriesRule(row: SeriesRecord): SeriesRule {
	return {
		id: row.id,
		studentId: row.studentId,
		weekday: toWeekday(row.weekday),
		startTime: row.startTime.slice(0, 5),
		durationMinutes: row.durationMinutes,
		startsOn: row.startsOn,
		endsOn: row.endsOn,
	}
}

export function toSeriesException(row: ExceptionRecord): SeriesException {
	const seriesId = row.seriesId
	const originalOn = row.originalOn
	switch (row.kind) {
		case 'cancelled':
			return row.startsAt === null || row.durationMinutes === null
				? { seriesId, originalOn, kind: 'cancelled' }
				: { seriesId, originalOn, kind: 'cancelled', startsAt: row.startsAt, durationMinutes: row.durationMinutes }
		case 'restored':
			return { seriesId, originalOn, kind: 'restored' }
		case 'moved':
			if (row.startsAt === null || row.durationMinutes === null) throw new Error('moved lesson exception has no time')
			return { seriesId, originalOn, kind: 'moved', startsAt: row.startsAt, durationMinutes: row.durationMinutes }
		default:
			throw new Error('unexpected lesson exception kind')
	}
}

function toLessonStatus(value: string): SingleLesson['status'] {
	if (value === 'scheduled' || value === 'cancelled') return value
	throw new Error('unexpected lesson status')
}

export function toSingleLesson(row: LessonRecord): SingleLesson {
	return {
		id: row.id,
		studentId: row.studentId,
		startsAt: row.startsAt,
		durationMinutes: row.durationMinutes,
		status: toLessonStatus(row.status),
	}
}

function dateBounds(from: Date, to: Date | null): { fromDate: string; toDate: string | null } | null {
	if (to === null) return { fromDate: scheduleDate(from), toDate: null }
	const dates = windowDates(from, to, SCHEDULE_TIME_ZONE)
	const first = dates[0]
	const last = dates[dates.length - 1]
	return first === undefined || last === undefined ? null : { fromDate: first, toDate: last }
}

export async function lockSeries(executor: DbExecutor, id: string): Promise<SeriesRule | null> {
	const [row] = await executor.select(seriesColumns).from(lessonSeries).where(eq(lessonSeries.id, id)).for('update')
	return row ? toSeriesRule(row) : null
}

export async function lockLesson(executor: DbExecutor, id: string): Promise<SingleLesson | null> {
	const [row] = await executor.select(lessonColumns).from(lessons).where(eq(lessons.id, id)).for('update')
	return row ? toSingleLesson(row) : null
}

export async function seriesException(
	executor: DbExecutor,
	seriesId: string,
	originalOn: string
): Promise<SeriesException | null> {
	const [row] = await executor
		.select(exceptionColumns)
		.from(lessonExceptions)
		.where(and(eq(lessonExceptions.seriesId, seriesId), eq(lessonExceptions.originalOn, originalOn)))
	return row ? toSeriesException(row) : null
}

export async function seriesExceptionsFrom(
	executor: DbExecutor,
	seriesId: string,
	from: string
): Promise<SeriesException[]> {
	const rows = await executor
		.select(exceptionColumns)
		.from(lessonExceptions)
		.where(and(eq(lessonExceptions.seriesId, seriesId), gte(lessonExceptions.originalOn, from)))
	return rows.map(toSeriesException)
}

function markRef(row: MarkRecord): OccurrenceRef {
	if (row.seriesId !== null && row.originalOn !== null) {
		return { kind: 'series', seriesId: row.seriesId, originalOn: row.originalOn }
	}
	if (row.lessonId !== null) return { kind: 'single', lessonId: row.lessonId }
	throw new Error('lesson mark has no occurrence')
}

export async function loadMarks(executor: DbExecutor, refs: readonly OccurrenceRef[]): Promise<Map<string, MarkKind>> {
	const wanted = new Set(refs.map(occurrenceKey))
	const seriesIds = [...new Set(refs.flatMap((ref) => (ref.kind === 'series' ? [ref.seriesId] : [])))]
	const lessonIds = [...new Set(refs.flatMap((ref) => (ref.kind === 'single' ? [ref.lessonId] : [])))]
	if (seriesIds.length === 0 && lessonIds.length === 0) return new Map()
	const rows = await executor
		.select(markColumns)
		.from(lessonMarks)
		.where(
			or(
				seriesIds.length === 0 ? undefined : inArray(lessonMarks.seriesId, seriesIds),
				lessonIds.length === 0 ? undefined : inArray(lessonMarks.lessonId, lessonIds)
			)
		)
	const marks = new Map<string, MarkKind>()
	for (const row of rows) {
		const key = occurrenceKey(markRef(row))
		if (wanted.has(key)) marks.set(key, toMarkKind(row.kind))
	}
	return marks
}

export async function markOf(executor: DbExecutor, ref: OccurrenceRef): Promise<MarkKind | null> {
	const [row] = await executor
		.select({ kind: lessonMarks.kind })
		.from(lessonMarks)
		.where(
			ref.kind === 'series'
				? and(eq(lessonMarks.seriesId, ref.seriesId), eq(lessonMarks.originalOn, ref.originalOn))
				: eq(lessonMarks.lessonId, ref.lessonId)
		)
	return row ? toMarkKind(row.kind) : null
}

export async function loadMarkRows(
	executor: DbExecutor,
	studentIds: readonly string[]
): Promise<Array<BalanceLesson & { studentId: string }>> {
	if (studentIds.length === 0) return []
	const ids = [...studentIds]
	const seriesRows = await executor
		.select({ ...seriesColumns, markOn: lessonMarks.originalOn, markKind: lessonMarks.kind })
		.from(lessonMarks)
		.innerJoin(lessonSeries, eq(lessonMarks.seriesId, lessonSeries.id))
		.where(inArray(lessonSeries.studentId, ids))
	const seriesIds = [...new Set(seriesRows.map((row) => row.id))]
	const exceptionRows =
		seriesIds.length === 0
			? []
			: await executor
					.select(exceptionColumns)
					.from(lessonExceptions)
					.where(inArray(lessonExceptions.seriesId, seriesIds))
	const exceptions = new Map<string, SeriesException>()
	for (const row of exceptionRows) {
		const exception = toSeriesException(row)
		exceptions.set(
			occurrenceKey({ kind: 'series', seriesId: exception.seriesId, originalOn: exception.originalOn }),
			exception
		)
	}
	const lessonRows = await executor
		.select({ ...lessonColumns, markKind: lessonMarks.kind })
		.from(lessonMarks)
		.innerJoin(lessons, eq(lessonMarks.lessonId, lessons.id))
		.where(inArray(lessons.studentId, ids))

	const result: Array<BalanceLesson & { studentId: string }> = []
	for (const row of seriesRows) {
		if (row.markOn === null) continue
		const exception = exceptions.get(occurrenceKey({ kind: 'series', seriesId: row.id, originalOn: row.markOn }))
		const occurrence = occurrenceAt(toSeriesRule(row), row.markOn, exception)
		if (occurrence === null) continue
		result.push({
			studentId: occurrence.studentId,
			startsAt: occurrence.startsAt,
			durationMinutes: occurrence.durationMinutes,
			outcome: occurrenceOutcome(occurrence, toMarkKind(row.markKind)),
		})
	}
	for (const row of lessonRows) {
		const lesson = toSingleLesson(row)
		result.push({
			studentId: lesson.studentId,
			startsAt: lesson.startsAt,
			durationMinutes: lesson.durationMinutes,
			outcome: occurrenceOutcome(lesson, toMarkKind(row.markKind)),
		})
	}
	return result
}

export function readSnapshot<T>(db: Database, read: (executor: DbExecutor) => Promise<T>): Promise<T> {
	return db.transaction((tx) => read(tx), { isolationLevel: 'repeatable read', accessMode: 'read only' })
}

const EMPTY_ROWS: ScheduleRows = { series: [], exceptions: [], lessons: [] }

export async function loadScheduleRows(executor: DbExecutor, range: ScheduleRange): Promise<ScheduleRows> {
	const { from, to, studentIds } = range
	if (studentIds !== undefined && studentIds.length === 0) return EMPTY_ROWS
	const bounds = dateBounds(from, to)
	if (bounds === null) return EMPTY_ROWS
	const { fromDate, toDate } = bounds
	const ofStudents = (column: typeof lessons.studentId | typeof lessonSeries.studentId) =>
		studentIds === undefined ? undefined : inArray(column, [...studentIds])

	const lessonRows = await executor
		.select(lessonColumns)
		.from(lessons)
		.where(
			and(
				gte(lessons.startsAt, from),
				to === null ? undefined : lt(lessons.startsAt, to),
				ofStudents(lessons.studentId)
			)
		)

	const seriesRows = await executor
		.select(seriesColumns)
		.from(lessonSeries)
		.where(
			and(
				or(isNull(lessonSeries.endsOn), gte(lessonSeries.endsOn, fromDate)),
				toDate === null ? undefined : lte(lessonSeries.startsOn, toDate),
				ofStudents(lessonSeries.studentId)
			)
		)

	const loadedIds = seriesRows.map((row) => row.id)
	const ofLoadedSeries =
		loadedIds.length === 0
			? undefined
			: and(
					inArray(lessonExceptions.seriesId, loadedIds),
					gte(lessonExceptions.originalOn, fromDate),
					toDate === null ? undefined : lte(lessonExceptions.originalOn, toDate)
				)
	const movedInWindow = and(
		inArray(lessonExceptions.kind, ['moved', 'cancelled']),
		gte(lessonExceptions.startsAt, from),
		to === null ? undefined : lt(lessonExceptions.startsAt, to)
	)
	const exceptionRows = await executor
		.select(exceptionColumns)
		.from(lessonExceptions)
		.innerJoin(lessonSeries, eq(lessonExceptions.seriesId, lessonSeries.id))
		.where(and(or(ofLoadedSeries, movedInWindow), ofStudents(lessonSeries.studentId)))

	const known = new Set(loadedIds)
	const missing = [...new Set(exceptionRows.map((row) => row.seriesId))].filter((id) => !known.has(id))
	const ownerRows =
		missing.length === 0
			? []
			: await executor.select(seriesColumns).from(lessonSeries).where(inArray(lessonSeries.id, missing))

	return {
		series: [...seriesRows, ...ownerRows].map(toSeriesRule),
		exceptions: exceptionRows.map(toSeriesException),
		lessons: lessonRows.map(toSingleLesson),
	}
}
