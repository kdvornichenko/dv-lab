import type {
	ChatDay,
	ChatFactsBlock,
	ChatLessonsBlock,
	ChatPaysSoonBlock,
	ChatRecordsKey,
	ChatStudentFacts,
} from '@dv-lab/contracts'
import { addDays, lessonDay, paysSoonList } from '@dv-lab/core'
import type { DbExecutor } from '@dv-lab/db'

import type { CardReadContext } from '../cards/card-facts.ts'
import { getCard, listCards } from '../cards/cards.ts'
import { readLessonDay } from '../today/today.ts'

export type ChatRecordsBlock = ChatFactsBlock | ChatLessonsBlock | ChatPaysSoonBlock

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

export async function readChatDay(
	executor: DbExecutor,
	context: CardReadContext,
	day: ChatDay
): Promise<ChatLessonsBlock> {
	const today = lessonDay(context.now, context.defaultTimeZone)
	const read = await readLessonDay(executor, context, day === 'today' ? today : addDays(today, 1))
	return {
		type: 'lessons',
		day,
		date: read.date,
		defaultTimeZone: read.defaultTimeZone,
		asOf: context.now.toISOString(),
		calendarRead: read.calendarRead,
		lessons: read.lessons.map((block) => ({
			key: block.key,
			studentId: block.studentId,
			studentName: block.studentName,
			startsAt: block.startsAt,
			timeZone: block.timeZone,
			durationMinutes: block.durationMinutes,
			outcome: block.outcome,
			movedTo: block.movedTo,
		})),
	}
}

export async function readChatPaysSoon(
	executor: DbExecutor,
	context: CardReadContext,
	paysSoonLessons: number
): Promise<ChatPaysSoonBlock> {
	const cards = await listCards(executor, context)
	return {
		type: 'pays_soon',
		students: paysSoonList(cards.students, paysSoonLessons).map((student) => ({
			id: student.id,
			displayName: student.displayName,
			balanceMinutes: student.balanceMinutes,
			defaultLessonMinutes: student.defaultLessonMinutes,
		})),
		paysSoonLessons,
		asOf: context.now.toISOString(),
	}
}

export async function readChatRecords(
	executor: DbExecutor,
	context: CardReadContext,
	key: ChatRecordsKey,
	paysSoonLessons: number
): Promise<ChatRecordsBlock | null> {
	if (key.kind === 'student') {
		const facts = await readChatFacts(executor, context, key.studentId, paysSoonLessons)
		return facts === null ? null : { type: 'facts', facts }
	}
	if (key.day === 'payments') return readChatPaysSoon(executor, context, paysSoonLessons)
	return readChatDay(executor, context, key.day)
}
