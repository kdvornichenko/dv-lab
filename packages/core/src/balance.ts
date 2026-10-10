import { type LessonOutcome, scheduleDate } from './schedule.ts'

export function balanceMinutes(openingMinutes: number | null, credited: readonly number[]): number | null {
	if (openingMinutes === null) return null
	return credited.reduce((sum, minutes) => sum + minutes, openingMinutes)
}

export type BalanceCard = { openingMinutes: number | null; openingOn: string | null; noShowDeducts: boolean }

export type BalancePayment = { paidOn: string; creditedMinutes: number }

export type BalanceLesson = { startsAt: Date; durationMinutes: number; outcome: LessonOutcome }

export function countsAfterOpening(date: string, openingOn: string): boolean {
	return date > openingOn
}

export function deductedMinutes(outcome: LessonOutcome, durationMinutes: number, noShowDeducts: boolean): number {
	if (outcome === 'done') return durationMinutes
	if (outcome === 'no_show') return noShowDeducts ? durationMinutes : 0
	return 0
}

export function lessonDeduction(lesson: BalanceLesson, card: Pick<BalanceCard, 'openingOn' | 'noShowDeducts'>): number {
	if (card.openingOn === null || !countsAfterOpening(scheduleDate(lesson.startsAt), card.openingOn)) return 0
	return deductedMinutes(lesson.outcome, lesson.durationMinutes, card.noShowDeducts)
}

export function studentBalance(
	card: BalanceCard,
	payments: readonly BalancePayment[],
	lessons: readonly BalanceLesson[]
): number | null {
	const { openingMinutes, openingOn } = card
	if (openingMinutes === null || openingOn === null) return null
	let minutes = openingMinutes
	for (const payment of payments) {
		if (countsAfterOpening(payment.paidOn, openingOn)) minutes += payment.creditedMinutes
	}
	for (const lesson of lessons) minutes -= lessonDeduction(lesson, card)
	return minutes
}
