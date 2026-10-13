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

export const CHAT_TITLE_MAX = 160

export const chatConversationTitle = z
	.string()
	.trim()
	.refine((value) => {
		const length = Array.from(value).length
		return length >= 1 && length <= CHAT_TITLE_MAX && !value.includes('\u0000')
	})

export const chatConversation = z.strictObject({
	id: z.uuid(),
	title: z.string(),
	revision: z.number().int().min(1),
	createdAt: z.string(),
	updatedAt: z.string(),
})

export type ChatConversation = z.infer<typeof chatConversation>

export const chatConversationResponse = z.strictObject({ conversation: chatConversation })

export type ChatConversationResponse = z.infer<typeof chatConversationResponse>

export const chatConversationsResponse = z.strictObject({ conversations: z.array(chatConversation) })

export type ChatConversationsResponse = z.infer<typeof chatConversationsResponse>

export const renameConversationRequest = z.strictObject({
	title: chatConversationTitle,
	expectedRevision: z.number().int().min(1),
})

export type RenameConversationRequest = z.infer<typeof renameConversationRequest>

export const deleteConversationRequest = z.strictObject({ expectedRevision: z.number().int().min(1) })

export type DeleteConversationRequest = z.infer<typeof deleteConversationRequest>
