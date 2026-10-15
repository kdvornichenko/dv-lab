import { and, eq, gt, inArray, or, sql } from 'drizzle-orm'

import { CHAT_ACTIVE_TURN_STATES } from '@dv-lab/contracts'
import { type DbExecutor, chatActions, chatTurns, noteReviews, studentSections, studentTerms } from '@dv-lab/db'

export type NoteReviewRead = { reviewedAt: string | null; runningConversationId: string | null }

const ACTIVE: string[] = [...CHAT_ACTIVE_TURN_STATES]

async function turnLive(executor: DbExecutor, conversationId: string): Promise<boolean> {
	const [turn] = await executor
		.select({ id: chatTurns.id })
		.from(chatTurns)
		.where(and(eq(chatTurns.conversationId, conversationId), inArray(chatTurns.state, ACTIVE)))
		.limit(1)
	return turn !== undefined
}

export async function readNoteReview(executor: DbExecutor, studentId: string): Promise<NoteReviewRead> {
	const [row] = await executor
		.select({ reviewedAt: noteReviews.reviewedAt, runningConversationId: noteReviews.runningConversationId })
		.from(noteReviews)
		.where(eq(noteReviews.studentId, studentId))
	const running = row?.runningConversationId ?? null
	return {
		reviewedAt: row?.reviewedAt ? row.reviewedAt.toISOString() : null,
		runningConversationId: running !== null && (await turnLive(executor, running)) ? running : null,
	}
}

export async function markReviewRunning(executor: DbExecutor, studentId: string, conversationId: string) {
	await executor
		.insert(noteReviews)
		.values({ studentId, runningConversationId: conversationId })
		.onConflictDoUpdate({
			target: noteReviews.studentId,
			set: { runningConversationId: conversationId, updatedAt: sql`now()` },
		})
}

export async function clearReviewRunning(executor: DbExecutor, studentId: string, conversationId: string) {
	await executor
		.update(noteReviews)
		.set({ runningConversationId: null, updatedAt: sql`now()` })
		.where(and(eq(noteReviews.studentId, studentId), eq(noteReviews.runningConversationId, conversationId)))
}

const REVIEW_DUE_MS = 14 * 24 * 60 * 60 * 1000

export type ReviewOffer = { lastReviewedAt: string | null }

async function changedSince(executor: DbExecutor, studentId: string, since: Date): Promise<boolean> {
	const [block] = await executor
		.select({ id: studentSections.id })
		.from(studentSections)
		.where(and(eq(studentSections.studentId, studentId), gt(studentSections.updatedAt, since)))
		.limit(1)
	if (block) return true
	const [term] = await executor
		.select({ id: studentTerms.id })
		.from(studentTerms)
		.where(
			and(
				eq(studentTerms.studentId, studentId),
				or(gt(studentTerms.createdAt, since), gt(studentTerms.removedAt, since))
			)
		)
		.limit(1)
	return term !== undefined
}

export async function shouldOffer(
	executor: DbExecutor,
	studentId: string,
	conversationId: string,
	today: string,
	now: Date
): Promise<ReviewOffer | null> {
	const [row] = await executor
		.select({ reviewedAt: noteReviews.reviewedAt, offeredOn: noteReviews.offeredOn })
		.from(noteReviews)
		.where(eq(noteReviews.studentId, studentId))
	if (row?.offeredOn === today) return null
	const [asked] = await executor
		.select({ id: chatActions.id })
		.from(chatActions)
		.where(
			and(
				eq(chatActions.conversationId, conversationId),
				eq(chatActions.kind, 'change'),
				sql`${chatActions.target}->>'operation' = 'review_offer'`,
				sql`${chatActions.target}->>'studentId' = ${studentId}`
			)
		)
		.limit(1)
	if (asked) return null
	const reviewedAt = row?.reviewedAt ?? null
	const offer = { lastReviewedAt: reviewedAt === null ? null : reviewedAt.toISOString() }
	if (reviewedAt === null || now.getTime() - reviewedAt.getTime() > REVIEW_DUE_MS) return offer
	return (await changedSince(executor, studentId, reviewedAt)) ? offer : null
}

export async function recordOffer(executor: DbExecutor, studentId: string, today: string): Promise<boolean> {
	const rows = await executor
		.insert(noteReviews)
		.values({ studentId, offeredOn: today })
		.onConflictDoUpdate({
			target: noteReviews.studentId,
			set: { offeredOn: today, updatedAt: sql`now()` },
			setWhere: sql`${noteReviews.offeredOn} is distinct from ${today}::date`,
		})
		.returning({ studentId: noteReviews.studentId })
	return rows.length > 0
}

export async function finishReview(executor: DbExecutor, studentId: string): Promise<string> {
	const [row] = await executor
		.insert(noteReviews)
		.values({ studentId, reviewedAt: sql`now()` })
		.onConflictDoUpdate({ target: noteReviews.studentId, set: { reviewedAt: sql`now()`, updatedAt: sql`now()` } })
		.returning({ reviewedAt: noteReviews.reviewedAt })
	if (!row?.reviewedAt) throw new Error('note review stamp returned no row')
	return row.reviewedAt.toISOString()
}
