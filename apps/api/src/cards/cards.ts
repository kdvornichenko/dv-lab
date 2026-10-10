import { and, eq, gt, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import type { z } from 'zod'

import type { StudentDetail, StudentsResponse, openingBalanceRequest, saveStudentRequest } from '@dv-lab/contracts'
import { balanceMinutes, lessonsToMinutes } from '@dv-lab/core'
import { type Database, type DbExecutor, payments, students } from '@dv-lab/db'

import { findStudentAccount } from '../auth/accounts.ts'
import { type CardRecord, cardColumns, toCardRow, toStudentDetail } from './card-rows.ts'

type SaveStudentInput = z.output<typeof saveStudentRequest>

type OpeningBalanceInput = z.output<typeof openingBalanceRequest>

type ImportCardInput = Pick<SaveStudentInput, 'displayName' | 'rateMinor' | 'currency' | 'defaultLessonMinutes'> & {
	importKey: string
}

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
	executor: DbExecutor,
	cards: readonly BalanceSource[]
): Promise<Map<string, number | null>> {
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

export function setOpeningBalance(
	db: Database,
	id: string,
	{ lessonsHundredths, on }: OpeningBalanceInput
): Promise<StudentDetail | null> {
	return db.transaction(async (tx): Promise<StudentDetail | null> => {
		const [locked] = await tx
			.select({ defaultLessonMinutes: students.defaultLessonMinutes })
			.from(students)
			.where(eq(students.id, id))
			.for('update')
		if (!locked) return null
		const [row] = await tx
			.update(students)
			.set({
				openingBalanceMinutes: lessonsToMinutes(lessonsHundredths, locked.defaultLessonMinutes),
				openingBalanceOn: on,
				updatedAt: sql`now()`,
			})
			.where(eq(students.id, id))
			.returning(cardColumns)
		if (!row) throw new Error('student card update returned no row')
		return toDetail(tx, row)
	})
}

export async function importCard(
	executor: DbExecutor,
	{ importKey, ...card }: ImportCardInput
): Promise<{ id: string; inserted: boolean }> {
	const values = cardValues({ ...card, parent: null, level: null, goals: null, timeZone: null })
	const [row] = await executor
		.insert(students)
		.values({ ...values, importKey })
		.onConflictDoNothing({ target: students.importKey })
		.returning({ id: students.id })
	if (row) return { id: row.id, inserted: true }
	const [existing] = await executor.select({ id: students.id }).from(students).where(eq(students.importKey, importKey))
	if (!existing) throw new Error('imported student card is missing after a conflict')
	return { id: existing.id, inserted: false }
}
