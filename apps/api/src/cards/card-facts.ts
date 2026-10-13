import { inArray } from 'drizzle-orm'

import type { NextLessonRead } from '@dv-lab/contracts'
import { type BalanceLesson, type BalancePayment, lessonDay, studentBalance } from '@dv-lab/core'
import { type DbExecutor, payments } from '@dv-lab/db'

import { readNextLessons } from '../calendar/read-model.ts'
import type { CalendarReadContext } from '../calendar/read-state.ts'
import { loadMarkRows, toBalanceCard } from '../schedule/rows.ts'
import type { TeacherTimeContext } from '../settings/settings.ts'
import type { CardRecord } from './card-rows.ts'

export type CardFacts = { balanceMinutes: number | null; nextLesson: NextLessonRead }
export type CardReadContext = TeacherTimeContext & CalendarReadContext

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

async function cardBalances(
	executor: DbExecutor,
	cards: readonly FactSource[],
	timeZone: string
): Promise<Map<string, number | null>> {
	if (cards.length === 0) return new Map<string, number | null>()
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
			studentBalance(toBalanceCard(card), paid.get(card.id) ?? [], held.get(card.id) ?? [], timeZone),
		])
	)
}

export async function cardFacts(
	executor: DbExecutor,
	cards: readonly FactSource[],
	context: CardReadContext
): Promise<Map<string, CardFacts>> {
	const balances = await cardBalances(executor, cards, context.defaultTimeZone)
	const next = await readNextLessons(
		executor,
		context,
		cards.map((card) => card.id)
	)
	return new Map(
		cards.map((card) => {
			const read = next.get(card.id)
			if (!read) throw new Error('Card next lesson result is missing')
			const nextLesson: NextLessonRead =
				read.result === 'known' ? { ...read, date: lessonDay(new Date(read.startsAt), context.defaultTimeZone) } : read
			return [card.id, { balanceMinutes: balances.get(card.id) ?? null, nextLesson }]
		})
	)
}
