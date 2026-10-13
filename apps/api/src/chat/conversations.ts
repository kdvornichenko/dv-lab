import { and, desc, eq, isNull, sql } from 'drizzle-orm'

import type { ChatConversation, DeleteConversationRequest, RenameConversationRequest } from '@dv-lab/contracts'
import { type DbExecutor, chatConversations } from '@dv-lab/db'

const NEW_CONVERSATION_TITLE = 'New chat'
const DELETED_CONVERSATION_TITLE = 'Deleted chat'

export type ConversationChange =
	{ kind: 'saved'; conversation: ChatConversation } | { kind: 'changed' } | { kind: 'not_found' }

export type ConversationDeletion = { kind: 'deleted' } | { kind: 'changed' } | { kind: 'not_found' }

const columns = {
	id: chatConversations.id,
	title: chatConversations.title,
	revision: chatConversations.revision,
	createdAt: chatConversations.createdAt,
	updatedAt: chatConversations.updatedAt,
}

type ConversationRow = {
	id: string
	title: string
	revision: number
	createdAt: Date
	updatedAt: Date
}

const toConversation = (row: ConversationRow): ChatConversation => ({
	id: row.id,
	title: row.title,
	revision: row.revision,
	createdAt: row.createdAt.toISOString(),
	updatedAt: row.updatedAt.toISOString(),
})

const owned = (accountId: string, id: string) =>
	and(eq(chatConversations.id, id), eq(chatConversations.accountId, accountId), isNull(chatConversations.deletedAt))

export async function createConversation(executor: DbExecutor, accountId: string): Promise<ChatConversation> {
	const [row] = await executor
		.insert(chatConversations)
		.values({ accountId, title: NEW_CONVERSATION_TITLE })
		.returning(columns)
	if (!row) throw new Error('conversation insert returned no row')
	return toConversation(row)
}

export async function listConversations(executor: DbExecutor, accountId: string): Promise<ChatConversation[]> {
	const rows = await executor
		.select(columns)
		.from(chatConversations)
		.where(and(eq(chatConversations.accountId, accountId), isNull(chatConversations.deletedAt)))
		.orderBy(desc(chatConversations.updatedAt), chatConversations.id)
	return rows.map(toConversation)
}

export async function readConversation(
	executor: DbExecutor,
	accountId: string,
	id: string
): Promise<ChatConversation | null> {
	const [row] = await executor.select(columns).from(chatConversations).where(owned(accountId, id))
	return row ? toConversation(row) : null
}

async function lockConversation(executor: DbExecutor, accountId: string, id: string) {
	const [row] = await executor
		.select({ revision: chatConversations.revision })
		.from(chatConversations)
		.where(owned(accountId, id))
		.for('update')
	return row ?? null
}

export async function renameConversation(
	executor: DbExecutor,
	accountId: string,
	id: string,
	input: RenameConversationRequest
): Promise<ConversationChange> {
	const locked = await lockConversation(executor, accountId, id)
	if (locked === null) return { kind: 'not_found' }
	if (locked.revision !== input.expectedRevision) return { kind: 'changed' }
	const [row] = await executor
		.update(chatConversations)
		.set({ title: input.title, revision: locked.revision + 1, updatedAt: sql`now()` })
		.where(owned(accountId, id))
		.returning(columns)
	if (!row) throw new Error('conversation update returned no row')
	return { kind: 'saved', conversation: toConversation(row) }
}

export async function deleteConversation(
	executor: DbExecutor,
	accountId: string,
	id: string,
	input: DeleteConversationRequest
): Promise<ConversationDeletion> {
	const locked = await lockConversation(executor, accountId, id)
	if (locked === null) return { kind: 'not_found' }
	if (locked.revision !== input.expectedRevision) return { kind: 'changed' }
	await executor
		.update(chatConversations)
		.set({
			title: DELETED_CONVERSATION_TITLE,
			revision: locked.revision + 1,
			updatedAt: sql`now()`,
			deletedAt: sql`now()`,
		})
		.where(owned(accountId, id))
	return { kind: 'deleted' }
}
