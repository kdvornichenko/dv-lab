import { desc, eq } from 'drizzle-orm'
import type { z } from 'zod'

import {
	CURRENCIES,
	type Currency,
	PAYMENT_SOURCES,
	type PaymentRow,
	type PaymentSource,
	type recordPaymentRequest,
} from '@dv-lab/contracts'
import { creditedMinutes, decimalToHundredths, hundredthsToDecimal } from '@dv-lab/core'
import { type Database, type DbExecutor, payments, students } from '@dv-lab/db'

type RecordPaymentInput = z.output<typeof recordPaymentRequest>

type PaymentRecord = typeof payments.$inferSelect

type RecordPaymentResult = { kind: 'recorded'; payment: PaymentRow } | { kind: 'not_found' }

function toCurrency(value: string | null): Currency | null {
	if (value === null) return null
	const known = CURRENCIES.find((currency) => currency === value)
	if (!known) throw new Error('unexpected payment currency')
	return known
}

function toSource(value: string): PaymentSource {
	const known = PAYMENT_SOURCES.find((source) => source === value)
	if (!known) throw new Error('unexpected payment source')
	return known
}

function toPaymentRow(row: PaymentRecord): PaymentRow {
	return {
		id: row.id,
		studentId: row.studentId,
		paidOn: row.paidOn,
		amountMinor: row.amountMinor,
		currency: toCurrency(row.currency),
		lessonsHundredths: row.lessonsCount === null ? null : decimalToHundredths(row.lessonsCount),
		creditedMinutes: row.creditedMinutes,
		note: row.note,
		source: toSource(row.source),
		createdAt: row.createdAt.toISOString(),
	}
}

const newestFirst = [desc(payments.paidOn), desc(payments.createdAt), desc(payments.id)]

export async function listCardPayments(executor: DbExecutor, studentId: string): Promise<PaymentRow[] | null> {
	const [card] = await executor.select({ id: students.id }).from(students).where(eq(students.id, studentId))
	if (!card) return null
	const rows = await executor
		.select()
		.from(payments)
		.where(eq(payments.studentId, studentId))
		.orderBy(...newestFirst)
	return rows.map(toPaymentRow)
}

export function recordPayment(db: Database, input: RecordPaymentInput): Promise<RecordPaymentResult> {
	return db.transaction(async (tx): Promise<RecordPaymentResult> => {
		const [card] = await tx
			.select({ id: students.id, defaultLessonMinutes: students.defaultLessonMinutes })
			.from(students)
			.where(eq(students.id, input.studentId))
			.for('share')
		if (!card) return { kind: 'not_found' }
		const [row] = await tx
			.insert(payments)
			.values({
				studentId: card.id,
				paidOn: input.paidOn,
				amountMinor: input.amountMinor,
				currency: input.currency,
				lessonsCount: input.lessonsHundredths === null ? null : hundredthsToDecimal(input.lessonsHundredths),
				creditedMinutes: creditedMinutes(input.lessonsHundredths, card.defaultLessonMinutes),
				note: input.note,
				source: 'manual',
			})
			.returning()
		if (!row) throw new Error('payment insert returned no row')
		return { kind: 'recorded', payment: toPaymentRow(row) }
	})
}
