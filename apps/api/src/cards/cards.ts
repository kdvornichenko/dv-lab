import { type SQL, and, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { z } from 'zod'

import type {
	Currency,
	Gender,
	StudentDetail,
	StudentLessonOption,
	StudentResponse,
	StudentsResponse,
	openingBalanceRequest,
	saveStudentRequest,
} from '@dv-lab/contracts'
import { isAfterScheduleToday, lessonsToMinutes } from '@dv-lab/core'
import { type Database, type DbExecutor, payments, studentSections, students } from '@dv-lab/db'

import { findStudentAccount } from '../auth/accounts.ts'
import { lockTeacherTimeContext } from '../settings/settings.ts'
import { standardBlocks } from './blocks.ts'
import { cardFacts, type CardFacts, type CardReadContext } from './card-facts.ts'
import { type CardRecord, cardColumns, toCardRow, toGender, toStudentDetail } from './card-rows.ts'

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
		.values({ ...cardValues(input), noShowDeducts: input.noShowDeducts ?? true, gender: input.gender ?? null })
		.returning(cardColumns)
	if (!row) throw new Error('student card insert returned no row')
	await executor.insert(studentSections).values(standardBlocks(row.id))
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

export async function studentGenders(
	executor: DbExecutor,
	ids: readonly string[]
): Promise<Map<string, Gender | null>> {
	const wanted = [...new Set(ids)]
	if (wanted.length === 0) return new Map()
	const rows = await executor
		.select({ id: students.id, gender: students.gender })
		.from(students)
		.where(inArray(students.id, wanted))
	return new Map(rows.map((row) => [row.id, toGender(row.gender)]))
}

export type CardWrite = { kind: 'ok'; detail: StudentDetail } | { kind: 'not_found' } | { kind: 'changed' }

type CardValues = { [Key in keyof typeof students.$inferInsert]?: (typeof students.$inferInsert)[Key] | SQL }

type CardRate = { rateMinor: number; currency: Currency } | { rateMinor: null; currency: null }

const nextRevision = { revision: sql`${students.revision} + 1`, updatedAt: sql`now()` }

const sameRevision = (expectedRevision: number | undefined) =>
	expectedRevision === undefined ? undefined : eq(students.revision, expectedRevision)

async function writeCard(
	executor: DbExecutor,
	id: string,
	values: CardValues,
	context: CardReadContext,
	expectedRevision: number | undefined,
	only?: SQL
): Promise<CardWrite> {
	const [row] = await executor
		.update(students)
		.set({ ...values, ...nextRevision })
		.where(and(eq(students.id, id), only, sameRevision(expectedRevision)))
		.returning(cardColumns)
	if (row) return { kind: 'ok', detail: await toDetail(executor, row, context) }
	const [current] = await executor.select(cardColumns).from(students).where(eq(students.id, id))
	if (!current) return { kind: 'not_found' }
	if (expectedRevision !== undefined && current.revision !== expectedRevision) return { kind: 'changed' }
	return { kind: 'ok', detail: await toDetail(executor, current, context) }
}

export function updateCard(
	executor: DbExecutor,
	id: string,
	input: SaveStudentInput,
	context: CardReadContext,
	expectedRevision?: number
): Promise<CardWrite> {
	const values = {
		...cardValues(input),
		...(input.noShowDeducts === undefined ? {} : { noShowDeducts: input.noShowDeducts }),
		...(input.gender === undefined ? {} : { gender: input.gender }),
	}
	return writeCard(executor, id, values, context, expectedRevision)
}

export function setCardRate(
	executor: DbExecutor,
	id: string,
	rate: CardRate,
	expectedRevision: number,
	context: CardReadContext
): Promise<CardWrite> {
	return writeCard(executor, id, { rateMinor: rate.rateMinor, currency: rate.currency }, context, expectedRevision)
}

export function archiveCard(
	executor: DbExecutor,
	id: string,
	context: CardReadContext,
	expectedRevision?: number
): Promise<CardWrite> {
	const values = { status: 'archived', archivedAt: sql`now()` }
	return writeCard(executor, id, values, context, expectedRevision, eq(students.status, 'active'))
}

export function restoreCard(
	executor: DbExecutor,
	id: string,
	context: CardReadContext,
	expectedRevision?: number
): Promise<CardWrite> {
	const values = { status: 'active', archivedAt: null }
	return writeCard(executor, id, values, context, expectedRevision, eq(students.status, 'archived'))
}

type OpeningBalanceResult =
	| { kind: 'ok'; response: StudentResponse }
	| { kind: 'not_found' }
	| { kind: 'invalid' }
	| { kind: 'changed' }
	| { kind: 'default_time_zone_changed' }

export function setOpeningBalance(
	db: Database,
	accountId: string,
	id: string,
	{ lessonsHundredths, on, expectedDefaultTimeZone, expectedRevision }: OpeningBalanceInput
): Promise<OpeningBalanceResult> {
	return db.transaction(async (tx): Promise<OpeningBalanceResult> => {
		const time = await lockTeacherTimeContext(tx, accountId, expectedDefaultTimeZone)
		if (!time.ok) return { kind: time.error }
		const { context, settings } = time
		if (isAfterScheduleToday(on, context.now, context.defaultTimeZone)) return { kind: 'invalid' }
		const [locked] = await tx
			.select({ defaultLessonMinutes: students.defaultLessonMinutes, revision: students.revision })
			.from(students)
			.where(eq(students.id, id))
			.for('update')
		if (!locked) return { kind: 'not_found' }
		if (expectedRevision !== undefined && locked.revision !== expectedRevision) return { kind: 'changed' }
		const [row] = await tx
			.update(students)
			.set({
				openingBalanceMinutes: lessonsToMinutes(lessonsHundredths, locked.defaultLessonMinutes),
				openingBalanceOn: on,
				...nextRevision,
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
