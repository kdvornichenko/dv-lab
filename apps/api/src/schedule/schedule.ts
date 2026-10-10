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
} from '@dv-lab/contracts'
import {
	type ScheduleBlock as CoreBlock,
	SCHEDULE_TIME_ZONE,
	type SeriesRule,
	type SingleLesson,
	addDays,
	canChange,
	nextSeriesDate,
	scheduleWindow,
	weekdayOf,
	zonedInstant,
	zonedParts,
} from '@dv-lab/core'
import { type Database, type DbExecutor, lessonSeries, lessons, students } from '@dv-lab/db'

import { lessonColumns, loadScheduleRows, seriesColumns, toSeriesRule, toSingleLesson } from './rows.ts'

type CreateLessonInput = z.output<typeof createLessonRequest>

type CreateLessonResult =
	| { kind: 'invalid' }
	| { kind: 'lesson'; lesson: ScheduleLesson }
	| { kind: 'series'; series: ScheduleSeries; existing: boolean }

type BlockStudent = { name: string; status: StudentStatus; goal: string | null }

function toStudentStatus(value: string): StudentStatus {
	const known = STUDENT_STATUSES.find((status) => status === value)
	if (!known) throw new Error('unexpected student status')
	return known
}

function toWireSeries(rule: SeriesRule): ScheduleSeries {
	return {
		id: rule.id,
		studentId: rule.studentId,
		weekday: rule.weekday,
		startTime: rule.startTime,
		durationMinutes: rule.durationMinutes,
		startsOn: rule.startsOn,
		endsOn: rule.endsOn,
	}
}

function toWireLesson(lesson: SingleLesson): ScheduleLesson {
	return {
		id: lesson.id,
		studentId: lesson.studentId,
		startsAt: lesson.startsAt.toISOString(),
		durationMinutes: lesson.durationMinutes,
		status: lesson.status,
	}
}

function toWireBlock(block: CoreBlock, people: Map<string, BlockStudent>, now: Date): WireBlock {
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
		durationMinutes: block.durationMinutes,
		status: block.status,
		movedTo: block.movedTo === null ? null : block.movedTo.toISOString(),
		movedFrom: block.movedFrom === null ? null : block.movedFrom.toISOString(),
		changeable: canChange(block.startsAt, now),
	}
}

async function blockStudents(executor: DbExecutor, blocks: readonly CoreBlock[]): Promise<Map<string, BlockStudent>> {
	const ids = [...new Set(blocks.map((block) => block.studentId))]
	if (ids.length === 0) return new Map()
	const rows = await executor
		.select({ id: students.id, name: students.displayName, status: students.status, goal: students.goals })
		.from(students)
		.where(inArray(students.id, ids))
	return new Map(rows.map((row) => [row.id, { name: row.name, status: toStudentStatus(row.status), goal: row.goal }]))
}

export async function readWeek(executor: DbExecutor, monday: string, now: Date): Promise<ScheduleWeekResponse> {
	const from = zonedInstant(monday, '00:00', SCHEDULE_TIME_ZONE)
	const to = zonedInstant(addDays(monday, 7), '00:00', SCHEDULE_TIME_ZONE)
	const rows = await loadScheduleRows(executor, { from, to })
	const blocks = scheduleWindow({ ...rows, from, to })
	const people = await blockStudents(executor, blocks)
	const shown = new Set(blocks.flatMap((block) => (block.ref.kind === 'series' ? [block.ref.seriesId] : [])))
	return {
		start: monday,
		blocks: blocks.map((block) => toWireBlock(block, people, now)),
		series: rows.series.filter((rule) => shown.has(rule.id)).map(toWireSeries),
	}
}

export function createLesson(db: Database, input: CreateLessonInput, now: Date): Promise<CreateLessonResult> {
	return db.transaction(async (tx): Promise<CreateLessonResult> => {
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
					startsAt: zonedInstant(input.date, input.startTime, SCHEDULE_TIME_ZONE),
					durationMinutes: input.durationMinutes,
					status: 'scheduled',
				})
				.returning(lessonColumns)
			if (!row) throw new Error('lesson insert returned no row')
			return { kind: 'lesson', lesson: toWireLesson(toSingleLesson(row)) }
		}
		if (input.date < zonedParts(now, SCHEDULE_TIME_ZONE).date) return { kind: 'invalid' }
		const weekday = weekdayOf(input.date)
		const startsOn = nextSeriesDate({ weekday, startTime: input.startTime, startsOn: input.date, endsOn: null }, now)
		if (startsOn === null) return { kind: 'invalid' }
		const [existing] = await tx
			.select(seriesColumns)
			.from(lessonSeries)
			.where(
				and(
					eq(lessonSeries.studentId, input.studentId),
					eq(lessonSeries.weekday, weekday),
					eq(lessonSeries.startTime, input.startTime),
					eq(lessonSeries.startsOn, startsOn),
					isNull(lessonSeries.endsOn)
				)
			)
			.limit(1)
		if (existing) return { kind: 'series', series: toWireSeries(toSeriesRule(existing)), existing: true }
		const [row] = await tx
			.insert(lessonSeries)
			.values({
				studentId: input.studentId,
				weekday,
				startTime: input.startTime,
				durationMinutes: input.durationMinutes,
				startsOn,
				endsOn: null,
			})
			.returning(seriesColumns)
		if (!row) throw new Error('lesson series insert returned no row')
		return { kind: 'series', series: toWireSeries(toSeriesRule(row)), existing: false }
	})
}
