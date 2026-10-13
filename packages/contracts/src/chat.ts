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

export const CHAT_MESSAGE_MAX = 20000
export const CHAT_MENTIONS_MAX = 20

export const CHAT_REFUSAL_CODES = [
	...LESSON_TARGET_REFUSALS,
	'lesson_changed',
	'mention_stale',
	'model_unavailable',
	'out_of_phase',
	'budget_reached',
	'budget_insufficient',
	'credits_unavailable',
	'provider_unavailable',
] as const

export const chatRefusalCode = z.enum(CHAT_REFUSAL_CODES)

export type ChatRefusalCode = z.infer<typeof chatRefusalCode>

export const chatMessageText = z.string().refine((value) => {
	const length = Array.from(value).length
	return length >= 1 && length <= CHAT_MESSAGE_MAX && value.trim() !== '' && !value.includes('\u0000')
})

export const sendMessageRequest = z.strictObject({
	requestId: z.uuid(),
	text: chatMessageText,
	mentions: z.array(mentionBinding).max(CHAT_MENTIONS_MAX),
})

export type SendMessageRequest = z.infer<typeof sendMessageRequest>

export const chatMarkEffect = z.discriminatedUnion('kind', [
	z.strictObject({ kind: z.literal('cancelled') }),
	z.strictObject({ kind: z.literal('moved') }),
	z.strictObject({ kind: z.literal('not_started') }),
	z.strictObject({ kind: z.literal('unmarked') }),
	z.strictObject({ kind: z.literal('no_opening') }),
	z.strictObject({ kind: z.literal('before_opening'), openingOn: calendarDate }),
	z.strictObject({ kind: z.literal('no_show_off') }),
	z.strictObject({ kind: z.literal('deducts'), minutes: z.number().int().min(0) }),
])

export const CHAT_UNDO_STATES = ['available', 'pending', 'done', 'stale'] as const

export const CHAT_LOCAL_ACTION_KINDS = ['mark', 'note', 'comment'] as const

export const chatActionResultBlock = z.strictObject({
	type: z.literal('action_result'),
	actionId: z.uuid(),
	kind: z.enum(CHAT_LOCAL_ACTION_KINDS),
	mark: z.enum(['done', 'no_show']).optional(),
	before: z.enum(MARK_KINDS).optional(),
	studentName: z.string(),
	lessonStartsAt: calendarInstant.optional(),
	timeZone: calendarTimeZone.optional(),
	effect: chatMarkEffect.optional(),
	lessonMinutes: z.number().int().min(LESSON_MINUTES_MIN).optional(),
	text: z.string().optional(),
	undo: z.enum(CHAT_UNDO_STATES),
})

export const chatClarifyOption = z.strictObject({
	startsAt: calendarInstant,
	date: calendarDate,
	time: clockTime,
	timeZone: calendarTimeZone,
	reply: z.string().min(1),
})

export const chatClarifyBlock = z.strictObject({
	type: z.literal('clarify'),
	question: z.enum(['which_lesson', 'date_time']),
	studentId: z.uuid(),
	studentName: z.string(),
	options: z.array(chatClarifyOption).max(6),
})

export const chatRefusedBlock = z.strictObject({
	type: z.literal('refused'),
	code: chatRefusalCode,
	lessonStartsAt: calendarInstant.optional(),
	timeZone: calendarTimeZone.optional(),
})

export const chatBlock = z.discriminatedUnion('type', [chatActionResultBlock, chatClarifyBlock, chatRefusedBlock])

export type ChatBlock = z.infer<typeof chatBlock>
export type ChatActionResultBlock = z.infer<typeof chatActionResultBlock>
export type ChatClarifyBlock = z.infer<typeof chatClarifyBlock>
export type ChatRefusedBlock = z.infer<typeof chatRefusedBlock>
export type ChatUndoState = (typeof CHAT_UNDO_STATES)[number]

export const CHAT_MESSAGE_ROLES = ['teacher', 'assistant'] as const

export const chatMessage = z.strictObject({
	id: z.uuid(),
	role: z.enum(CHAT_MESSAGE_ROLES),
	body: z.string(),
	mentions: z.array(mentionBinding),
	blocks: z.array(chatBlock),
	createdAt: z.string(),
})

export type ChatMessage = z.infer<typeof chatMessage>

export const chatConversationReadResponse = z.strictObject({
	conversation: chatConversation,
	messages: z.array(chatMessage),
})

export type ChatConversationReadResponse = z.infer<typeof chatConversationReadResponse>

export const sendMessageResponse = z.strictObject({
	conversation: chatConversation,
	messages: z.array(chatMessage),
})

export type SendMessageResponse = z.infer<typeof sendMessageResponse>

export const undoRequest = z.strictObject({ requestId: z.uuid() })

export type UndoRequest = z.infer<typeof undoRequest>

export const undoResponse = z.strictObject({ block: chatActionResultBlock })

export type UndoResponse = z.infer<typeof undoResponse>
