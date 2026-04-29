import {
	BILLABLE_ATTENDANCE_STATUSES,
	calculatePackageLessonPriceRub,
	getLessonDurationUnits,
	type CreatePaymentInput,
	type Payment,
	type StudentBalance,
} from '@teacher-crm/api-types'
import {
	calculateStudentBalances,
	deletePaymentRow,
	insertPaymentRow,
	listAttendanceRows,
	listLessonRows,
	listPaymentRows,
	listStudentRows,
	type LessonRowWithStudents,
	type PaymentRow,
} from '@teacher-crm/db'

import { getDb, teacherProfileId } from './db-context'
import { memoryStore } from './memory-store'
import type { StoreScope } from './store-scope'

function dateToIso(value: Date | string | null | undefined) {
	if (!value) return new Date().toISOString()
	if (value instanceof Date) return value.toISOString()
	return value.includes('T') ? value : `${value}T00:00:00.000Z`
}

function paymentDate(value: string) {
	return value.slice(0, 10)
}

function mapPaymentRow(row: PaymentRow): Payment {
	return {
		id: row.id,
		studentId: row.studentId,
		amount: Number(row.amount),
		paidAt: dateToIso(row.paidAt),
		method: row.method,
		comment: row.comment ?? undefined,
		correctionOfPaymentId: row.correctionOfPaymentId ?? undefined,
		createdAt: dateToIso(row.createdAt),
	}
}

function priceForStudent(
	student: Awaited<ReturnType<typeof listStudentRows>>[number] | undefined,
	lesson: LessonRowWithStudents | undefined
) {
	if (!student) return 0
	const durationUnits = lesson ? getLessonDurationUnits(lesson.durationMinutes) : 1
	const packageLessonPrice = calculatePackageLessonPriceRub({
		defaultLessonPrice: Number(student.defaultLessonPrice),
		defaultLessonDurationMinutes: lesson?.durationMinutes ?? student.defaultLessonDurationMinutes,
		packageMonths: student.packageMonths,
	})
	return student.billingMode === 'package' && packageLessonPrice > 0
		? packageLessonPrice
		: Number(student.defaultLessonPrice) * durationUnits
}

export const paymentService = {
	async listPayments(scope: StoreScope) {
		const db = getDb()
		if (!db) return memoryStore.listPayments(scope)

		const teacherId = await teacherProfileId(db, scope)
		return (await listPaymentRows(db, teacherId)).map(mapPaymentRow)
	},

	async createPayment(scope: StoreScope, input: CreatePaymentInput) {
		const db = getDb()
		if (!db) return memoryStore.createPayment(scope, input)

		const teacherId = await teacherProfileId(db, scope)
		return mapPaymentRow(
			await insertPaymentRow(db, {
				teacherId,
				studentId: input.studentId,
				amount: input.amount.toFixed(2),
				paidAt: paymentDate(input.paidAt),
				method: input.method,
				comment: input.comment?.trim() || null,
				correctionOfPaymentId: input.correctionOfPaymentId ?? null,
			})
		)
	},

	async deletePayment(scope: StoreScope, paymentId: string) {
		const db = getDb()
		if (!db) return memoryStore.deletePayment(scope, paymentId)

		const teacherId = await teacherProfileId(db, scope)
		const payment = await deletePaymentRow(db, teacherId, paymentId)
		return payment ? mapPaymentRow(payment) : null
	},

	async listStudentBalances(scope: StoreScope): Promise<StudentBalance[]> {
		const db = getDb()
		if (!db) return memoryStore.listStudentBalances(scope)

		const teacherId = await teacherProfileId(db, scope)
		const [attendance, students, payments, lessons] = await Promise.all([
			listAttendanceRows(db, teacherId),
			listStudentRows(db, teacherId, { status: 'all' }),
			listPaymentRows(db, teacherId),
			listLessonRows(db, teacherId, { status: 'all' }),
		])
		const studentsById = new Map(students.map((student) => [student.id, student]))
		const lessonsById = new Map(lessons.map((lesson) => [lesson.id, lesson]))
		const charges = attendance.map((record) => ({
			studentId: record.studentId,
			amount: priceForStudent(studentsById.get(record.studentId), lessonsById.get(record.lessonId)),
			billable: record.billable && (BILLABLE_ATTENDANCE_STATUSES as readonly string[]).includes(record.status),
		}))

		return calculateStudentBalances(
			charges,
			payments.map((payment) => ({
				studentId: payment.studentId,
				amount: Number(payment.amount),
			}))
		)
	},
}
