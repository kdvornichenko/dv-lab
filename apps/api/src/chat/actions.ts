import { and, eq, sql } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import { z } from 'zod'

import {
	type ChatActionResultBlock,
	type ChatBlock,
	type ChatConversation,
	type ChatLessonIntent,
	type ChatMessage,
	type ChatRefusalCode,
	type LessonTargetLesson,
	type LessonTargetResult,
	type SendMessageRequest,
	type UndoRequest,
	MARK_KINDS,
	appendLessonCommentRequest,
	appendStudentNoteRequest,
	calendarInstant,
	calendarOccurrenceRef,
} from '@dv-lab/contracts'
import { markEffect } from '@dv-lab/core'
import { type Database, type DbExecutor, chatActions, students, violatesUnique } from '@dv-lab/db'

import type { CardReadContext } from '../cards/card-facts.ts'
import { appendStudentNote, retractStudentNote } from '../cards/notes.ts'
import { appendLessonComment, retractLessonComment } from '../schedule/comments.ts'
import { writeMark } from '../schedule/marks.ts'
import { lockConversation, readConversation, touchConversation } from './conversations.ts'
import { resolveLessonTarget } from './lesson-target.ts'
import { validateMentions } from './mentions.ts'
import { blocksOf, findRequest, insertMessage, replyOf, toMessages, undoState, withUndo } from './messages.ts'
import { parseNoteCommand, parseQuickCommand } from './quick-command.ts'

export type ChatContext = CardReadContext

export type LocalRequest =
	{ kind: 'lesson'; intent: ChatLessonIntent; body?: string } | { kind: 'note'; studentId: string; body: string }

export type ActionSource = { conversationId: string; messageId: string }

export type SendOutcome =
	| { kind: 'sent'; replayed: boolean; conversation: ChatConversation; messages: ChatMessage[] }
	| { kind: 'not_found' }
	| { kind: 'conflict' }

export type UndoOutcome =
	{ kind: 'ok'; block: ChatActionResultBlock } | { kind: 'not_found' } | { kind: 'not_undoable' } | { kind: 'conflict' }

const NOTE_SECTION = 'general_info'
const REQUEST_UNIQUE = 'chat_messages_account_request_uq'
const UNDO_UNIQUE = 'chat_actions_undo_request_uq'

const markTarget = z.object({ ref: calendarOccurrenceRef, startsAt: calendarInstant })
const markBefore = z.object({ kind: z.enum(MARK_KINDS), revision: z.number().int() }).nullable()
const markAfter = z.object({ kind: z.enum(MARK_KINDS), revision: z.number().int() })
const entryAfter = z.object({ entryId: z.uuid(), revision: z.number().int() })

class Refusal extends Error {
	readonly code: ChatRefusalCode
	constructor(code: ChatRefusalCode) {
		super(code)
		this.code = code
	}
}

type Card = {
	displayName: string
	openingBalanceOn: string | null
	noShowDeducts: boolean
	defaultLessonMinutes: number
}

type ActionRecord = {
	kind: 'mark' | 'note' | 'comment'
	state: 'applied' | 'refused'
	target?: unknown
	before?: unknown
	after?: unknown
	result: unknown
}

function requestDigest(conversationId: string, input: SendMessageRequest): string {
	const mentions = [...input.mentions]
		.sort((left, right) => left.start - right.start)
		.map(({ studentId, text, start, end }) => ({ studentId, text, start, end }))
	return createHash('sha256')
		.update(JSON.stringify({ conversationId, text: input.text, mentions }))
		.digest('hex')
}

async function inSavepoint<T>(tx: DbExecutor, run: (executor: DbExecutor) => Promise<T>): Promise<T | Refusal> {
	try {
		return await tx.transaction((savepoint) => run(savepoint))
	} catch (error) {
		if (error instanceof Refusal) return error
		throw error
	}
}

async function cardOf(executor: DbExecutor, studentId: string): Promise<Card | null> {
	const [row] = await executor
		.select({
			displayName: students.displayName,
			openingBalanceOn: students.openingBalanceOn,
			noShowDeducts: students.noShowDeducts,
			defaultLessonMinutes: students.defaultLessonMinutes,
		})
		.from(students)
		.where(eq(students.id, studentId))
	return row ?? null
}

async function recordAction(
	executor: DbExecutor,
	context: ChatContext,
	source: ActionSource,
	action: ActionRecord
): Promise<string> {
	const [row] = await executor
		.insert(chatActions)
		.values({
			accountId: context.accountId,
			conversationId: source.conversationId,
			messageId: source.messageId,
			kind: action.kind,
			state: action.state,
			target: action.target ?? null,
			before: action.before ?? null,
			after: action.after ?? null,
			result: action.result,
		})
		.returning({ id: chatActions.id })
	if (!row) throw new Error('chat action insert returned no row')
	return row.id
}

async function refuse(
	executor: DbExecutor,
	context: ChatContext,
	source: ActionSource,
	kind: ActionRecord['kind'],
	code: ChatRefusalCode,
	lesson?: Pick<LessonTargetLesson, 'startsAt'>
): Promise<ChatBlock> {
	await recordAction(executor, context, source, { kind, state: 'refused', result: { kind: 'refused', code } })
	return lesson
		? { type: 'refused', code, lessonStartsAt: lesson.startsAt, timeZone: context.defaultTimeZone }
		: { type: 'refused', code }
}

function clarifyReply(intent: ChatLessonIntent, date: string, time: string): string {
	if (intent.kind === 'done') return `was at the lesson ${date} ${time}`
	if (intent.kind === 'no_show') return `didn't come ${date} ${time}`
	if (intent.kind === 'cancel') return `didn't happen ${date} ${time}`
	return `${date} ${time}`
}

async function clarify(
	executor: DbExecutor,
	context: ChatContext,
	source: ActionSource,
	kind: ActionRecord['kind'],
	intent: ChatLessonIntent,
	target: Extract<LessonTargetResult, { kind: 'clarify' }>,
	card: Card
): Promise<ChatBlock> {
	await recordAction(executor, context, source, {
		kind,
		state: 'refused',
		target: { studentId: intent.studentId },
		result: { kind: 'clarify', question: target.question },
	})
	return {
		type: 'clarify',
		question: target.question,
		studentId: intent.studentId,
		studentName: card.displayName,
		options: target.options.map((option) => ({ ...option, reply: clarifyReply(intent, option.date, option.time) })),
	}
}

function markFailure(kind: string): ChatRefusalCode {
	if (kind === 'not_found') return 'not_found'
	if (kind === 'not_started') return 'lesson_not_started'
	return 'lesson_changed'
}

async function applyMark(
	tx: DbExecutor,
	context: ChatContext,
	source: ActionSource,
	intent: ChatLessonIntent & { kind: 'done' | 'no_show' },
	lesson: LessonTargetLesson,
	card: Card
): Promise<ChatBlock> {
	const saved = await inSavepoint(tx, async (executor) => {
		const result = await writeMark(
			executor,
			context.accountId,
			lesson.ref,
			{ kind: intent.kind, expectedStartsAt: lesson.startsAt, expectedRevision: lesson.markRevision },
			context.now
		)
		if (result.kind !== 'ok') throw new Refusal(markFailure(result.kind))
		return result
	})
	if (saved instanceof Refusal) return refuse(tx, context, source, 'mark', saved.code, lesson)
	const actionId = await recordAction(tx, context, source, {
		kind: 'mark',
		state: 'applied',
		target: { ref: lesson.ref, startsAt: lesson.startsAt },
		before: saved.before,
		after: { kind: saved.mark.kind, revision: saved.mark.revision },
		result: { kind: 'applied' },
	})
	return {
		type: 'action_result',
		actionId,
		kind: 'mark',
		mark: intent.kind,
		before: saved.before?.kind ?? 'none',
		studentName: card.displayName,
		lessonStartsAt: lesson.startsAt,
		timeZone: context.defaultTimeZone,
		effect: markEffect({
			outcome: saved.mark.outcome,
			startsAt: new Date(lesson.startsAt),
			durationMinutes: lesson.durationMinutes,
			now: context.now,
			timeZone: context.defaultTimeZone,
			card: { openingOn: card.openingBalanceOn, noShowDeducts: card.noShowDeducts },
		}),
		lessonMinutes: card.defaultLessonMinutes,
		undo: 'available',
	}
}

async function applyComment(
	tx: DbExecutor,
	context: ChatContext,
	source: ActionSource,
	lesson: LessonTargetLesson,
	card: Card,
	body: string
): Promise<ChatBlock> {
	const saved = await inSavepoint(tx, async (executor) => {
		const result = await appendLessonComment(executor, context.accountId, lesson.ref, body, context.now)
		if (result.kind === 'not_found') throw new Refusal('not_found')
		if (result.kind === 'not_started') throw new Refusal('lesson_not_started')
		return result.comment
	})
	if (saved instanceof Refusal) return refuse(tx, context, source, 'comment', saved.code, lesson)
	const actionId = await recordAction(tx, context, source, {
		kind: 'comment',
		state: 'applied',
		target: { ref: lesson.ref, startsAt: lesson.startsAt },
		after: { entryId: saved.id, revision: saved.revision },
		result: { kind: 'applied' },
	})
	return {
		type: 'action_result',
		actionId,
		kind: 'comment',
		studentName: card.displayName,
		lessonStartsAt: lesson.startsAt,
		timeZone: context.defaultTimeZone,
		text: saved.body,
		undo: 'available',
	}
}

async function applyNote(
	tx: DbExecutor,
	context: ChatContext,
	source: ActionSource,
	studentId: string,
	body: string
): Promise<ChatBlock> {
	const input = appendStudentNoteRequest.parse({ sectionKind: NOTE_SECTION, body })
	const card = await cardOf(tx, studentId)
	const saved = await inSavepoint(tx, async (executor) => {
		const note = await appendStudentNote(executor, context.accountId, studentId, input)
		if (note === null) throw new Refusal('not_found')
		return note
	})
	if (saved instanceof Refusal || card === null) return refuse(tx, context, source, 'note', 'not_found')
	const actionId = await recordAction(tx, context, source, {
		kind: 'note',
		state: 'applied',
		target: { studentId },
		after: { entryId: saved.id, revision: saved.revision },
		result: { kind: 'applied' },
	})
	return {
		type: 'action_result',
		actionId,
		kind: 'note',
		studentName: card.displayName,
		text: saved.body,
		undo: 'available',
	}
}

export async function executeLocalAction(
	tx: DbExecutor,
	context: ChatContext,
	source: ActionSource,
	request: LocalRequest
): Promise<ChatBlock> {
	if (request.kind === 'note') return applyNote(tx, context, source, request.studentId, request.body)
	const { intent } = request
	if (intent.kind === 'cancel' || intent.kind === 'move' || intent.kind === 'note') {
		return { type: 'refused', code: 'out_of_phase' }
	}
	const kind = intent.kind === 'comment' ? 'comment' : 'mark'
	const body = intent.kind === 'comment' ? appendLessonCommentRequest.parse({ body: request.body }).body : null
	const card = await cardOf(tx, intent.studentId)
	if (card === null) return refuse(tx, context, source, kind, 'not_found')
	const target = await resolveLessonTarget(tx, context, intent)
	if (target.kind === 'clarify') return clarify(tx, context, source, kind, intent, target, card)
	if (target.kind === 'refused') return refuse(tx, context, source, kind, target.code)
	if (target.kind !== 'lesson') return refuse(tx, context, source, kind, 'not_found')
	if (body !== null) return applyComment(tx, context, source, target.lesson, card, body)
	if (intent.kind === 'done' || intent.kind === 'no_show') {
		return applyMark(tx, context, source, { ...intent, kind: intent.kind }, target.lesson, card)
	}
	return refuse(tx, context, source, kind, 'not_found')
}

async function respond(
	tx: DbExecutor,
	context: ChatContext,
	source: ActionSource,
	input: SendMessageRequest
): Promise<ChatBlock[]> {
	const mentions = await validateMentions(tx, context.accountId, input.text, input.mentions)
	if (mentions.kind === 'stale') return [{ type: 'refused', code: 'mention_stale' }]
	const note = parseNoteCommand(input.text, mentions.bindings)
	if (note !== null && appendStudentNoteRequest.safeParse({ sectionKind: NOTE_SECTION, body: note.body }).success) {
		return [await executeLocalAction(tx, context, source, { kind: 'note', ...note })]
	}
	const intent = parseQuickCommand(input.text, mentions.bindings, context.now, context.defaultTimeZone)
	if (intent === null) return [{ type: 'refused', code: 'model_unavailable' }]
	return [await executeLocalAction(tx, context, source, { kind: 'lesson', intent })]
}

async function replay(
	executor: DbExecutor,
	context: ChatContext,
	conversationId: string,
	input: SendMessageRequest
): Promise<SendOutcome | null> {
	const found = await findRequest(executor, context.accountId, input.requestId)
	if (found === null) return null
	if (
		found.teacher.conversationId !== conversationId ||
		found.teacher.requestDigest !== requestDigest(conversationId, input)
	) {
		return { kind: 'conflict' }
	}
	const conversation = await readConversation(executor, context.accountId, conversationId)
	if (conversation === null) return { kind: 'not_found' }
	const messages = await toMessages(executor, [found.teacher, ...found.replies])
	return { kind: 'sent', replayed: true, conversation, messages }
}

async function send(
	tx: DbExecutor,
	context: ChatContext,
	conversationId: string,
	input: SendMessageRequest
): Promise<SendOutcome> {
	if ((await lockConversation(tx, context.accountId, conversationId)) === null) return { kind: 'not_found' }
	const earlier = await replay(tx, context, conversationId, input)
	if (earlier !== null) return earlier
	const teacher = await insertMessage(tx, {
		accountId: context.accountId,
		conversationId,
		role: 'teacher',
		body: input.text,
		mentions: input.mentions,
		requestId: input.requestId,
		requestDigest: requestDigest(conversationId, input),
	})
	const blocks = await respond(tx, context, { conversationId, messageId: teacher.id }, input)
	const reply = await insertMessage(tx, {
		accountId: context.accountId,
		conversationId,
		role: 'assistant',
		body: '',
		blocks,
		replyTo: teacher.id,
	})
	const conversation = await touchConversation(tx, context.accountId, conversationId)
	return { kind: 'sent', replayed: false, conversation, messages: await toMessages(tx, [teacher, reply]) }
}

export async function sendMessage(
	db: Database,
	context: ChatContext,
	conversationId: string,
	input: SendMessageRequest
): Promise<SendOutcome> {
	try {
		return await db.transaction((tx) => send(tx, context, conversationId, input))
	} catch (error) {
		if (!violatesUnique(error, REQUEST_UNIQUE)) throw error
		const earlier = await db.transaction((tx) => replay(tx, context, conversationId, input))
		return earlier ?? { kind: 'conflict' }
	}
}

async function originalBlock(
	executor: DbExecutor,
	accountId: string,
	action: { id: string; messageId: string }
): Promise<ChatActionResultBlock | null> {
	const reply = await replyOf(executor, accountId, action.messageId)
	if (reply === null) return null
	const block = blocksOf(reply).find((item) => item.type === 'action_result' && item.actionId === action.id)
	return block?.type === 'action_result' ? block : null
}

async function inverse(
	executor: DbExecutor,
	context: ChatContext,
	action: typeof chatActions.$inferSelect
): Promise<boolean> {
	if (action.kind === 'mark') {
		const target = markTarget.parse(action.target)
		const before = markBefore.parse(action.before)
		const after = markAfter.parse(action.after)
		const result = await writeMark(
			executor,
			context.accountId,
			target.ref,
			{ kind: before?.kind ?? 'none', expectedRevision: after.revision },
			context.now
		)
		return result.kind === 'ok'
	}
	const after = entryAfter.parse(action.after)
	const result =
		action.kind === 'note'
			? await retractStudentNote(executor, context.accountId, after.entryId, after.revision)
			: await retractLessonComment(executor, context.accountId, after.entryId, after.revision)
	return result.kind === 'retracted'
}

async function undo(tx: DbExecutor, context: ChatContext, actionId: string, input: UndoRequest): Promise<UndoOutcome> {
	const [action] = await tx
		.select()
		.from(chatActions)
		.where(and(eq(chatActions.id, actionId), eq(chatActions.accountId, context.accountId)))
		.for('update')
	if (!action) return { kind: 'not_found' }
	const block = await originalBlock(tx, context.accountId, action)
	if (block === null) return { kind: 'not_undoable' }
	if (action.undoRequestId !== null) {
		return { kind: 'ok', block: { ...block, undo: undoState(action) } }
	}
	if (action.state !== 'applied' || action.kind === 'calendar') return { kind: 'not_undoable' }
	const done = await inSavepoint(tx, async (executor) => {
		if (!(await inverse(executor, context, action))) throw new Refusal('lesson_changed')
		return true
	})
	const undone = done === true
	const undoResult = { undo: undone ? 'done' : 'stale' }
	await tx
		.update(chatActions)
		.set({
			state: undone ? 'undone' : action.state,
			undoRequestId: input.requestId,
			undoResult,
			updatedAt: sql`now()`,
		})
		.where(eq(chatActions.id, action.id))
	const [shown] = withUndo(
		[block],
		new Map([[action.id, { id: action.id, state: undone ? 'undone' : action.state, undoResult }]])
	)
	return shown?.type === 'action_result' ? { kind: 'ok', block: shown } : { kind: 'not_undoable' }
}

export async function undoAction(
	db: Database,
	context: ChatContext,
	actionId: string,
	input: UndoRequest
): Promise<UndoOutcome> {
	try {
		return await db.transaction((tx) => undo(tx, context, actionId, input))
	} catch (error) {
		if (violatesUnique(error, UNDO_UNIQUE)) return { kind: 'conflict' }
		throw error
	}
}
