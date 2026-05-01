import {
	calculatePackageLessonCount,
	calculatePackageTotalPriceRub,
	DEFAULT_LESSON_DURATION_MINUTES,
	type CreateStudentInput,
	type ListStudentsQuery,
	type Student,
	type UpdateStudentInput,
} from '@teacher-crm/api-types'
import {
	deleteStudentRow,
	getStudentRow,
	insertStudentRow,
	listStudentRows,
	updateLessonTitlesForStudent,
	updateStudentRow,
	type StudentRow,
	type StudentUpdateValues,
} from '@teacher-crm/db'

import { getDb, teacherProfileId } from './db-context'
import { getMemoryStore } from './storage-context'
import type { StoreScope } from './store-scope'

function emptyToNull(value: string | undefined) {
	const next = value?.trim()
	return next ? next : null
}

function nameParts(input: { firstName?: string; lastName?: string; fullName?: string }) {
	const firstName = input.firstName?.trim()
	const lastName = input.lastName?.trim()
	if (firstName || lastName) {
		return {
			firstName: firstName ?? '',
			lastName: lastName ?? '',
		}
	}

	const parts = input.fullName?.trim().split(/\s+/).filter(Boolean) ?? []
	return {
		firstName: parts[0] ?? '',
		lastName: parts.slice(1).join(' '),
	}
}

function fullNameFromParts(firstName: string, lastName: string) {
	return [firstName, lastName].filter(Boolean).join(' ').trim()
}

function studentLessonTitle(student: Pick<StudentRow, 'firstName' | 'lastName' | 'fullName'>) {
	const fallbackParts = nameParts({ fullName: student.fullName })
	const firstName = student.firstName || fallbackParts.firstName || student.fullName
	const lastName = student.lastName || fallbackParts.lastName
	const lastInitial = lastName.trim() ? `${lastName.trim()[0]}.` : ''
	return [firstName, lastInitial].filter(Boolean).join(' ')
}

function priceToNumeric(value: number) {
	return value.toFixed(2)
}

function calculateStudentPackageTotal(input: {
	defaultLessonPrice: number
	defaultLessonDurationMinutes: number
	packageMonths: number
	packageLessonCount: number
}) {
	return calculatePackageTotalPriceRub(input)
}

function resolvePackageLessonCount(
	input: {
		packageMonths?: number
		packageLessonsPerWeek?: number
		packageLessonCount?: number
	},
	existing?: Pick<StudentRow, 'packageMonths' | 'packageLessonsPerWeek' | 'packageLessonCount'>
) {
	const packageMonths = input.packageMonths ?? existing?.packageMonths ?? 0
	const packageLessonsPerWeek = input.packageLessonsPerWeek ?? existing?.packageLessonsPerWeek ?? 0
	const derivedLessonCount = calculatePackageLessonCount({ packageMonths, packageLessonsPerWeek })
	return derivedLessonCount > 0 ? derivedLessonCount : (input.packageLessonCount ?? existing?.packageLessonCount ?? 0)
}

function dateToIso(value: Date | string | null | undefined) {
	if (!value) return null
	return value instanceof Date ? value.toISOString() : value
}

function mapStudentRow(row: StudentRow): Student {
	const fallbackNameParts = nameParts({ fullName: row.fullName })
	const firstName = row.firstName || fallbackNameParts.firstName
	const lastName = row.lastName || fallbackNameParts.lastName
	return {
		id: row.id,
		firstName,
		lastName,
		fullName: row.fullName,
		email: row.email ?? '',
		phone: row.phone ?? '',
		level: row.level ?? '',
		special: row.special ?? '',
		status: row.status,
		notes: row.notes ?? '',
		defaultLessonPrice: Number(row.defaultLessonPrice),
		defaultLessonDurationMinutes: row.defaultLessonDurationMinutes ?? DEFAULT_LESSON_DURATION_MINUTES,
		packageMonths: row.packageMonths,
		packageLessonsPerWeek: row.packageLessonsPerWeek,
		packageLessonCount: row.packageLessonCount,
		packageTotalPrice: Number(row.packageTotalPrice),
		currency: row.currency,
		billingMode: row.billingMode,
		createdAt: dateToIso(row.createdAt) ?? new Date().toISOString(),
		updatedAt: dateToIso(row.updatedAt) ?? new Date().toISOString(),
	}
}

function toInsertValues(teacherId: string, input: CreateStudentInput) {
	const archivedAt = input.status === 'archived' ? new Date() : null
	const parts = nameParts(input)
	const fullName = fullNameFromParts(parts.firstName, parts.lastName) || input.fullName.trim()
	const packageLessonCount = resolvePackageLessonCount(input)
	const packageTotalPrice = calculateStudentPackageTotal({
		defaultLessonPrice: input.defaultLessonPrice,
		defaultLessonDurationMinutes: input.defaultLessonDurationMinutes,
		packageMonths: input.packageMonths,
		packageLessonCount,
	})

	return {
		teacherId,
		firstName: parts.firstName,
		lastName: parts.lastName,
		fullName,
		email: emptyToNull(input.email),
		phone: emptyToNull(input.phone),
		level: emptyToNull(input.level),
		special: emptyToNull(input.special),
		status: input.status,
		notes: emptyToNull(input.notes),
		defaultLessonPrice: priceToNumeric(input.defaultLessonPrice),
		defaultLessonDurationMinutes: input.defaultLessonDurationMinutes,
		packageMonths: input.packageMonths,
		packageLessonsPerWeek: input.packageLessonsPerWeek,
		packageLessonCount,
		packageTotalPrice: priceToNumeric(packageTotalPrice),
		currency: input.currency,
		billingMode: input.billingMode,
		archivedAt,
	}
}

function toUpdateValues(input: UpdateStudentInput, existing: StudentRow): StudentUpdateValues {
	const values: StudentUpdateValues = {}
	const hasNamePatch = input.firstName !== undefined || input.lastName !== undefined || input.fullName !== undefined

	if (hasNamePatch) {
		const parts = nameParts({
			firstName: input.firstName ?? existing.firstName,
			lastName: input.lastName ?? existing.lastName,
			fullName: input.fullName ?? existing.fullName,
		})
		if (input.firstName !== undefined) values.firstName = parts.firstName
		if (input.lastName !== undefined) values.lastName = parts.lastName
		values.fullName = fullNameFromParts(parts.firstName, parts.lastName) || input.fullName?.trim() || ''
	}
	if (input.email !== undefined) values.email = emptyToNull(input.email)
	if (input.phone !== undefined) values.phone = emptyToNull(input.phone)
	if (input.level !== undefined) values.level = emptyToNull(input.level)
	if (input.special !== undefined) values.special = emptyToNull(input.special)
	if (input.status !== undefined) {
		values.status = input.status
		values.archivedAt = input.status === 'archived' ? new Date() : null
	}
	if (input.notes !== undefined) values.notes = emptyToNull(input.notes)
	if (input.defaultLessonPrice !== undefined) values.defaultLessonPrice = priceToNumeric(input.defaultLessonPrice)
	if (input.defaultLessonDurationMinutes !== undefined) {
		values.defaultLessonDurationMinutes = input.defaultLessonDurationMinutes
	}
	if (input.currency !== undefined) values.currency = input.currency
	if (input.packageMonths !== undefined) values.packageMonths = input.packageMonths
	if (input.packageLessonsPerWeek !== undefined) values.packageLessonsPerWeek = input.packageLessonsPerWeek
	if (
		input.packageMonths !== undefined ||
		input.packageLessonsPerWeek !== undefined ||
		input.packageLessonCount !== undefined
	) {
		values.packageLessonCount = resolvePackageLessonCount(input, existing)
	}
	if (
		input.defaultLessonPrice !== undefined ||
		input.defaultLessonDurationMinutes !== undefined ||
		input.packageMonths !== undefined ||
		input.packageLessonsPerWeek !== undefined ||
		input.packageLessonCount !== undefined
	) {
		const packageLessonCount = resolvePackageLessonCount(input, existing)
		values.packageTotalPrice = priceToNumeric(
			calculateStudentPackageTotal({
				defaultLessonPrice: input.defaultLessonPrice ?? Number(existing.defaultLessonPrice),
				defaultLessonDurationMinutes:
					input.defaultLessonDurationMinutes ??
					existing.defaultLessonDurationMinutes ??
					DEFAULT_LESSON_DURATION_MINUTES,
				packageMonths: input.packageMonths ?? existing.packageMonths,
				packageLessonCount,
			})
		)
	}
	if (input.billingMode !== undefined) values.billingMode = input.billingMode

	return values
}

export const studentService = {
	async listStudents(scope: StoreScope, filters: ListStudentsQuery) {
		const db = getDb()
		if (!db) return getMemoryStore().listStudents(scope, filters)

		const teacherId = await teacherProfileId(db, scope)
		return (await listStudentRows(db, teacherId, filters)).map(mapStudentRow)
	},

	async createStudent(scope: StoreScope, input: CreateStudentInput) {
		const db = getDb()
		if (!db) return getMemoryStore().createStudent(scope, input)

		const teacherId = await teacherProfileId(db, scope)
		return mapStudentRow(await insertStudentRow(db, toInsertValues(teacherId, input)))
	},

	async updateStudent(scope: StoreScope, studentId: string, input: UpdateStudentInput) {
		const db = getDb()
		if (!db) return getMemoryStore().updateStudent(scope, studentId, input)

		const teacherId = await teacherProfileId(db, scope)
		const existing = await getStudentRow(db, teacherId, studentId)
		if (!existing) return null
		const student = await updateStudentRow(db, teacherId, studentId, toUpdateValues(input, existing))
		if (student && (input.firstName !== undefined || input.lastName !== undefined || input.fullName !== undefined)) {
			await updateLessonTitlesForStudent(db, teacherId, studentId, studentLessonTitle(student))
		}
		return student ? mapStudentRow(student) : null
	},

	async deleteStudent(scope: StoreScope, studentId: string) {
		const db = getDb()
		if (!db) return getMemoryStore().deleteStudent(scope, studentId)

		const teacherId = await teacherProfileId(db, scope)
		const student = await deleteStudentRow(db, teacherId, studentId)
		return student ? mapStudentRow(student) : null
	},
}
