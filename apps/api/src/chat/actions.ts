import { and, eq, sql } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import { z } from 'zod'

import {
	type ChatActionResultBlock,
	type ChatBlock,
	type ChatCalendarProposalBlock,
	type ChatConversation,
	type ChatEffort,
	type ChatLessonIntent,
	type ChatMessage,
	type ChatNoteChangeBlock,
	type ChatReviewResultBlock,
	type ChatNoteIssue,
	type ChatRecordsKey,
	type ChatRefusalCode,
	type ChatStep,
	type ChatTurn,
	type MentionBinding,
	type LessonTargetLesson,
	type LessonTargetResult,
	type SendMessageRequest,
	type UndoRequest,
	CHAT_FOLLOW_UP_TEXT,
	MARK_KINDS,
	appendLessonCommentRequest,
	appendStudentNoteRequest,
	calendarInstant,
	calendarOccurrenceRef,
} from '@dv-lab/contracts'
import { lessonDay, markEffect } from '@dv-lab/core'
import { type Database, type DbExecutor, chatActions, chatMessages, students, violatesUnique } from '@dv-lab/db'

import type { CalendarCommands } from '../calendar/commands.ts'
import type { CardReadContext } from '../cards/card-facts.ts'
import { retractStudentNote } from '../cards/notes.ts'
import { appendLessonComment, retractLessonComment } from '../schedule/comments.ts'
import { writeMark } from '../schedule/marks.ts'
import { readTeacherSettings } from '../settings/settings.ts'
import { type CalendarOutcome, proposeCalendarChange, undoCalendarAction } from './calendar.ts'
import { isNoteProposal, undoNoteProposal } from './change-notes.ts'
import { lockConversation, readConversation, touchConversation } from './conversations.ts'
import { readChatRecords } from './facts.ts'
import { resolveLessonTarget } from './lesson-target.ts'
import { typedMentions, validateMentions } from './mentions.ts'
import { blocksOf, findRequest, insertAction, insertMessage, replyOf, toMessages, withUndo } from './messages.ts'
import { type NoteUndo, appendNoteLine, isNoteWrite, undoNoteWrite } from './note-writes.ts'
import { parseNoteCommand, parseQuickCommand } from './quick-command.ts'
import { type NewTurn, type TurnRow, activeTurn, toTurn, turnOfMessage } from './turns.ts'

export type ChatContext = CardReadContext & { calendarEnabled?: boolean }

export type LocalRequest =
	{ kind: 'lesson'; intent: ChatLessonIntent; body?: string } | { kind: 'note'; studentId: string; body: string }

export type ActionSource = { conversationId: string; messageId: string }

export type Admission =
	{ kind: 'ready'; model: string; effort: ChatEffort } | { kind: 'refused'; code: ChatRefusalCode }

export type TurnStarter = {
	admit: (context: ChatContext, conversationId: string) => Promise<Admission>
	startTurn: (tx: DbExecutor, context: ChatContext, turn: NewTurn) => Promise<{ row: TurnRow; launch: () => void }>
}

export type SendOutcome =
	| {
			kind: 'sent'
			replayed: boolean
			conversation: ChatConversation
			messages: ChatMessage[]
			turn: ChatTurn | null
	  }
	| { kind: 'not_found' }
	| { kind: 'conflict' }
	| { kind: 'busy' }

export type UndoOutcome =
	| { kind: 'ok'; block: ChatActionResultBlock | ChatCalendarProposalBlock | UndoBlock }
	| { kind: 'not_found' }
	| { kind: 'not_undoable' }
	| { kind: 'conflict' }

const NOTE_SECTION = 'general_info'
const REQUEST_UNIQUE = 'chat_messages_account_request_uq'
const ACTIVE_TURN_UNIQUE = 'chat_turns_active_uq'
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
	kind: 'mark' | 'note' | 'comment' | 'calendar'
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

function recordAction(
	executor: DbExecutor,
	context: ChatContext,
	source: ActionSource,
	action: ActionRecord
): Promise<string> {
	return insertAction(executor, { accountId: context.accountId, ...source, ...action })
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
		? { type: 'refused', code, kind, lessonStartsAt: lesson.startsAt, timeZone: context.defaultTimeZone }
		: { type: 'refused', code, kind }
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
		studentId: lesson.studentId,
		studentName: card.displayName,
		lessonRef: lesson.ref,
		lessonDate: lessonDay(new Date(lesson.startsAt), context.defaultTimeZone),
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
		studentId: lesson.studentId,
		studentName: card.displayName,
		lessonRef: lesson.ref,
		lessonDate: lessonDay(new Date(lesson.startsAt), context.defaultTimeZone),
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
	const saved = await inSavepoint(tx, async (executor) => {
		const block = await appendNoteLine(executor, context, source, studentId, body)
		if (block === null) throw new Refusal('not_found')
		return block
	})
	return saved instanceof Refusal ? refuse(tx, context, source, 'note', 'not_found') : saved
}

export function executeIntent(
	executor: DbExecutor,
	context: ChatContext,
	source: ActionSource,
	request: LocalRequest,
	persist?: (tx: DbExecutor, block: ChatBlock) => Promise<void>
): Promise<ChatBlock> {
	return executor.transaction(async (tx) => {
		const block = await executeLocalAction(tx, context, source, request)
		if (persist) await persist(tx, block)
		return block
	})
}

export async function executeLocalAction(
	tx: DbExecutor,
	context: ChatContext,
	source: ActionSource,
	request: LocalRequest
): Promise<ChatBlock> {
	if (request.kind === 'note') return applyNote(tx, context, source, request.studentId, request.body)
	const { intent } = request
	if (intent.kind === 'note') return { type: 'refused', code: 'out_of_phase' }
	const calendar = intent.kind === 'cancel' || intent.kind === 'move'
	const kind = intent.kind === 'comment' ? 'comment' : calendar ? 'calendar' : 'mark'
	const body = intent.kind === 'comment' ? appendLessonCommentRequest.parse({ body: request.body }).body : null
	const card = await cardOf(tx, intent.studentId)
	if (card === null) return refuse(tx, context, source, kind, 'not_found')
	if (calendar && !context.calendarEnabled) return refuse(tx, context, source, kind, 'connection_required')
	const target = await resolveLessonTarget(tx, context, intent)
	if (target.kind === 'clarify') return clarify(tx, context, source, kind, intent, target, card)
	if (target.kind === 'refused') return refuse(tx, context, source, kind, target.code)
	if (calendar && (target.kind === 'lesson' || target.kind === 'series'))
		return proposeCalendarChange(tx, context, source, target, card.displayName)
	if (target.kind !== 'lesson') return refuse(tx, context, source, kind, 'not_found')
	if (body !== null) return applyComment(tx, context, source, target.lesson, card, body)
	if (intent.kind === 'done' || intent.kind === 'no_show') {
		return applyMark(tx, context, source, { ...intent, kind: intent.kind }, target.lesson, card)
	}
	return refuse(tx, context, source, kind, 'not_found')
}

function quickRequest(context: ChatContext, text: string, bindings: readonly MentionBinding[]): LocalRequest | null {
	const note = parseNoteCommand(text, bindings)
	if (note !== null && appendStudentNoteRequest.safeParse({ sectionKind: NOTE_SECTION, body: note.body }).success) {
		return { kind: 'note', ...note }
	}
	const intent = parseQuickCommand(text, bindings, context.now, context.defaultTimeZone)
	return intent === null ? null : { kind: 'lesson', intent }
}

const READ_COMMANDS: Record<string, ChatRecordsKey> = {
	'/today': { kind: 'day', day: 'today' },
	'/tomorrow': { kind: 'day', day: 'tomorrow' },
	'/payments': { kind: 'day', day: 'payments' },
}

function readCommand(text: string): ChatRecordsKey | null {
	return READ_COMMANDS[text.normalize('NFC').trim().toLowerCase()] ?? null
}

function commandText(text: string): string {
	return text.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase()
}

const FOLLOW_UP = commandText(CHAT_FOLLOW_UP_TEXT)

function followUpCommand(
	context: ChatContext,
	text: string,
	bindings: readonly MentionBinding[]
): ChatRecordsKey | null {
	const [binding, ...others] = bindings
	if (binding === undefined || others.length > 0) return null
	const start = binding.start > 0 && text[binding.start - 1] === '@' ? binding.start - 1 : binding.start
	if (commandText(`${text.slice(0, start)} ${text.slice(binding.end)}`) !== FOLLOW_UP) return null
	const today = lessonDay(context.now, context.defaultTimeZone)
	return { kind: 'lesson_dates', studentId: binding.studentId, from: today, to: today, scope: 'since_payment' }
}

function readStep(key: ChatRecordsKey, block: ChatBlock): ChatStep {
	const studentId = key.kind === 'day' ? undefined : key.studentId
	const step: ChatStep = {
		id: `lesson_dates:${studentId ?? 'none'}`,
		tool: 'lesson_dates',
		state: block.type === 'lesson_dates' ? 'done' : 'failed',
	}
	if (studentId !== undefined) step.studentId = studentId
	if (block.type === 'lesson_dates') {
		step.studentName = block.studentName.slice(0, 200)
		step.from = block.from
		step.to = block.to
	}
	return step
}

async function readBlock(tx: DbExecutor, context: ChatContext, key: ChatRecordsKey): Promise<ChatBlock> {
	try {
		return await tx.transaction(async (executor) => {
			const settings = await readTeacherSettings(executor, context.accountId)
			const block = await readChatRecords(executor, context, key, settings.paysSoonLessons)
			if (block === null) throw new Refusal('not_found')
			return block
		})
	} catch {
		return { type: 'read_failed', key }
	}
}

type Response = { blocks: ChatBlock[]; model: boolean; steps?: ChatStep[] }

async function respond(
	tx: DbExecutor,
	context: ChatContext,
	source: ActionSource,
	input: SendMessageRequest,
	typed: readonly MentionBinding[]
): Promise<Response> {
	const reading = readCommand(input.text)
	if (reading !== null) return { blocks: [await readBlock(tx, context, reading)], model: false }
	const mentions = await validateMentions(tx, context.accountId, input.text, input.mentions)
	if (mentions.kind === 'stale') return { blocks: [{ type: 'refused', code: 'mention_stale' }], model: false }
	const followUp = followUpCommand(context, input.text, withTyped(mentions.bindings, typed))
	if (followUp !== null) {
		const block = await readBlock(tx, context, followUp)
		return { blocks: [block], model: false, steps: [readStep(followUp, block)] }
	}
	const request = quickRequest(context, input.text, withTyped(mentions.bindings, typed))
	if (request === null) return { blocks: [], model: true }
	return { blocks: [await executeIntent(tx, context, source, request)], model: false }
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
	const turn = await turnOfMessage(executor, context.accountId, found.teacher.id)
	return { kind: 'sent', replayed: true, conversation, messages, turn: turn === null ? null : toTurn(turn) }
}

type SendPlan = { turns: TurnStarter | null; admission: Admission | null; launch: (() => void) | null }

function withTyped(bindings: readonly MentionBinding[], typed: readonly MentionBinding[]): readonly MentionBinding[] {
	return typed.length === 0 ? bindings : [...bindings, ...typed].sort((left, right) => left.start - right.start)
}

async function send(
	tx: DbExecutor,
	context: ChatContext,
	conversationId: string,
	input: SendMessageRequest,
	plan: SendPlan,
	typed: readonly MentionBinding[]
): Promise<SendOutcome> {
	if ((await lockConversation(tx, context.accountId, conversationId)) === null) return { kind: 'not_found' }
	const earlier = await replay(tx, context, conversationId, input)
	if (earlier !== null) return earlier
	if ((await activeTurn(tx, conversationId)) !== null) return { kind: 'busy' }
	const teacher = await insertMessage(tx, {
		accountId: context.accountId,
		conversationId,
		role: 'teacher',
		body: input.text,
		mentions: withTyped(input.mentions, typed),
		requestId: input.requestId,
		requestDigest: requestDigest(conversationId, input),
	})
	const response = await respond(tx, context, { conversationId, messageId: teacher.id }, input, typed)
	const admission = response.model ? (plan.admission ?? { kind: 'refused', code: 'model_unavailable' }) : null
	const blocks: ChatBlock[] =
		admission?.kind === 'refused' ? [{ type: 'refused', code: admission.code }] : response.blocks
	const inserted = await insertMessage(tx, {
		accountId: context.accountId,
		conversationId,
		role: 'assistant',
		body: '',
		blocks,
		replyTo: teacher.id,
	})
	const steps = admission === null ? (response.steps ?? []) : []
	if (steps.length > 0) await tx.update(chatMessages).set({ steps }).where(eq(chatMessages.id, inserted.id))
	const reply = steps.length > 0 ? { ...inserted, steps } : inserted
	let turn: ChatTurn | null = null
	if (admission?.kind === 'ready' && plan.turns !== null) {
		const started = await plan.turns.startTurn(tx, context, {
			accountId: context.accountId,
			conversationId,
			teacherMessageId: teacher.id,
			assistantMessageId: reply.id,
			model: admission.model,
			effort: admission.effort,
		})
		turn = toTurn(started.row)
		plan.launch = started.launch
	}
	const conversation = await touchConversation(tx, context.accountId, conversationId)
	return { kind: 'sent', replayed: false, conversation, messages: await toMessages(tx, [teacher, reply]), turn }
}

export async function sendMessage(
	db: Database,
	context: ChatContext,
	conversationId: string,
	input: SendMessageRequest,
	turns: TurnStarter | null = null
): Promise<SendOutcome> {
	const typed = await typedMentions(db, input.text, input.mentions)
	const bindings = withTyped(input.mentions, typed)
	const freeText =
		readCommand(input.text) === null &&
		followUpCommand(context, input.text, bindings) === null &&
		quickRequest(context, input.text, bindings) === null
	const plan: SendPlan = {
		turns,
		admission: turns !== null && freeText ? await turns.admit(context, conversationId) : null,
		launch: null,
	}
	let outcome: SendOutcome
	try {
		outcome = await db.transaction((tx) => send(tx, context, conversationId, input, plan, typed))
	} catch (error) {
		if (violatesUnique(error, ACTIVE_TURN_UNIQUE)) return { kind: 'busy' }
		if (!violatesUnique(error, REQUEST_UNIQUE)) throw error
		const earlier = await db.transaction((tx) => replay(tx, context, conversationId, input))
		return earlier ?? { kind: 'conflict' }
	}
	if (outcome.kind === 'sent' && !outcome.replayed) plan.launch?.()
	return outcome
}

type UndoBlock = ChatActionResultBlock | ChatNoteChangeBlock | ChatReviewResultBlock

const isUndoBlock = (block: ChatBlock | undefined): block is UndoBlock =>
	block?.type === 'action_result' || block?.type === 'note_change' || block?.type === 'review_result'

async function originalBlock(
	executor: DbExecutor,
	accountId: string,
	action: { id: string; messageId: string }
): Promise<UndoBlock | null> {
	const reply = await replyOf(executor, accountId, action.messageId)
	if (reply === null) return null
	const block = blocksOf(reply).find((item) => isUndoBlock(item) && item.actionId === action.id)
	return isUndoBlock(block) ? block : null
}

async function inverse(
	executor: DbExecutor,
	context: ChatContext,
	action: typeof chatActions.$inferSelect
): Promise<NoteUndo> {
	if (isNoteWrite(action)) return undoNoteWrite(executor, action)
	if (isNoteProposal(action)) return undoNoteProposal(executor, action)
	return (await legacyInverse(executor, context, action)) ? { ok: true } : { ok: false }
}

async function legacyInverse(
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

async function undo(
	tx: DbExecutor,
	context: ChatContext,
	actionId: string,
	input: UndoRequest
): Promise<UndoOutcome | { kind: 'calendar' }> {
	const [action] = await tx
		.select()
		.from(chatActions)
		.where(and(eq(chatActions.id, actionId), eq(chatActions.accountId, context.accountId)))
		.for('update')
	if (!action) return { kind: 'not_found' }
	if (action.kind === 'calendar') return { kind: 'calendar' }
	const block = await originalBlock(tx, context.accountId, action)
	if (block === null) return { kind: 'not_undoable' }
	const view = (state: string, undoResult: unknown): UndoOutcome => {
		const [shown] = withUndo(
			[block],
			new Map([[action.id, { id: action.id, state, result: action.result, after: action.after, undoResult }]])
		)
		return isUndoBlock(shown) ? { kind: 'ok', block: shown } : { kind: 'not_undoable' }
	}
	if (action.undoRequestId !== null) return view(action.state, action.undoResult)
	if (action.state !== 'applied') return { kind: 'not_undoable' }
	let issue: ChatNoteIssue | undefined
	const done = await inSavepoint(tx, async (executor) => {
		const outcome = await inverse(executor, context, action)
		if (!outcome.ok) {
			issue = outcome.issue
			throw new Refusal('lesson_changed')
		}
		return true
	})
	const undone = done === true
	const undoResult = undone ? { undo: 'done' } : { undo: 'stale', ...(issue === undefined ? {} : { issue }) }
	await tx
		.update(chatActions)
		.set({
			state: undone ? 'undone' : action.state,
			undoRequestId: input.requestId,
			undoResult,
			updatedAt: sql`now()`,
		})
		.where(eq(chatActions.id, action.id))
	return view(undone ? 'undone' : action.state, undoResult)
}

function calendarUndo(outcome: CalendarOutcome): UndoOutcome {
	if (outcome.kind === 'ok' || outcome.kind === 'not_found' || outcome.kind === 'conflict') return outcome
	return { kind: 'not_undoable' }
}

export async function undoAction(
	db: Database,
	context: ChatContext,
	actionId: string,
	input: UndoRequest,
	commands?: CalendarCommands
): Promise<UndoOutcome> {
	let outcome: UndoOutcome | { kind: 'calendar' }
	try {
		outcome = await db.transaction((tx) => undo(tx, context, actionId, input))
	} catch (error) {
		if (violatesUnique(error, UNDO_UNIQUE)) return { kind: 'conflict' }
		throw error
	}
	if (outcome.kind !== 'calendar') return outcome
	return calendarUndo(await undoCalendarAction(db, commands, context, actionId, input))
}
