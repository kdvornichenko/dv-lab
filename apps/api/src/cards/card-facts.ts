import type { NextLessonRead, StudentLastPayment } from '@dv-lab/contracts'
import { lessonDay } from '@dv-lab/core'
import type { DbExecutor } from '@dv-lab/db'

import { readNextLessons } from '../calendar/read-model.ts'
import type { CalendarReadContext } from '../calendar/read-state.ts'
import type { TeacherTimeContext } from '../settings/settings.ts'
import { type LedgerSource, readStudentLedgers } from './ledger.ts'

export type CardFacts = {
	balanceMinutes: number | null
	nextLesson: NextLessonRead
	lastPayment: StudentLastPayment | null
}
export type CardReadContext = TeacherTimeContext & CalendarReadContext

export async function cardFacts(
	executor: DbExecutor,
	cards: readonly LedgerSource[],
	context: CardReadContext
): Promise<Map<string, CardFacts>> {
	const ledgers = await readStudentLedgers(executor, cards, context.defaultTimeZone)
	const next = await readNextLessons(
		executor,
		context,
		cards.map((card) => card.id)
	)
	return new Map(
		cards.map((card) => {
			const read = next.get(card.id)
			if (!read) throw new Error('Card next lesson result is missing')
			const nextLesson: NextLessonRead =
				read.result === 'known' ? { ...read, date: lessonDay(new Date(read.startsAt), context.defaultTimeZone) } : read
			const ledger = ledgers.get(card.id)
			return [
				card.id,
				{
					balanceMinutes: ledger?.ledger.balanceMinutes ?? null,
					nextLesson,
					lastPayment: ledger?.lastPayment ?? null,
				},
			]
		})
	)
}
