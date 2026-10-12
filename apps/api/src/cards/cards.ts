import { and, eq, isNull, sql } from 'drizzle-orm'
import type { z } from 'zod'

import type {
	StudentDetail,
	StudentLessonOption,
	StudentResponse,
	StudentsResponse,
	openingBalanceRequest,
	saveStudentRequest,
} from '@dv-lab/contracts'
import { isAfterScheduleToday, lessonsToMinutes } from '@dv-lab/core'
import { type Database, type DbExecutor, payments, students } from '@dv-lab/db'

import { findStudentAccount } from '../auth/accounts.ts'
import { lockTeacherTimeContext } from '../settings/settings.ts'
import { cardFacts, type CardFacts, type CardReadContext } from './card-facts.ts'
import { type CardRecord, cardColumns, toCardRow, toStudentDetail } from './card-rows.ts'

type SaveStudentInput = z.output<typeof saveStudentRequest>

type OpeningBalanceInput = z.output<typeof openingBalanceRequest>

type ImportCardInput = Pick<SaveStudentInput, 'displayName' | 'rateMinor' | 'currency' | 'defaultLessonMinutes'> & {
	importKey: string
}

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

function requiredFacts(facts: ReadonlyMap<string, CardFacts>, id: string): CardFacts {
	const value = facts.get(id)
	if (!value) throw new Error('Card facts are missing')
	return value
}

async function toDetail(executor: DbExecutor, row: CardRecord, context: CardReadContext): Promise<StudentDetail> {
	const facts = await cardFacts(executor, [row], context)
	const account = await findStudentAccount(executor, row.id)
	return toStudentDetail(row, requiredFacts(facts, row.id), account)
}

export async function createCard(
	executor: DbExecutor,
	input: SaveStudentInput,
	context: CardReadContext
): Promise<StudentDetail> {
	const [row] = await executor
		.insert(students)
		.values({ ...cardValues(input), noShowDeducts: input.noShowDeducts ?? true })
		.returning(cardColumns)
	if (!row) throw new Error('student card insert returned no row')
	return toDetail(executor, row, context)
}

export async function getCard(
	executor: DbExecutor,
	id: string,
	context: CardReadContext
): Promise<StudentDetail | null> {
	const [row] = await executor.select(cardColumns).from(students).where(eq(students.id, id))
	return row ? toDetail(executor, row, context) : null
}

export async function listCards(
	executor: DbExecutor,
	context: CardReadContext
): Promise<Pick<StudentsResponse, 'students' | 'unassignedPayments'>> {
	const rows = await executor
		.select(cardColumns)
		.from(students)
		.orderBy(sql`lower(${students.displayName})`, students.id)
	const facts = await cardFacts(executor, rows, context)
	const [unassigned] = await executor
		.select({ count: sql<number>`count(*)::int` })
		.from(payments)
		.where(isNull(payments.studentId))
	return {
		students: rows.map((row) => toCardRow(row, requiredFacts(facts, row.id))),
		unassignedPayments: unassigned?.count ?? 0,
	}
}

export async function listLessonStudents(executor: DbExecutor): Promise<StudentLessonOption[]> {
	return executor
		.select({ id: students.id, displayName: students.displayName, defaultLessonMinutes: students.defaultLessonMinutes })
		.from(students)
		.where(eq(students.status, 'active'))
		.orderBy(sql`lower(${students.displayName})`, students.id)
}

export async function updateCard(
	executor: DbExecutor,
	id: string,
	input: SaveStudentInput,
	context: CardReadContext
): Promise<StudentDetail | null> {
	const [row] = await executor
		.update(students)
		.set({
			...cardValues(input),
			...(input.noShowDeducts === undefined ? {} : { noShowDeducts: input.noShowDeducts }),
			updatedAt: sql`now()`,
		})
		.where(eq(students.id, id))
		.returning(cardColumns)
	return row ? toDetail(executor, row, context) : null
}

export async function archiveCard(
	executor: DbExecutor,
	id: string,
	context: CardReadContext
): Promise<StudentDetail | null> {
	const [row] = await executor
		.update(students)
		.set({ status: 'archived', archivedAt: sql`now()`, updatedAt: sql`now()` })
		.where(and(eq(students.id, id), eq(students.status, 'active')))
		.returning(cardColumns)
	return row ? toDetail(executor, row, context) : getCard(executor, id, context)
}

export async function restoreCard(
	executor: DbExecutor,
	id: string,
	context: CardReadContext
): Promise<StudentDetail | null> {
	const [row] = await executor
		.update(students)
		.set({ status: 'active', archivedAt: null, updatedAt: sql`now()` })
		.where(and(eq(students.id, id), eq(students.status, 'archived')))
		.returning(cardColumns)
	return row ? toDetail(executor, row, context) : getCard(executor, id, context)
}

type OpeningBalanceResult =
	| { kind: 'ok'; response: StudentResponse }
	| { kind: 'not_found' }
	| { kind: 'invalid' }
	| { kind: 'default_time_zone_changed' }

export function setOpeningBalance(
	db: Database,
	accountId: string,
	id: string,
	{ lessonsHundredths, on, expectedDefaultTimeZone }: OpeningBalanceInput
): Promise<OpeningBalanceResult> {
	return db.transaction(async (tx): Promise<OpeningBalanceResult> => {
		const time = await lockTeacherTimeContext(tx, accountId, expectedDefaultTimeZone)
		if (!time.ok) return { kind: time.error }
		const { context, settings } = time
		if (isAfterScheduleToday(on, context.now, context.defaultTimeZone)) return { kind: 'invalid' }
		const [locked] = await tx
			.select({ defaultLessonMinutes: students.defaultLessonMinutes })
			.from(students)
			.where(eq(students.id, id))
			.for('update')
		if (!locked) return { kind: 'not_found' }
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
		return {
			kind: 'ok',
			response: {
				student: await toDetail(tx, row, { ...context, accountId }),
				defaultTimeZone: context.defaultTimeZone,
				asOf: context.now.toISOString(),
				paysSoonLessons: settings.paysSoonLessons,
			},
		}
	})
}

export async function importCard(
	executor: DbExecutor,
	{ importKey, ...card }: ImportCardInput
): Promise<{ id: string; inserted: boolean }> {
	const values = cardValues({ ...card, parent: null, level: null, goals: null, timeZone: null })
	const [row] = await executor
		.insert(students)
		.values({ ...values, noShowDeducts: true, importKey })
		.onConflictDoNothing({ target: students.importKey })
		.returning({ id: students.id })
	if (row) return { id: row.id, inserted: true }
	const [existing] = await executor.select({ id: students.id }).from(students).where(eq(students.importKey, importKey))
	if (!existing) throw new Error('imported student card is missing after a conflict')
	return { id: existing.id, inserted: false }
}
