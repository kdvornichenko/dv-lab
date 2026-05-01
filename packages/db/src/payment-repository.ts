import { and, desc, eq, isNull } from 'drizzle-orm'

import type { DB } from './factory'
import { payments } from './schema'

export type PaymentRow = typeof payments.$inferSelect
export type PaymentInsertValues = Omit<typeof payments.$inferInsert, 'id' | 'createdAt'>

export async function listPaymentRows(db: DB, teacherId: string): Promise<PaymentRow[]> {
	return db
		.select()
		.from(payments)
		.where(and(eq(payments.teacherId, teacherId), isNull(payments.voidedAt)))
		.orderBy(desc(payments.paidAt), desc(payments.createdAt))
}

export async function findPaymentRowByIdempotencyKey(
	db: DB,
	teacherId: string,
	idempotencyKey: string
): Promise<PaymentRow | null> {
	const [payment] = await db
		.select()
		.from(payments)
		.where(and(eq(payments.teacherId, teacherId), eq(payments.idempotencyKey, idempotencyKey)))
		.limit(1)

	return payment ?? null
}

export async function insertPaymentRow(db: DB, values: PaymentInsertValues): Promise<PaymentRow> {
	if (values.idempotencyKey) {
		const [payment] = await db
			.insert(payments)
			.values(values)
			.onConflictDoNothing({ target: [payments.teacherId, payments.idempotencyKey] })
			.returning()
		if (payment) return payment

		const existing = await findPaymentRowByIdempotencyKey(db, values.teacherId, values.idempotencyKey)
		if (existing) return existing
	}

	const [payment] = await db.insert(payments).values(values).returning()
	return payment
}

export async function getPaymentRow(db: DB, teacherId: string, paymentId: string): Promise<PaymentRow | null> {
	const [payment] = await db
		.select()
		.from(payments)
		.where(and(eq(payments.teacherId, teacherId), eq(payments.id, paymentId), isNull(payments.voidedAt)))
		.limit(1)

	return payment ?? null
}

export async function voidPaymentRow(db: DB, teacherId: string, paymentId: string): Promise<PaymentRow | null> {
	const [payment] = await db
		.update(payments)
		.set({ voidedAt: new Date() })
		.where(and(eq(payments.teacherId, teacherId), eq(payments.id, paymentId), isNull(payments.voidedAt)))
		.returning()

	return payment ?? null
}
