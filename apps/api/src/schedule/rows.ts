import { and, eq, gte, inArray, isNull, lt, lte, or } from 'drizzle-orm'

import {
	SCHEDULE_TIME_ZONE,
	type SeriesException,
	type SeriesRule,
	type SingleLesson,
	type Weekday,
	windowDates,
	zonedParts,
} from '@dv-lab/core'
import { type Database, type DbExecutor, lessonExceptions, lessonSeries, lessons } from '@dv-lab/db'

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

type SeriesRecord = Pick<typeof lessonSeries.$inferSelect, keyof typeof seriesColumns>

type ExceptionRecord = Pick<typeof lessonExceptions.$inferSelect, keyof typeof exceptionColumns>

type LessonRecord = Pick<typeof lessons.$inferSelect, keyof typeof lessonColumns>

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
	if (to === null) return { fromDate: zonedParts(from, SCHEDULE_TIME_ZONE).date, toDate: null }
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
