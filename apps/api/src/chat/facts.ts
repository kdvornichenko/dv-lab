import { eq } from 'drizzle-orm'

import {
	CHAT_LESSON_DATES_DAYS_MAX,
	type ChatBalanceEnds,
	type ChatDay,
	type ChatDayLesson,
	type ChatFactsBlock,
	type ChatLessonDateScope,
	type ChatLessonDatesBlock,
	type ChatLessonsBlock,
	type ChatPaysSoonBlock,
	type ChatRecordsKey,
	type ChatStudentFacts,
	type ScheduleBlock,
	type StudentDetail,
} from '@dv-lab/contracts'
import {
	MARK_LOOKBACK_DAYS,
	addDays,
	balanceRunsOut,
	lessonDay,
	minorToInput,
	paysSoonList,
	startOfLessonDay,
} from '@dv-lab/core'
import { type DbExecutor, students } from '@dv-lab/db'

import type { CardReadContext } from '../cards/card-facts.ts'
import { getCard, listCards } from '../cards/cards.ts'
import { readStudentLessons } from '../cards/lessons-range.ts'
import { readWindowBlocks } from '../schedule/window-blocks.ts'
import { readLessonDay } from '../today/today.ts'

export type ChatRecordsBlock = ChatFactsBlock | ChatLessonsBlock | ChatPaysSoonBlock | ChatLessonDatesBlock

export type LessonDatesPeriod = { from: string; to: string }

const BALANCE_ENDS_DAYS = 366

async function readBalanceEnds(
	executor: DbExecutor,
	context: CardReadContext,
	studentId: string,
	balanceMinutes: number,
	openingOn: string
): Promise<ChatBalanceEnds> {
	const zone = context.defaultTimeZone
	const today = lessonDay(context.now, zone)
	const earliest = addDays(today, -MARK_LOOKBACK_DAYS)
	const from = startOfLessonDay(openingOn > earliest ? openingOn : earliest, zone)
	const to = startOfLessonDay(addDays(today, BALANCE_ENDS_DAYS), zone)
	const window = await readWindowBlocks(executor, context, { from, to, studentIds: [studentId] })
	const lessons = window.blocks
		.filter((block) => {
			const kind = dateKind(block, context.now)
			return kind === 'ahead' || kind === 'unmarked'
		})
		.map((block) => ({ startsAt: new Date(block.startsAt), durationMinutes: block.durationMinutes, ref: block.ref }))
	const ends = balanceRunsOut(balanceMinutes, openingOn, lessons, zone)
	if (ends.kind !== 'on') return { state: ends.kind }
	const { startsAt, ref } = ends.lesson
	return { state: 'on', date: lessonDay(startsAt, zone), startsAt: startsAt.toISOString(), ref }
}

async function factsOf(
	executor: DbExecutor,
	context: CardReadContext,
	card: StudentDetail,
	paysSoonLessons: number
): Promise<ChatStudentFacts> {
	const openingOn = card.openingBalance?.on ?? null
	const balanceEnds =
		card.balanceMinutes === null || openingOn === null
			? null
			: await readBalanceEnds(executor, context, card.id, card.balanceMinutes, openingOn)
	return {
		student: {
			id: card.id,
			displayName: card.displayName,
			status: card.status,
			defaultLessonMinutes: card.defaultLessonMinutes,
		},
		balanceMinutes: card.balanceMinutes,
		...(balanceEnds === null ? {} : { balanceEnds }),
		nextLesson: card.nextLesson,
		paysSoon: paysSoonList([card], paysSoonLessons).length > 0,
		paysSoonLessons,
		asOf: context.now.toISOString(),
		defaultTimeZone: context.defaultTimeZone,
		...(card.lastPayment ? { followUp: 'since_payment' as const } : {}),
	}
}

export async function readChatFacts(
	executor: DbExecutor,
	context: CardReadContext,
	studentId: string,
	paysSoonLessons: number
): Promise<ChatStudentFacts | null> {
	const card = await getCard(executor, studentId, context)
	return card === null ? null : factsOf(executor, context, card, paysSoonLessons)
}

export async function readModelFacts(
	executor: DbExecutor,
	context: CardReadContext,
	studentId: string,
	paysSoonLessons: number
) {
	const card = await getCard(executor, studentId, context)
	if (card === null) return null
	return {
		facts: await factsOf(executor, context, card, paysSoonLessons),
		gender: card.gender,
		card: {
			rate: card.rateMinor === null ? null : minorToInput(card.rateMinor, card.currency),
			currency: card.currency,
			lesson_minutes: card.defaultLessonMinutes,
			no_show_deducts: card.noShowDeducts,
			parent: card.parent,
			level: card.level,
			goals: card.goals,
			time_zone: card.timeZone,
		},
	}
}

export function chatDayLesson(block: ScheduleBlock, zone: string): ChatDayLesson {
	return {
		key: block.key,
		studentId: block.studentId,
		studentName: block.studentName,
		startsAt: block.startsAt,
		timeZone: block.timeZone,
		durationMinutes: block.durationMinutes,
		outcome: block.outcome,
		movedTo: block.movedTo,
		ref: block.ref,
		date: lessonDay(new Date(block.startsAt), zone),
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
		lessons: read.lessons.map((block) => chatDayLesson(block, read.defaultTimeZone)),
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

function monthStart(date: string): string {
	return `${date.slice(0, 8)}01`
}

function monthEnd(date: string): string {
	return addDays(monthStart(addDays(monthStart(date), 32)), -1)
}

export function lessonDatesPeriod(
	from: string | null,
	to: string | null,
	now: Date,
	zone: string
): LessonDatesPeriod | null {
	const today = lessonDay(now, zone)
	const start = from ?? monthStart(to ?? today)
	const end = to ?? monthEnd(from ?? today)
	if (end < start || addDays(start, CHAT_LESSON_DATES_DAYS_MAX - 1) < end) return null
	return { from: start, to: end }
}

type DateKind = 'held' | 'ahead' | 'no_show' | 'unmarked'

function dateKind(block: ScheduleBlock, now: Date): DateKind | null {
	if (block.movedTo !== null) return null
	if (block.outcome === 'done') return 'held'
	if (block.outcome === 'no_show') return 'no_show'
	if (block.outcome !== 'planned') return null
	return Date.parse(block.startsAt) > now.getTime() ? 'ahead' : 'unmarked'
}

function inScope(kind: DateKind, scope: ChatLessonDateScope): boolean {
	return scope === 'all' || kind === scope
}

async function studentName(executor: DbExecutor, studentId: string): Promise<string | null> {
	const [student] = await executor
		.select({ displayName: students.displayName })
		.from(students)
		.where(eq(students.id, studentId))
	return student?.displayName ?? null
}

export async function readChatSincePayment(
	executor: DbExecutor,
	context: CardReadContext,
	studentId: string
): Promise<ChatLessonDatesBlock | null> {
	const name = await studentName(executor, studentId)
	if (name === null) return null
	const read = await readStudentLessons(executor, studentId, context, { range: 'since_payment' })
	if (read === null) return null
	const paid = read.lastPayment !== null
	const dates = new Set<string>()
	const leftOut = { noShow: 0, ahead: 0 }
	for (const lesson of paid ? read.lessons : []) {
		if (lesson.held && lesson.sinceLastPayment) dates.add(lesson.date)
		else if (lesson.outcome === 'no_show') leftOut.noShow += 1
		else if (lesson.outcome === 'planned' && Date.parse(lesson.startsAt) > context.now.getTime()) leftOut.ahead += 1
	}
	return {
		type: 'lesson_dates',
		studentId,
		studentName: name,
		from: read.from,
		to: read.to,
		scope: 'since_payment',
		defaultTimeZone: context.defaultTimeZone,
		asOf: context.now.toISOString(),
		dates: [...dates].sort(),
		leftOut,
		coverage: read.coverage === 'complete' ? 'complete' : 'partial',
		...(read.sinceLastPaymentFrom === null ? {} : { sinceFrom: read.sinceLastPaymentFrom }),
		lastPaidOn: read.lastPayment?.paidOn ?? null,
	}
}

export async function readChatLessonDates(
	executor: DbExecutor,
	context: CardReadContext,
	studentId: string,
	period: LessonDatesPeriod,
	scope: ChatLessonDateScope
): Promise<ChatLessonDatesBlock | null> {
	if (scope === 'since_payment') return readChatSincePayment(executor, context, studentId)
	const name = await studentName(executor, studentId)
	if (name === null) return null
	const zone = context.defaultTimeZone
	const from = startOfLessonDay(period.from, zone)
	const to = startOfLessonDay(addDays(period.to, 1), zone)
	const window = await readWindowBlocks(executor, context, { from, to, studentIds: [studentId] })
	const dates = new Set<string>()
	const leftOut = { noShow: 0, ahead: 0 }
	for (const block of window.blocks) {
		const kind = dateKind(block, context.now)
		if (kind === null) continue
		if (inScope(kind, scope)) dates.add(lessonDay(new Date(block.startsAt), zone))
		else if (kind === 'no_show') leftOut.noShow += 1
		else if (kind === 'ahead') leftOut.ahead += 1
	}
	const coverage: ChatLessonDatesBlock['coverage'] = window.coverage === 'complete' ? 'complete' : 'partial'
	return {
		type: 'lesson_dates',
		studentId,
		studentName: name,
		from: period.from,
		to: period.to,
		scope,
		defaultTimeZone: zone,
		asOf: context.now.toISOString(),
		dates: [...dates].filter((date) => date >= period.from && date <= period.to).sort(),
		leftOut,
		coverage,
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
	if (key.kind === 'lesson_dates') {
		if (key.scope === 'since_payment') return readChatSincePayment(executor, context, key.studentId)
		const period = lessonDatesPeriod(key.from, key.to, context.now, context.defaultTimeZone)
		return period === null ? null : readChatLessonDates(executor, context, key.studentId, period, key.scope)
	}
	if (key.day === 'payments') return readChatPaysSoon(executor, context, paysSoonLessons)
	return readChatDay(executor, context, key.day)
}
