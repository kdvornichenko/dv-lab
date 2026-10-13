import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'

import {
	type AssistantSettings,
	type ChatConversation,
	type ConversationModelRequest,
	type DeleteConversationRequest,
	type RenameConversationRequest,
	CHAT_ACTIVE_TURN_STATES,
	chatEffort,
} from '@dv-lab/contracts'
import { type DbExecutor, chatConversations, chatTurns } from '@dv-lab/db'

import { readAssistantSettings } from '../settings/settings.ts'
import { redactConversationContent, unsettledActionIds } from './messages.ts'
import { modelCapabilities, resolveModelChoice, selectionAllowed } from './model-config.ts'

const NEW_CONVERSATION_TITLE = 'New chat'
const DELETED_CONVERSATION_TITLE = 'Deleted chat'

export type ConversationChange =
	{ kind: 'saved'; conversation: ChatConversation } | { kind: 'changed' } | { kind: 'not_found' }

export type ConversationModelChange = ConversationChange | { kind: 'invalid' }

export type ConversationDeletion =
	{ kind: 'deleted' } | { kind: 'pending' } | { kind: 'changed' } | { kind: 'not_found' }

const columns = {
	id: chatConversations.id,
	title: chatConversations.title,
	revision: chatConversations.revision,
	modelOverride: chatConversations.modelOverride,
	effortOverride: chatConversations.effortOverride,
	createdAt: chatConversations.createdAt,
	updatedAt: chatConversations.updatedAt,
}

type ConversationRow = {
	id: string
	title: string
	revision: number
	modelOverride: string | null
	effortOverride: string | null
	createdAt: Date
	updatedAt: Date
}

function toConversation(row: ConversationRow, settings: AssistantSettings): ChatConversation {
	const effortOverride = chatEffort.safeParse(row.effortOverride)
	const override = { model: row.modelOverride, effort: effortOverride.success ? effortOverride.data : null }
	const choice = resolveModelChoice(settings, override)
	return {
		id: row.id,
		title: row.title,
		revision: row.revision,
		model: choice.kind === 'resolved' ? choice.model.id : choice.modelId,
		effort: choice.kind === 'resolved' ? choice.effort : override.effort,
		override: row.modelOverride !== null || row.effortOverride !== null,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	}
}

const owned = (accountId: string, id: string) =>
	and(eq(chatConversations.id, id), eq(chatConversations.accountId, accountId), isNull(chatConversations.deletedAt))

export async function createConversation(executor: DbExecutor, accountId: string): Promise<ChatConversation> {
	const [row] = await executor
		.insert(chatConversations)
		.values({ accountId, title: NEW_CONVERSATION_TITLE })
		.returning(columns)
	if (!row) throw new Error('conversation insert returned no row')
	return toConversation(row, await readAssistantSettings(executor, accountId))
}

export async function listConversations(executor: DbExecutor, accountId: string): Promise<ChatConversation[]> {
	const rows = await executor
		.select(columns)
		.from(chatConversations)
		.where(and(eq(chatConversations.accountId, accountId), isNull(chatConversations.deletedAt)))
		.orderBy(desc(chatConversations.updatedAt), chatConversations.id)
	const settings = await readAssistantSettings(executor, accountId)
	return rows.map((row) => toConversation(row, settings))
}

export async function readConversation(
	executor: DbExecutor,
	accountId: string,
	id: string
): Promise<ChatConversation | null> {
	const [row] = await executor.select(columns).from(chatConversations).where(owned(accountId, id))
	return row ? toConversation(row, await readAssistantSettings(executor, accountId)) : null
}

export async function lockConversation(executor: DbExecutor, accountId: string, id: string) {
	const [row] = await executor
		.select({ revision: chatConversations.revision })
		.from(chatConversations)
		.where(owned(accountId, id))
		.for('update')
	return row ?? null
}

export async function touchConversation(
	executor: DbExecutor,
	accountId: string,
	id: string
): Promise<ChatConversation> {
	const [row] = await executor
		.update(chatConversations)
		.set({ updatedAt: sql`clock_timestamp()` })
		.where(owned(accountId, id))
		.returning(columns)
	if (!row) throw new Error('conversation touch returned no row')
	return toConversation(row, await readAssistantSettings(executor, accountId))
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
	return { kind: 'saved', conversation: toConversation(row, await readAssistantSettings(executor, accountId)) }
}

export async function setConversationModel(
	executor: DbExecutor,
	accountId: string,
	id: string,
	input: ConversationModelRequest,
	availability: (modelId: string) => Promise<boolean>
): Promise<ConversationModelChange> {
	const locked = await lockConversation(executor, accountId, id)
	if (locked === null) return { kind: 'not_found' }
	if (locked.revision !== input.expectedRevision) return { kind: 'changed' }
	const settings = await readAssistantSettings(executor, accountId)
	if (input.model !== null || input.effort !== null) {
		const modelId = input.model ?? settings.model ?? settings.models[0]?.id
		const capabilities = await modelCapabilities(settings, availability)
		if (modelId === undefined || !selectionAllowed(capabilities, modelId, input.effort)) return { kind: 'invalid' }
	}
	const [row] = await executor
		.update(chatConversations)
		.set({ modelOverride: input.model, effortOverride: input.effort, revision: locked.revision + 1 })
		.where(owned(accountId, id))
		.returning(columns)
	if (!row) throw new Error('conversation update returned no row')
	return { kind: 'saved', conversation: toConversation(row, settings) }
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
	const running = await executor
		.select({ id: chatTurns.id })
		.from(chatTurns)
		.where(and(eq(chatTurns.conversationId, id), inArray(chatTurns.state, [...CHAT_ACTIVE_TURN_STATES])))
		.for('update')
		.limit(1)
	if (running.length > 0) return { kind: 'pending' }
	if ((await unsettledActionIds(executor, accountId, id, true)).length > 0) return { kind: 'pending' }
	await redactConversationContent(executor, accountId, id)
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
