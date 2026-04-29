import { and, asc, eq, sql } from 'drizzle-orm'

import type { DB } from './factory'
import { lessonCharges, studentPackages } from './schema'

export type StudentPackageRow = typeof studentPackages.$inferSelect
export type StudentPackageInsertValues = Omit<typeof studentPackages.$inferInsert, 'id' | 'createdAt'>
export type StudentPackageUpdateValues = Partial<
	Omit<typeof studentPackages.$inferInsert, 'id' | 'teacherId' | 'studentId' | 'createdAt'>
>

export type LessonChargeRow = typeof lessonCharges.$inferSelect
export type LessonChargeInsertValues = Omit<typeof lessonCharges.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>

export async function listStudentPackageRows(db: DB, teacherId: string): Promise<StudentPackageRow[]> {
	return db
		.select()
		.from(studentPackages)
		.where(eq(studentPackages.teacherId, teacherId))
		.orderBy(asc(studentPackages.startsAt), asc(studentPackages.createdAt))
}

export async function insertStudentPackageRow(db: DB, values: StudentPackageInsertValues): Promise<StudentPackageRow> {
	const [studentPackage] = await db.insert(studentPackages).values(values).returning()
	return studentPackage
}

export async function updateStudentPackageRow(
	db: DB,
	teacherId: string,
	packageId: string,
	values: StudentPackageUpdateValues
): Promise<StudentPackageRow | null> {
	const [studentPackage] = await db
		.update(studentPackages)
		.set(values)
		.where(and(eq(studentPackages.teacherId, teacherId), eq(studentPackages.id, packageId)))
		.returning()

	return studentPackage ?? null
}

export async function clearLessonChargePackageRows(db: DB, teacherId: string, packageId: string): Promise<void> {
	await db
		.update(lessonCharges)
		.set({
			packageId: null,
			updatedAt: new Date(),
		})
		.where(and(eq(lessonCharges.teacherId, teacherId), eq(lessonCharges.packageId, packageId)))
}

export async function listLessonChargeRows(db: DB, teacherId: string): Promise<LessonChargeRow[]> {
	return db
		.select()
		.from(lessonCharges)
		.where(eq(lessonCharges.teacherId, teacherId))
		.orderBy(asc(lessonCharges.createdAt))
}

export async function upsertLessonChargeRow(db: DB, values: LessonChargeInsertValues): Promise<LessonChargeRow> {
	const [charge] = await db
		.insert(lessonCharges)
		.values(values)
		.onConflictDoUpdate({
			target: [lessonCharges.teacherId, lessonCharges.attendanceRecordId],
			set: {
				packageId: sql`excluded.package_id`,
				attendanceStatus: sql`excluded.attendance_status`,
				voidedAt: null,
				updatedAt: new Date(),
			},
		})
		.returning()

	return charge
}

export async function voidLessonChargeRow(
	db: DB,
	teacherId: string,
	attendanceRecordId: string
): Promise<LessonChargeRow | null> {
	const [charge] = await db
		.update(lessonCharges)
		.set({
			voidedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(and(eq(lessonCharges.teacherId, teacherId), eq(lessonCharges.attendanceRecordId, attendanceRecordId)))
		.returning()

	return charge ?? null
}
