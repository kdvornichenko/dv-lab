import { z } from 'zod'

import { TIME_ZONE_MAX_LENGTH, isTimeZone } from './students.ts'

export const PAYS_SOON_LESSONS_MIN = 0
export const PAYS_SOON_LESSONS_MAX = 20

export const NOTIFY_LESSON_MINUTES_MIN = 5
export const NOTIFY_LESSON_MINUTES_MAX = 120

export const NOTIFY_SETTINGS_DEFAULT = {
	notifyLessonSoon: true,
	notifyLessonMinutes: 30,
	notifyPaysSoon: true,
	notifyAssistant: false,
} as const

const timeZone = z.string().min(1).max(TIME_ZONE_MAX_LENGTH).refine(isTimeZone)

export const updateSettingsRequest = z
	.object({
		paysSoonLessons: z.number().int().min(PAYS_SOON_LESSONS_MIN).max(PAYS_SOON_LESSONS_MAX).optional(),
		defaultTimeZone: timeZone.optional(),
		expectedDefaultTimeZone: timeZone.optional(),
		notifyLessonSoon: z.boolean().optional(),
		notifyLessonMinutes: z.number().int().min(NOTIFY_LESSON_MINUTES_MIN).max(NOTIFY_LESSON_MINUTES_MAX).optional(),
		notifyPaysSoon: z.boolean().optional(),
		notifyAssistant: z.boolean().optional(),
	})
	.strict()
	.refine(
		(input) =>
			input.paysSoonLessons !== undefined ||
			input.defaultTimeZone !== undefined ||
			input.notifyLessonSoon !== undefined ||
			input.notifyLessonMinutes !== undefined ||
			input.notifyPaysSoon !== undefined ||
			input.notifyAssistant !== undefined
	)
	.refine((input) =>
		input.defaultTimeZone === undefined
			? input.expectedDefaultTimeZone === undefined
			: input.expectedDefaultTimeZone !== undefined
	)

export type UpdateSettingsRequest = z.infer<typeof updateSettingsRequest>

export type TeacherSettings = {
	paysSoonLessons: number
	defaultTimeZone: string
	notifyLessonSoon: boolean
	notifyLessonMinutes: number
	notifyPaysSoon: boolean
	notifyAssistant: boolean
}

export type SettingsResponse = { settings: TeacherSettings }
