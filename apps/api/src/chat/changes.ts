import { and, eq, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'

import {
	type ChatCalendarProposalBlock,
	type ChatChangeIssue,
	type ChatChangeProposalBlock,
	type ChatBlock,
	type ChatNoteChangeBlock,
	type ChatReviewOfferBlock,
	type Currency,
	CURRENCIES,
	calendarDate,
	recordPaymentRequest,
} from '@dv-lab/contracts'
import {
	countsAfterOpening,
	creditedMinutes,
	isAfterScheduleToday,
	parseLessons,
	parseMoney,
	scheduleToday,
	suggestLessons,
} from '@dv-lab/core'
import { type Database, type DbExecutor, chatActions, chatMessages, students } from '@dv-lab/db'

import type { CalendarCommands } from '../calendar/commands.ts'
import { cardFacts } from '../cards/card-facts.ts'
import { insertPayment } from '../cards/payments.ts'
import { lockTeacherTimeContext } from '../settings/settings.ts'
import type { ActionSource, ChatContext } from './actions.ts'
import {
	type BulkMoveRequest,
	type BulkRefusal,
	checkBulk,
	confirmBulk,
	isBulkMove,
	proposeBulkMove,
} from './bulk-move.ts'
import { declineCalendarChange } from './calendar.ts'
import {
	type CardChangeRequest,
	type CardRefusal,
	type Said,
	applyCardChange,
	cardTargets,
	moneyText,
	previewCardChange,
} from './change-cards.ts'
import {
	type DeletionRefusal,
	type DeletionRequest,
	applyDeletion,
	deletionTargets,
	previewDeletion,
} from './change-deletions.ts'
import { applyNoteChange, noteTargets } from './change-notes.ts'
import { blocksOf, changeView, insertAction, noteChangeView, repliesOf, reviewOfferView } from './messages.ts'

type PaymentRequest = {
	operation: 'record_payment'
	studentId: string
	amountText: string
	currency: Currency | null
	paidOn: string | null
	lessonsText: string | null
	note: string | null
}

export type ChangeRequest = PaymentRequest | CardChangeRequest | DeletionRequest | BulkMoveRequest

export type ChangeRefusal =
	| 'amount_not_in_message'
	| 'currency_required'
	| 'invalid_amount'
	| 'invalid_lessons'
	| 'date_in_future'
	| 'invalid_note'
	| 'student_not_found'
	| CardRefusal
	| DeletionRefusal
	| BulkRefusal

export type ProposeOutcome =
	{ kind: 'proposed'; block: ChatChangeProposalBlock } | { kind: 'refused'; code: ChangeRefusal }

export type ChangeOutcome =
	| { kind: 'ok'; block: ChatChangeProposalBlock | ChatCalendarProposalBlock | ProposalBlock }
	| { kind: 'not_found' }
	| { kind: 'not_change' }

type ActionRow = typeof chatActions.$inferSelect

const paymentTarget = z.strictObject({
	operation: z.literal('record_payment'),
	studentId: z.uuid(),
	amountMinor: z.number().int(),
	currency: z.enum(CURRENCIES),
	paidOn: calendarDate,
	lessonsHundredths: z.number().int().nullable(),
	note: z.string().nullable(),
	guard: z.strictObject({
		cardRevision: z.number().int().min(1),
		timeZone: z.string(),
	}),
})

const reviewOfferTarget = z.strictObject({ operation: z.literal('review_offer'), studentId: z.uuid() })

const storedTarget = z.discriminatedUnion('operation', [
	paymentTarget,
	reviewOfferTarget,
	...cardTargets,
	...deletionTargets,
	...noteTargets,
])

const legacyTarget = paymentTarget.extend({
	guard: z.strictObject({
		lessonMinutes: z.number().int(),
		rateMinor: z.number().int().nullable(),
		rateCurrency: z.string().nullable(),
		timeZone: z.string(),
	}),
})

type PaymentTarget = z.infer<typeof paymentTarget>

const refused = (code: ChangeRefusal): ProposeOutcome => ({ kind: 'refused', code })

function flat(value: string): string {
	return value.normalize('NFC').replace(/\s+/gu, ' ').trim()
}

function escaped(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

function writtenIn(message: string, part: string): boolean {
	const piece = flat(part)
	if (piece === '') return false
	return new RegExp(`(?<![\\p{Nd}.,])${escaped(piece)}(?![\\p{Nd}]|[.,]\\p{Nd})`, 'u').test(flat(message))
}

function saidIn(message: string): Said {
	const folded = flat(message).toLocaleLowerCase()
	return {
		has: (part) => writtenIn(message, part),
		hasName: (name) => {
			const piece = flat(name).toLocaleLowerCase()
			if (piece === '') return false
			return new RegExp(`(?<![\\p{L}\\p{Nd}])${escaped(piece)}(?![\\p{L}\\p{Nd}])`, 'u').test(folded)
		},
		hasNumber: (value) => new RegExp(`(?<!\\p{Nd})${value}(?!\\p{Nd})`, 'u').test(message),
	}
}

async function teacherText(executor: DbExecutor, accountId: string, messageId: string): Promise<string | null> {
	const [row] = await executor
		.select({ body: chatMessages.body })
		.from(chatMessages)
		.where(
			and(
				eq(chatMessages.id, messageId),
				eq(chatMessages.accountId, accountId),
				eq(chatMessages.role, 'teacher'),
				isNull(chatMessages.redactedAt)
			)
		)
	return row?.body ?? null
}

async function cardOf(executor: DbExecutor, studentId: string) {
	const [row] = await executor
		.select({
			id: students.id,
			displayName: students.displayName,
			rateMinor: students.rateMinor,
			currency: students.currency,
			defaultLessonMinutes: students.defaultLessonMinutes,
			openingBalanceMinutes: students.openingBalanceMinutes,
			openingBalanceOn: students.openingBalanceOn,
			noShowDeducts: students.noShowDeducts,
			revision: students.revision,
		})
		.from(students)
		.where(eq(students.id, studentId))
	return row ?? null
}

async function preparePayment(
	tx: DbExecutor,
	context: ChatContext,
	source: ActionSource,
	request: PaymentRequest
): Promise<ProposeOutcome> {
	const message = await teacherText(tx, context.accountId, source.messageId)
	if (message === null || !writtenIn(message, request.amountText)) return refused('amount_not_in_message')
	if (request.lessonsText !== null && !writtenIn(message, request.lessonsText)) return refused('amount_not_in_message')
	const card = await cardOf(tx, request.studentId)
	if (card === null) return refused('student_not_found')
	const currency = request.currency ?? CURRENCIES.find((item) => item === card.currency) ?? null
	if (currency === null) return refused('currency_required')
	const amountMinor = parseMoney(moneyText(request.amountText), currency)
	if (amountMinor === null) return refused('invalid_amount')
	const rate =
		card.rateMinor !== null && card.currency !== null ? { rateMinor: card.rateMinor, currency: card.currency } : null
	let lessonsHundredths = suggestLessons(amountMinor, currency, rate)
	if (request.lessonsText !== null) {
		lessonsHundredths = parseLessons(flat(request.lessonsText))
		if (lessonsHundredths === null) return refused('invalid_lessons')
	}
	const zone = context.defaultTimeZone
	const paidOn = request.paidOn ?? scheduleToday(context.now, zone)
	if (isAfterScheduleToday(paidOn, context.now, zone)) return refused('date_in_future')
	const note = recordPaymentRequest.shape.note.safeParse(request.note)
	if (!note.success) return refused('invalid_note')
	const input = recordPaymentRequest.safeParse({
		studentId: card.id,
		paidOn,
		expectedDefaultTimeZone: zone,
		amountMinor,
		currency,
		lessonsHundredths,
		note: note.data,
	})
	if (!input.success) return refused('invalid_amount')
	const facts = (await cardFacts(tx, [card], context)).get(card.id)
	const balanceMinutes = facts?.balanceMinutes ?? null
	const credited = creditedMinutes(input.data.lessonsHundredths, card.defaultLessonMinutes)
	const counts = card.openingBalanceOn !== null && countsAfterOpening(paidOn, card.openingBalanceOn)
	const target: PaymentTarget = {
		operation: 'record_payment',
		studentId: card.id,
		amountMinor: input.data.amountMinor,
		currency: input.data.currency,
		paidOn: input.data.paidOn,
		lessonsHundredths: input.data.lessonsHundredths,
		note: input.data.note,
		guard: { cardRevision: card.revision, timeZone: zone },
	}
	const actionId = await insertAction(tx, {
		accountId: context.accountId,
		...source,
		kind: 'change',
		state: 'proposed',
		target,
		result: { kind: 'proposed' },
	})
	return {
		kind: 'proposed',
		block: {
			type: 'change_proposal',
			actionId,
			state: 'proposed',
			change: {
				operation: 'record_payment',
				studentId: card.id,
				studentName: card.displayName,
				amountMinor: target.amountMinor,
				currency: target.currency,
				paidOn: target.paidOn,
				lessonsHundredths: target.lessonsHundredths,
				creditedMinutes: credited,
				lessonMinutes: card.defaultLessonMinutes,
				note: target.note,
				balanceMinutes,
				balanceAfterMinutes: balanceMinutes === null ? null : counts ? balanceMinutes + credited : balanceMinutes,
				timeZone: zone,
			},
			receipt: null,
		},
	}
}

type Preview =
	{ kind: 'ok'; target: unknown; change: ChatChangeProposalBlock['change'] } | { kind: 'refused'; code: ChangeRefusal }

async function stage(
	tx: DbExecutor,
	context: ChatContext,
	source: ActionSource,
	preview: Preview
): Promise<ProposeOutcome> {
	if (preview.kind === 'refused') return refused(preview.code)
	const actionId = await insertAction(tx, {
		accountId: context.accountId,
		...source,
		kind: 'change',
		state: 'proposed',
		target: preview.target,
		result: { kind: 'proposed' },
	})
	return {
		kind: 'proposed',
		block: { type: 'change_proposal', actionId, state: 'proposed', change: preview.change, receipt: null },
	}
}

async function prepare(
	tx: DbExecutor,
	context: ChatContext,
	source: ActionSource,
	request: ChangeRequest
): Promise<ProposeOutcome> {
	switch (request.operation) {
		case 'record_payment':
			return preparePayment(tx, context, source, request)
		case 'delete_payment':
		case 'remove_entry':
			return stage(tx, context, source, await previewDeletion(tx, context, request))
		case 'bulk_move': {
			const message = await teacherText(tx, context.accountId, source.messageId)
			return stage(tx, context, source, await proposeBulkMove(tx, context, message ?? '', request))
		}
		default: {
			const message = await teacherText(tx, context.accountId, source.messageId)
			return stage(tx, context, source, await previewCardChange(tx, saidIn(message ?? ''), request))
		}
	}
}

export function proposeChange(
	db: Database,
	context: ChatContext,
	source: ActionSource,
	request: ChangeRequest,
	persist: (tx: DbExecutor, block: ChatChangeProposalBlock) => Promise<void>
): Promise<ProposeOutcome> {
	return db.transaction(async (tx) => {
		const outcome = await prepare(tx, context, source, request)
		if (outcome.kind === 'proposed') await persist(tx, outcome.block)
		return outcome
	})
}

async function actionOf(executor: DbExecutor, accountId: string, actionId: string, lock = false) {
	const query = executor
		.select()
		.from(chatActions)
		.where(and(eq(chatActions.id, actionId), eq(chatActions.accountId, accountId)))
	const [row] = lock ? await query.for('update') : await query
	return row ?? null
}

type ProposalBlock = ChatChangeProposalBlock | ChatNoteChangeBlock | ChatReviewOfferBlock

const isProposal = (block: ChatBlock): block is ProposalBlock =>
	block.type === 'change_proposal' ||
	block.type === 'review_offer' ||
	(block.type === 'note_change' && block.mode === 'proposal')

async function proposalOf(executor: DbExecutor, accountId: string, action: ActionRow): Promise<ProposalBlock | null> {
	for (const reply of await repliesOf(executor, accountId, action.messageId)) {
		const block = blocksOf(reply).find((item) => isProposal(item) && item.actionId === action.id)
		if (block !== undefined && isProposal(block)) return block
	}
	return null
}

function proposalView(block: ProposalBlock, action: ActionRow): ProposalBlock {
	if (block.type === 'note_change') return noteChangeView(block, action)
	if (block.type === 'review_offer') return reviewOfferView(block, action)
	return changeView(block, action)
}

export async function presentChange(executor: DbExecutor, accountId: string, actionId: string): Promise<ChangeOutcome> {
	const action = await actionOf(executor, accountId, actionId)
	if (!action) return { kind: 'not_found' }
	if (action.kind !== 'change') return { kind: 'not_change' }
	const block = await proposalOf(executor, accountId, action)
	if (block === null) return { kind: 'not_found' }
	return { kind: 'ok', block: proposalView(block, action) }
}

async function settle(
	tx: DbExecutor,
	actionId: string,
	state: 'applied' | 'refused',
	result: { kind: 'applied' | 'declined' | 'stale' | 'failed'; issue?: ChatChangeIssue },
	after?: unknown
) {
	await tx
		.update(chatActions)
		.set({ state, result, ...(after === undefined ? {} : { after }), updatedAt: sql`now()` })
		.where(eq(chatActions.id, actionId))
}

async function applyPayment(tx: DbExecutor, context: ChatContext, action: ActionRow, target: PaymentTarget) {
	const time = await lockTeacherTimeContext(tx, context.accountId, target.guard.timeZone, context.now)
	if (!time.ok) return settle(tx, action.id, 'refused', { kind: 'stale', issue: 'time_zone_changed' })
	const [card] = await tx
		.select({ id: students.id, defaultLessonMinutes: students.defaultLessonMinutes, revision: students.revision })
		.from(students)
		.where(eq(students.id, target.studentId))
		.for('share')
	if (!card) return settle(tx, action.id, 'refused', { kind: 'stale', issue: 'not_found' })
	if (card.revision !== target.guard.cardRevision)
		return settle(tx, action.id, 'refused', { kind: 'stale', issue: 'student_changed' })
	const payment = await insertPayment(tx, card, {
		paidOn: target.paidOn,
		amountMinor: target.amountMinor,
		currency: target.currency,
		lessonsHundredths: target.lessonsHundredths,
		note: target.note,
	})
	await settle(tx, action.id, 'applied', { kind: 'applied' }, { paymentId: payment.id })
}

async function applyChange(tx: DbExecutor, context: ChatContext, action: ActionRow) {
	const parsed = storedTarget.safeParse(action.target)
	if (!parsed.success) {
		if (legacyTarget.safeParse(action.target).success)
			return settle(tx, action.id, 'refused', { kind: 'stale', issue: 'student_changed' })
		return settle(tx, action.id, 'refused', { kind: 'failed' })
	}
	const target = parsed.data
	if (target.operation === 'record_payment') return applyPayment(tx, context, action, target)
	if (target.operation === 'review_offer') return settle(tx, action.id, 'applied', { kind: 'applied' })
	const applied =
		target.operation === 'update_block' || target.operation === 'delete_block'
			? await applyNoteChange(tx, target)
			: target.operation === 'delete_payment' ||
				  target.operation === 'remove_note' ||
				  target.operation === 'remove_comment'
				? await applyDeletion(tx, context, target)
				: await applyCardChange(tx, context, target)
	if (applied.kind === 'applied') return settle(tx, action.id, 'applied', { kind: 'applied' }, applied.after)
	return settle(tx, action.id, 'refused', applied)
}

async function bulkAction(db: Database, accountId: string, actionId: string) {
	const action = await actionOf(db, accountId, actionId)
	if (!action || action.kind !== 'change' || !isBulkMove(action.target)) return null
	return (await proposalOf(db, accountId, action)) === null ? null : action
}

export async function checkChange(
	db: Database,
	commands: CalendarCommands | undefined,
	context: ChatContext,
	actionId: string
): Promise<ChangeOutcome> {
	if ((await bulkAction(db, context.accountId, actionId)) !== null) await checkBulk(db, commands, context, actionId)
	return presentChange(db, context.accountId, actionId)
}

export async function confirmChange(
	db: Database,
	context: ChatContext,
	actionId: string,
	commands?: CalendarCommands
): Promise<ChangeOutcome> {
	if ((await bulkAction(db, context.accountId, actionId)) !== null) {
		await confirmBulk(db, commands, context, actionId)
		return presentChange(db, context.accountId, actionId)
	}
	return db.transaction(async (tx) => {
		const action = await actionOf(tx, context.accountId, actionId, true)
		if (!action) return { kind: 'not_found' }
		if (action.kind !== 'change') return { kind: 'not_change' }
		if ((await proposalOf(tx, context.accountId, action)) === null) return { kind: 'not_found' }
		if (action.state === 'proposed') await applyChange(tx, context, action)
		return presentChange(tx, context.accountId, actionId)
	})
}

export function declineAction(db: Database, context: ChatContext, actionId: string): Promise<ChangeOutcome> {
	return db.transaction(async (tx) => {
		const action = await actionOf(tx, context.accountId, actionId, true)
		if (!action) return { kind: 'not_found' }
		if (action.kind === 'calendar') {
			const kept = await declineCalendarChange(tx, context.accountId, action)
			return kept.kind === 'ok' ? kept : { kind: 'not_found' }
		}
		if (action.kind !== 'change') return { kind: 'not_change' }
		if ((await proposalOf(tx, context.accountId, action)) === null) return { kind: 'not_found' }
		if (action.state === 'proposed') await settle(tx, action.id, 'refused', { kind: 'declined' })
		return presentChange(tx, context.accountId, actionId)
	})
}
