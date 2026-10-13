import { and, eq, inArray } from 'drizzle-orm'

import {
	CHAT_ACTIVE_TURN_STATES,
	CHAT_TURN_ISSUES,
	CHAT_TURN_STATES,
	type ChatEffort,
	type ChatTurn,
	chatEffort,
} from '@dv-lab/contracts'
import { type DbExecutor, chatTurns } from '@dv-lab/db'

export type TurnRow = typeof chatTurns.$inferSelect

export type NewTurn = {
	accountId: string
	conversationId: string
	teacherMessageId: string
	assistantMessageId: string
	model: string
	effort: ChatEffort
}

const ACTIVE: readonly string[] = CHAT_ACTIVE_TURN_STATES

export function isActive(state: string): boolean {
	return ACTIVE.includes(state)
}

export function toTurn(row: TurnRow): ChatTurn {
	const state = CHAT_TURN_STATES.find((value) => value === row.state)
	if (state === undefined) throw new Error('chat turn has an unknown state')
	return {
		id: row.id,
		state,
		model: row.model,
		effort: chatEffort.parse(row.effort),
		issue: CHAT_TURN_ISSUES.find((value) => value === row.issue) ?? null,
		assistantMessageId: row.assistantMessageId,
	}
}

export async function readTurn(executor: DbExecutor, accountId: string, turnId: string): Promise<TurnRow | null> {
	const [row] = await executor
		.select()
		.from(chatTurns)
		.where(and(eq(chatTurns.id, turnId), eq(chatTurns.accountId, accountId)))
	return row ?? null
}

export async function activeTurn(executor: DbExecutor, conversationId: string): Promise<TurnRow | null> {
	const [row] = await executor
		.select()
		.from(chatTurns)
		.where(and(eq(chatTurns.conversationId, conversationId), inArray(chatTurns.state, [...ACTIVE])))
	return row ?? null
}

export async function turnOfMessage(
	executor: DbExecutor,
	accountId: string,
	teacherMessageId: string
): Promise<TurnRow | null> {
	const [row] = await executor
		.select()
		.from(chatTurns)
		.where(and(eq(chatTurns.teacherMessageId, teacherMessageId), eq(chatTurns.accountId, accountId)))
	return row ?? null
}

export async function insertTurn(executor: DbExecutor, turn: NewTurn): Promise<TurnRow> {
	const [row] = await executor
		.insert(chatTurns)
		.values({ ...turn, state: 'accepted' })
		.returning()
	if (!row) throw new Error('chat turn insert returned no row')
	return row
}
