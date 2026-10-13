import type { ChatStudentFacts } from '@dv-lab/contracts'
import { paysSoonList } from '@dv-lab/core'
import type { DbExecutor } from '@dv-lab/db'

import type { CardReadContext } from '../cards/card-facts.ts'
import { getCard } from '../cards/cards.ts'

export async function readChatFacts(
	executor: DbExecutor,
	context: CardReadContext,
	studentId: string,
	paysSoonLessons: number
): Promise<ChatStudentFacts | null> {
	const card = await getCard(executor, studentId, context)
	if (card === null) return null
	return {
		student: {
			id: card.id,
			displayName: card.displayName,
			status: card.status,
			defaultLessonMinutes: card.defaultLessonMinutes,
		},
		balanceMinutes: card.balanceMinutes,
		nextLesson: card.nextLesson,
		paysSoon: paysSoonList([card], paysSoonLessons).length > 0,
		paysSoonLessons,
		asOf: context.now.toISOString(),
		defaultTimeZone: context.defaultTimeZone,
	}
}
