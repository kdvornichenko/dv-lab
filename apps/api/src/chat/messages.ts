import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { z } from 'zod'

import {
	type ChatBlock,
	type ChatMessage,
	type ChatUndoState,
	type MentionBinding,
	CHAT_UNDO_STATES,
	chatBlock,
	mentionBinding,
} from '@dv-lab/contracts'
import { type DbExecutor, chatActions, chatMessages } from '@dv-lab/db'

export type MessageRow = typeof chatMessages.$inferSelect

export type ActionUndo = { id: string; state: string; undoResult: unknown }

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
const storedUndo = z.object({ undo: z.enum(CHAT_UNDO_STATES) }).nullable()

export function undoState(action: Pick<ActionUndo, 'state' | 'undoResult'>): ChatUndoState {
	if (action.state === 'undone') return 'done'
	const recorded = storedUndo.safeParse(action.undoResult ?? null)
	if (recorded.success && recorded.data?.undo === 'stale') return 'stale'
	if (recorded.success && recorded.data?.undo === 'pending') return 'pending'
	return 'available'
}

export function withUndo(blocks: readonly ChatBlock[], actions: ReadonlyMap<string, ActionUndo>): ChatBlock[] {
	return blocks.map((block) => {
		if (block.type !== 'action_result') return block
		const action = actions.get(block.actionId)
		return action ? { ...block, undo: undoState(action) } : block
	})
}

export function toMessage(row: MessageRow, actions: ReadonlyMap<string, ActionUndo>): ChatMessage {
	return {
		id: row.id,
		role: row.role === 'teacher' ? 'teacher' : 'assistant',
		body: row.body,
		mentions: storedMentions.parse(row.mentions),
		blocks: withUndo(storedBlocks.parse(row.blocks), actions),
		createdAt: row.createdAt.toISOString(),
	}
}

export function blocksOf(row: MessageRow): ChatBlock[] {
	return storedBlocks.parse(row.blocks)
}

async function actionsOf(executor: DbExecutor, rows: readonly MessageRow[]): Promise<Map<string, ActionUndo>> {
	const ids = rows.flatMap((row) =>
		blocksOf(row).flatMap((block) => (block.type === 'action_result' ? [block.actionId] : []))
	)
	if (ids.length === 0) return new Map()
	const found = await executor
		.select({ id: chatActions.id, state: chatActions.state, undoResult: chatActions.undoResult })
		.from(chatActions)
		.where(inArray(chatActions.id, ids))
	return new Map(found.map((action) => [action.id, action]))
}

export async function toMessages(executor: DbExecutor, rows: readonly MessageRow[]): Promise<ChatMessage[]> {
	const actions = await actionsOf(executor, rows)
	return rows.map((row) => toMessage(row, actions))
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
