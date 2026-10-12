import { inArray } from 'drizzle-orm'

import type { CalendarEventView } from '@dv-lab/contracts'
import { occurrenceKey, type ScheduleBlock } from '@dv-lab/core'
import { lessonSeries, lessons, type DbExecutor } from '@dv-lab/db'

import { wireBlocks } from '../schedule/schedule.ts'

async function studentsByRef(executor: DbExecutor, events: readonly CalendarEventView[]) {
	const refs = events.flatMap((event) => (event.binding.kind === 'lesson' ? [event.binding.ref] : []))
	const lessonIds = refs.flatMap((ref) => (ref.kind === 'single' ? [ref.lessonId] : []))
	const seriesIds = refs.flatMap((ref) => (ref.kind === 'series' ? [ref.seriesId] : []))
	const singles = lessonIds.length
		? await executor
				.select({ id: lessons.id, studentId: lessons.studentId })
				.from(lessons)
				.where(inArray(lessons.id, lessonIds))
		: []
	const series = seriesIds.length
		? await executor
				.select({ id: lessonSeries.id, studentId: lessonSeries.studentId })
				.from(lessonSeries)
				.where(inArray(lessonSeries.id, seriesIds))
		: []
	return new Map([...singles, ...series].map((row) => [row.id, row.studentId]))
}

function futureBlock(
	event: CalendarEventView,
	people: ReadonlyMap<string, string>,
	now: Date,
	dayEnd: Date
): ScheduleBlock | null {
	if (event.binding.kind !== 'lesson' || event.when.kind !== 'timed') return null
	const ref = event.binding.ref
	const studentId = people.get(ref.kind === 'single' ? ref.lessonId : ref.seriesId)
	const startsAt = new Date(event.when.startsAt)
	const durationMinutes = (new Date(event.when.endsAt).getTime() - startsAt.getTime()) / 60000
	if (!studentId || startsAt <= now || startsAt >= dayEnd || durationMinutes <= 0) return null
	return {
		key: occurrenceKey(ref),
		ref,
		studentId,
		startsAt,
		timeZone: event.when.timeZone,
		durationMinutes,
		status: event.status === 'cancelled' ? 'cancelled' : 'scheduled',
		movedTo: null,
		movedFrom: null,
	}
}

export async function calendarLessons(
	executor: DbExecutor,
	events: readonly CalendarEventView[],
	now: Date,
	dayEnd: Date
) {
	const people = await studentsByRef(executor, events)
	const placed = events.map((event) => futureBlock(event, people, now, dayEnd)).filter((block) => block !== null)
	const blocks = await wireBlocks(executor, placed, now)
	return blocks.map((block) => ({
		...block,
		actions: { move: false, cancel: false, restore: false, mark: false, series: false },
	}))
}
