import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import {
	type ChatChange,
	type ChatChangeIssue,
	type Currency,
	type Gender,
	AMOUNT_MINOR_MAX,
	CURRENCIES,
	GENDERS,
	LESSON_MINUTES_DEFAULT,
	LESSON_MINUTES_MIN,
	isDisplayNameLength,
	normalizeDisplayName,
	saveStudentRequest,
} from '@dv-lab/contracts'
import { parseMoney } from '@dv-lab/core'
import { type DbExecutor, students } from '@dv-lab/db'

import type { CardReadContext } from '../cards/card-facts.ts'
import { type CardWrite, createCard, setCardRate } from '../cards/cards.ts'

export type CardChangeRequest =
	| {
			operation: 'create_card'
			displayName: string
			rateText: string | null
			currency: Currency | null
			lessonMinutes: number | null
			gender: Gender | null
	  }
	| { operation: 'set_rate'; studentId: string; rateText: string | null; currency: Currency | null; clear: boolean }

export type CardRefusal =
	| 'name_not_in_message'
	| 'invalid_name'
	| 'amount_not_in_message'
	| 'lesson_minutes_not_in_message'
	| 'currency_required'
	| 'invalid_amount'
	| 'invalid_card'
	| 'no_change'
	| 'student_not_found'

export type Said = {
	has: (part: string) => boolean
	hasName: (name: string) => boolean
	hasNumber: (value: number) => boolean
}

const rate = z
	.strictObject({ rateMinor: z.number().int().min(1).nullable(), currency: z.enum(CURRENCIES).nullable() })
	.refine((value) => (value.rateMinor === null) === (value.currency === null))

const guard = z.strictObject({ cardRevision: z.number().int().min(1) })

export const cardTargets = [
	z.strictObject({
		operation: z.literal('create_card'),
		displayName: z.string(),
		rateMinor: z.number().int().min(1).nullable(),
		currency: z.enum(CURRENCIES).nullable(),
		lessonMinutes: z.number().int().min(LESSON_MINUTES_MIN),
		gender: z.enum(GENDERS).nullable(),
	}),
	z.strictObject({ operation: z.literal('set_rate'), studentId: z.uuid(), after: rate, guard }),
] as const

type CardTarget = z.infer<(typeof cardTargets)[number]>

type CardPair = { rateMinor: number; currency: Currency } | { rateMinor: null; currency: null }

export type CardPreview =
	{ kind: 'ok'; target: CardTarget; change: ChatChange } | { kind: 'refused'; code: CardRefusal }

export type CardApplied =
	{ kind: 'applied'; after: { studentId: string } } | { kind: 'stale'; issue: ChatChangeIssue } | { kind: 'failed' }

const refused = (code: CardRefusal): CardPreview => ({ kind: 'refused', code })

const NO_RATE: CardPair = { rateMinor: null, currency: null }

function pairOf(rateMinor: number | null, currency: string | null): CardPair {
	const known = CURRENCIES.find((item) => item === currency)
	return rateMinor !== null && known !== undefined ? { rateMinor, currency: known } : NO_RATE
}

function readRate(said: Said, rateText: string, currency: Currency | null): CardPair | CardRefusal {
	if (!said.has(rateText)) return 'amount_not_in_message'
	if (currency === null) return 'currency_required'
	const rateMinor = parseMoney(rateText.normalize('NFC').trim(), currency)
	if (rateMinor === null || rateMinor > AMOUNT_MINOR_MAX) return 'invalid_amount'
	return { rateMinor, currency }
}

async function cardOf(executor: DbExecutor, studentId: string) {
	const [row] = await executor
		.select({
			id: students.id,
			displayName: students.displayName,
			rateMinor: students.rateMinor,
			currency: students.currency,
			status: students.status,
			revision: students.revision,
		})
		.from(students)
		.where(eq(students.id, studentId))
	return row ?? null
}

async function previewCreate(
	executor: DbExecutor,
	said: Said,
	request: Extract<CardChangeRequest, { operation: 'create_card' }>
): Promise<CardPreview> {
	const displayName = normalizeDisplayName(request.displayName.normalize('NFC'))
	if (!said.hasName(displayName)) return refused('name_not_in_message')
	if (!isDisplayNameLength(displayName)) return refused('invalid_name')
	let pair = NO_RATE
	if (request.rateText !== null) {
		const read = readRate(said, request.rateText, request.currency)
		if (typeof read === 'string') return refused(read)
		pair = read
	}
	if (request.lessonMinutes !== null && !said.hasNumber(request.lessonMinutes))
		return refused('lesson_minutes_not_in_message')
	const input = saveStudentRequest.safeParse({
		displayName,
		rateMinor: pair.rateMinor,
		currency: pair.currency,
		defaultLessonMinutes: request.lessonMinutes ?? LESSON_MINUTES_DEFAULT,
		parent: null,
		level: null,
		goals: null,
		timeZone: null,
		noShowDeducts: true,
		gender: request.gender,
	})
	if (!input.success) return refused('invalid_card')
	const [same] = await executor
		.select({ count: sql<number>`count(*)::int` })
		.from(students)
		.where(sql`lower(${students.displayName}) = lower(${input.data.displayName})`)
	const target: CardTarget = {
		operation: 'create_card',
		displayName: input.data.displayName,
		rateMinor: input.data.rateMinor,
		currency: input.data.currency,
		lessonMinutes: input.data.defaultLessonMinutes,
		gender: input.data.gender ?? null,
	}
	return {
		kind: 'ok',
		target,
		change: {
			operation: 'create_card',
			displayName: target.displayName,
			rateMinor: target.rateMinor,
			currency: target.currency,
			lessonMinutes: target.lessonMinutes,
			noShowDeducts: true,
			timeZone: null,
			gender: target.gender,
			duplicateName: (same?.count ?? 0) > 0,
		},
	}
}

async function previewRate(
	executor: DbExecutor,
	said: Said,
	request: Extract<CardChangeRequest, { operation: 'set_rate' }>
): Promise<CardPreview> {
	const card = await cardOf(executor, request.studentId)
	if (card === null) return refused('student_not_found')
	const before = pairOf(card.rateMinor, card.currency)
	let after = NO_RATE
	if (request.clear) {
		if (request.rateText !== null) return refused('invalid_amount')
	} else {
		if (request.rateText === null) return refused('amount_not_in_message')
		const currency = request.currency ?? CURRENCIES.find((item) => item === card.currency) ?? null
		const read = readRate(said, request.rateText, currency)
		if (typeof read === 'string') return refused(read)
		after = read
	}
	if (after.rateMinor === before.rateMinor && after.currency === before.currency) return refused('no_change')
	return {
		kind: 'ok',
		target: { operation: 'set_rate', studentId: card.id, after, guard: { cardRevision: card.revision } },
		change: { operation: 'set_rate', studentId: card.id, studentName: card.displayName, before, after },
	}
}

export function previewCardChange(executor: DbExecutor, said: Said, request: CardChangeRequest): Promise<CardPreview> {
	if (request.operation === 'create_card') return previewCreate(executor, said, request)
	return previewRate(executor, said, request)
}

function written(outcome: CardWrite, studentId: string): CardApplied {
	if (outcome.kind === 'not_found') return { kind: 'stale', issue: 'not_found' }
	if (outcome.kind === 'changed') return { kind: 'stale', issue: 'student_changed' }
	return { kind: 'applied', after: { studentId } }
}

export async function applyCardChange(
	tx: DbExecutor,
	context: CardReadContext,
	target: CardTarget
): Promise<CardApplied> {
	if (target.operation === 'create_card') {
		const input = saveStudentRequest.safeParse({
			displayName: target.displayName,
			rateMinor: target.rateMinor,
			currency: target.currency,
			defaultLessonMinutes: target.lessonMinutes,
			parent: null,
			level: null,
			goals: null,
			timeZone: null,
			noShowDeducts: true,
			gender: target.gender,
		})
		if (!input.success) return { kind: 'failed' }
		const created = await createCard(tx, input.data, context)
		return { kind: 'applied', after: { studentId: created.id } }
	}
	const after = pairOf(target.after.rateMinor, target.after.currency)
	const outcome = await setCardRate(tx, target.studentId, after, target.guard.cardRevision, context)
	return written(outcome, target.studentId)
}
