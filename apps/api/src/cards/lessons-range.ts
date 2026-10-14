import { eq } from 'drizzle-orm'

import {
	STUDENT_LESSONS_DAYS_MAX,
	type ScheduleBlock,
	type StudentLesson,
	type StudentLessonsQuery,
	type StudentLessonsResponse,
	type StudentLessonsTotals,
} from '@dv-lab/contracts'
import { type LedgerEntry, type LedgerLesson, addDays, lessonDay, startOfLessonDay } from '@dv-lab/core'
import { type DbExecutor, students } from '@dv-lab/db'

import { readWindowBlocks } from '../schedule/window-blocks.ts'
import type { CardReadContext } from './card-facts.ts'
import { type CardRecord, cardColumns } from './card-rows.ts'
import { type CardLedger, readStudentLedgers, withLessons } from './ledger.ts'

type Period = { from: string; to: string; clipped: boolean; since: boolean }

function monthStart(date: string): string {
	return `${date.slice(0, 8)}01`
}

function monthEnd(date: string): string {
	return addDays(monthStart(addDays(monthStart(date), 32)), -1)
}

function periodOf(query: StudentLessonsQuery, ledger: CardLedger, today: string): Period {
	if (query.range !== 'since_payment') return { from: query.from, to: query.to, clipped: false, since: false }
	const start = ledger.lastPayment === null ? null : ledger.ledger.sinceLastPaymentFrom
	if (start === null) return { from: monthStart(today), to: monthEnd(today), clipped: false, since: false }
	const to = start > today ? start : today
	const earliest = addDays(to, 1 - STUDENT_LESSONS_DAYS_MAX)
	return start < earliest
		? { from: earliest, to, clipped: true, since: true }
		: { from: start, to, clipped: false, since: true }
}

function ledgerLesson(block: ScheduleBlock): LedgerLesson {
	return {
		key: block.key,
		startsAt: new Date(block.startsAt),
		durationMinutes: block.durationMinutes,
		outcome: block.outcome,
	}
}

function emptyTotals(): StudentLessonsTotals {
	return { planned: 0, done: 0, noShow: 0, cancelled: 0, moved: 0, heldCount: 0, heldMinutes: 0 }
}

function addTotals(totals: StudentLessonsTotals, lesson: StudentLesson): void {
	if (lesson.outcome === 'planned') totals.planned += 1
	else if (lesson.outcome === 'done') totals.done += 1
	else if (lesson.outcome === 'no_show') totals.noShow += 1
	else if (lesson.outcome === 'cancelled') totals.cancelled += 1
	if (lesson.outcome === 'moved' || lesson.movedFrom !== null) totals.moved += 1
	if (lesson.held) {
		totals.heldCount += 1
		totals.heldMinutes += lesson.durationMinutes
	}
}

function toLesson(
	block: ScheduleBlock,
	entry: LedgerEntry | undefined,
	ledger: CardLedger,
	card: Pick<CardRecord, 'noShowDeducts'>,
	zone: string
): StudentLesson {
	const covering = entry?.coveringPaymentId ?? null
	const payment = covering === null ? undefined : ledger.payments.find((item) => item.id === covering)
	return {
		key: block.key,
		ref: block.ref,
		date: lessonDay(new Date(block.startsAt), zone),
		startsAt: block.startsAt,
		timeZone: block.timeZone,
		durationMinutes: block.durationMinutes,
		outcome: block.outcome,
		movedFrom: block.movedFrom,
		movedTo: block.movedTo,
		actions: block.actions,
		mark: block.mark,
		markRevision: block.markRevision,
		counted: entry?.counted ?? false,
		deductedMinutes: entry?.deductedMinutes ?? 0,
		balanceAfterMinutes: entry?.balanceAfterMinutes ?? null,
		projected: false,
		payment:
			payment === undefined
				? null
				: {
						id: payment.id,
						paidOn: payment.paidOn,
						amountMinor: payment.amountMinor,
						currency: payment.currency,
						paidAfter: entry?.paidAfter ?? false,
					},
		held: block.outcome === 'done' || (block.outcome === 'no_show' && card.noShowDeducts),
		sinceLastPayment: entry?.sinceLastPayment ?? false,
	}
}

function project(lessons: StudentLesson[], balance: number | null, now: Date): void {
	if (balance === null) return
	let running = balance
	for (const lesson of lessons) {
		if (lesson.outcome !== 'planned' || !lesson.counted || Date.parse(lesson.startsAt) <= now.getTime()) continue
		running -= lesson.durationMinutes
		lesson.balanceAfterMinutes = running
		lesson.projected = true
	}
}

export async function readStudentLessons(
	executor: DbExecutor,
	studentId: string,
	context: CardReadContext,
	query: StudentLessonsQuery
): Promise<StudentLessonsResponse | null> {
	const [card] = await executor.select(cardColumns).from(students).where(eq(students.id, studentId))
	if (!card) return null
	const zone = context.defaultTimeZone
	const base = (await readStudentLedgers(executor, [card], zone)).get(card.id)
	if (!base) throw new Error('Card ledger is missing')
	const today = lessonDay(context.now, zone)
	const period = periodOf(query, base, today)
	const start = startOfLessonDay(period.since ? addDays(period.from, -1) : period.from, zone)
	const window = await readWindowBlocks(executor, context, {
		from: start.getTime() < context.now.getTime() ? start : context.now,
		to: startOfLessonDay(addDays(period.to, 1), zone),
		studentIds: [card.id],
	})
	const rows = window.blocks.filter((block) => block.movedTo === null)
	const ledger = withLessons(card, base, rows.map(ledgerLesson), zone)
	const entries = new Map(ledger.ledger.entries.map((entry) => [entry.key, entry]))
	const all = rows.map((block) => toLesson(block, entries.get(block.key), ledger, card, zone))
	project(all, ledger.ledger.balanceMinutes, context.now)
	const lessons = all.filter((lesson) =>
		period.since
			? lesson.sinceLastPayment && lesson.date <= period.to && (!period.clipped || lesson.date >= period.from)
			: lesson.date >= period.from && lesson.date <= period.to
	)
	const totals = emptyTotals()
	for (const lesson of lessons) addTotals(totals, lesson)
	return {
		studentId: card.id,
		from: period.from,
		to: period.to,
		clipped: period.clipped,
		coverage: window.coverage,
		asOf: context.now.toISOString(),
		defaultTimeZone: zone,
		defaultLessonMinutes: card.defaultLessonMinutes,
		lastPayment: ledger.lastPayment,
		sinceLastPaymentFrom: ledger.lastPayment === null ? null : ledger.ledger.sinceLastPaymentFrom,
		lessons,
		totals,
	}
}
