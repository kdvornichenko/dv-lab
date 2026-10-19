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

export function lessonDeduction(
	lesson: BalanceLesson,
	card: Pick<BalanceCard, 'openingOn' | 'noShowDeducts'>,
	timeZone: string
): number {
	if (card.openingOn === null || !countsAfterOpening(scheduleDate(lesson.startsAt, timeZone), card.openingOn)) return 0
	return deductedMinutes(lesson.outcome, lesson.durationMinutes, card.noShowDeducts)
}

export function studentBalance(
	card: BalanceCard,
	payments: readonly BalancePayment[],
	lessons: readonly BalanceLesson[],
	timeZone: string
): number | null {
	const { openingMinutes, openingOn } = card
	if (openingMinutes === null || openingOn === null) return null
	let minutes = openingMinutes
	for (const payment of payments) {
		if (countsAfterOpening(payment.paidOn, openingOn)) minutes += payment.creditedMinutes
	}
	for (const lesson of lessons) minutes -= lessonDeduction(lesson, card, timeZone)
	return minutes
}

export type BalanceForecastLesson = { startsAt: Date; durationMinutes: number }

export type BalanceRunsOut = { kind: 'on'; startsAt: Date } | { kind: 'now' } | { kind: 'beyond' }

export function balanceRunsOut(
	balanceMinutes: number,
	openingOn: string,
	lessons: readonly BalanceForecastLesson[],
	timeZone: string
): BalanceRunsOut {
	if (balanceMinutes <= 0) return { kind: 'now' }
	let left = balanceMinutes
	const ordered = [...lessons].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
	for (const lesson of ordered) {
		if (!countsAfterOpening(scheduleDate(lesson.startsAt, timeZone), openingOn)) continue
		left -= lesson.durationMinutes
		if (left <= 0) return { kind: 'on', startsAt: lesson.startsAt }
	}
	return { kind: 'beyond' }
}

export type LedgerPayment = BalancePayment & { id: string; createdAt: Date }

export type LedgerLesson = BalanceLesson & { key: string }

export type LedgerEntry = {
	key: string
	date: string
	counted: boolean
	deductedMinutes: number
	balanceAfterMinutes: number | null
	coveringPaymentId: string | null
	paidAfter: boolean
	held: boolean
	sinceLastPayment: boolean
}

export type LedgerLastPayment = { id: string; paidOn: string; creditedMinutes: number }

export type StudentLedger = {
	balanceMinutes: number | null
	entries: LedgerEntry[]
	lastPayment: LedgerLastPayment | null
	sinceLastPaymentFrom: string | null
	balanceBeforeLastPayment: number | null
}

type LedgerEvent =
	| { kind: 'payment'; date: string; payment: LedgerPayment }
	| { kind: 'lesson'; date: string; lesson: LedgerLesson; entry: LedgerEntry }

function compareText(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0
}

function compareEvents(left: LedgerEvent, right: LedgerEvent): number {
	const byDate = compareText(left.date, right.date)
	if (byDate !== 0) return byDate
	if (left.kind === 'payment' && right.kind === 'payment') {
		return (
			left.payment.createdAt.getTime() - right.payment.createdAt.getTime() ||
			compareText(left.payment.id, right.payment.id)
		)
	}
	if (left.kind === 'lesson' && right.kind === 'lesson') {
		return (
			left.lesson.startsAt.getTime() - right.lesson.startsAt.getTime() || compareText(left.lesson.key, right.lesson.key)
		)
	}
	return left.kind === 'payment' ? -1 : 1
}

type Credit = { id: string | null; minutes: number }
type Debt = { entry: LedgerEntry | null; minutes: number }

function fifo(openingMinutes: number) {
	const credits: Credit[] = openingMinutes > 0 ? [{ id: null, minutes: openingMinutes }] : []
	const debts: Debt[] = openingMinutes < 0 ? [{ entry: null, minutes: 0 - openingMinutes }] : []
	function give(minutes: number, id: string): void {
		let left = minutes
		while (left > 0 && debts.length > 0) {
			const debt = debts[0] as Debt
			const paid = Math.min(left, debt.minutes)
			debt.minutes -= paid
			left -= paid
			if (debt.minutes === 0) {
				debts.shift()
				if (debt.entry !== null) {
					debt.entry.coveringPaymentId = id
					debt.entry.paidAfter = true
				}
			}
		}
		if (left > 0) credits.push({ id, minutes: left })
	}
	function take(minutes: number, entry: LedgerEntry | null): void {
		let left = minutes
		let source: string | null = null
		while (left > 0 && credits.length > 0) {
			const credit = credits[0] as Credit
			const used = Math.min(left, credit.minutes)
			credit.minutes -= used
			left -= used
			source = credit.id
			if (credit.minutes === 0) credits.shift()
		}
		if (left > 0) debts.push({ entry, minutes: left })
		else if (entry !== null) entry.coveringPaymentId = source
	}
	return { give, take }
}

export function studentLedger(
	card: BalanceCard,
	payments: readonly LedgerPayment[],
	lessons: readonly LedgerLesson[],
	timeZone: string
): StudentLedger {
	const { openingMinutes, openingOn } = card
	const events: LedgerEvent[] = []
	for (const lesson of lessons) {
		const date = scheduleDate(lesson.startsAt, timeZone)
		const deducted = lessonDeduction(lesson, card, timeZone)
		const counted =
			openingMinutes !== null &&
			openingOn !== null &&
			countsAfterOpening(date, openingOn) &&
			countsAsLesson(lesson.outcome)
		const entry: LedgerEntry = {
			key: lesson.key,
			date,
			counted,
			deductedMinutes: deducted,
			balanceAfterMinutes: null,
			coveringPaymentId: null,
			paidAfter: false,
			held: deducted > 0,
			sinceLastPayment: false,
		}
		events.push({ kind: 'lesson', date, lesson, entry })
	}
	if (openingMinutes === null || openingOn === null) {
		const entries = events.sort(compareEvents).flatMap((event) => (event.kind === 'lesson' ? [event.entry] : []))
		return {
			balanceMinutes: null,
			entries,
			lastPayment: null,
			sinceLastPaymentFrom: null,
			balanceBeforeLastPayment: null,
		}
	}
	for (const payment of payments) {
		if (countsAfterOpening(payment.paidOn, openingOn)) events.push({ kind: 'payment', date: payment.paidOn, payment })
	}
	events.sort(compareEvents)
	const entries = events.flatMap((event) => (event.kind === 'lesson' ? [event.entry] : []))

	const queue = fifo(openingMinutes)
	const after: number[] = []
	let minutes = openingMinutes
	let lastIndex = -1
	for (const [index, event] of events.entries()) {
		if (event.kind === 'payment') {
			const credited = event.payment.creditedMinutes
			if (credited > 0) {
				queue.give(credited, event.payment.id)
				lastIndex = index
			} else if (credited < 0) queue.take(0 - credited, null)
			minutes += credited
		} else if (event.entry.counted) {
			if (event.entry.deductedMinutes > 0) queue.take(event.entry.deductedMinutes, event.entry)
			minutes -= event.entry.deductedMinutes
			event.entry.balanceAfterMinutes = minutes
		}
		after.push(minutes)
	}

	const last = events[lastIndex]
	if (last === undefined || last.kind !== 'payment') {
		return {
			balanceMinutes: minutes,
			entries,
			lastPayment: null,
			sinceLastPaymentFrom: null,
			balanceBeforeLastPayment: null,
		}
	}
	const before = lastIndex === 0 ? openingMinutes : (after[lastIndex - 1] as number)
	let start = lastIndex
	if (before < 0) {
		let solvent = -1
		for (let index = lastIndex - 1; index >= 0; index -= 1) {
			if ((after[index] as number) >= 0) {
				solvent = index
				break
			}
		}
		for (let index = solvent + 1; index < lastIndex; index += 1) {
			const event = events[index] as LedgerEvent
			if (event.kind === 'lesson' && event.entry.counted && event.entry.deductedMinutes > 0) {
				start = index
				break
			}
		}
	}
	for (let index = start; index < events.length; index += 1) {
		const event = events[index] as LedgerEvent
		if (event.kind === 'lesson') event.entry.sinceLastPayment = true
	}
	return {
		balanceMinutes: minutes,
		entries,
		lastPayment: { id: last.payment.id, paidOn: last.payment.paidOn, creditedMinutes: last.payment.creditedMinutes },
		sinceLastPaymentFrom: (events[start] as LedgerEvent).date,
		balanceBeforeLastPayment: before,
	}
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
	timeZone: string
	card: Pick<BalanceCard, 'openingOn' | 'noShowDeducts'>
}): MarkEffect {
	const { outcome, startsAt, durationMinutes, now, card, timeZone } = input
	if (outcome === 'cancelled') return { kind: 'cancelled' }
	if (outcome === 'moved') return { kind: 'moved' }
	if (outcome === 'planned') return canChange(startsAt, now) ? { kind: 'not_started' } : { kind: 'unmarked' }
	if (card.openingOn === null) return { kind: 'no_opening' }
	if (!countsAfterOpening(scheduleDate(startsAt, timeZone), card.openingOn)) {
		return { kind: 'before_opening', openingOn: card.openingOn }
	}
	if (outcome === 'no_show' && !card.noShowDeducts) return { kind: 'no_show_off' }
	return { kind: 'deducts', minutes: deductedMinutes(outcome, durationMinutes, card.noShowDeducts) }
}

export function needsMark(
	lesson: { outcome: LessonOutcome; startsAt: Date },
	card: { status: string; openingOn: string | null },
	now: Date,
	timeZone: string
): boolean {
	if (!awaitsMark(lesson.outcome, lesson.startsAt, now) || card.status !== 'active') return false
	return card.openingOn === null || countsAfterOpening(scheduleDate(lesson.startsAt, timeZone), card.openingOn)
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
	now: Date,
	timeZone: string
): TodayCounts {
	const counted = input.lessons.filter((lesson) => countsAsLesson(lesson.outcome))
	const toCome = counted.filter((lesson) => canChange(lesson.startsAt, now)).length
	const toMarkToday = input.lessons.filter((lesson) =>
		needsMark(lesson, { status: lesson.studentStatus, openingOn: lesson.openingOn }, now, timeZone)
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
