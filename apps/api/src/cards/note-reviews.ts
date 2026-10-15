import { and, eq, inArray, sql } from 'drizzle-orm'

import { CHAT_ACTIVE_TURN_STATES } from '@dv-lab/contracts'
import { type DbExecutor, chatTurns, noteReviews } from '@dv-lab/db'

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

export async function finishReview(executor: DbExecutor, studentId: string): Promise<string> {
	const [row] = await executor
		.insert(noteReviews)
		.values({ studentId, reviewedAt: sql`now()` })
		.onConflictDoUpdate({ target: noteReviews.studentId, set: { reviewedAt: sql`now()`, updatedAt: sql`now()` } })
		.returning({ reviewedAt: noteReviews.reviewedAt })
	if (!row?.reviewedAt) throw new Error('note review stamp returned no row')
	return row.reviewedAt.toISOString()
}
