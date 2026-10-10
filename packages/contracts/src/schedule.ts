import { z } from 'zod'

import { LESSON_MINUTES_MAX, LESSON_MINUTES_MIN, isIsoDate, type StudentStatus } from './students.ts'

export const CLOCK_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export function isClockTime(value: string): boolean {
	return CLOCK_TIME_PATTERN.test(value)
}

export type ScheduleWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export const REPEATS = ['once', 'weekly'] as const

export type LessonRepeats = (typeof REPEATS)[number]

const isoDate = z.string().refine(isIsoDate)

const clockTime = z.string().regex(CLOCK_TIME_PATTERN)

const lessonMinutes = z.number().int().min(LESSON_MINUTES_MIN).max(LESSON_MINUTES_MAX)

const weekday = z.literal([1, 2, 3, 4, 5, 6, 7])

const expectedStartsAt = z.iso.datetime().optional()

export const createLessonRequest = z.object({
	studentId: z.uuid(),
	date: isoDate,
	startTime: clockTime,
	durationMinutes: lessonMinutes,
	repeats: z.enum(REPEATS),
})

export const moveLessonRequest = z.object({
	date: isoDate,
	startTime: clockTime,
	expectedStartsAt,
})

export const lessonActionRequest = z.object({
	expectedStartsAt,
})

export const moveSeriesRequest = z.object({
	from: isoDate,
	weekday,
	startTime: clockTime,
})

export const endSeriesRequest = z.object({
	lastOn: isoDate,
})

export const scheduleWeekStart = isoDate

export type ScheduleBlockStatus = 'scheduled' | 'cancelled' | 'moved'

export type ScheduleOccurrenceRef =
	{ kind: 'single'; lessonId: string } | { kind: 'series'; seriesId: string; originalOn: string }

export type ScheduleBlock = {
	key: string
	ref: ScheduleOccurrenceRef
	studentId: string
	studentName: string
	studentStatus: StudentStatus
	studentGoal: string | null
	startsAt: string
	durationMinutes: number
	status: ScheduleBlockStatus
	movedTo: string | null
	movedFrom: string | null
	changeable: boolean
}

export type ScheduleSeries = {
	id: string
	studentId: string
	weekday: ScheduleWeekday
	startTime: string
	durationMinutes: number
	startsOn: string
	endsOn: string | null
}

export type ScheduleWeekResponse = { start: string; blocks: ScheduleBlock[]; series: ScheduleSeries[] }

export type ScheduleLesson = {
	id: string
	studentId: string
	startsAt: string
	durationMinutes: number
	status: 'scheduled' | 'cancelled'
}

export type ScheduleLessonResponse = { lesson: ScheduleLesson }

export type ScheduleSeriesResponse = { series: ScheduleSeries }

export type ScheduleOccurrence = {
	seriesId: string
	originalOn: string
	status: ScheduleBlockStatus
	startsAt: string
}

export type ScheduleOccurrenceResponse = { occurrence: ScheduleOccurrence }

export type ScheduleCreateResponse = ScheduleLessonResponse | ScheduleSeriesResponse
