import { z } from 'zod'

import { calendarDate, calendarInstant, calendarOccurrenceRef, calendarTimeZone, nextLessonRead } from './calendar.ts'
import { CLOCK_TIME_PATTERN, MARK_KINDS } from './schedule.ts'
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

function isHighSurrogate(code: number): boolean {
	return code >= 0xd800 && code <= 0xdbff
}

function isLowSurrogate(code: number): boolean {
	return code >= 0xdc00 && code <= 0xdfff
}

export function splitsSurrogatePair(text: string, offset: number): boolean {
	return (
		offset > 0 &&
		offset < text.length &&
		isHighSurrogate(text.charCodeAt(offset - 1)) &&
		isLowSurrogate(text.charCodeAt(offset))
	)
}

export const mentionBinding = z
	.strictObject({
		studentId: z.uuid(),
		text: z.string().min(1).max(200),
		start: z.number().int().min(0),
		end: z.number().int().min(1),
	})
	.refine((value) => value.start < value.end && value.end - value.start === value.text.length)
	.refine(
		(value) => !splitsSurrogatePair(value.text, 0) && !isLowSurrogate(value.text.charCodeAt(0)),
		'binding starts inside a surrogate pair'
	)
	.refine(
		(value) => !isHighSurrogate(value.text.charCodeAt(value.text.length - 1)),
		'binding ends inside a surrogate pair'
	)

export type MentionBinding = z.infer<typeof mentionBinding>

const clockTime = z.string().regex(CLOCK_TIME_PATTERN)

export const CHAT_LESSON_INTENT_KINDS = ['done', 'no_show', 'cancel', 'move', 'comment', 'note'] as const

export const chatLessonIntent = z.strictObject({
	kind: z.enum(CHAT_LESSON_INTENT_KINDS),
	studentId: z.uuid(),
	date: calendarDate.optional(),
	time: clockTime.optional(),
	target: z
		.strictObject({
			date: calendarDate,
			time: clockTime.optional(),
			durationMinutes: z.number().int().min(LESSON_MINUTES_MIN).optional(),
			timeZone: calendarTimeZone.optional(),
		})
		.optional(),
	scope: z.enum(['one', 'series']),
	from: calendarDate.optional(),
})

export type ChatLessonIntent = z.infer<typeof chatLessonIntent>

export const LESSON_TARGET_REFUSALS = [
	'lesson_done',
	'outside_sync_window',
	'connection_required',
	'command_pending',
	'calendar_unavailable',
	'lesson_not_started',
	'series_marked',
	'not_found',
] as const

export type LessonTargetRefusal = (typeof LESSON_TARGET_REFUSALS)[number]

const lessonOutcome = z.enum(['planned', 'done', 'no_show', 'cancelled', 'moved'])

const lessonPlace = z.strictObject({
	startsAt: calendarInstant,
	endsAt: calendarInstant,
	date: calendarDate,
	time: clockTime,
	timeZone: calendarTimeZone,
	durationMinutes: z.number().int().min(LESSON_MINUTES_MIN),
})

export const lessonTargetLesson = z.strictObject({
	key: z.string().min(1),
	ref: calendarOccurrenceRef,
	studentId: z.uuid(),
	startsAt: calendarInstant,
	timeZone: calendarTimeZone,
	durationMinutes: z.number().int().min(LESSON_MINUTES_MIN),
	outcome: lessonOutcome,
	mark: z.enum(MARK_KINDS).nullable(),
	markRevision: z.number().int().min(1).nullable(),
	started: z.boolean(),
})

export const lessonTargetOption = z.strictObject({
	startsAt: calendarInstant,
	date: calendarDate,
	time: clockTime,
	timeZone: calendarTimeZone,
})

export const lessonTargetResult = z.discriminatedUnion('kind', [
	z.strictObject({
		kind: z.literal('lesson'),
		intent: z.enum(CHAT_LESSON_INTENT_KINDS),
		lesson: lessonTargetLesson,
		move: lessonPlace.nullable(),
	}),
	z.strictObject({
		kind: z.literal('series'),
		intent: z.enum(['cancel', 'move']),
		seriesId: z.uuid(),
		studentId: z.uuid(),
		area: z.enum(['all', 'following']),
		from: calendarDate,
		allFrom: calendarDate,
		lesson: lessonTargetLesson,
		move: lessonPlace.nullable(),
	}),
	z.strictObject({ kind: z.literal('student'), studentId: z.uuid() }),
	z.strictObject({
		kind: z.literal('clarify'),
		question: z.enum(['which_lesson', 'date_time']),
		options: z.array(lessonTargetOption).max(6),
	}),
	z.strictObject({ kind: z.literal('refused'), code: z.enum(LESSON_TARGET_REFUSALS) }),
])

export type LessonTargetResult = z.infer<typeof lessonTargetResult>
export type LessonTargetLesson = z.infer<typeof lessonTargetLesson>
export type LessonTargetOption = z.infer<typeof lessonTargetOption>
export type LessonPlace = z.infer<typeof lessonPlace>
