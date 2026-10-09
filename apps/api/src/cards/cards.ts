import { eq } from 'drizzle-orm'
import type { z } from 'zod'

import type { StudentDetail, saveStudentRequest } from '@dv-lab/contracts'
import { balanceMinutes } from '@dv-lab/core'
import { type DbExecutor, students } from '@dv-lab/db'

import { findStudentAccount } from '../auth/accounts.ts'
import { type CardRecord, cardColumns, toStudentDetail } from './card-rows.ts'

type SaveStudentInput = z.output<typeof saveStudentRequest>

type BalanceSource = Pick<CardRecord, 'id' | 'openingBalanceMinutes' | 'openingBalanceOn'>

function cardValues(input: SaveStudentInput) {
	return {
		displayName: input.displayName,
		rateMinor: input.rateMinor,
		currency: input.currency,
		defaultLessonMinutes: input.defaultLessonMinutes,
		parent: input.parent,
		level: input.level,
		goals: input.goals,
		timeZone: input.timeZone,
	}
}

async function cardBalances(
	_executor: DbExecutor,
	cards: readonly BalanceSource[]
): Promise<Map<string, number | null>> {
	return new Map(cards.map((card) => [card.id, balanceMinutes(card.openingBalanceMinutes, [])]))
}

async function toDetail(executor: DbExecutor, row: CardRecord): Promise<StudentDetail> {
	const balances = await cardBalances(executor, [row])
	const account = await findStudentAccount(executor, row.id)
	return toStudentDetail(row, balances.get(row.id) ?? null, account)
}

export async function createCard(executor: DbExecutor, input: SaveStudentInput): Promise<StudentDetail> {
	const [row] = await executor.insert(students).values(cardValues(input)).returning(cardColumns)
	if (!row) throw new Error('student card insert returned no row')
	return toStudentDetail(row, null, null)
}

export async function getCard(executor: DbExecutor, id: string): Promise<StudentDetail | null> {
	const [row] = await executor.select(cardColumns).from(students).where(eq(students.id, id))
	return row ? toDetail(executor, row) : null
}
