import { z } from 'zod'

import { nextLessonRead } from './calendar.ts'
import { LESSON_MINUTES_MIN, STUDENT_STATUSES } from './students.ts'

export const chatRecordsQuery = z.strictObject({ studentId: z.uuid() })

export type ChatRecordsQuery = z.infer<typeof chatRecordsQuery>

export const chatStudentFacts = z.strictObject({
	student: z.strictObject({
		id: z.uuid(),
		displayName: z.string(),
		status: z.enum(STUDENT_STATUSES),
		defaultLessonMinutes: z.number().int().min(LESSON_MINUTES_MIN),
	}),
	balanceMinutes: z.number().int().nullable(),
	nextLesson: nextLessonRead,
	paysSoon: z.boolean(),
	paysSoonLessons: z.number().int(),
	asOf: z.string(),
	defaultTimeZone: z.string(),
})

export type ChatStudentFacts = z.infer<typeof chatStudentFacts>
