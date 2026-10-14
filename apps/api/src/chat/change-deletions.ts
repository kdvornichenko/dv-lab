import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { type ChatChange, type ChatChangeIssue, CHAT_REMOVED_BODY_MAX } from '@dv-lab/contracts'
import { countsAfterOpening, lessonDay } from '@dv-lab/core'
import { type DbExecutor, lessonComments, students } from '@dv-lab/db'

import { cardFacts } from '../cards/card-facts.ts'
import { listStudentNotes, retractStudentNote } from '../cards/notes.ts'
import { deletePayment, listCardPayments } from '../cards/payments.ts'
import { retractLessonComment } from '../schedule/comments.ts'
import { occurrenceStartsAt } from '../schedule/rows.ts'
import type { ChatContext } from './actions.ts'

export type DeletionRequest =
	| { operation: 'delete_payment'; studentId: string; paymentId: string }
	| { operation: 'remove_entry'; studentId: string; entryId: string }

export type DeletionRefusal = 'student_not_found' | 'payment_not_found' | 'entry_not_found'

const entryGuard = z.strictObject({ revision: z.number().int().min(1) })

export const deletionTargets = [
	z.strictObject({
		operation: z.literal('delete_payment'),
		studentId: z.uuid(),
		paymentId: z.uuid(),
		guard: z.strictObject({ paymentRevision: z.number().int().min(1) }),
	}),
	z.strictObject({ operation: z.literal('remove_note'), studentId: z.uuid(), noteId: z.uuid(), guard: entryGuard }),
	z.strictObject({
		operation: z.literal('remove_comment'),
		studentId: z.uuid(),
		commentId: z.uuid(),
		guard: entryGuard,
	}),
] as const

type DeletionTarget = z.infer<(typeof deletionTargets)[number]>

export type DeletionPreview =
	{ kind: 'ok'; target: DeletionTarget; change: ChatChange } | { kind: 'refused'; code: DeletionRefusal }

export type DeletionApplied =
	{ kind: 'applied'; after: { studentId: string } } | { kind: 'stale'; issue: ChatChangeIssue } | { kind: 'failed' }

const refused = (code: DeletionRefusal): DeletionPreview => ({ kind: 'refused', code })

const applied = (studentId: string): DeletionApplied => ({ kind: 'applied', after: { studentId } })

function shortBody(body: string): string {
	const points = Array.from(body)
	return points.length > CHAT_REMOVED_BODY_MAX ? `${points.slice(0, CHAT_REMOVED_BODY_MAX - 1).join('')}…` : body
}

async function cardOf(executor: DbExecutor, studentId: string) {
	const [row] = await executor
		.select({
			id: students.id,
			displayName: students.displayName,
			defaultLessonMinutes: students.defaultLessonMinutes,
			openingBalanceMinutes: students.openingBalanceMinutes,
			openingBalanceOn: students.openingBalanceOn,
			noShowDeducts: students.noShowDeducts,
		})
		.from(students)
		.where(eq(students.id, studentId))
	return row ?? null
}

type Card = NonNullable<Awaited<ReturnType<typeof cardOf>>>

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
	card: Card,
	paymentId: string
): Promise<DeletionPreview> {
	const payment = (await listCardPayments(executor, card.id))?.find((row) => row.id === paymentId)
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
			lessonMinutes: card.defaultLessonMinutes,
			note: payment.note,
			balanceMinutes,
			balanceAfterMinutes:
				balanceMinutes === null ? null : counts ? balanceMinutes - payment.creditedMinutes : balanceMinutes,
		},
	}
}

async function liveComment(executor: DbExecutor, studentId: string, commentId: string) {
	const [row] = await executor
		.select({
			id: lessonComments.id,
			seriesId: lessonComments.seriesId,
			originalOn: lessonComments.originalOn,
			lessonId: lessonComments.lessonId,
			body: lessonComments.body,
			revision: lessonComments.revision,
			createdAt: lessonComments.createdAt,
		})
		.from(lessonComments)
		.where(
			and(eq(lessonComments.id, commentId), eq(lessonComments.studentId, studentId), isNull(lessonComments.retractedAt))
		)
	return row ?? null
}

async function previewEntry(
	executor: DbExecutor,
	context: ChatContext,
	card: Card,
	entryId: string
): Promise<DeletionPreview> {
	const note = (await listStudentNotes(executor, context.accountId, card.id))?.find((row) => row.id === entryId)
	if (note !== undefined)
		return {
			kind: 'ok',
			target: { operation: 'remove_note', studentId: card.id, noteId: note.id, guard: { revision: note.revision } },
			change: {
				operation: 'remove_note',
				studentId: card.id,
				studentName: card.displayName,
				noteId: note.id,
				sectionKind: note.sectionKind,
				body: shortBody(note.body),
				createdAt: note.createdAt,
			},
		}
	const comment = await liveComment(executor, card.id, entryId)
	if (comment === null) return refused('entry_not_found')
	const lessonRef =
		comment.seriesId !== null && comment.originalOn !== null
			? { kind: 'series' as const, seriesId: comment.seriesId, originalOn: comment.originalOn }
			: comment.lessonId !== null
				? { kind: 'single' as const, lessonId: comment.lessonId }
				: null
	if (lessonRef === null) return refused('entry_not_found')
	const startsAt = await occurrenceStartsAt(executor, lessonRef)
	return {
		kind: 'ok',
		target: {
			operation: 'remove_comment',
			studentId: card.id,
			commentId: comment.id,
			guard: { revision: comment.revision },
		},
		change: {
			operation: 'remove_comment',
			studentId: card.id,
			studentName: card.displayName,
			commentId: comment.id,
			lessonRef,
			lessonDate: startsAt === null ? null : lessonDay(startsAt, context.defaultTimeZone),
			body: shortBody(comment.body),
			createdAt: comment.createdAt.toISOString(),
		},
	}
}

export async function previewDeletion(
	executor: DbExecutor,
	context: ChatContext,
	request: DeletionRequest
): Promise<DeletionPreview> {
	const card = await cardOf(executor, request.studentId)
	if (card === null) return refused('student_not_found')
	if (request.operation === 'delete_payment') return previewPayment(executor, context, card, request.paymentId)
	return previewEntry(executor, context, card, request.entryId)
}

export async function applyDeletion(
	tx: DbExecutor,
	context: ChatContext,
	target: DeletionTarget
): Promise<DeletionApplied> {
	if (target.operation === 'delete_payment') {
		const outcome = await deletePayment(tx, target.paymentId, target.guard.paymentRevision)
		return outcome === 'deleted' ? applied(target.studentId) : { kind: 'stale', issue: 'payment_changed' }
	}
	const outcome =
		target.operation === 'remove_note'
			? await retractStudentNote(tx, context.accountId, target.noteId, target.guard.revision, target.studentId)
			: await retractLessonComment(tx, context.accountId, target.commentId, target.guard.revision)
	return outcome.kind === 'retracted' ? applied(target.studentId) : { kind: 'stale', issue: 'entry_changed' }
}
