import { type LessonOutcome, awaitsMark, canChange, countsAsLesson, scheduleDate } from './schedule.ts'

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

export type MarkEffect =
	| { kind: 'cancelled' }
	| { kind: 'moved' }
	| { kind: 'not_started' }
	| { kind: 'unmarked' }
	| { kind: 'no_opening' }
	| { kind: 'before_opening'; openingOn: string }
	| { kind: 'no_show_off' }
	| { kind: 'deducts'; minutes: number }

export function markEffect(input: {
	outcome: LessonOutcome
	startsAt: Date
	durationMinutes: number
	now: Date
	card: Pick<BalanceCard, 'openingOn' | 'noShowDeducts'>
}): MarkEffect {
	const { outcome, startsAt, durationMinutes, now, card } = input
	if (outcome === 'cancelled') return { kind: 'cancelled' }
	if (outcome === 'moved') return { kind: 'moved' }
	if (canChange(startsAt, now)) return { kind: 'not_started' }
	if (outcome === 'planned') return { kind: 'unmarked' }
	if (card.openingOn === null) return { kind: 'no_opening' }
	if (!countsAfterOpening(scheduleDate(startsAt), card.openingOn)) {
		return { kind: 'before_opening', openingOn: card.openingOn }
	}
	if (outcome === 'no_show' && !card.noShowDeducts) return { kind: 'no_show_off' }
	return { kind: 'deducts', minutes: deductedMinutes(outcome, durationMinutes, card.noShowDeducts) }
}

export function needsMark(
	lesson: { outcome: LessonOutcome; startsAt: Date },
	card: { status: string; openingOn: string | null },
	now: Date
): boolean {
	if (!awaitsMark(lesson.outcome, lesson.startsAt, now) || card.status !== 'active') return false
	return card.openingOn === null || countsAfterOpening(scheduleDate(lesson.startsAt), card.openingOn)
}

export type TodayCounts = {
	lessons: number
	toCome: number
	started: number
	done: number
	toMark: number
	toMarkToday: number
	toMarkEarlier: number
	paysSoon: number
	nextKey: string | null
}

type TodayLesson = {
	key: string
	startsAt: Date
	outcome: LessonOutcome
	studentStatus: string
	openingOn: string | null
}

export function todayCounts(
	input: { lessons: readonly TodayLesson[]; earlier: number; paysSoon: number },
	now: Date
): TodayCounts {
	const counted = input.lessons.filter((lesson) => countsAsLesson(lesson.outcome))
	const toCome = counted.filter((lesson) => canChange(lesson.startsAt, now)).length
	const toMarkToday = input.lessons.filter((lesson) =>
		needsMark(lesson, { status: lesson.studentStatus, openingOn: lesson.openingOn }, now)
	).length
	let next: TodayLesson | null = null
	for (const lesson of input.lessons) {
		if (lesson.outcome !== 'planned' || !canChange(lesson.startsAt, now)) continue
		if (next === null || lesson.startsAt.getTime() < next.startsAt.getTime()) next = lesson
	}
	return {
		lessons: counted.length,
		toCome,
		started: counted.length - toCome,
		done: counted.filter((lesson) => lesson.outcome === 'done').length,
		toMark: toMarkToday + input.earlier,
		toMarkToday,
		toMarkEarlier: input.earlier,
		paysSoon: input.paysSoon,
		nextKey: next?.key ?? null,
	}
}
