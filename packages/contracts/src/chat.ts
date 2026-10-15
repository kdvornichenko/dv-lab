import { z } from 'zod'

import {
	calendarDate,
	calendarInstant,
	calendarOccurrenceRef,
	calendarReadStatus,
	calendarTimeZone,
	nextLessonRead,
} from './calendar.ts'
import { CHAT_MODEL_ID_MAX_LENGTH, chatEffort } from './chat-settings.ts'
import { CLOCK_TIME_PATTERN, MARK_KINDS } from './schedule.ts'
import {
	AMOUNT_MINOR_MAX,
	CURRENCIES,
	GENDERS,
	LESSONS_HUNDREDTHS_MAX,
	LESSON_MINUTES_MIN,
	SECTION_KINDS,
	STUDENT_LESSONS_DAYS_MAX,
	STUDENT_STATUSES,
} from './students.ts'

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
	followUp: z.literal('since_payment').optional(),
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
	model: z.string(),
	effort: chatEffort.nullable(),
	override: z.boolean(),
	createdAt: z.string(),
	updatedAt: z.string(),
})

export type ChatConversation = z.infer<typeof chatConversation>

export const chatConversationResponse = z.strictObject({ conversation: chatConversation })

export type ChatConversationResponse = z.infer<typeof chatConversationResponse>

export const CHAT_PREVIEW_MAX = 120

export const chatConversationListItem = chatConversation.extend({
	preview: z.string().nullable(),
	waiting: z.boolean(),
})

export type ChatConversationListItem = z.infer<typeof chatConversationListItem>

export const chatConversationsResponse = z.strictObject({ conversations: z.array(chatConversationListItem) })

export type ChatConversationsResponse = z.infer<typeof chatConversationsResponse>

export const renameConversationRequest = z.strictObject({
	title: chatConversationTitle,
	expectedRevision: z.number().int().min(1),
})

export type RenameConversationRequest = z.infer<typeof renameConversationRequest>

export const conversationModelRequest = z.strictObject({
	model: z.string().max(CHAT_MODEL_ID_MAX_LENGTH).nullable(),
	effort: chatEffort.nullable(),
	expectedRevision: z.number().int().min(1),
})

export type ConversationModelRequest = z.infer<typeof conversationModelRequest>

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
	'model_refused',
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
	studentId: z.uuid().optional(),
	studentName: z.string(),
	lessonRef: calendarOccurrenceRef.optional(),
	lessonDate: calendarDate.optional(),
	entryId: z.uuid().optional(),
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
	kind: z.enum([...CHAT_LOCAL_ACTION_KINDS, 'calendar']).optional(),
	lessonStartsAt: calendarInstant.optional(),
	timeZone: calendarTimeZone.optional(),
})

export const CHAT_CALENDAR_OPERATIONS = ['move', 'cancel', 'restore', 'move_series', 'end_series'] as const

export const CHAT_CALENDAR_STATES = [
	'proposed',
	'submitting',
	'pending',
	'unknown',
	'applied',
	'failed',
	'stale',
	'declined',
] as const

export const CHAT_CALENDAR_ISSUES = [
	'command_pending',
	'connection_required',
	'precondition_failed',
	'outside_sync_window',
	'lesson_done',
	'provider_unavailable',
	'external_change',
] as const

export const chatCalendarIssue = z.enum(CHAT_CALENDAR_ISSUES)

const lessonLength = z.number().int().min(LESSON_MINUTES_MIN)

export const chatCalendarProposalBlock = z.strictObject({
	type: z.literal('calendar_proposal'),
	actionId: z.uuid(),
	operation: z.enum(CHAT_CALENDAR_OPERATIONS),
	studentId: z.uuid().optional(),
	studentName: z.string(),
	timeZone: calendarTimeZone,
	lesson: z.strictObject({
		key: z.string().min(1),
		ref: calendarOccurrenceRef.optional(),
		date: calendarDate.optional(),
		startsAt: calendarInstant,
		durationMinutes: lessonLength,
	}),
	target: z.discriminatedUnion('kind', [
		z.strictObject({
			kind: z.literal('lesson'),
			startsAt: calendarInstant,
			durationMinutes: lessonLength,
			date: calendarDate.optional(),
		}),
		z.strictObject({ kind: z.literal('cancelled'), date: calendarDate.optional() }),
		z.strictObject({
			kind: z.literal('series'),
			startsAt: calendarInstant,
			durationMinutes: lessonLength,
			from: calendarDate,
			area: z.enum(['following', 'all']),
		}),
		z.strictObject({ kind: z.literal('series_end'), from: calendarDate, lastOn: calendarDate }),
	]),
	clearsNoShow: z.boolean(),
	state: z.enum(CHAT_CALENDAR_STATES),
	accepted: z.boolean().optional(),
	issue: chatCalendarIssue.optional(),
	undo: z.enum(CHAT_UNDO_STATES).nullable(),
	undoIssue: chatCalendarIssue.optional(),
})

export const CHAT_CHANGE_OPERATIONS = [
	'record_payment',
	'create_card',
	'set_rate',
	'archive_card',
	'delete_payment',
	'remove_note',
	'remove_comment',
	'bulk_move',
	'set_details',
] as const

export const CHAT_CHANGE_STATES = [
	'proposed',
	'applying',
	'pending',
	'applied',
	'partial',
	'declined',
	'stale',
	'failed',
] as const

export const CHAT_CHANGE_ISSUES = [
	'student_changed',
	'time_zone_changed',
	'not_found',
	'payment_changed',
	'entry_changed',
	'calendar_changed',
	'connection_required',
	'command_pending',
	'outside_sync_window',
	'provider_unavailable',
] as const

export const CHAT_BULK_TARGET_STATES = ['planned', 'pending', 'applied', 'failed', 'not_started'] as const

export const chatChangeIssue = z.enum(CHAT_CHANGE_ISSUES)

export const chatRecordPaymentChange = z.strictObject({
	operation: z.literal('record_payment'),
	studentId: z.uuid(),
	studentName: z.string(),
	amountMinor: z.number().int().min(1).max(AMOUNT_MINOR_MAX),
	currency: z.enum(CURRENCIES),
	paidOn: calendarDate,
	lessonsHundredths: z.number().int().min(0).max(LESSONS_HUNDREDTHS_MAX).nullable(),
	creditedMinutes: z.number().int().min(0),
	lessonMinutes: lessonLength,
	note: z.string().nullable(),
	balanceMinutes: z.number().int().nullable(),
	balanceAfterMinutes: z.number().int().nullable(),
	timeZone: calendarTimeZone,
})

const chatCardRate = z
	.strictObject({
		rateMinor: z.number().int().min(1).max(AMOUNT_MINOR_MAX).nullable(),
		currency: z.enum(CURRENCIES).nullable(),
	})
	.refine((value) => (value.rateMinor === null) === (value.currency === null))

export const chatCreateCardChange = z.strictObject({
	operation: z.literal('create_card'),
	displayName: z.string(),
	rateMinor: z.number().int().min(1).max(AMOUNT_MINOR_MAX).nullable(),
	currency: z.enum(CURRENCIES).nullable(),
	lessonMinutes: lessonLength,
	noShowDeducts: z.literal(true),
	timeZone: z.null(),
	gender: z.enum(GENDERS).nullable(),
	duplicateName: z.boolean(),
})

export const chatSetRateChange = z.strictObject({
	operation: z.literal('set_rate'),
	studentId: z.uuid(),
	studentName: z.string(),
	before: chatCardRate,
	after: chatCardRate,
})

const CHAT_DETAIL_FIELDS = [
	'rate',
	'lessonMinutes',
	'noShowDeducts',
	'gender',
	'parent',
	'level',
	'goals',
	'timeZone',
] as const

const detailText = z.string().min(1).nullable()

const chatDetailChange = z.discriminatedUnion('field', [
	z.strictObject({ field: z.literal('rate'), before: chatCardRate, after: chatCardRate }),
	z.strictObject({ field: z.literal('lessonMinutes'), before: lessonLength, after: lessonLength }),
	z.strictObject({ field: z.literal('noShowDeducts'), before: z.boolean(), after: z.boolean() }),
	z.strictObject({
		field: z.literal('gender'),
		before: z.enum(GENDERS).nullable(),
		after: z.enum(GENDERS).nullable(),
	}),
	z.strictObject({ field: z.literal('parent'), before: detailText, after: detailText }),
	z.strictObject({ field: z.literal('level'), before: detailText, after: detailText }),
	z.strictObject({ field: z.literal('goals'), before: detailText, after: detailText }),
	z.strictObject({
		field: z.literal('timeZone'),
		before: z.string().min(1).nullable(),
		after: calendarTimeZone.nullable(),
	}),
])

export const chatSetDetailsChange = z.strictObject({
	operation: z.literal('set_details'),
	studentId: z.uuid(),
	studentName: z.string(),
	fields: z.array(chatDetailChange).min(1).max(CHAT_DETAIL_FIELDS.length),
})

export const chatArchiveCardChange = z.strictObject({
	operation: z.literal('archive_card'),
	studentId: z.uuid(),
	studentName: z.string(),
	requestedDeletion: z.boolean(),
	accountActive: z.boolean(),
})

export const chatDeletePaymentChange = z.strictObject({
	operation: z.literal('delete_payment'),
	studentId: z.uuid(),
	studentName: z.string(),
	paymentId: z.uuid(),
	paidOn: calendarDate,
	amountMinor: z.number().int(),
	currency: z.enum(CURRENCIES).nullable(),
	lessonsHundredths: z.number().int().min(0).nullable(),
	creditedMinutes: z.number().int().min(0),
	lessonMinutes: lessonLength.optional(),
	note: z.string().nullable(),
	balanceMinutes: z.number().int().nullable(),
	balanceAfterMinutes: z.number().int().nullable(),
})

export const CHAT_REMOVED_BODY_MAX = 300

export const chatRemoveNoteChange = z.strictObject({
	operation: z.literal('remove_note'),
	studentId: z.uuid(),
	studentName: z.string(),
	noteId: z.uuid(),
	sectionKind: z.enum(SECTION_KINDS),
	body: z.string(),
	createdAt: calendarInstant,
})

export const chatRemoveCommentChange = z.strictObject({
	operation: z.literal('remove_comment'),
	studentId: z.uuid(),
	studentName: z.string(),
	commentId: z.uuid(),
	lessonRef: calendarOccurrenceRef,
	lessonDate: calendarDate.nullable(),
	body: z.string(),
	createdAt: calendarInstant,
})

const weekdayNumber = z.number().int().min(1).max(7)

export const chatBulkMoveTarget = z.strictObject({
	seriesId: z.uuid(),
	seriesTimeZone: calendarTimeZone,
	from: calendarDate,
	wasStartsAt: calendarInstant,
	nowStartsAt: calendarInstant,
	durationMinutes: lessonLength,
	state: z.enum(CHAT_BULK_TARGET_STATES),
})

export const chatBulkMoveChange = z.strictObject({
	operation: z.literal('bulk_move'),
	studentId: z.uuid(),
	studentName: z.string(),
	inputTimeZone: calendarTimeZone,
	zoneNamed: z.boolean(),
	accountTimeZone: calendarTimeZone,
	fromWeekday: weekdayNumber,
	fromTime: clockTime,
	toWeekday: weekdayNumber,
	toTime: clockTime,
	targets: z.array(chatBulkMoveTarget).min(1),
	singlesLeft: z.number().int().min(0),
})

export const chatChange = z.discriminatedUnion('operation', [
	chatRecordPaymentChange,
	chatCreateCardChange,
	chatSetRateChange,
	chatArchiveCardChange,
	chatDeletePaymentChange,
	chatRemoveNoteChange,
	chatRemoveCommentChange,
	chatBulkMoveChange,
	chatSetDetailsChange,
])

export const chatChangeReceipt = z.strictObject({ studentId: z.uuid(), paymentId: z.uuid().optional() })

export const chatChangeProposalBlock = z.strictObject({
	type: z.literal('change_proposal'),
	actionId: z.uuid(),
	state: z.enum(CHAT_CHANGE_STATES),
	issue: chatChangeIssue.optional(),
	change: chatChange,
	receipt: chatChangeReceipt.nullable(),
})

const CHAT_NOTE_CHANGES = [
	'updated',
	'created',
	'deleted',
	'words_added',
	'words_removed',
	'already',
	'update_block',
	'delete_block',
] as const

export const CHAT_NOTE_ISSUES = ['block_changed', 'not_found', 'name_taken', 'words_changed'] as const

export const CHAT_NOTE_CHANGED_LINES_MAX = 6

export const CHAT_NOTE_WORDS_MAX = 20

const chatNoteLine = z.strictObject({ kind: z.enum(['same', 'added', 'removed']), text: z.string() })

const chatNoteWord = z.strictObject({
	termId: z.uuid(),
	term: z.string().min(1),
	state: z.enum(['added', 'restored', 'already', 'removed']),
})

export const chatNoteChangeBlock = z.strictObject({
	type: z.literal('note_change'),
	actionId: z.uuid(),
	mode: z.enum(['receipt', 'proposal']),
	studentId: z.uuid(),
	studentName: z.string(),
	target: z.discriminatedUnion('kind', [
		z.strictObject({
			kind: z.literal('block'),
			blockId: z.uuid(),
			blockKey: z.string().min(1),
			blockName: z.string(),
		}),
		z.strictObject({ kind: z.literal('vocabulary') }),
	]),
	change: z.enum(CHAT_NOTE_CHANGES),
	hunks: z.array(z.strictObject({ lines: z.array(chatNoteLine).min(1) })),
	more: z.number().int().min(0),
	words: z.array(chatNoteWord),
	state: z.enum(CHAT_CHANGE_STATES).nullable(),
	undo: z.enum(['available', 'undone', 'unavailable']).nullable(),
	issue: z.enum(CHAT_NOTE_ISSUES).optional(),
})

export const chatWithheldBlock = z.strictObject({ type: z.literal('withheld') })

export const chatStoppedBlock = z.strictObject({ type: z.literal('stopped') })

export const chatInterruptedBlock = z.strictObject({ type: z.literal('interrupted') })

export const CHAT_DAYS = ['today', 'tomorrow'] as const

export const chatDay = z.enum(CHAT_DAYS)

export type ChatDay = z.infer<typeof chatDay>

export const CHAT_LESSON_DATE_SCOPES = ['held', 'ahead', 'no_show', 'all', 'since_payment'] as const

export const chatLessonDateScope = z.enum(CHAT_LESSON_DATE_SCOPES)

export type ChatLessonDateScope = z.infer<typeof chatLessonDateScope>

export const CHAT_LESSON_DATES_DAYS_MAX = STUDENT_LESSONS_DAYS_MAX

export const CHAT_FOLLOW_UP_TEXT = 'Count lessons since the last payment'

export const chatRecordsKey = z.discriminatedUnion('kind', [
	z.strictObject({ kind: z.literal('student'), studentId: z.uuid() }),
	z.strictObject({ kind: z.literal('day'), day: z.enum([...CHAT_DAYS, 'payments']) }),
	z.strictObject({
		kind: z.literal('lesson_dates'),
		studentId: z.uuid(),
		from: calendarDate,
		to: calendarDate,
		scope: chatLessonDateScope,
	}),
])

export type ChatRecordsKey = z.infer<typeof chatRecordsKey>

export const chatFactsBlock = z.strictObject({ type: z.literal('facts'), facts: chatStudentFacts })

export const chatDayLesson = z.strictObject({
	key: z.string().min(1),
	studentId: z.uuid(),
	studentName: z.string(),
	startsAt: calendarInstant,
	timeZone: calendarTimeZone,
	durationMinutes: z.number().int().min(LESSON_MINUTES_MIN),
	outcome: lessonOutcome,
	movedTo: calendarInstant.nullable(),
	ref: calendarOccurrenceRef.optional(),
	date: calendarDate.optional(),
})

export const chatLessonsBlock = z.strictObject({
	type: z.literal('lessons'),
	day: chatDay.nullable(),
	date: calendarDate,
	defaultTimeZone: calendarTimeZone,
	asOf: z.string(),
	calendarRead: calendarReadStatus.nullable(),
	lessons: z.array(chatDayLesson),
})

export const chatDueStudent = z.strictObject({
	id: z.uuid(),
	displayName: z.string(),
	balanceMinutes: z.number().int().nullable(),
	defaultLessonMinutes: z.number().int().min(LESSON_MINUTES_MIN),
})

export const chatPaysSoonBlock = z.strictObject({
	type: z.literal('pays_soon'),
	students: z.array(chatDueStudent),
	paysSoonLessons: z.number().int(),
	asOf: z.string(),
})

export const CHAT_EXCERPT_SOURCES = ['section', 'note', 'comment'] as const

export const chatExcerptBlock = z.strictObject({
	type: z.literal('excerpt'),
	source: z.enum(CHAT_EXCERPT_SOURCES),
	id: z.string().min(1),
	studentId: z.uuid(),
	sectionKind: z.enum(SECTION_KINDS).optional(),
	blockId: z.uuid().optional(),
	body: z.string(),
	createdAt: calendarInstant,
	timeZone: calendarTimeZone,
	entry: z.uuid().optional(),
	section: z.strictObject({ key: z.enum(SECTION_KINDS), tab: z.enum(['overview', 'notes']) }).optional(),
	lesson: z.strictObject({ ref: calendarOccurrenceRef, date: calendarDate }).optional(),
})

export const chatLessonDatesBlock = z.strictObject({
	type: z.literal('lesson_dates'),
	studentId: z.uuid(),
	studentName: z.string(),
	from: calendarDate,
	to: calendarDate,
	scope: chatLessonDateScope,
	defaultTimeZone: calendarTimeZone,
	asOf: z.string(),
	dates: z.array(calendarDate),
	leftOut: z.strictObject({ noShow: z.number().int().min(0), ahead: z.number().int().min(0) }),
	coverage: z.enum(['complete', 'partial']),
	sinceFrom: calendarDate.optional(),
	lastPaidOn: calendarDate.nullable().optional(),
})

export const CHAT_SUGGESTIONS_MAX = 4

export const CHAT_SUGGESTION_MAX_LENGTH = 200

export const chatSuggestionsBlock = z.strictObject({
	type: z.literal('suggestions'),
	lines: z.array(z.string().min(1).max(CHAT_SUGGESTION_MAX_LENGTH)).min(1).max(CHAT_SUGGESTIONS_MAX),
})

export const chatReadFailedBlock = z.strictObject({ type: z.literal('read_failed'), key: chatRecordsKey })

export const CHAT_ACTION_LINK_KINDS = [
	'payments',
	'notes',
	'overview',
	'vocabulary',
	'schedule_day',
	'settings',
] as const

export const CHAT_ACTION_LINK_STUDENT_KINDS = ['payments', 'notes', 'overview', 'vocabulary'] as const

export const CHAT_ACTION_LINK_DIALOGS = ['payment', 'details'] as const

export const CHAT_SETTINGS_TABS = ['general', 'calendar', 'assistant'] as const

export const chatActionLinkBlock = z.strictObject({
	type: z.literal('action_link'),
	kind: z.enum(CHAT_ACTION_LINK_KINDS),
	studentId: z.uuid().nullable(),
	studentName: z.string().nullable(),
	date: calendarDate.nullable(),
	tab: z.enum(CHAT_SETTINGS_TABS).nullable(),
	dialog: z.enum(CHAT_ACTION_LINK_DIALOGS).nullable(),
})

export const CHAT_ESSAY_TASKS = ['task1', 'task2'] as const

export const chatEssayBlock = z.strictObject({
	type: z.literal('essay'),
	task: z.enum(CHAT_ESSAY_TASKS).nullable(),
})

export const chatBlock = z.discriminatedUnion('type', [
	chatActionResultBlock,
	chatClarifyBlock,
	chatRefusedBlock,
	chatCalendarProposalBlock,
	chatChangeProposalBlock,
	chatNoteChangeBlock,
	chatWithheldBlock,
	chatStoppedBlock,
	chatInterruptedBlock,
	chatFactsBlock,
	chatLessonsBlock,
	chatPaysSoonBlock,
	chatExcerptBlock,
	chatSuggestionsBlock,
	chatReadFailedBlock,
	chatLessonDatesBlock,
	chatActionLinkBlock,
	chatEssayBlock,
])

export const chatRecordsRefreshRequest = z.strictObject({ key: chatRecordsKey })

export type ChatRecordsRefreshRequest = z.infer<typeof chatRecordsRefreshRequest>

export const chatRecordsRefreshResponse = z.strictObject({
	block: z.discriminatedUnion('type', [chatFactsBlock, chatLessonsBlock, chatPaysSoonBlock, chatLessonDatesBlock]),
})

export type ChatRecordsRefreshResponse = z.infer<typeof chatRecordsRefreshResponse>

export type ChatBlock = z.infer<typeof chatBlock>
export type ChatFactsBlock = z.infer<typeof chatFactsBlock>
export type ChatLessonsBlock = z.infer<typeof chatLessonsBlock>
export type ChatPaysSoonBlock = z.infer<typeof chatPaysSoonBlock>
export type ChatExcerptBlock = z.infer<typeof chatExcerptBlock>
export type ChatSuggestionsBlock = z.infer<typeof chatSuggestionsBlock>
export type ChatReadFailedBlock = z.infer<typeof chatReadFailedBlock>
export type ChatLessonDatesBlock = z.infer<typeof chatLessonDatesBlock>
export type ChatActionLinkBlock = z.infer<typeof chatActionLinkBlock>
export type ChatEssayBlock = z.infer<typeof chatEssayBlock>
export type ChatActionLinkKind = (typeof CHAT_ACTION_LINK_KINDS)[number]
export type ChatActionLinkDialog = (typeof CHAT_ACTION_LINK_DIALOGS)[number]
export type ChatSettingsTab = (typeof CHAT_SETTINGS_TABS)[number]
export type ChatDayLesson = z.infer<typeof chatDayLesson>
export type ChatActionResultBlock = z.infer<typeof chatActionResultBlock>
export type ChatClarifyBlock = z.infer<typeof chatClarifyBlock>
export type ChatRefusedBlock = z.infer<typeof chatRefusedBlock>
export type ChatCalendarProposalBlock = z.infer<typeof chatCalendarProposalBlock>
export type ChatCalendarState = (typeof CHAT_CALENDAR_STATES)[number]
export type ChatChangeProposalBlock = z.infer<typeof chatChangeProposalBlock>
export type ChatNoteChangeBlock = z.infer<typeof chatNoteChangeBlock>
export type ChatNoteIssue = (typeof CHAT_NOTE_ISSUES)[number]
export type ChatChange = z.infer<typeof chatChange>
export type ChatChangeState = (typeof CHAT_CHANGE_STATES)[number]
export type ChatChangeIssue = z.infer<typeof chatChangeIssue>
export type ChatChangeOperation = (typeof CHAT_CHANGE_OPERATIONS)[number]
export type ChatBulkMoveChange = z.infer<typeof chatBulkMoveChange>
export type ChatDetailChange = z.infer<typeof chatDetailChange>
export type ChatCalendarIssue = z.infer<typeof chatCalendarIssue>
export type ChatUndoState = (typeof CHAT_UNDO_STATES)[number]

export const CHAT_MESSAGE_ROLES = ['teacher', 'assistant'] as const

export const CHAT_STEP_TOOLS = [
	'find_students',
	'student_facts',
	'student_notes',
	'lessons',
	'lesson_dates',
	'mark_lesson',
	'add_note',
	'note_write',
	'note_block_create',
	'note_block_delete',
	'vocabulary_add',
	'vocabulary_remove',
	'add_comment',
	'propose_lesson_change',
	'propose_payment',
	'propose_student',
	'propose_rate',
	'propose_details',
	'propose_archive',
	'student_payments',
	'propose_payment_delete',
	'propose_entry_removal',
	'propose_bulk_move',
	'essay_feedback',
	'calendar_events',
	'answer',
] as const

export const CHAT_STEP_STATES = ['running', 'done', 'failed', 'stopped'] as const

export const chatStep = z.strictObject({
	id: z.string().min(1).max(120),
	tool: z.enum(CHAT_STEP_TOOLS),
	state: z.enum(CHAT_STEP_STATES),
	studentId: z.uuid().optional(),
	studentName: z.string().min(1).max(200).optional(),
	from: calendarDate.optional(),
	to: calendarDate.optional(),
})

export type ChatStep = z.infer<typeof chatStep>
export type ChatStepTool = (typeof CHAT_STEP_TOOLS)[number]
export type ChatStepState = (typeof CHAT_STEP_STATES)[number]

export const chatMessage = z.strictObject({
	id: z.uuid(),
	role: z.enum(CHAT_MESSAGE_ROLES),
	body: z.string(),
	mentions: z.array(mentionBinding),
	blocks: z.array(chatBlock),
	steps: z.array(chatStep),
	createdAt: z.string(),
	finishedAt: z.string().nullable(),
})

export type ChatMessage = z.infer<typeof chatMessage>

export const CHAT_TURN_STATES = ['accepted', 'running', 'completed', 'stopped', 'interrupted', 'failed'] as const

export const CHAT_ACTIVE_TURN_STATES = ['accepted', 'running'] as const

export const CHAT_TURN_ISSUES = [
	'provider_unavailable',
	'credits_unavailable',
	'model_unavailable',
	'budget_reached',
	'budget_insufficient',
	'model_refused',
	'max_tokens',
	'request_limit',
] as const

export const chatTurn = z.strictObject({
	id: z.uuid(),
	state: z.enum(CHAT_TURN_STATES),
	model: z.string(),
	effort: chatEffort,
	issue: z.enum(CHAT_TURN_ISSUES).nullable(),
	assistantMessageId: z.uuid().nullable(),
})

export type ChatTurn = z.infer<typeof chatTurn>
export type ChatTurnState = (typeof CHAT_TURN_STATES)[number]
export type ChatTurnIssue = (typeof CHAT_TURN_ISSUES)[number]

export const chatTurnResponse = z.strictObject({ turn: chatTurn })

export type ChatTurnResponse = z.infer<typeof chatTurnResponse>

const streamSeq = z.number().int().min(0)

export const chatStreamEvent = z.discriminatedUnion('type', [
	z.strictObject({ type: z.literal('snapshot'), seq: streamSeq, turn: chatTurn, message: chatMessage.nullable() }),
	z.strictObject({ type: z.literal('text'), seq: streamSeq, messageId: z.uuid(), text: z.string().min(1) }),
	z.strictObject({ type: z.literal('block'), seq: streamSeq, messageId: z.uuid(), block: chatBlock }),
	z.strictObject({ type: z.literal('step'), seq: streamSeq, messageId: z.uuid(), step: chatStep }),
	z.strictObject({ type: z.literal('state'), turn: chatTurn, message: chatMessage.nullable().optional() }),
	z.strictObject({ type: z.literal('heartbeat') }),
])

export type ChatStreamEvent = z.infer<typeof chatStreamEvent>

export const chatConversationReadResponse = z.strictObject({
	conversation: chatConversation,
	messages: z.array(chatMessage),
	turn: chatTurn.nullable(),
})

export type ChatConversationReadResponse = z.infer<typeof chatConversationReadResponse>

export const sendMessageResponse = z.strictObject({
	conversation: chatConversation,
	messages: z.array(chatMessage),
	turn: chatTurn.nullable(),
})

export type SendMessageResponse = z.infer<typeof sendMessageResponse>

export const undoRequest = z.strictObject({ requestId: z.uuid() })

export type UndoRequest = z.infer<typeof undoRequest>

export const undoResponse = z.strictObject({
	block: z.discriminatedUnion('type', [chatActionResultBlock, chatCalendarProposalBlock, chatNoteChangeBlock]),
})

export type UndoResponse = z.infer<typeof undoResponse>

export const calendarActionResponse = z.strictObject({ block: chatCalendarProposalBlock })

export type CalendarActionResponse = z.infer<typeof calendarActionResponse>

export const chatActionResponse = z.strictObject({
	block: z.discriminatedUnion('type', [chatCalendarProposalBlock, chatChangeProposalBlock, chatNoteChangeBlock]),
})

export type ChatActionResponse = z.infer<typeof chatActionResponse>
