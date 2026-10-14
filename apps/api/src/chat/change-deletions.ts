import { eq } from 'drizzle-orm'
import { z } from 'zod'

import type { ChatChange, ChatChangeIssue } from '@dv-lab/contracts'
import { countsAfterOpening } from '@dv-lab/core'
import { type DbExecutor, students } from '@dv-lab/db'

import { cardFacts } from '../cards/card-facts.ts'
import { deletePayment, listCardPayments } from '../cards/payments.ts'
import type { ChatContext } from './actions.ts'

export type DeletionRequest = { operation: 'delete_payment'; studentId: string; paymentId: string }

export type DeletionRefusal = 'student_not_found' | 'payment_not_found'

export const deletionTargets = [
	z.strictObject({
		operation: z.literal('delete_payment'),
		studentId: z.uuid(),
		paymentId: z.uuid(),
		guard: z.strictObject({ paymentRevision: z.number().int().min(1) }),
	}),
] as const

type DeletionTarget = z.infer<(typeof deletionTargets)[number]>

export type DeletionPreview =
	{ kind: 'ok'; target: DeletionTarget; change: ChatChange } | { kind: 'refused'; code: DeletionRefusal }

export type DeletionApplied =
	{ kind: 'applied'; after: { studentId: string } } | { kind: 'stale'; issue: ChatChangeIssue } | { kind: 'failed' }

const refused = (code: DeletionRefusal): DeletionPreview => ({ kind: 'refused', code })

async function cardOf(executor: DbExecutor, studentId: string) {
	const [row] = await executor
		.select({
			id: students.id,
			displayName: students.displayName,
			openingBalanceMinutes: students.openingBalanceMinutes,
			openingBalanceOn: students.openingBalanceOn,
			noShowDeducts: students.noShowDeducts,
		})
		.from(students)
		.where(eq(students.id, studentId))
	return row ?? null
}

export async function paymentRecords(executor: DbExecutor, studentId: string) {
	const rows = await listCardPayments(executor, studentId)
	if (rows === null) return null
	return rows.map((row) => ({
		payment_id: row.id,
		paid_on: row.paidOn,
		amount_minor: row.amountMinor,
		currency: row.currency,
		lessons: row.lessonsHundredths === null ? null : row.lessonsHundredths / 100,
		note: row.note,
	}))
}

async function previewPayment(
	executor: DbExecutor,
	context: ChatContext,
	request: Extract<DeletionRequest, { operation: 'delete_payment' }>
): Promise<DeletionPreview> {
	const card = await cardOf(executor, request.studentId)
	if (card === null) return refused('student_not_found')
	const payment = (await listCardPayments(executor, card.id))?.find((row) => row.id === request.paymentId)
	if (payment === undefined) return refused('payment_not_found')
	const balanceMinutes = (await cardFacts(executor, [card], context)).get(card.id)?.balanceMinutes ?? null
	const counts = card.openingBalanceOn !== null && countsAfterOpening(payment.paidOn, card.openingBalanceOn)
	return {
		kind: 'ok',
		target: {
			operation: 'delete_payment',
			studentId: card.id,
			paymentId: payment.id,
			guard: { paymentRevision: payment.revision },
		},
		change: {
			operation: 'delete_payment',
			studentId: card.id,
			studentName: card.displayName,
			paymentId: payment.id,
			paidOn: payment.paidOn,
			amountMinor: payment.amountMinor,
			currency: payment.currency,
			lessonsHundredths: payment.lessonsHundredths,
			creditedMinutes: payment.creditedMinutes,
			note: payment.note,
			balanceMinutes,
			balanceAfterMinutes:
				balanceMinutes === null ? null : counts ? balanceMinutes - payment.creditedMinutes : balanceMinutes,
		},
	}
}

export function previewDeletion(
	executor: DbExecutor,
	context: ChatContext,
	request: DeletionRequest
): Promise<DeletionPreview> {
	return previewPayment(executor, context, request)
}

export async function applyDeletion(
	tx: DbExecutor,
	_context: ChatContext,
	target: DeletionTarget
): Promise<DeletionApplied> {
	const outcome = await deletePayment(tx, target.paymentId, target.guard.paymentRevision)
	if (outcome !== 'deleted') return { kind: 'stale', issue: 'payment_changed' }
	return { kind: 'applied', after: { studentId: target.studentId } }
}
