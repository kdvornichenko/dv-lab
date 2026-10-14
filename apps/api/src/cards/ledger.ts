import { inArray } from 'drizzle-orm'

import type { StudentLastPayment } from '@dv-lab/contracts'
import { type LedgerLesson, type StudentLedger, studentLedger } from '@dv-lab/core'
import { type DbExecutor, payments } from '@dv-lab/db'

import { loadMarkRows, toBalanceCard } from '../schedule/rows.ts'
import { type CardRecord, toCurrency } from './card-rows.ts'

export type LedgerSource = Pick<CardRecord, 'id' | 'openingBalanceMinutes' | 'openingBalanceOn' | 'noShowDeducts'>

export type LedgerPaymentRow = StudentLastPayment & { createdAt: Date }

export type CardLedger = {
	ledger: StudentLedger
	payments: LedgerPaymentRow[]
	lessons: LedgerLesson[]
	lastPayment: StudentLastPayment | null
}

function groupBy<T extends { studentId: string | null }>(rows: readonly T[]): Map<string, T[]> {
	const groups = new Map<string, T[]>()
	for (const row of rows) {
		if (row.studentId === null) continue
		const list = groups.get(row.studentId) ?? []
		list.push(row)
		groups.set(row.studentId, list)
	}
	return groups
}

function passLedger(
	card: LedgerSource,
	paid: LedgerPaymentRow[],
	lessons: LedgerLesson[],
	timeZone: string
): CardLedger {
	const ledger = studentLedger(toBalanceCard(card), paid, lessons, timeZone)
	const last = ledger.lastPayment === null ? null : paid.find((payment) => payment.id === ledger.lastPayment?.id)
	return {
		ledger,
		payments: paid,
		lessons,
		lastPayment:
			last === undefined || last === null
				? null
				: {
						id: last.id,
						paidOn: last.paidOn,
						amountMinor: last.amountMinor,
						currency: last.currency,
						creditedMinutes: last.creditedMinutes,
					},
	}
}

export async function readStudentLedgers(
	executor: DbExecutor,
	cards: readonly LedgerSource[],
	timeZone: string
): Promise<Map<string, CardLedger>> {
	if (cards.length === 0) return new Map<string, CardLedger>()
	const ids = cards.map((card) => card.id)
	const paymentRows = await executor
		.select({
			id: payments.id,
			studentId: payments.studentId,
			paidOn: payments.paidOn,
			creditedMinutes: payments.creditedMinutes,
			createdAt: payments.createdAt,
			amountMinor: payments.amountMinor,
			currency: payments.currency,
		})
		.from(payments)
		.where(inArray(payments.studentId, ids))
	const paid = groupBy(
		paymentRows.map((row) => ({
			id: row.id,
			studentId: row.studentId,
			paidOn: row.paidOn,
			creditedMinutes: row.creditedMinutes,
			createdAt: row.createdAt,
			amountMinor: row.amountMinor,
			currency: toCurrency(row.currency),
		}))
	)
	const held = groupBy(await loadMarkRows(executor, ids))
	return new Map(
		cards.map((card) => [card.id, passLedger(card, paid.get(card.id) ?? [], held.get(card.id) ?? [], timeZone)])
	)
}

export function withLessons(
	card: LedgerSource,
	base: CardLedger,
	extra: readonly LedgerLesson[],
	timeZone: string
): CardLedger {
	const known = new Set(base.lessons.map((lesson) => lesson.key))
	const added = extra.filter((lesson) => !known.has(lesson.key))
	if (added.length === 0) return base
	return passLedger(card, base.payments, [...base.lessons, ...added], timeZone)
}
