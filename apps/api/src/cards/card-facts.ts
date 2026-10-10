import { inArray } from 'drizzle-orm'

import { type BalanceLesson, type BalancePayment, nextLessons, studentBalance } from '@dv-lab/core'
import { type DbExecutor, payments } from '@dv-lab/db'

import { loadMarkRows, loadScheduleRows, toBalanceCard } from '../schedule/rows.ts'
import type { CardRecord } from './card-rows.ts'

export type CardFacts = { balanceMinutes: number | null; nextLessonAt: string | null }

export const NO_CARD_FACTS: CardFacts = { balanceMinutes: null, nextLessonAt: null }

type FactSource = Pick<CardRecord, 'id' | 'openingBalanceMinutes' | 'openingBalanceOn' | 'noShowDeducts'>

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

async function cardBalances(executor: DbExecutor, cards: readonly FactSource[]): Promise<Map<string, number | null>> {
	if (cards.length === 0) return new Map()
	const ids = cards.map((card) => card.id)
	const paymentRows = await executor
		.select({ studentId: payments.studentId, paidOn: payments.paidOn, creditedMinutes: payments.creditedMinutes })
		.from(payments)
		.where(inArray(payments.studentId, ids))
	const paid: Map<string, BalancePayment[]> = groupBy(paymentRows)
	const held: Map<string, BalanceLesson[]> = groupBy(await loadMarkRows(executor, ids))
	return new Map(
		cards.map((card) => [
			card.id,
			studentBalance(toBalanceCard(card), paid.get(card.id) ?? [], held.get(card.id) ?? []),
		])
	)
}

async function cardNextLessons(
	executor: DbExecutor,
	cards: readonly FactSource[],
	now: Date
): Promise<Map<string, Date>> {
	const rows = await loadScheduleRows(executor, { from: now, to: null, studentIds: cards.map((card) => card.id) })
	return nextLessons({ ...rows, now })
}

export async function cardFacts(
	executor: DbExecutor,
	cards: readonly FactSource[],
	now: Date
): Promise<Map<string, CardFacts>> {
	const balances = await cardBalances(executor, cards)
	const next = await cardNextLessons(executor, cards, now)
	return new Map(
		cards.map((card) => [
			card.id,
			{ balanceMinutes: balances.get(card.id) ?? null, nextLessonAt: next.get(card.id)?.toISOString() ?? null },
		])
	)
}
