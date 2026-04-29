import type {
	AttendanceRecord,
	CreateLessonInput,
	Lesson,
	ListLessonsQuery,
	MarkAttendanceInput,
	UpdateLessonInput,
} from '@teacher-crm/api-types'
import {
	deleteLessonRow,
	insertLessonRow,
	listAttendanceRows,
	listLessonRows,
	updateLessonRow,
	upsertAttendanceRows,
	type AttendanceRecordRow,
	type LessonRowWithStudents,
	type LessonUpdateValues,
} from '@teacher-crm/db'

import { getDb, teacherProfileId } from './db-context'
import { memoryStore } from './memory-store'
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
		if (!db) return memoryStore.listLessons(scope, filters)

		const teacherId = await teacherProfileId(db, scope)
		return (await listLessonRows(db, teacherId, filters)).map(mapLessonRow)
	},

	async createLesson(scope: StoreScope, input: CreateLessonInput) {
		const db = getDb()
		if (!db) return memoryStore.createLesson(scope, input)

		const teacherId = await teacherProfileId(db, scope)
		const lesson = await insertLessonRow(db, toInsertValues(teacherId, input), input.studentIds)
		await syncLessonAttendanceForStatus(db, teacherId, lesson)
		return mapLessonRow(lesson)
	},

	async updateLesson(scope: StoreScope, lessonId: string, input: UpdateLessonInput) {
		const db = getDb()
		if (!db) return memoryStore.updateLesson(scope, lessonId, input)

		const teacherId = await teacherProfileId(db, scope)
		const lesson = await updateLessonRow(db, teacherId, lessonId, toUpdateValues(input), input.studentIds)
		if (lesson && (input.status !== undefined || input.studentIds !== undefined)) {
			await syncLessonAttendanceForStatus(db, teacherId, lesson)
		}
		return lesson ? mapLessonRow(lesson) : null
	},

	async deleteLesson(scope: StoreScope, lessonId: string) {
		const db = getDb()
		if (!db) return memoryStore.deleteLesson(scope, lessonId)

		const teacherId = await teacherProfileId(db, scope)
		const lesson = await deleteLessonRow(db, teacherId, lessonId)
		return lesson ? mapLessonRow(lesson) : null
	},

	async listAttendance(scope: StoreScope) {
		const db = getDb()
		if (!db) return memoryStore.listAttendance(scope)

		const teacherId = await teacherProfileId(db, scope)
		return (await listAttendanceRows(db, teacherId)).map(mapAttendanceRow)
	},

	async markAttendance(scope: StoreScope, input: MarkAttendanceInput) {
		const db = getDb()
		if (!db) return memoryStore.markAttendance(scope, input)

		const teacherId = await teacherProfileId(db, scope)
		return (
			await upsertAttendanceRows(
				db,
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
	},
}
