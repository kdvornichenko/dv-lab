import { and, eq, sql } from 'drizzle-orm'

import { CHAT_PROMPT_COMMANDS, type ChatPromptCommand, type CommandPrompt } from '@dv-lab/contracts'
import { type Database, type DbExecutor, accounts, chatCommandPrompts } from '@dv-lab/db'

import { ESSAY_TASK } from './essay.ts'

export const RECAP_TASK =
	'Prepare a short recap for the mentioned student. Read the stored profile, notes, comments and lessons with the tools, then retell them in your own words under three bold labels: what was covered, weak points, ideas for the next lessons. Under each label write one to five short bullet points, one line each, concrete and without filler. Never leave a label without text under it: when the records say nothing for it, leave the label out. Summarize profile sections instead of quoting them, and do not copy raw tables, file lists or service text. Use at most two cite markers in the whole recap, only for a short note or comment whose exact words matter, at the end of a bullet that reads complete without the quote. If no student is mentioned, ask which one.'

const DEFAULT_TEXTS: Record<ChatPromptCommand, string> = { '/recap': RECAP_TASK, '/essay': ESSAY_TASK }

export type CommandTexts = Record<ChatPromptCommand, string>

type SaveCommandPromptResult = { ok: true; prompt: CommandPrompt } | { ok: false; error: 'changed' }

export function isPromptCommand(value: string): value is ChatPromptCommand {
	return CHAT_PROMPT_COMMANDS.some((command) => command === value)
}

function promptOf(
	command: ChatPromptCommand,
	row: { body: string | null; revision: number } | undefined
): CommandPrompt {
	const defaultBody = DEFAULT_TEXTS[command]
	const body = row?.body ?? null
	return {
		command,
		body: body ?? defaultBody,
		isDefault: body === null,
		defaultBody,
		revision: row?.revision ?? 0,
	}
}

export async function readCommandPrompts(executor: DbExecutor, accountId: string): Promise<CommandPrompt[]> {
	const rows = await executor
		.select({
			command: chatCommandPrompts.command,
			body: chatCommandPrompts.body,
			revision: chatCommandPrompts.revision,
		})
		.from(chatCommandPrompts)
		.where(eq(chatCommandPrompts.accountId, accountId))
	return CHAT_PROMPT_COMMANDS.map((command) =>
		promptOf(
			command,
			rows.find((row) => row.command === command)
		)
	)
}

export async function readCommandTexts(executor: DbExecutor, accountId: string): Promise<CommandTexts> {
	const prompts = await readCommandPrompts(executor, accountId)
	const texts = { ...DEFAULT_TEXTS }
	for (const prompt of prompts) texts[prompt.command] = prompt.body
	return texts
}

export function saveCommandPrompt(
	db: Database,
	accountId: string,
	command: ChatPromptCommand,
	body: string | null,
	expectedRevision: number
): Promise<SaveCommandPromptResult> {
	return db.transaction(async (tx): Promise<SaveCommandPromptResult> => {
		const [account] = await tx
			.select({ id: accounts.id })
			.from(accounts)
			.where(eq(accounts.id, accountId))
			.for('update')
		if (!account) throw new Error('Teacher account missing while locking settings')
		const key = and(eq(chatCommandPrompts.accountId, accountId), eq(chatCommandPrompts.command, command))
		const [current] = await tx
			.select({ revision: chatCommandPrompts.revision })
			.from(chatCommandPrompts)
			.where(key)
			.for('update')
		if ((current?.revision ?? 0) !== expectedRevision) return { ok: false, error: 'changed' }
		const [row] = current
			? await tx
					.update(chatCommandPrompts)
					.set({ body, revision: sql`${chatCommandPrompts.revision} + 1`, updatedAt: sql`now()` })
					.where(key)
					.returning({ body: chatCommandPrompts.body, revision: chatCommandPrompts.revision })
			: await tx
					.insert(chatCommandPrompts)
					.values({ accountId, command, body })
					.returning({ body: chatCommandPrompts.body, revision: chatCommandPrompts.revision })
		if (!row) throw new Error('Command prompt upsert returned no row')
		return { ok: true, prompt: promptOf(command, row) }
	})
}
