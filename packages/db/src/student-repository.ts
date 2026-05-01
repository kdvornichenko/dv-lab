import { and, asc, eq, ilike, inArray, or, type SQL } from 'drizzle-orm'

import type { DB } from './factory'
import { students, teacherProfiles } from './schema'

export type StudentStatusFilter = 'all' | 'active' | 'paused' | 'archived'

export type StudentListFilters = {
	status?: StudentStatusFilter
	search?: string
}

export type TeacherProfileIdentity = {
	authUserId: string
	email?: string | null
	displayName?: string | null
}

export type StudentRow = typeof students.$inferSelect
export type StudentInsertValues = Omit<typeof students.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>
export type StudentUpdateValues = Partial<
	Omit<typeof students.$inferInsert, 'id' | 'teacherId' | 'createdAt' | 'updatedAt'>
>

export async function findOrCreateTeacherProfile(db: DB, identity: TeacherProfileIdentity): Promise<string> {
	const now = new Date()
	const [profile] = await db
		.insert(teacherProfiles)
		.values({
			authUserId: identity.authUserId,
			email: identity.email ?? null,
			displayName: identity.displayName ?? null,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: teacherProfiles.authUserId,
			set: {
				email: identity.email ?? null,
				displayName: identity.displayName ?? null,
				updatedAt: now,
			},
		})
		.returning({ id: teacherProfiles.id })

	return profile.id
}

export async function listStudentRows(
	db: DB,
	teacherId: string,
	filters: StudentListFilters = {}
): Promise<StudentRow[]> {
	const conditions: SQL[] = [eq(students.teacherId, teacherId)]
	const search = filters.search?.trim()

	if (filters.status && filters.status !== 'all') {
		conditions.push(eq(students.status, filters.status))
	}

	if (search) {
		const pattern = `%${search}%`
		const searchCondition = or(
			ilike(students.firstName, pattern),
			ilike(students.lastName, pattern),
			ilike(students.fullName, pattern),
			ilike(students.email, pattern),
			ilike(students.phone, pattern),
			ilike(students.level, pattern),
			ilike(students.special, pattern),
			ilike(students.notes, pattern)
		)
		if (searchCondition) conditions.push(searchCondition)
	}

	return db
		.select()
		.from(students)
		.where(and(...conditions))
		.orderBy(asc(students.fullName))
}

export async function getStudentRow(db: DB, teacherId: string, studentId: string): Promise<StudentRow | null> {
	const [student] = await db
		.select()
		.from(students)
		.where(and(eq(students.teacherId, teacherId), eq(students.id, studentId)))
		.limit(1)

	return student ?? null
}

export async function listStudentRowsByIds(db: DB, teacherId: string, studentIds: string[]): Promise<StudentRow[]> {
	if (studentIds.length === 0) return []
	return db
		.select()
		.from(students)
		.where(and(eq(students.teacherId, teacherId), inArray(students.id, studentIds)))
}

export async function insertStudentRow(db: DB, values: StudentInsertValues): Promise<StudentRow> {
	const [student] = await db.insert(students).values(values).returning()
	return student
}

export async function updateStudentRow(
	db: DB,
	teacherId: string,
	studentId: string,
	values: StudentUpdateValues
): Promise<StudentRow | null> {
	const [student] = await db
		.update(students)
		.set({
			...values,
			updatedAt: new Date(),
		})
		.where(and(eq(students.teacherId, teacherId), eq(students.id, studentId)))
		.returning()

	return student ?? null
}

export async function deleteStudentRow(db: DB, teacherId: string, studentId: string): Promise<StudentRow | null> {
	const [student] = await db
		.delete(students)
		.where(and(eq(students.teacherId, teacherId), eq(students.id, studentId)))
		.returning()

	return student ?? null
}
