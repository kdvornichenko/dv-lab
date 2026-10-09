import { and, eq, isNull, sql } from 'drizzle-orm'
import type { z } from 'zod'

import type { StudentDetail, StudentsResponse, saveStudentRequest } from '@dv-lab/contracts'
import { balanceMinutes } from '@dv-lab/core'
import { type DbExecutor, payments, students } from '@dv-lab/db'

import { findStudentAccount } from '../auth/accounts.ts'
import { type CardRecord, cardColumns, toCardRow, toStudentDetail } from './card-rows.ts'

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

export async function listCards(executor: DbExecutor): Promise<StudentsResponse> {
	const rows = await executor
		.select(cardColumns)
		.from(students)
		.orderBy(sql`lower(${students.displayName})`, students.id)
	const balances = await cardBalances(executor, rows)
	const [unassigned] = await executor
		.select({ count: sql<number>`count(*)::int` })
		.from(payments)
		.where(isNull(payments.studentId))
	return {
		students: rows.map((row) => toCardRow(row, balances.get(row.id) ?? null)),
		unassignedPayments: unassigned?.count ?? 0,
	}
}

export async function updateCard(
	executor: DbExecutor,
	id: string,
	input: SaveStudentInput
): Promise<StudentDetail | null> {
	const [row] = await executor
		.update(students)
		.set({ ...cardValues(input), updatedAt: sql`now()` })
		.where(eq(students.id, id))
		.returning(cardColumns)
	return row ? toDetail(executor, row) : null
}

export async function archiveCard(executor: DbExecutor, id: string): Promise<StudentDetail | null> {
	const [row] = await executor
		.update(students)
		.set({ status: 'archived', archivedAt: sql`now()`, updatedAt: sql`now()` })
		.where(and(eq(students.id, id), eq(students.status, 'active')))
		.returning(cardColumns)
	return row ? toDetail(executor, row) : getCard(executor, id)
}

export async function restoreCard(executor: DbExecutor, id: string): Promise<StudentDetail | null> {
	const [row] = await executor
		.update(students)
		.set({ status: 'active', archivedAt: null, updatedAt: sql`now()` })
		.where(and(eq(students.id, id), eq(students.status, 'archived')))
		.returning(cardColumns)
	return row ? toDetail(executor, row) : getCard(executor, id)
}
