import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import {
	type ChatChange,
	type ChatChangeIssue,
	type ChatDetailChange,
	type Currency,
	type Gender,
	AMOUNT_MINOR_MAX,
	CURRENCIES,
	GENDERS,
	LESSON_MINUTES_DEFAULT,
	LESSON_MINUTES_MIN,
	STUDENT_TEXT_MAX_LENGTH,
	currencyFor,
	isDisplayNameLength,
	isTimeZone,
	normalizeDisplayName,
	saveStudentRequest,
} from '@dv-lab/contracts'
import { parseMoney } from '@dv-lab/core'
import { type DbExecutor, students } from '@dv-lab/db'

import { findStudentAccount } from '../auth/accounts.ts'
import type { CardReadContext } from '../cards/card-facts.ts'
import {
	type CardDetails,
	type CardWrite,
	archiveCard,
	createCard,
	setCardDetails,
	setCardRate,
} from '../cards/cards.ts'

export const LESSON_MINUTES_CHAT_MAX = 1440

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
	| { operation: 'archive_card'; studentId: string; requestedDeletion: boolean }
	| {
			operation: 'set_details'
			studentId: string
			rateText: string | null
			currency: Currency | null
			lessonMinutesText: string | null
			noShowDeducts: boolean | null
			gender: Gender | 'clear' | null
			parentText: string | null
			levelText: string | null
			goalsText: string | null
			timeZone: string | null
	  }

export type CardRefusal =
	| 'name_not_in_message'
	| 'invalid_name'
	| 'amount_not_in_message'
	| 'lesson_minutes_not_in_message'
	| 'invalid_lesson_minutes'
	| 'text_not_in_message'
	| 'invalid_text'
	| 'unknown_time_zone'
	| 'invalid_amount'
	| 'invalid_card'
	| 'no_change'
	| 'already_archived'
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

const isTextLength = (value: string) => Array.from(value).length <= STUDENT_TEXT_MAX_LENGTH

const detailText = z.string().min(1).refine(isTextLength).nullable().optional()

const details = z.strictObject({
	rate: rate.optional(),
	defaultLessonMinutes: z.number().int().min(LESSON_MINUTES_MIN).max(LESSON_MINUTES_CHAT_MAX).optional(),
	noShowDeducts: z.boolean().optional(),
	gender: z.enum(GENDERS).nullable().optional(),
	parent: detailText,
	level: detailText,
	goals: detailText,
	timeZone: z.string().refine(isTimeZone).nullable().optional(),
})

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
	z.strictObject({ operation: z.literal('archive_card'), studentId: z.uuid(), requestedDeletion: z.boolean(), guard }),
	z.strictObject({ operation: z.literal('set_details'), studentId: z.uuid(), values: details, guard }),
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

export function moneyText(text: string): string {
	const compact = text.normalize('NFC').replace(/\s+/gu, '')
	return /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/u.test(compact) ? compact.replaceAll(',', '') : compact
}

function readRate(said: Said, rateText: string, currency: Currency): CardPair | CardRefusal {
	if (!said.has(rateText)) return 'amount_not_in_message'
	const rateMinor = parseMoney(moneyText(rateText), currency)
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
			defaultLessonMinutes: students.defaultLessonMinutes,
			noShowDeducts: students.noShowDeducts,
			gender: students.gender,
			parent: students.parent,
			level: students.level,
			goals: students.goals,
			timeZone: students.timeZone,
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
		const read = readRate(said, request.rateText, currencyFor(request.currency, null))
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
		const read = readRate(said, request.rateText, currencyFor(request.currency, card.currency))
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

async function previewArchive(
	executor: DbExecutor,
	request: Extract<CardChangeRequest, { operation: 'archive_card' }>
): Promise<CardPreview> {
	const card = await cardOf(executor, request.studentId)
	if (card === null) return refused('student_not_found')
	if (card.status === 'archived') return refused('already_archived')
	const account = await findStudentAccount(executor, card.id)
	return {
		kind: 'ok',
		target: {
			operation: 'archive_card',
			studentId: card.id,
			requestedDeletion: request.requestedDeletion,
			guard: { cardRevision: card.revision },
		},
		change: {
			operation: 'archive_card',
			studentId: card.id,
			studentName: card.displayName,
			requestedDeletion: request.requestedDeletion,
			accountActive: account?.status === 'active',
		},
	}
}

function readMinutes(said: Said, text: string): number | CardRefusal {
	const value = text.normalize('NFC').trim()
	if (!said.has(value)) return 'lesson_minutes_not_in_message'
	if (!/^\d{1,4}$/u.test(value)) return 'invalid_lesson_minutes'
	const minutes = Number(value)
	return minutes < LESSON_MINUTES_MIN || minutes > LESSON_MINUTES_CHAT_MAX ? 'invalid_lesson_minutes' : minutes
}

function readText(said: Said, text: string): string | CardRefusal {
	const value = text.normalize('NFC').trim()
	if (value === '' || !said.has(value)) return 'text_not_in_message'
	return isTextLength(value) ? value : 'invalid_text'
}

const TEXT_FIELDS = [
	['parent', 'parentText'],
	['level', 'levelText'],
	['goals', 'goalsText'],
] as const

async function previewDetails(
	executor: DbExecutor,
	said: Said,
	request: Extract<CardChangeRequest, { operation: 'set_details' }>
): Promise<CardPreview> {
	const card = await cardOf(executor, request.studentId)
	if (card === null) return refused('student_not_found')
	const values: z.infer<typeof details> = {}
	const fields: ChatDetailChange[] = []
	if (request.rateText !== null || request.currency !== null) {
		if (request.rateText === null) return refused('amount_not_in_message')
		const after = readRate(said, request.rateText, currencyFor(request.currency, card.currency))
		if (typeof after === 'string') return refused(after)
		const before = pairOf(card.rateMinor, card.currency)
		if (after.rateMinor !== before.rateMinor || after.currency !== before.currency) {
			values.rate = after
			fields.push({ field: 'rate', before, after })
		}
	}
	if (request.lessonMinutesText !== null) {
		const after = readMinutes(said, request.lessonMinutesText)
		if (typeof after === 'string') return refused(after)
		if (after !== card.defaultLessonMinutes) {
			values.defaultLessonMinutes = after
			fields.push({ field: 'lessonMinutes', before: card.defaultLessonMinutes, after })
		}
	}
	if (request.noShowDeducts !== null && request.noShowDeducts !== card.noShowDeducts) {
		values.noShowDeducts = request.noShowDeducts
		fields.push({ field: 'noShowDeducts', before: card.noShowDeducts, after: request.noShowDeducts })
	}
	if (request.gender !== null) {
		const before = GENDERS.find((item) => item === card.gender) ?? null
		const after = request.gender === 'clear' ? null : request.gender
		if (after !== before) {
			values.gender = after
			fields.push({ field: 'gender', before, after })
		}
	}
	for (const [field, key] of TEXT_FIELDS) {
		const text = request[key]
		if (text === null) continue
		const after = readText(said, text)
		if (after === 'text_not_in_message' || after === 'invalid_text') return refused(after)
		if (after !== card[field]) {
			values[field] = after
			fields.push({ field, before: card[field], after })
		}
	}
	if (request.timeZone !== null) {
		const after = request.timeZone === 'clear' ? null : request.timeZone.trim()
		if (after !== null && !isTimeZone(after)) return refused('unknown_time_zone')
		if (after !== card.timeZone) {
			values.timeZone = after
			fields.push({ field: 'timeZone', before: card.timeZone, after })
		}
	}
	if (fields.length === 0) return refused('no_change')
	return {
		kind: 'ok',
		target: { operation: 'set_details', studentId: card.id, values, guard: { cardRevision: card.revision } },
		change: { operation: 'set_details', studentId: card.id, studentName: card.displayName, fields },
	}
}

export function previewCardChange(executor: DbExecutor, said: Said, request: CardChangeRequest): Promise<CardPreview> {
	if (request.operation === 'create_card') return previewCreate(executor, said, request)
	if (request.operation === 'set_rate') return previewRate(executor, said, request)
	if (request.operation === 'set_details') return previewDetails(executor, said, request)
	return previewArchive(executor, request)
}

function cardDetails({ rate: pair, ...values }: z.infer<typeof details>): CardDetails {
	return pair === undefined ? values : { ...values, rate: pairOf(pair.rateMinor, pair.currency) }
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
	if (target.operation === 'set_rate') {
		const after = pairOf(target.after.rateMinor, target.after.currency)
		const outcome = await setCardRate(tx, target.studentId, after, target.guard.cardRevision, context)
		return written(outcome, target.studentId)
	}
	if (target.operation === 'set_details') {
		const values = cardDetails(target.values)
		const outcome = await setCardDetails(tx, target.studentId, values, target.guard.cardRevision, context)
		return written(outcome, target.studentId)
	}
	const outcome = await archiveCard(tx, target.studentId, context, target.guard.cardRevision)
	return written(outcome, target.studentId)
}
