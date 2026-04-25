import type { CreateStudentInput, ListStudentsQuery, Student, UpdateStudentInput } from '@teacher-crm/api-types'
import {
	createDb,
	findOrCreateTeacherProfile,
	insertStudentRow,
	listStudentRows,
	updateStudentRow,
	type DB,
	type StudentRow,
	type StudentUpdateValues,
} from '@teacher-crm/db'

import { databaseUrl } from '../config/env'
import { memoryStore, type StoreScope } from './memory-store'

let dbHandle: ReturnType<typeof createDb> | undefined

function getDb(): DB | null {
	if (!databaseUrl) return null
	if (dbHandle === undefined) dbHandle = createDb(databaseUrl)
	return dbHandle.db
}

function emptyToNull(value: string | undefined) {
	const next = value?.trim()
	return next ? next : null
}

function priceToNumeric(value: number) {
	return value.toFixed(2)
}

function dateToIso(value: Date | string | null | undefined) {
	if (!value) return null
	return value instanceof Date ? value.toISOString() : value
}

function mapStudentRow(row: StudentRow): Student {
	return {
		id: row.id,
		fullName: row.fullName,
		email: row.email ?? '',
		phone: row.phone ?? '',
		level: row.level ?? '',
		status: row.status,
		notes: row.notes ?? '',
		defaultLessonPrice: Number(row.defaultLessonPrice),
		billingMode: row.billingMode,
		createdAt: dateToIso(row.createdAt) ?? new Date().toISOString(),
		updatedAt: dateToIso(row.updatedAt) ?? new Date().toISOString(),
	}
}

async function teacherProfileId(db: DB, scope: StoreScope) {
	return findOrCreateTeacherProfile(db, {
		authUserId: scope.teacherId,
		email: scope.email,
	})
}

function toInsertValues(teacherId: string, input: CreateStudentInput) {
	const archivedAt = input.status === 'archived' ? new Date() : null

	return {
		teacherId,
		fullName: input.fullName.trim(),
		email: emptyToNull(input.email),
		phone: emptyToNull(input.phone),
		level: emptyToNull(input.level),
		status: input.status,
		notes: emptyToNull(input.notes),
		defaultLessonPrice: priceToNumeric(input.defaultLessonPrice),
		billingMode: input.billingMode,
		archivedAt,
	}
}

function toUpdateValues(input: UpdateStudentInput): StudentUpdateValues {
	const values: StudentUpdateValues = {}

	if (input.fullName !== undefined) values.fullName = input.fullName.trim()
	if (input.email !== undefined) values.email = emptyToNull(input.email)
	if (input.phone !== undefined) values.phone = emptyToNull(input.phone)
	if (input.level !== undefined) values.level = emptyToNull(input.level)
	if (input.status !== undefined) {
		values.status = input.status
		values.archivedAt = input.status === 'archived' ? new Date() : null
	}
	if (input.notes !== undefined) values.notes = emptyToNull(input.notes)
	if (input.defaultLessonPrice !== undefined) values.defaultLessonPrice = priceToNumeric(input.defaultLessonPrice)
	if (input.billingMode !== undefined) values.billingMode = input.billingMode

	return values
}

export const studentService = {
	async listStudents(scope: StoreScope, filters: ListStudentsQuery) {
		const db = getDb()
		if (!db) return memoryStore.listStudents(scope, filters)

		const teacherId = await teacherProfileId(db, scope)
		return (await listStudentRows(db, teacherId, filters)).map(mapStudentRow)
	},

	async createStudent(scope: StoreScope, input: CreateStudentInput) {
		const db = getDb()
		if (!db) return memoryStore.createStudent(scope, input)

		const teacherId = await teacherProfileId(db, scope)
		return mapStudentRow(await insertStudentRow(db, toInsertValues(teacherId, input)))
	},

	async updateStudent(scope: StoreScope, studentId: string, input: UpdateStudentInput) {
		const db = getDb()
		if (!db) return memoryStore.updateStudent(scope, studentId, input)

		const teacherId = await teacherProfileId(db, scope)
		const student = await updateStudentRow(db, teacherId, studentId, toUpdateValues(input))
		return student ? mapStudentRow(student) : null
	},
}
