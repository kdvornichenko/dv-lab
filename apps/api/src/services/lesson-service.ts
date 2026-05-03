import type {
	AttendanceRecord,
	CreateLessonInput,
	Lesson,
	LessonOccurrenceException,
	ListLessonsQuery,
	MarkAttendanceInput,
	UpdateLessonInput,
} from '@teacher-crm/api-types'
import {
	deleteLessonRow,
	getLessonRow,
	insertLessonRow,
	listAttendanceRows,
	listLessonOccurrenceExceptionRows,
	listLessonRows,
	updateLessonRow,
	upsertLessonOccurrenceExceptionRow,
	upsertAttendanceRows,
	type DB,
	type AttendanceRecordRow,
	type LessonOccurrenceExceptionRow,
	type LessonRowWithStudents,
	type LessonUpdateValues,
} from '@teacher-crm/db'

import { billingService } from './billing-service'
import { getDb, runWithDbContext, teacherProfileId } from './db-context'
import { getMemoryStore } from './storage-context'
import type { StoreScope } from './store-scope'

function emptyToNull(value: string | undefined) {
	const next = value?.trim()
	return next ? next : null
}

function dateToIso(value: Date | string | null | undefined) {
	if (!value) return null
	return value instanceof Date ? value.toISOString() : value
}

function mapLessonRow(row: LessonRowWithStudents): Lesson {
	return {
		id: row.id,
		title: row.title,
		startsAt: dateToIso(row.startsAt) ?? new Date().toISOString(),
		durationMinutes: row.durationMinutes,
		repeatWeekly: row.repeatWeekly,
		topic: row.topic ?? '',
		notes: row.notes ?? '',
		status: row.status,
		studentIds: row.studentIds,
		createdAt: dateToIso(row.createdAt) ?? new Date().toISOString(),
		updatedAt: dateToIso(row.updatedAt) ?? new Date().toISOString(),
	}
}

function mapAttendanceRow(row: AttendanceRecordRow): AttendanceRecord {
	return {
		id: row.id,
		lessonId: row.lessonId,
		studentId: row.studentId,
		status: row.status,
		billable: row.billable,
		note: row.note ?? '',
		updatedAt: dateToIso(row.updatedAt) ?? new Date().toISOString(),
	}
}

function mapOccurrenceExceptionRow(row: LessonOccurrenceExceptionRow): LessonOccurrenceException {
	return {
		id: row.id,
		lessonId: row.lessonId,
		occurrenceStartsAt: dateToIso(row.occurrenceStartsAt) ?? new Date().toISOString(),
		replacementLessonId: row.replacementLessonId ?? undefined,
		reason: row.reason === 'deleted' ? 'deleted' : 'moved',
		createdAt: dateToIso(row.createdAt) ?? new Date().toISOString(),
	}
}

function toInsertValues(teacherId: string, input: CreateLessonInput) {
	return {
		teacherId,
		title: input.title.trim(),
		startsAt: new Date(input.startsAt),
		durationMinutes: input.durationMinutes,
		repeatWeekly: input.repeatWeekly,
		topic: emptyToNull(input.topic),
		notes: emptyToNull(input.notes),
		status: input.status,
	}
}

function toUpdateValues(input: UpdateLessonInput): LessonUpdateValues {
	const values: LessonUpdateValues = {}

	if (input.title !== undefined) values.title = input.title.trim()
	if (input.startsAt !== undefined) values.startsAt = new Date(input.startsAt)
	if (input.durationMinutes !== undefined) values.durationMinutes = input.durationMinutes
	if (input.repeatWeekly !== undefined) values.repeatWeekly = input.repeatWeekly
	if (input.topic !== undefined) values.topic = emptyToNull(input.topic)
	if (input.notes !== undefined) values.notes = emptyToNull(input.notes)
	if (input.status !== undefined) values.status = input.status

	return values
}

function attendanceForLessonStatus(
	status: Lesson['status']
): Pick<MarkAttendanceInput['records'][number], 'status' | 'billable'> {
	if (status === 'completed') return { status: 'attended', billable: true }
	if (status === 'no_show') return { status: 'no_show', billable: true }
	if (status === 'cancelled') return { status: 'cancelled', billable: false }
	if (status === 'rescheduled') return { status: 'rescheduled', billable: false }
	return { status: 'planned', billable: true }
}

export class LessonServiceError extends Error {
	constructor(
		readonly code: 'LESSON_NOT_FOUND' | 'STUDENT_NOT_IN_LESSON',
		message: string
	) {
		super(message)
		this.name = 'LessonServiceError'
	}
}

function assertAttendanceRoster(lesson: Pick<Lesson, 'id' | 'studentIds'> | null, input: MarkAttendanceInput) {
	if (!lesson) throw new LessonServiceError('LESSON_NOT_FOUND', 'Lesson not found for attendance')
	const lessonStudentIds = new Set(lesson.studentIds)
	const unknownStudentIds = input.records
		.map((record) => record.studentId)
		.filter((studentId) => !lessonStudentIds.has(studentId))
	if (unknownStudentIds.length > 0) {
		throw new LessonServiceError('STUDENT_NOT_IN_LESSON', 'Attendance student is not enrolled in this lesson')
	}
}

async function syncLessonAttendanceForStatus(
	db: Parameters<typeof upsertAttendanceRows>[0],
	teacherId: string,
	lesson: LessonRowWithStudents
) {
	const attendancePatch = attendanceForLessonStatus(lesson.status)
	await upsertAttendanceRows(
		db,
		lesson.studentIds.map((studentId) => ({
			teacherId,
			lessonId: lesson.id,
			studentId,
			status: attendancePatch.status,
			billable: attendancePatch.billable,
			note: null,
		})),
		{ preserveExistingNote: true }
	)
}

export const lessonService = {
	async listLessons(scope: StoreScope, filters: ListLessonsQuery) {
		const db = getDb()
		if (!db) return getMemoryStore().listLessons(scope, filters)

		const teacherId = await teacherProfileId(db, scope)
		return (await listLessonRows(db, teacherId, filters)).map(mapLessonRow)
	},

	async listOccurrenceExceptions(scope: StoreScope) {
		const db = getDb()
		if (!db) return getMemoryStore().listLessonOccurrenceExceptions(scope)

		const teacherId = await teacherProfileId(db, scope)
		return (await listLessonOccurrenceExceptionRows(db, teacherId)).map(mapOccurrenceExceptionRow)
	},

	async upsertOccurrenceException(
		scope: StoreScope,
		input: {
			lessonId: string
			occurrenceStartsAt: string
			replacementLessonId?: string
			reason: LessonOccurrenceException['reason']
		}
	) {
		const db = getDb()
		if (!db) return getMemoryStore().upsertLessonOccurrenceException(scope, input)

		const teacherId = await teacherProfileId(db, scope)
		return mapOccurrenceExceptionRow(
			await upsertLessonOccurrenceExceptionRow(db, {
				teacherId,
				lessonId: input.lessonId,
				occurrenceStartsAt: new Date(input.occurrenceStartsAt),
				replacementLessonId: input.replacementLessonId ?? null,
				reason: input.reason,
			})
		)
	},

	async createLesson(scope: StoreScope, input: CreateLessonInput) {
		const db = getDb()
		if (!db) return getMemoryStore().createLesson(scope, input)

		const teacherId = await teacherProfileId(db, scope)
		return db.transaction((tx) =>
			runWithDbContext({ db: tx as DB }, async () => {
				const lesson = await insertLessonRow(tx as DB, toInsertValues(teacherId, input), input.studentIds)
				await syncLessonAttendanceForStatus(tx as DB, teacherId, lesson)
				await billingService.syncLessonChargesForLesson(scope, lesson.id)
				return mapLessonRow(lesson)
			})
		)
	},

	async updateLesson(scope: StoreScope, lessonId: string, input: UpdateLessonInput) {
		const db = getDb()
		if (!db) return getMemoryStore().updateLesson(scope, lessonId, input)

		const teacherId = await teacherProfileId(db, scope)
		return db.transaction((tx) =>
			runWithDbContext({ db: tx as DB }, async () => {
				const lesson = await updateLessonRow(tx as DB, teacherId, lessonId, toUpdateValues(input), input.studentIds)
				if (lesson && (input.status !== undefined || input.studentIds !== undefined)) {
					await syncLessonAttendanceForStatus(tx as DB, teacherId, lesson)
				}
				if (lesson) await billingService.syncLessonChargesForLesson(scope, lesson.id)
				return lesson ? mapLessonRow(lesson) : null
			})
		)
	},

	async deleteLesson(scope: StoreScope, lessonId: string) {
		const db = getDb()
		if (!db) return getMemoryStore().deleteLesson(scope, lessonId)

		const teacherId = await teacherProfileId(db, scope)
		const lesson = await deleteLessonRow(db, teacherId, lessonId)
		return lesson ? mapLessonRow(lesson) : null
	},

	async listAttendance(scope: StoreScope) {
		const db = getDb()
		if (!db) return getMemoryStore().listAttendance(scope)

		const teacherId = await teacherProfileId(db, scope)
		return (await listAttendanceRows(db, teacherId)).map(mapAttendanceRow)
	},

	async markAttendance(scope: StoreScope, input: MarkAttendanceInput) {
		const db = getDb()
		if (!db) {
			const store = getMemoryStore()
			const lesson = store
				.listLessons(scope, { status: 'all', studentId: '', dateFrom: '', dateTo: '' })
				.find((item) => item.id === input.lessonId)
			assertAttendanceRoster(lesson ?? null, input)
			return store.markAttendance(scope, input)
		}

		const teacherId = await teacherProfileId(db, scope)
		return db.transaction((tx) =>
			runWithDbContext({ db: tx as DB }, async () => {
				const lesson = await getLessonRow(tx as DB, teacherId, input.lessonId)
				assertAttendanceRoster(lesson ? mapLessonRow(lesson) : null, input)
				const updatedAttendance = (
					await upsertAttendanceRows(
						tx as DB,
						input.records.map((record) => ({
							teacherId,
							lessonId: input.lessonId,
							studentId: record.studentId,
							status: record.status,
							billable: record.billable,
							note: emptyToNull(record.note),
						}))
					)
				).map(mapAttendanceRow)
				await billingService.syncLessonChargesForLesson(scope, input.lessonId)
				return updatedAttendance
			})
		)
	},
}
