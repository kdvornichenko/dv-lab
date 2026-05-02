import { and, asc, eq, gte, inArray, lte, notInArray, sql, type SQL } from 'drizzle-orm'

import type { DB } from './factory'
import { attendanceRecords, lessonOccurrenceExceptions, lessons, lessonStudents } from './schema'

export type LessonStatusFilter = 'all' | 'planned' | 'completed' | 'cancelled' | 'rescheduled' | 'no_show'

export type LessonListFilters = {
	status?: LessonStatusFilter
	studentId?: string
	dateFrom?: string
	dateTo?: string
}

export type LessonRow = typeof lessons.$inferSelect
export type AttendanceRecordRow = typeof attendanceRecords.$inferSelect
export type LessonOccurrenceExceptionRow = typeof lessonOccurrenceExceptions.$inferSelect
export type LessonInsertValues = Omit<typeof lessons.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>
export type LessonUpdateValues = Partial<
	Omit<typeof lessons.$inferInsert, 'id' | 'teacherId' | 'createdAt' | 'updatedAt'>
>
export type AttendanceRecordUpsertValues = Omit<typeof attendanceRecords.$inferInsert, 'id' | 'updatedAt'>
export type LessonOccurrenceExceptionUpsertValues = Omit<
	typeof lessonOccurrenceExceptions.$inferInsert,
	'id' | 'createdAt'
>
export type LessonRowWithStudents = LessonRow & {
	studentIds: string[]
}

function parseDateBoundary(value: string | undefined, edge: 'start' | 'end') {
	const trimmed = value?.trim()
	if (!trimmed) return null
	const hasTime = trimmed.includes('T')
	return new Date(hasTime ? trimmed : `${trimmed}T${edge === 'start' ? '00:00:00.000' : '23:59:59.999'}Z`)
}

function groupLessonRows(
	rows: {
		lesson: LessonRow
		studentId: string | null
	}[]
): LessonRowWithStudents[] {
	const grouped = new Map<string, LessonRowWithStudents>()

	for (const row of rows) {
		const existing = grouped.get(row.lesson.id)
		if (existing) {
			if (row.studentId) existing.studentIds.push(row.studentId)
			continue
		}

		grouped.set(row.lesson.id, {
			...row.lesson,
			studentIds: row.studentId ? [row.studentId] : [],
		})
	}

	return Array.from(grouped.values())
}

async function readLessonStudents(db: DB, teacherId: string, lessonId: string) {
	return (
		await db
			.select({ studentId: lessonStudents.studentId })
			.from(lessonStudents)
			.where(and(eq(lessonStudents.teacherId, teacherId), eq(lessonStudents.lessonId, lessonId)))
	).map((row) => row.studentId)
}

export async function listLessonRows(
	db: DB,
	teacherId: string,
	filters: LessonListFilters = {}
): Promise<LessonRowWithStudents[]> {
	const conditions: SQL[] = [eq(lessons.teacherId, teacherId)]
	const dateFrom = parseDateBoundary(filters.dateFrom, 'start')
	const dateTo = parseDateBoundary(filters.dateTo, 'end')

	if (filters.status && filters.status !== 'all') conditions.push(eq(lessons.status, filters.status))
	if (filters.studentId) conditions.push(eq(lessonStudents.studentId, filters.studentId))
	if (dateFrom) conditions.push(gte(lessons.startsAt, dateFrom))
	if (dateTo) conditions.push(lte(lessons.startsAt, dateTo))

	const rows = await db
		.select({
			lesson: lessons,
			studentId: lessonStudents.studentId,
		})
		.from(lessons)
		.leftJoin(
			lessonStudents,
			and(eq(lessonStudents.teacherId, lessons.teacherId), eq(lessonStudents.lessonId, lessons.id))
		)
		.where(and(...conditions))
		.orderBy(asc(lessons.startsAt))

	return groupLessonRows(rows)
}

export async function getLessonRow(db: DB, teacherId: string, lessonId: string): Promise<LessonRowWithStudents | null> {
	const rows = await db
		.select({
			lesson: lessons,
			studentId: lessonStudents.studentId,
		})
		.from(lessons)
		.leftJoin(
			lessonStudents,
			and(eq(lessonStudents.teacherId, lessons.teacherId), eq(lessonStudents.lessonId, lessons.id))
		)
		.where(and(eq(lessons.teacherId, teacherId), eq(lessons.id, lessonId)))

	return groupLessonRows(rows)[0] ?? null
}

export async function insertLessonRow(
	db: DB,
	values: LessonInsertValues,
	studentIds: string[]
): Promise<LessonRowWithStudents> {
	return db.transaction(async (tx) => {
		const [lesson] = await tx.insert(lessons).values(values).returning()
		if (!lesson) throw new Error('Lesson insert did not return a row')

		await tx.insert(lessonStudents).values(
			studentIds.map((studentId) => ({
				teacherId: lesson.teacherId,
				lessonId: lesson.id,
				studentId,
			}))
		)

		return {
			...lesson,
			studentIds,
		}
	})
}

export async function updateLessonRow(
	db: DB,
	teacherId: string,
	lessonId: string,
	values: LessonUpdateValues,
	studentIds?: string[]
): Promise<LessonRowWithStudents | null> {
	return db.transaction(async (tx) => {
		const updateValues = {
			...values,
			updatedAt: new Date(),
		}
		const hasLessonPatch = Object.keys(values).length > 0
		const [lesson] = hasLessonPatch
			? await tx
					.update(lessons)
					.set(updateValues)
					.where(and(eq(lessons.teacherId, teacherId), eq(lessons.id, lessonId)))
					.returning()
			: await tx
					.select()
					.from(lessons)
					.where(and(eq(lessons.teacherId, teacherId), eq(lessons.id, lessonId)))
					.limit(1)

		if (!lesson) return null

		if (studentIds) {
			await tx
				.delete(lessonStudents)
				.where(and(eq(lessonStudents.teacherId, teacherId), eq(lessonStudents.lessonId, lessonId)))
			await tx
				.delete(attendanceRecords)
				.where(
					and(
						eq(attendanceRecords.teacherId, teacherId),
						eq(attendanceRecords.lessonId, lessonId),
						notInArray(attendanceRecords.studentId, studentIds)
					)
				)

			await tx.insert(lessonStudents).values(
				studentIds.map((studentId) => ({
					teacherId,
					lessonId,
					studentId,
				}))
			)
		}

		return {
			...lesson,
			studentIds: studentIds ?? (await readLessonStudents(tx, teacherId, lessonId)),
		}
	})
}

export async function deleteLessonRow(
	db: DB,
	teacherId: string,
	lessonId: string
): Promise<LessonRowWithStudents | null> {
	return db.transaction(async (tx) => {
		const studentIds = await readLessonStudents(tx, teacherId, lessonId)
		const [lesson] = await tx
			.delete(lessons)
			.where(and(eq(lessons.teacherId, teacherId), eq(lessons.id, lessonId)))
			.returning()

		if (!lesson) return null

		return {
			...lesson,
			studentIds,
		}
	})
}

export async function listLessonOccurrenceExceptionRows(
	db: DB,
	teacherId: string
): Promise<LessonOccurrenceExceptionRow[]> {
	return db
		.select()
		.from(lessonOccurrenceExceptions)
		.where(eq(lessonOccurrenceExceptions.teacherId, teacherId))
		.orderBy(asc(lessonOccurrenceExceptions.occurrenceStartsAt))
}

export async function upsertLessonOccurrenceExceptionRow(
	db: DB,
	values: LessonOccurrenceExceptionUpsertValues
): Promise<LessonOccurrenceExceptionRow> {
	const [exception] = await db
		.insert(lessonOccurrenceExceptions)
		.values(values)
		.onConflictDoUpdate({
			target: [
				lessonOccurrenceExceptions.teacherId,
				lessonOccurrenceExceptions.lessonId,
				lessonOccurrenceExceptions.occurrenceStartsAt,
			],
			set: {
				replacementLessonId: values.replacementLessonId ?? null,
				reason: values.reason,
			},
		})
		.returning()

	return exception
}

export async function updateLessonTitlesForStudent(
	db: DB,
	teacherId: string,
	studentId: string,
	title: string
): Promise<number> {
	const relatedLessons = await db
		.select({ lessonId: lessonStudents.lessonId })
		.from(lessonStudents)
		.where(and(eq(lessonStudents.teacherId, teacherId), eq(lessonStudents.studentId, studentId)))

	const lessonIds = relatedLessons.map((row) => row.lessonId)
	if (lessonIds.length === 0) return 0

	const updatedLessons = await db
		.update(lessons)
		.set({
			title,
			updatedAt: new Date(),
		})
		.where(and(eq(lessons.teacherId, teacherId), inArray(lessons.id, lessonIds)))
		.returning({ id: lessons.id })

	return updatedLessons.length
}

export async function listAttendanceRows(
	db: DB,
	teacherId: string,
	filters: { lessonId?: string } = {}
): Promise<AttendanceRecordRow[]> {
	const conditions: SQL[] = [eq(attendanceRecords.teacherId, teacherId)]
	if (filters.lessonId) conditions.push(eq(attendanceRecords.lessonId, filters.lessonId))

	return db
		.select()
		.from(attendanceRecords)
		.where(and(...conditions))
		.orderBy(asc(attendanceRecords.updatedAt))
}

export async function upsertAttendanceRows(
	db: DB,
	records: AttendanceRecordUpsertValues[],
	options: { preserveExistingNote?: boolean } = {}
): Promise<AttendanceRecordRow[]> {
	if (records.length === 0) return []

	return db
		.insert(attendanceRecords)
		.values(records)
		.onConflictDoUpdate({
			target: [attendanceRecords.teacherId, attendanceRecords.lessonId, attendanceRecords.studentId],
			set: {
				status: sql`excluded.status`,
				billable: sql`excluded.billable`,
				note: options.preserveExistingNote
					? sql`coalesce(excluded.note, ${attendanceRecords.note})`
					: sql`excluded.note`,
				updatedAt: new Date(),
			},
		})
		.returning()
}
