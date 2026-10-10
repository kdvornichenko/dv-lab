import { and, eq, gt, inArray, isNotNull } from 'drizzle-orm'

import { balanceMinutes, nextLessons } from '@dv-lab/core'
import { type DbExecutor, payments, students } from '@dv-lab/db'

import { loadScheduleRows } from '../schedule/rows.ts'
import type { CardRecord } from './card-rows.ts'

export type CardFacts = { balanceMinutes: number | null; nextLessonAt: string | null }

export const NO_CARD_FACTS: CardFacts = { balanceMinutes: null, nextLessonAt: null }

type FactSource = Pick<CardRecord, 'id' | 'openingBalanceMinutes' | 'openingBalanceOn'>

async function cardBalances(executor: DbExecutor, cards: readonly FactSource[]): Promise<Map<string, number | null>> {
	const opened = cards.filter((card) => card.openingBalanceMinutes !== null && card.openingBalanceOn !== null)
	const credited = new Map<string, number[]>()
	if (opened.length > 0) {
		const rows = await executor
			.select({ studentId: payments.studentId, creditedMinutes: payments.creditedMinutes })
			.from(payments)
			.innerJoin(students, eq(payments.studentId, students.id))
			.where(
				and(
					inArray(
						payments.studentId,
						opened.map((card) => card.id)
					),
					isNotNull(students.openingBalanceOn),
					gt(payments.paidOn, students.openingBalanceOn),
					gt(payments.creditedMinutes, 0)
				)
			)
		for (const row of rows) {
			if (row.studentId === null) continue
			const list = credited.get(row.studentId) ?? []
			list.push(row.creditedMinutes)
			credited.set(row.studentId, list)
		}
	}
	return new Map(
		cards.map((card) => [card.id, balanceMinutes(card.openingBalanceMinutes, credited.get(card.id) ?? [])])
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
