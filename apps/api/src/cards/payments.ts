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
	type updatePaymentRequest,
} from '@dv-lab/contracts'
import { creditedMinutes, decimalToHundredths, hundredthsToDecimal, isAfterScheduleToday } from '@dv-lab/core'
import { type Database, type DbExecutor, payments, students } from '@dv-lab/db'

import { lockTeacherTimeContext } from '../settings/settings.ts'

type RecordPaymentInput = z.output<typeof recordPaymentRequest>

type PaymentRecord = typeof payments.$inferSelect

type AssignPaymentInput = z.output<typeof assignPaymentRequest>

type PaymentCard = { id: string; defaultLessonMinutes: number }

type NewPayment = Pick<RecordPaymentInput, 'paidOn' | 'amountMinor' | 'currency' | 'lessonsHundredths' | 'note'>

type RecordPaymentResult =
	| { kind: 'recorded'; payment: PaymentRow }
	| { kind: 'not_found' }
	| { kind: 'invalid' }
	| { kind: 'default_time_zone_changed' }

type AssignPaymentResult =
	| { kind: 'assigned'; payment: PaymentRow }
	| { kind: 'not_found' }
	| { kind: 'currency_required' }
	| { kind: 'already_assigned' }
	| { kind: 'changed' }

type UpdatePaymentInput = z.output<typeof updatePaymentRequest>

type UpdatePaymentResult =
	| { kind: 'updated'; payment: PaymentRow }
	| { kind: 'not_found' }
	| { kind: 'invalid' }
	| { kind: 'changed' }
	| { kind: 'default_time_zone_changed' }

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
		revision: row.revision,
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

export function recordPayment(
	db: Database,
	accountId: string,
	input: RecordPaymentInput
): Promise<RecordPaymentResult> {
	return db.transaction(async (tx): Promise<RecordPaymentResult> => {
		const time = await lockTeacherTimeContext(tx, accountId, input.expectedDefaultTimeZone)
		if (!time.ok) return { kind: time.error }
		if (isAfterScheduleToday(input.paidOn, time.context.now, time.context.defaultTimeZone)) return { kind: 'invalid' }
		const [card] = await tx
			.select({ id: students.id, defaultLessonMinutes: students.defaultLessonMinutes })
			.from(students)
			.where(eq(students.id, input.studentId))
			.for('share')
		if (!card) return { kind: 'not_found' }
		return { kind: 'recorded', payment: await insertPayment(tx, card, input) }
	})
}

export async function insertPayment(executor: DbExecutor, card: PaymentCard, input: NewPayment): Promise<PaymentRow> {
	const [row] = await executor
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
	return toPaymentRow(row)
}

export function updatePayment(
	db: Database,
	accountId: string,
	id: string,
	input: UpdatePaymentInput
): Promise<UpdatePaymentResult> {
	return db.transaction(async (tx): Promise<UpdatePaymentResult> => {
		const time = await lockTeacherTimeContext(tx, accountId, input.expectedDefaultTimeZone)
		if (!time.ok) return { kind: time.error }
		if (isAfterScheduleToday(input.paidOn, time.context.now, time.context.defaultTimeZone)) return { kind: 'invalid' }
		const [current] = await tx
			.select({
				studentId: payments.studentId,
				revision: payments.revision,
				lessonsCount: payments.lessonsCount,
				creditedMinutes: payments.creditedMinutes,
			})
			.from(payments)
			.where(eq(payments.id, id))
			.for('update')
		if (!current) return { kind: 'not_found' }
		if (current.studentId === null) return { kind: 'invalid' }
		if (current.revision !== input.expectedRevision) return { kind: 'changed' }
		const storedHundredths = current.lessonsCount === null ? null : decimalToHundredths(current.lessonsCount)
		let credited = current.creditedMinutes
		if (storedHundredths !== input.lessonsHundredths) {
			const [card] = await tx
				.select({ defaultLessonMinutes: students.defaultLessonMinutes })
				.from(students)
				.where(eq(students.id, current.studentId))
				.for('share')
			if (!card) throw new Error('payment card is missing')
			credited = creditedMinutes(input.lessonsHundredths, card.defaultLessonMinutes)
		}
		const [row] = await tx
			.update(payments)
			.set({
				paidOn: input.paidOn,
				amountMinor: input.amountMinor,
				currency: input.currency,
				lessonsCount: input.lessonsHundredths === null ? null : hundredthsToDecimal(input.lessonsHundredths),
				creditedMinutes: credited,
				note: input.note,
				revision: sql`${payments.revision} + 1`,
			})
			.where(eq(payments.id, id))
			.returning()
		if (!row) throw new Error('payment update returned no row')
		return { kind: 'updated', payment: toPaymentRow(row) }
	})
}

export async function deletePayment(
	executor: DbExecutor,
	id: string,
	expectedRevision?: number
): Promise<'deleted' | 'not_found' | 'changed'> {
	const [row] = await executor
		.delete(payments)
		.where(
			and(eq(payments.id, id), expectedRevision === undefined ? undefined : eq(payments.revision, expectedRevision))
		)
		.returning({ id: payments.id })
	if (row) return 'deleted'
	const [current] = await executor.select({ id: payments.id }).from(payments).where(eq(payments.id, id))
	return current ? 'changed' : 'not_found'
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
		const [current] = await tx
			.select({ currency: payments.currency, revision: payments.revision })
			.from(payments)
			.where(eq(payments.id, id))
			.for('update')
		if (!current) return { kind: 'not_found' }
		if (input.expectedRevision !== undefined && current.revision !== input.expectedRevision) return { kind: 'changed' }
		const currency = current.currency ?? input.currency
		if (input.lessonsHundredths !== null && currency === null) return { kind: 'currency_required' }
		const [row] = await tx
			.update(payments)
			.set({
				studentId: card.id,
				currency: sql`coalesce(${payments.currency}, ${input.currency})`,
				lessonsCount: input.lessonsHundredths === null ? null : hundredthsToDecimal(input.lessonsHundredths),
				creditedMinutes: creditedMinutes(input.lessonsHundredths, card.defaultLessonMinutes),
				revision: sql`${payments.revision} + 1`,
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
