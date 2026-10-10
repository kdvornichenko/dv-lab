import { z } from 'zod'

export const PAYS_SOON_LESSONS_MIN = 0
export const PAYS_SOON_LESSONS_MAX = 20

export const updateSettingsRequest = z.object({
	paysSoonLessons: z.number().int().min(PAYS_SOON_LESSONS_MIN).max(PAYS_SOON_LESSONS_MAX),
})

export type TeacherSettings = { paysSoonLessons: number }

export type SettingsResponse = { settings: TeacherSettings }
