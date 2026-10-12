import { inArray } from 'drizzle-orm'

import {
	STUDENT_STATUSES,
	type ScheduleBlock as WireBlock,
	type ScheduleLesson,
	type ScheduleSeries,
	type ScheduleWeekResponse,
	type StudentStatus,
} from '@dv-lab/contracts'
import {
	type BalanceCard,
	type ScheduleBlock as CoreBlock,
	type MarkKind,
	type OutcomeBlock,
	type SeriesRule,
	type SingleLesson,
	lessonActions,
	nextSeriesReference,
	scheduleWindow,
	withOutcomes,
} from '@dv-lab/core'
import { type DbExecutor, students } from '@dv-lab/db'

import type { TeacherTimeContext } from '../settings/settings.ts'
import {
	loadMarks,
	loadScheduleRows,
	seriesReferenceExceptions,
	toBalanceCard,
	toWireActions,
	toWireMark,
	toWireOutcome,
} from './rows.ts'

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
