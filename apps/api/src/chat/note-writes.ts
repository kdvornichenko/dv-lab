import { eq } from 'drizzle-orm'
import { z } from 'zod'

import type { ChatNoteChangeBlock, ChatNoteIssue, NoteBlock } from '@dv-lab/contracts'
import { type DbExecutor, chatActions, students } from '@dv-lab/db'

import { lockLiveBlock, saveBlockText } from '../cards/blocks.ts'
import { isAddition, noteHunks, noteText, sameNote } from '../cards/note-diff.ts'
import type { ActionSource, ChatContext } from './actions.ts'
import { insertAction } from './messages.ts'
import type { ToolContext } from './tool-registry.ts'

export type NoteCard = { id: string; displayName: string }

export type NoteRefusal = 'student_not_found' | 'block_not_found' | 'rewrite_needs_confirmation'

export type NoteOutcome = { kind: 'block'; block: ChatNoteChangeBlock } | { kind: 'refused'; code: NoteRefusal }

export type NoteUndo = { ok: true } | { ok: false; issue?: ChatNoteIssue }

type NoteParts = Partial<Pick<ChatNoteChangeBlock, 'hunks' | 'more' | 'words' | 'state' | 'undo'>>

const blockTextTarget = z.object({ op: z.literal('block_text'), studentId: z.uuid(), blockId: z.uuid() })

const noteTarget = z.discriminatedUnion('op', [blockTextTarget])

const revisionAfter = z.object({ revision: z.number().int().min(1) })

const bodyBefore = z.object({ body: z.string() })

export async function noteCard(executor: DbExecutor, studentId: string): Promise<NoteCard | null> {
	const [row] = await executor
		.select({ id: students.id, displayName: students.displayName })
		.from(students)
		.where(eq(students.id, studentId))
	return row ?? null
}

export function blockTarget(block: Pick<NoteBlock, 'id' | 'key' | 'name'>): ChatNoteChangeBlock['target'] {
	return { kind: 'block', blockId: block.id, blockKey: block.key, blockName: block.name }
}

export function noteChange(
	actionId: string,
	mode: ChatNoteChangeBlock['mode'],
	card: NoteCard,
	target: ChatNoteChangeBlock['target'],
	change: ChatNoteChangeBlock['change'],
	parts: NoteParts = {}
): ChatNoteChangeBlock {
	return {
		type: 'note_change',
		actionId,
		mode,
		studentId: card.id,
		studentName: card.displayName,
		target,
		change,
		hunks: parts.hunks ?? [],
		more: parts.more ?? 0,
		words: parts.words ?? [],
		state: parts.state ?? null,
		undo: parts.undo === undefined ? (mode === 'receipt' ? 'available' : null) : parts.undo,
	}
}

function receiptAction(
	executor: DbExecutor,
	context: ChatContext,
	source: ActionSource,
	record: { target: unknown; before?: unknown; after: unknown }
): Promise<string> {
	return insertAction(executor, {
		accountId: context.accountId,
		...source,
		kind: 'note',
		state: 'applied',
		...record,
		result: { kind: 'applied' },
	})
}

export async function alreadyWritten(
	executor: DbExecutor,
	context: ChatContext,
	source: ActionSource,
	card: NoteCard,
	target: ChatNoteChangeBlock['target']
): Promise<ChatNoteChangeBlock> {
	const actionId = await insertAction(executor, {
		accountId: context.accountId,
		...source,
		kind: 'note',
		state: 'refused',
		target: { studentId: card.id, ...(target.kind === 'block' ? { blockId: target.blockId } : {}) },
		result: { kind: 'already' },
	})
	return noteChange(actionId, 'receipt', card, target, 'already', { undo: null })
}

export async function appendToBlock(
	executor: DbExecutor,
	context: ChatContext,
	source: ActionSource,
	card: NoteCard,
	block: NoteBlock,
	text: string
): Promise<ChatNoteChangeBlock | null> {
	const saved = await saveBlockText(executor, card.id, block.id, text, block.revision)
	if (saved.kind !== 'ok') return null
	const actionId = await receiptAction(executor, context, source, {
		target: { op: 'block_text', studentId: card.id, blockId: block.id },
		before: { body: block.body, revision: block.revision },
		after: { revision: saved.block.revision },
	})
	return noteChange(actionId, 'receipt', card, blockTarget(saved.block), 'updated', noteHunks(block.body, text))
}

export function writeNoteBlock(
	context: ToolContext,
	studentId: string,
	blockId: string,
	text: string
): Promise<NoteOutcome> {
	return context.db.transaction(async (tx): Promise<NoteOutcome> => {
		const card = await noteCard(tx, studentId)
		if (card === null) return { kind: 'refused', code: 'student_not_found' }
		const block = await lockLiveBlock(tx, studentId, blockId)
		if (block === null) return { kind: 'refused', code: 'block_not_found' }
		const next = noteText(text)
		let shown: ChatNoteChangeBlock | null
		if (sameNote(block.body, next))
			shown = await alreadyWritten(tx, context.chat, context.source, card, blockTarget(block))
		else if (isAddition(block.body, next))
			shown = await appendToBlock(tx, context.chat, context.source, card, block, next)
		else return { kind: 'refused', code: 'rewrite_needs_confirmation' }
		if (shown === null) return { kind: 'refused', code: 'block_not_found' }
		await context.persist(tx, shown)
		return { kind: 'block', block: shown }
	})
}

export function isNoteWrite(action: Pick<typeof chatActions.$inferSelect, 'kind' | 'target'>): boolean {
	return action.kind === 'note' && noteTarget.safeParse(action.target).success
}

export async function undoNoteWrite(
	executor: DbExecutor,
	action: Pick<typeof chatActions.$inferSelect, 'target' | 'before' | 'after'>
): Promise<NoteUndo> {
	const target = noteTarget.parse(action.target)
	const after = revisionAfter.parse(action.after)
	const before = bodyBefore.parse(action.before)
	const outcome = await saveBlockText(executor, target.studentId, target.blockId, before.body, after.revision)
	if (outcome.kind === 'ok') return { ok: true }
	return { ok: false, issue: outcome.kind === 'not_found' ? 'not_found' : 'block_changed' }
}
