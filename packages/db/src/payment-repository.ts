import { and, desc, eq } from 'drizzle-orm'

import type { DB } from './factory'
import { payments } from './schema'

export type PaymentRow = typeof payments.$inferSelect
export type PaymentInsertValues = Omit<typeof payments.$inferInsert, 'id' | 'createdAt'>

export async function listPaymentRows(db: DB, teacherId: string): Promise<PaymentRow[]> {
	return db
		.select()
		.from(payments)
		.where(eq(payments.teacherId, teacherId))
		.orderBy(desc(payments.paidAt), desc(payments.createdAt))
}

export async function insertPaymentRow(db: DB, values: PaymentInsertValues): Promise<PaymentRow> {
	const [payment] = await db.insert(payments).values(values).returning()
	return payment
}

export async function deletePaymentRow(db: DB, teacherId: string, paymentId: string): Promise<PaymentRow | null> {
	const [payment] = await db
		.delete(payments)
		.where(and(eq(payments.teacherId, teacherId), eq(payments.id, paymentId)))
		.returning()

	return payment ?? null
}
