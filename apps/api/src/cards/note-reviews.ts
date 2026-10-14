import { eq } from 'drizzle-orm'

import { type DbExecutor, noteReviews } from '@dv-lab/db'

export type NoteReviewRead = { reviewedAt: string | null; runningConversationId: string | null }

export async function readNoteReview(executor: DbExecutor, studentId: string): Promise<NoteReviewRead> {
	const [row] = await executor
		.select({ reviewedAt: noteReviews.reviewedAt, runningConversationId: noteReviews.runningConversationId })
		.from(noteReviews)
		.where(eq(noteReviews.studentId, studentId))
	return {
		reviewedAt: row?.reviewedAt ? row.reviewedAt.toISOString() : null,
		runningConversationId: row?.runningConversationId ?? null,
	}
}
