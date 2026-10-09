import { and, desc, eq, isNull, or, sql } from 'drizzle-orm'
import type { z } from 'zod'

import {
	CURRENCIES,
	type Currency,
	PAYMENT_SOURCES,
	type PaymentRow,
	type PaymentSource,
	type assignPaymentRequest,
	type recordPaymentRequest,
} from '@dv-lab/contracts'
import { creditedMinutes, decimalToHundredths, hundredthsToDecimal } from '@dv-lab/core'
import { type Database, type DbExecutor, payments, students } from '@dv-lab/db'

type RecordPaymentInput = z.output<typeof recordPaymentRequest>

type PaymentRecord = typeof payments.$inferSelect

type AssignPaymentInput = z.output<typeof assignPaymentRequest>

type RecordPaymentResult = { kind: 'recorded'; payment: PaymentRow } | { kind: 'not_found' }

type AssignPaymentResult =
	| { kind: 'assigned'; payment: PaymentRow }
	| { kind: 'not_found' }
	| { kind: 'currency_required' }
	| { kind: 'already_assigned' }

type ImportedPayment = {
	importKey: string
	studentId: string | null
	paidOn: string
	amountMinor: number
	currency: Currency | null
	note: string | null
}

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

export async function deletePayment(executor: DbExecutor, id: string): Promise<'deleted' | 'not_found'> {
	const [row] = await executor.delete(payments).where(eq(payments.id, id)).returning({ id: payments.id })
	return row ? 'deleted' : 'not_found'
}

export async function listUnassignedPayments(executor: DbExecutor): Promise<PaymentRow[]> {
	const rows = await executor
		.select()
		.from(payments)
		.where(isNull(payments.studentId))
		.orderBy(...newestFirst)
	return rows.map(toPaymentRow)
}

export function assignPayment(db: Database, id: string, input: AssignPaymentInput): Promise<AssignPaymentResult> {
	return db.transaction(async (tx): Promise<AssignPaymentResult> => {
		const [card] = await tx
			.select({ id: students.id, defaultLessonMinutes: students.defaultLessonMinutes })
			.from(students)
			.where(eq(students.id, input.studentId))
			.for('share')
		if (!card) return { kind: 'not_found' }
		const [current] = await tx.select({ currency: payments.currency }).from(payments).where(eq(payments.id, id))
		if (!current) return { kind: 'not_found' }
		const currency = current.currency ?? input.currency
		if (input.lessonsHundredths !== null && currency === null) return { kind: 'currency_required' }
		const [row] = await tx
			.update(payments)
			.set({
				studentId: card.id,
				currency: sql`coalesce(${payments.currency}, ${input.currency})`,
				lessonsCount: input.lessonsHundredths === null ? null : hundredthsToDecimal(input.lessonsHundredths),
				creditedMinutes: creditedMinutes(input.lessonsHundredths, card.defaultLessonMinutes),
			})
			.where(
				and(
					eq(payments.id, id),
					or(isNull(payments.studentId), and(eq(payments.studentId, card.id), isNull(payments.currency)))
				)
			)
			.returning()
		if (!row) return { kind: 'already_assigned' }
		return { kind: 'assigned', payment: toPaymentRow(row) }
	})
}

export async function addMissingPayments(executor: DbExecutor, rows: readonly ImportedPayment[]): Promise<number> {
	if (rows.length === 0) return 0
	const inserted = await executor
		.insert(payments)
		.values(
			rows.map((row) => ({
				studentId: row.studentId,
				paidOn: row.paidOn,
				amountMinor: row.amountMinor,
				currency: row.currency,
				lessonsCount: null,
				creditedMinutes: 0,
				note: row.note,
				source: 'vault',
				importKey: row.importKey,
			}))
		)
		.onConflictDoNothing({ target: payments.importKey })
		.returning({ id: payments.id })
	return inserted.length
}
