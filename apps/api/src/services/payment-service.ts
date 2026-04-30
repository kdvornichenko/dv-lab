import { type CreatePaymentInput, type Payment, type StudentBalance } from '@teacher-crm/api-types'
import {
	deletePaymentRow,
	findPaymentRowByIdempotencyKey,
	insertPaymentRow,
	listPaymentRows,
	listStudentRows,
	type PaymentRow,
} from '@teacher-crm/db'

import { billingService } from './billing-service'
import { getDb, teacherProfileId } from './db-context'
import { getMemoryStore } from './storage-context'
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
		currency: row.currency,
		paidAt: dateToIso(row.paidAt),
		method: row.method,
		comment: row.comment ?? undefined,
		correctionOfPaymentId: row.correctionOfPaymentId ?? undefined,
		packageId: row.packageId ?? undefined,
		idempotencyKey: row.idempotencyKey ?? undefined,
		createdAt: dateToIso(row.createdAt),
	}
}

export const paymentService = {
	async listPayments(scope: StoreScope) {
		const db = getDb()
		if (!db) return getMemoryStore().listPayments(scope)

		const teacherId = await teacherProfileId(db, scope)
		return (await listPaymentRows(db, teacherId)).map(mapPaymentRow)
	},

	async createPayment(scope: StoreScope, input: CreatePaymentInput) {
		const db = getDb()
		if (!db) return getMemoryStore().createPayment(scope, input)

		const teacherId = await teacherProfileId(db, scope)
		if (input.idempotencyKey) {
			const existing = await findPaymentRowByIdempotencyKey(db, teacherId, input.idempotencyKey)
			if (existing) return mapPaymentRow(existing)
		}

		const student = (await listStudentRows(db, teacherId, { status: 'all' })).find((row) => row.id === input.studentId)
		const currency =
			input.packagePurchase && student?.billingMode === 'package'
				? student.currency
				: (input.currency ?? student?.currency ?? 'RUB')
		const studentPackage =
			input.packagePurchase && student?.billingMode === 'package'
				? await billingService.createPackageForPayment(scope, student, input.paidAt)
				: null
		return mapPaymentRow(
			await insertPaymentRow(db, {
				teacherId,
				studentId: input.studentId,
				packageId: studentPackage?.id ?? null,
				amount: input.amount.toFixed(2),
				currency,
				paidAt: paymentDate(input.paidAt),
				method: input.method,
				comment: input.comment?.trim() || null,
				correctionOfPaymentId: input.correctionOfPaymentId ?? null,
				idempotencyKey: input.idempotencyKey ?? null,
			})
		)
	},

	async deletePayment(scope: StoreScope, paymentId: string) {
		const db = getDb()
		if (!db) return getMemoryStore().deletePayment(scope, paymentId)

		const teacherId = await teacherProfileId(db, scope)
		const payment = await deletePaymentRow(db, teacherId, paymentId)
		if (payment?.packageId) await billingService.cancelPackage(scope, payment.packageId)
		return payment ? mapPaymentRow(payment) : null
	},

	async listStudentBalances(scope: StoreScope): Promise<StudentBalance[]> {
		return billingService.listStudentBalances(scope)
	},
}
