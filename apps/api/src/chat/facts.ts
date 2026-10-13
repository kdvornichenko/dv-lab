import { eq } from 'drizzle-orm'

import {
	CHAT_LESSON_DATES_DAYS_MAX,
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
} from '@dv-lab/contracts'
import { addDays, lessonDay, paysSoonList, scheduleWindow, startOfLessonDay } from '@dv-lab/core'
import { type DbExecutor, students } from '@dv-lab/db'

import { readNextLessons } from '../calendar/read-model.ts'
import type { CardReadContext } from '../cards/card-facts.ts'
import { getCard, listCards } from '../cards/cards.ts'
import { filterHistoryBlocks, loadScheduleRows } from '../schedule/rows.ts'
import { wireBlocks } from '../schedule/schedule.ts'
import { readLessonDay } from '../today/today.ts'

export type ChatRecordsBlock = ChatFactsBlock | ChatLessonsBlock | ChatPaysSoonBlock | ChatLessonDatesBlock

export type LessonDatesPeriod = { from: string; to: string }

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

export async function readChatLessonDates(
	executor: DbExecutor,
	context: CardReadContext,
	studentId: string,
	period: LessonDatesPeriod,
	scope: ChatLessonDateScope
): Promise<ChatLessonDatesBlock | null> {
	const [student] = await executor
		.select({ displayName: students.displayName })
		.from(students)
		.where(eq(students.id, studentId))
	if (!student) return null
	const zone = context.defaultTimeZone
	const from = startOfLessonDay(period.from, zone)
	const to = startOfLessonDay(addDays(period.to, 1), zone)
	const rows = await loadScheduleRows(executor, { from, to, studentIds: [studentId] })
	const blocks = (await wireBlocks(executor, scheduleWindow({ ...rows, from, to }), context.now)).filter(
		(block) => block.studentId === studentId
	)
	const past = blocks.filter((block) => Date.parse(block.startsAt) <= context.now.getTime())
	const kept = new Set((await filterHistoryBlocks(executor, context.accountId, past)).map((block) => block.key))
	const dropped = past.filter((block) => !kept.has(block.key)).length
	const read = blocks.filter((block) => Date.parse(block.startsAt) > context.now.getTime() || kept.has(block.key))
	const dates = new Set<string>()
	const leftOut = { noShow: 0, ahead: 0 }
	for (const block of read) {
		const kind = dateKind(block, context.now)
		if (kind === null) continue
		if (inScope(kind, scope)) dates.add(lessonDay(new Date(block.startsAt), zone))
		else if (kind === 'no_show') leftOut.noShow += 1
		else if (kind === 'ahead') leftOut.ahead += 1
	}
	let coverage: ChatLessonDatesBlock['coverage'] = 'complete'
	if (dropped > 0) {
		const next = (await readNextLessons(executor, context, [studentId])).get(studentId)
		if (next?.status.state !== 'fresh') coverage = 'partial'
	}
	return {
		type: 'lesson_dates',
		studentId,
		studentName: student.displayName,
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
		const period = lessonDatesPeriod(key.from, key.to, context.now, context.defaultTimeZone)
		return period === null ? null : readChatLessonDates(executor, context, key.studentId, period, key.scope)
	}
	if (key.day === 'payments') return readChatPaysSoon(executor, context, paysSoonLessons)
	return readChatDay(executor, context, key.day)
}
