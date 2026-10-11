import { z } from 'zod'

import { TIME_ZONE_MAX_LENGTH, isTimeZone } from './students.ts'

export const PAYS_SOON_LESSONS_MIN = 0
export const PAYS_SOON_LESSONS_MAX = 20

const timeZone = z.string().min(1).max(TIME_ZONE_MAX_LENGTH).refine(isTimeZone)

export const updateSettingsRequest = z
	.object({
		paysSoonLessons: z.number().int().min(PAYS_SOON_LESSONS_MIN).max(PAYS_SOON_LESSONS_MAX).optional(),
		defaultTimeZone: timeZone.optional(),
		expectedDefaultTimeZone: timeZone.optional(),
	})
	.strict()
	.refine((input) => input.paysSoonLessons !== undefined || input.defaultTimeZone !== undefined)
	.refine((input) =>
		input.defaultTimeZone === undefined
			? input.expectedDefaultTimeZone === undefined
			: input.expectedDefaultTimeZone !== undefined
	)

export type UpdateSettingsRequest = z.infer<typeof updateSettingsRequest>

export type TeacherSettings = { paysSoonLessons: number; defaultTimeZone: string }

export type SettingsResponse = { settings: TeacherSettings }
