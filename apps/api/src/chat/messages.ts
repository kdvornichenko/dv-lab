import { and, asc, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { z } from 'zod'

import {
	type ChatBlock,
	type ChatCalendarProposalBlock,
	type ChatMessage,
	type ChatUndoState,
	type MentionBinding,
	type ChatStep,
	CHAT_ACTIVE_TURN_STATES,
	CHAT_CALENDAR_STATES,
	CHAT_UNDO_STATES,
	chatBlock,
	chatCalendarIssue,
	chatStep,
	mentionBinding,
} from '@dv-lab/contracts'
import { type DbExecutor, chatActions, chatMessages, chatTurns, lessonComments, studentNotes } from '@dv-lab/db'

export type MessageRow = typeof chatMessages.$inferSelect

export type ActionUndo = { id: string; state: string; result?: unknown; undoResult: unknown }

export type NewAction = {
	accountId: string
	conversationId: string
	messageId: string
	kind: 'mark' | 'note' | 'comment' | 'calendar'
	state: 'applied' | 'refused' | 'proposed'
	target?: unknown
	before?: unknown
	after?: unknown
	result: unknown
	calendarRequestId?: string
}

export const calendarProgress = z.object({
	state: z.enum(CHAT_CALENDAR_STATES),
	commandId: z.uuid().nullable().optional(),
	accepted: z.boolean().optional(),
	issue: chatCalendarIssue.optional(),
})

const calendarUndo = z.object({ issue: chatCalendarIssue.optional() }).nullable()

type NewMessage = {
	accountId: string
	conversationId: string
	role: 'teacher' | 'assistant'
	body: string
	mentions?: readonly MentionBinding[]
	blocks?: readonly ChatBlock[]
	requestId?: string
	requestDigest?: string
	replyTo?: string
}

const storedBlocks = z.array(chatBlock)
const storedMentions = z.array(mentionBinding)
const storedSteps = z.array(chatStep)
const ACTIVE: readonly string[] = CHAT_ACTIVE_TURN_STATES
const storedUndo = z.object({ undo: z.enum(CHAT_UNDO_STATES) }).nullable()

export function undoState(action: Pick<ActionUndo, 'state' | 'undoResult'>): ChatUndoState {
	if (action.state === 'undone') return 'done'
	const recorded = storedUndo.safeParse(action.undoResult ?? null)
	if (recorded.success && recorded.data?.undo === 'stale') return 'stale'
	if (recorded.success && recorded.data?.undo === 'pending') return 'pending'
	return 'available'
}

export function calendarView(block: ChatCalendarProposalBlock, action: ActionUndo): ChatCalendarProposalBlock {
	const progress = calendarProgress.safeParse(action.result)
	if (!progress.success) return block
	const { state, accepted, issue } = progress.data
	const single = block.operation === 'move' || block.operation === 'cancel'
	const undo = state === 'applied' && single ? undoState(action) : null
	const recorded = calendarUndo.safeParse(action.undoResult ?? null)
	return {
		...block,
		state,
		undo,
		accepted: accepted === true ? true : undefined,
		issue,
		undoIssue: undo !== null && recorded.success ? recorded.data?.issue : undefined,
	}
}

export function withUndo(blocks: readonly ChatBlock[], actions: ReadonlyMap<string, ActionUndo>): ChatBlock[] {
	return blocks.map((block) => {
		if (block.type !== 'action_result' && block.type !== 'calendar_proposal') return block
		const action = actions.get(block.actionId)
		if (!action) return block
		return block.type === 'calendar_proposal' ? calendarView(block, action) : { ...block, undo: undoState(action) }
	})
}

export function stepsOf(row: Pick<MessageRow, 'steps'>): ChatStep[] {
	const parsed = storedSteps.safeParse(row.steps)
	return parsed.success ? parsed.data : []
}

type Reading = {
	actions: ReadonlyMap<string, ActionUndo>
	turns: ReadonlyMap<string, { state: string; updatedAt: Date }>
	gone: ReadonlySet<string>
}

function withSources(blocks: readonly ChatBlock[], gone: ReadonlySet<string>): ChatBlock[] {
	return blocks.map((block) => {
		if (block.type !== 'excerpt' || !gone.has(citeId(block.source, block.id))) return block
		const { entry: _entry, lesson: _lesson, ...rest } = block
		return rest
	})
}

function finishedAt(row: MessageRow, turns: Reading['turns']): string | null {
	if (row.role === 'teacher') return null
	const turn = turns.get(row.id)
	if (turn === undefined) return row.createdAt.toISOString()
	return ACTIVE.includes(turn.state) ? null : turn.updatedAt.toISOString()
}

function toMessage(row: MessageRow, reading: Reading): ChatMessage {
	return {
		id: row.id,
		role: row.role === 'teacher' ? 'teacher' : 'assistant',
		body: row.body,
		mentions: storedMentions.parse(row.mentions),
		blocks: withSources(withUndo(storedBlocks.parse(row.blocks), reading.actions), reading.gone),
		steps: stepsOf(row),
		createdAt: row.createdAt.toISOString(),
		finishedAt: finishedAt(row, reading.turns),
	}
}

const citeId = (source: string, id: string) => `${source}:${id.toLowerCase()}`

async function turnsOf(executor: DbExecutor, rows: readonly MessageRow[]) {
	const ids = rows.filter((row) => row.role === 'assistant').map((row) => row.id)
	if (ids.length === 0) return new Map<string, { state: string; updatedAt: Date }>()
	const found = await executor
		.select({ messageId: chatTurns.assistantMessageId, state: chatTurns.state, updatedAt: chatTurns.updatedAt })
		.from(chatTurns)
		.where(inArray(chatTurns.assistantMessageId, ids))
	return new Map(found.flatMap((turn) => (turn.messageId === null ? [] : [[turn.messageId, turn] as const])))
}

const UUID_TEXT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

async function goneSources(executor: DbExecutor, rows: readonly MessageRow[]): Promise<Set<string>> {
	const notes = new Set<string>()
	const comments = new Set<string>()
	for (const row of rows)
		for (const block of blocksOf(row)) {
			if (block.type !== 'excerpt' || !UUID_TEXT.test(block.id)) continue
			if (block.source === 'note') notes.add(block.id.toLowerCase())
			if (block.source === 'comment') comments.add(block.id.toLowerCase())
		}
	const gone = new Set<string>()
	if (notes.size > 0) {
		const live = await executor
			.select({ id: studentNotes.id })
			.from(studentNotes)
			.where(and(inArray(studentNotes.id, [...notes]), isNull(studentNotes.retractedAt)))
		const kept = new Set(live.map((note) => note.id.toLowerCase()))
		for (const id of notes) if (!kept.has(id)) gone.add(citeId('note', id))
	}
	if (comments.size > 0) {
		const live = await executor
			.select({ id: lessonComments.id })
			.from(lessonComments)
			.where(and(inArray(lessonComments.id, [...comments]), isNull(lessonComments.retractedAt)))
		const kept = new Set(live.map((comment) => comment.id.toLowerCase()))
		for (const id of comments) if (!kept.has(id)) gone.add(citeId('comment', id))
	}
	return gone
}

export function blocksOf(row: MessageRow): ChatBlock[] {
	return storedBlocks.parse(row.blocks)
}

async function actionsOf(executor: DbExecutor, rows: readonly MessageRow[]): Promise<Map<string, ActionUndo>> {
	const ids = rows.flatMap((row) =>
		blocksOf(row).flatMap((block) =>
			block.type === 'action_result' || block.type === 'calendar_proposal' ? [block.actionId] : []
		)
	)
	if (ids.length === 0) return new Map()
	const found = await executor
		.select({
			id: chatActions.id,
			state: chatActions.state,
			result: chatActions.result,
			undoResult: chatActions.undoResult,
		})
		.from(chatActions)
		.where(inArray(chatActions.id, ids))
	return new Map(found.map((action) => [action.id, action]))
}

export async function toMessages(executor: DbExecutor, rows: readonly MessageRow[]): Promise<ChatMessage[]> {
	const reading: Reading = {
		actions: await actionsOf(executor, rows),
		turns: await turnsOf(executor, rows),
		gone: await goneSources(executor, rows),
	}
	return rows.map((row) => toMessage(row, reading))
}

export async function listMessages(
	executor: DbExecutor,
	accountId: string,
	conversationId: string
): Promise<ChatMessage[]> {
	const rows = await executor
		.select()
		.from(chatMessages)
		.where(
			and(
				eq(chatMessages.accountId, accountId),
				eq(chatMessages.conversationId, conversationId),
				isNull(chatMessages.redactedAt)
			)
		)
		.orderBy(asc(chatMessages.createdAt), asc(chatMessages.id))
	return toMessages(executor, rows)
}

export async function insertMessage(executor: DbExecutor, message: NewMessage): Promise<MessageRow> {
	const [row] = await executor
		.insert(chatMessages)
		.values({
			accountId: message.accountId,
			conversationId: message.conversationId,
			role: message.role,
			body: message.body,
			mentions: message.mentions ?? [],
			blocks: message.blocks ?? [],
			requestId: message.requestId ?? null,
			requestDigest: message.requestDigest ?? null,
			replyTo: message.replyTo ?? null,
		})
		.returning()
	if (!row) throw new Error('chat message insert returned no row')
	return row
}

export async function insertAction(executor: DbExecutor, action: NewAction): Promise<string> {
	const [row] = await executor
		.insert(chatActions)
		.values({
			accountId: action.accountId,
			conversationId: action.conversationId,
			messageId: action.messageId,
			kind: action.kind,
			state: action.state,
			target: action.target ?? null,
			before: action.before ?? null,
			after: action.after ?? null,
			result: action.result,
			calendarRequestId: action.calendarRequestId ?? null,
		})
		.returning({ id: chatActions.id })
	if (!row) throw new Error('chat action insert returned no row')
	return row.id
}

export async function findRequest(
	executor: DbExecutor,
	accountId: string,
	requestId: string
): Promise<{ teacher: MessageRow; replies: MessageRow[] } | null> {
	const [teacher] = await executor
		.select()
		.from(chatMessages)
		.where(and(eq(chatMessages.accountId, accountId), eq(chatMessages.requestId, requestId)))
	if (!teacher) return null
	const replies = await executor
		.select()
		.from(chatMessages)
		.where(and(eq(chatMessages.accountId, accountId), eq(chatMessages.replyTo, teacher.id)))
		.orderBy(asc(chatMessages.createdAt), asc(chatMessages.id))
	return { teacher, replies }
}

export async function replyOf(executor: DbExecutor, accountId: string, messageId: string): Promise<MessageRow | null> {
	const [reply] = await executor
		.select()
		.from(chatMessages)
		.where(and(eq(chatMessages.accountId, accountId), eq(chatMessages.replyTo, messageId)))
		.orderBy(asc(chatMessages.createdAt), asc(chatMessages.id))
		.limit(1)
	return reply ?? null
}

export const unsettledCalendarAction = or(
	eq(chatActions.state, 'submitted'),
	sql`${chatActions.undoResult}->>'undo' = 'pending'`
)

export async function unsettledActionIds(
	executor: DbExecutor,
	accountId: string,
	conversationId: string,
	lock = false
): Promise<string[]> {
	const query = executor
		.select({ id: chatActions.id })
		.from(chatActions)
		.where(
			and(eq(chatActions.accountId, accountId), eq(chatActions.conversationId, conversationId), unsettledCalendarAction)
		)
	return (lock ? await query.for('update') : await query).map((row) => row.id)
}

export async function redactConversationContent(
	executor: DbExecutor,
	accountId: string,
	conversationId: string
): Promise<void> {
	await executor
		.update(chatActions)
		.set({ state: 'refused', result: { state: 'stale' }, updatedAt: sql`now()` })
		.where(
			and(
				eq(chatActions.accountId, accountId),
				eq(chatActions.conversationId, conversationId),
				eq(chatActions.kind, 'calendar'),
				eq(chatActions.state, 'proposed')
			)
		)
	await executor
		.update(chatMessages)
		.set({ body: '', mentions: [], blocks: [], steps: [], redactedAt: sql`now()` })
		.where(
			and(
				eq(chatMessages.accountId, accountId),
				eq(chatMessages.conversationId, conversationId),
				isNull(chatMessages.redactedAt)
			)
		)
}
