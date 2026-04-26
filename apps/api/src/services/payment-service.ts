import type { CreatePaymentInput, Payment, StudentBalance } from '@teacher-crm/api-types'
import {
	calculateStudentBalances,
	deletePaymentRow,
	insertPaymentRow,
	listAttendanceRows,
	listPaymentRows,
	listStudentRows,
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

function priceForStudent(student: Awaited<ReturnType<typeof listStudentRows>>[number] | undefined) {
	if (!student) return 0
	const packageLessonPrice =
		student.packageLessonCount > 0 ? Number(student.packageTotalPrice) / student.packageLessonCount : 0
	return student.billingMode === 'package' && packageLessonPrice > 0
		? packageLessonPrice
		: Number(student.defaultLessonPrice)
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
		const [attendance, students, payments] = await Promise.all([
			listAttendanceRows(db, teacherId),
			listStudentRows(db, teacherId, { status: 'all' }),
			listPaymentRows(db, teacherId),
		])
		const studentsById = new Map(students.map((student) => [student.id, student]))
		const charges = attendance.map((record) => ({
			studentId: record.studentId,
			amount: priceForStudent(studentsById.get(record.studentId)),
			billable: record.billable && record.status === 'attended',
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
