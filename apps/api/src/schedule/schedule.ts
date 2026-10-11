import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { z } from 'zod'

import {
	STUDENT_STATUSES,
	type ScheduleBlock as WireBlock,
	type ScheduleLesson,
	type ScheduleSeries,
	type ScheduleWeekResponse,
	type StudentStatus,
	type createLessonRequest,
	timeZoneIdentity,
} from '@dv-lab/contracts'
import {
	type BalanceCard,
	type ScheduleBlock as CoreBlock,
	type MarkKind,
	type OutcomeBlock,
	type SeriesRule,
	type SingleLesson,
	addDays,
	lessonActions,
	localTimeCandidates,
	nextSeriesDate,
	nextSeriesReference,
	scheduleToday,
	scheduleWindow,
	weekdayOf,
	withOutcomes,
	startOfZonedDay,
} from '@dv-lab/core'
import { type Database, type DbExecutor, lessonSeries, lessons, students } from '@dv-lab/db'

import { lockTeacherTimeContext, type TeacherTimeContext } from '../settings/settings.ts'
import {
	lessonColumns,
	loadMarks,
	loadScheduleRows,
	seriesColumns,
	seriesReferenceExceptions,
	toBalanceCard,
	toSeriesRule,
	toSingleLesson,
	toWireActions,
	toWireMark,
	toWireOutcome,
} from './rows.ts'

type CreateLessonInput = z.output<typeof createLessonRequest>

type CreateLessonResult =
	| { kind: 'invalid' }
	| { kind: 'nonexistent_local_time' }
	| { kind: 'default_time_zone_changed' }
	| { kind: 'lesson'; lesson: ScheduleLesson }
	| { kind: 'series'; series: ScheduleSeries; existing: boolean }

type BlockStudent = {
	name: string
	status: StudentStatus
	goal: string | null
	card: BalanceCard
	lessonMinutes: number
}

function toStudentStatus(value: string): StudentStatus {
	const known = STUDENT_STATUSES.find((status) => status === value)
	if (!known) throw new Error('unexpected student status')
	return known
}

export function toWireSeries(rule: SeriesRule, reference: ReturnType<typeof nextSeriesReference>): ScheduleSeries {
	return {
		id: rule.id,
		studentId: rule.studentId,
		weekday: rule.weekday,
		startTime: rule.startTime,
		timeZone: rule.timeZone,
		durationMinutes: rule.durationMinutes,
		startsOn: rule.startsOn,
		endsOn: rule.endsOn,
		referenceOccurrence:
			reference === null
				? null
				: {
						originalOn: reference.originalOn,
						actualStartsAt: reference.actualStartsAt.toISOString(),
						ruleStartsAt: reference.ruleStartsAt?.toISOString() ?? null,
					},
	}
}

export function toWireLesson(lesson: SingleLesson): ScheduleLesson {
	return {
		id: lesson.id,
		studentId: lesson.studentId,
		startsAt: lesson.startsAt.toISOString(),
		timeZone: lesson.timeZone,
		durationMinutes: lesson.durationMinutes,
		status: lesson.status,
	}
}

function toWireBlock(
	block: OutcomeBlock,
	people: Map<string, BlockStudent>,
	marks: ReadonlyMap<string, MarkKind>,
	now: Date
): WireBlock {
	const student = people.get(block.studentId)
	if (!student) throw new Error('schedule block student is missing')
	return {
		key: block.key,
		ref: block.ref,
		studentId: block.studentId,
		studentName: student.name,
		studentStatus: student.status,
		studentGoal: student.goal,
		startsAt: block.startsAt.toISOString(),
		timeZone: block.timeZone,
		durationMinutes: block.durationMinutes,
		movedTo: block.movedTo === null ? null : block.movedTo.toISOString(),
		movedFrom: block.movedFrom === null ? null : block.movedFrom.toISOString(),
		outcome: toWireOutcome(block.outcome),
		actions: toWireActions(lessonActions(block.outcome, block.startsAt, now)),
		ledger: {
			openingOn: student.card.openingOn,
			noShowDeducts: student.card.noShowDeducts,
			lessonMinutes: student.lessonMinutes,
		},
		mark: toWireMark(marks.get(block.key) ?? null),
	}
}

async function blockStudents(executor: DbExecutor, blocks: readonly CoreBlock[]): Promise<Map<string, BlockStudent>> {
	const ids = [...new Set(blocks.map((block) => block.studentId))]
	if (ids.length === 0) return new Map()
	const rows = await executor
		.select({
			id: students.id,
			name: students.displayName,
			status: students.status,
			goal: students.goals,
			openingBalanceMinutes: students.openingBalanceMinutes,
			openingBalanceOn: students.openingBalanceOn,
			noShowDeducts: students.noShowDeducts,
			lessonMinutes: students.defaultLessonMinutes,
		})
		.from(students)
		.where(inArray(students.id, ids))
	return new Map(
		rows.map((row) => [
			row.id,
			{
				name: row.name,
				status: toStudentStatus(row.status),
				goal: row.goal,
				card: toBalanceCard(row),
				lessonMinutes: row.lessonMinutes,
			},
		])
	)
}

export async function readWindow(
	executor: DbExecutor,
	from: Date,
	to: Date,
	context: TeacherTimeContext
): Promise<Omit<ScheduleWeekResponse, 'start'>> {
	const rows = await loadScheduleRows(executor, { from, to })
	const placed = scheduleWindow({ ...rows, from, to })
	const blocks = await wireBlocks(executor, placed, context.now)
	const shown = new Set(blocks.flatMap((block) => (block.ref.kind === 'series' ? [block.ref.seriesId] : [])))
	const references = await seriesReferenceExceptions(executor, [...shown])
	return {
		defaultTimeZone: context.defaultTimeZone,
		asOf: context.now.toISOString(),
		blocks,
		series: rows.series
			.filter((rule) => shown.has(rule.id))
			.map((rule) => toWireSeries(rule, nextSeriesReference({ rule, exceptions: references, now: context.now }))),
	}
}

export async function wireBlocks(executor: DbExecutor, placed: readonly CoreBlock[], now: Date): Promise<WireBlock[]> {
	const marks = await loadMarks(
		executor,
		placed.map((block) => block.ref)
	)
	const blocks = withOutcomes(placed, marks)
	const people = await blockStudents(executor, blocks)
	return blocks.map((block) => toWireBlock(block, people, marks, now))
}

export async function readWeek(
	executor: DbExecutor,
	monday: string,
	context: TeacherTimeContext
): Promise<ScheduleWeekResponse> {
	const from = startOfZonedDay(monday, context.defaultTimeZone)
	const to = startOfZonedDay(addDays(monday, 7), context.defaultTimeZone)
	return { start: monday, ...(await readWindow(executor, from, to, context)) }
}

export function createLesson(
	db: Database,
	accountId: string,
	input: CreateLessonInput,
	now = new Date()
): Promise<CreateLessonResult> {
	return db.transaction(async (tx): Promise<CreateLessonResult> => {
		const locked = await lockTeacherTimeContext(tx, accountId, input.expectedDefaultTimeZone, now)
		if (!locked.ok) return { kind: locked.error }
		const { defaultTimeZone } = locked.context
		const target = localTimeCandidates(input.date, input.startTime, defaultTimeZone)[0]
		if (target === undefined) return { kind: 'nonexistent_local_time' }
		const [card] = await tx
			.select({ status: students.status })
			.from(students)
			.where(eq(students.id, input.studentId))
			.for('update')
		if (!card || card.status !== 'active') return { kind: 'invalid' }
		if (input.repeats === 'once') {
			const [row] = await tx
				.insert(lessons)
				.values({
					studentId: input.studentId,
					startsAt: target,
					timeZone: defaultTimeZone,
					durationMinutes: input.durationMinutes,
					status: 'scheduled',
				})
				.returning(lessonColumns)
			if (!row) throw new Error('lesson insert returned no row')
			return { kind: 'lesson', lesson: toWireLesson(toSingleLesson(row)) }
		}
		if (input.date < scheduleToday(now, defaultTimeZone)) return { kind: 'invalid' }
		const weekday = weekdayOf(input.date)
		const startsOn = nextSeriesDate(
			{ weekday, startTime: input.startTime, timeZone: defaultTimeZone, startsOn: input.date, endsOn: null },
			now
		)
		if (startsOn === null) return { kind: 'invalid' }
		const matches = await tx
			.select(seriesColumns)
			.from(lessonSeries)
			.where(
				and(
					eq(lessonSeries.studentId, input.studentId),
					eq(lessonSeries.weekday, weekday),
					eq(lessonSeries.startTime, input.startTime),
					eq(lessonSeries.durationMinutes, input.durationMinutes),
					eq(lessonSeries.startsOn, startsOn),
					isNull(lessonSeries.endsOn)
				)
			)
		const existing = matches.find((row) => timeZoneIdentity(row.timeZone) === timeZoneIdentity(defaultTimeZone))
		if (existing) {
			const rule = toSeriesRule(existing)
			const exceptions = await seriesReferenceExceptions(tx, [rule.id])
			return {
				kind: 'series',
				series: toWireSeries(rule, nextSeriesReference({ rule, exceptions, now })),
				existing: true,
			}
		}
		const [row] = await tx
			.insert(lessonSeries)
			.values({
				studentId: input.studentId,
				weekday,
				startTime: input.startTime,
				timeZone: defaultTimeZone,
				durationMinutes: input.durationMinutes,
				startsOn,
				endsOn: null,
			})
			.returning(seriesColumns)
		if (!row) throw new Error('lesson series insert returned no row')
		const rule = toSeriesRule(row)
		return {
			kind: 'series',
			series: toWireSeries(rule, nextSeriesReference({ rule, exceptions: [], now })),
			existing: false,
		}
	})
}
