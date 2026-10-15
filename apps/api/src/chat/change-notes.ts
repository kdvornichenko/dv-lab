import { z } from 'zod'

import type { ChatChangeIssue, ChatNoteChangeBlock, NoteBlock } from '@dv-lab/contracts'
import { type DbExecutor, chatActions } from '@dv-lab/db'

import { deleteBlock, lockLiveBlock, restoreBlock, saveBlockText } from '../cards/blocks.ts'
import { isAddition, noteHunks, noteText, sameNote } from '../cards/note-diff.ts'
import type { ActionSource, ChatContext } from './actions.ts'
import { insertAction } from './messages.ts'
import {
	type NoteCard,
	type NoteOutcome,
	type NoteUndo,
	alreadyWritten,
	appendToBlock,
	blockIssue,
	blockTarget,
	deleteEmptyBlock,
	noteCard,
	noteChange,
} from './note-writes.ts'
import type { ToolContext } from './tool-registry.ts'

const guard = z.strictObject({ blockRevision: z.number().int().min(1) })

export const noteTargets = [
	z.strictObject({
		operation: z.literal('update_block'),
		studentId: z.uuid(),
		blockId: z.uuid(),
		after: z.string(),
		guard,
	}),
	z.strictObject({ operation: z.literal('delete_block'), studentId: z.uuid(), blockId: z.uuid(), guard }),
] as const

const noteTarget = z.discriminatedUnion('operation', noteTargets)

type NoteTarget = z.infer<typeof noteTarget>

export type NoteApplied =
	| { kind: 'applied'; after: { studentId: string; blockId: string; revision: number } }
	| { kind: 'stale'; issue: ChatChangeIssue }

const appliedAfter = z.object({ revision: z.number().int().min(1) })

const bodyBefore = z.object({ body: z.string() })

async function propose(
	executor: DbExecutor,
	context: ChatContext,
	source: ActionSource,
	card: NoteCard,
	block: NoteBlock,
	target: NoteTarget
): Promise<ChatNoteChangeBlock> {
	const actionId = await insertAction(executor, {
		accountId: context.accountId,
		...source,
		kind: 'change',
		state: 'proposed',
		target,
		before: { body: block.body },
		result: { kind: 'proposed' },
	})
	const after = target.operation === 'update_block' ? target.after : ''
	return noteChange(actionId, 'proposal', card, blockTarget(block), target.operation, {
		...noteHunks(block.body, after),
		state: 'proposed',
	})
}

async function shown(context: ToolContext, tx: DbExecutor, block: ChatNoteChangeBlock | null): Promise<NoteOutcome> {
	if (block === null) return { kind: 'refused', code: 'block_not_found' }
	await context.persist(tx, block)
	return { kind: 'block', block }
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
		if (sameNote(block.body, next))
			return shown(context, tx, await alreadyWritten(tx, context.chat, context.source, card, blockTarget(block)))
		if (isAddition(block.body, next))
			return shown(context, tx, await appendToBlock(tx, context.chat, context.source, card, block, next))
		const target: NoteTarget = {
			operation: 'update_block',
			studentId,
			blockId,
			after: next,
			guard: { blockRevision: block.revision },
		}
		return shown(context, tx, await propose(tx, context.chat, context.source, card, block, target))
	})
}

export function removeNoteBlock(context: ToolContext, studentId: string, blockId: string): Promise<NoteOutcome> {
	return context.db.transaction(async (tx): Promise<NoteOutcome> => {
		const card = await noteCard(tx, studentId)
		if (card === null) return { kind: 'refused', code: 'student_not_found' }
		const block = await lockLiveBlock(tx, studentId, blockId)
		if (block === null) return { kind: 'refused', code: 'block_not_found' }
		if (block.body.trim() === '')
			return shown(context, tx, await deleteEmptyBlock(tx, context.chat, context.source, card, block))
		const target: NoteTarget = {
			operation: 'delete_block',
			studentId,
			blockId,
			guard: { blockRevision: block.revision },
		}
		return shown(context, tx, await propose(tx, context.chat, context.source, card, block, target))
	})
}

export async function applyNoteChange(tx: DbExecutor, target: NoteTarget): Promise<NoteApplied> {
	const outcome =
		target.operation === 'update_block'
			? await saveBlockText(tx, target.studentId, target.blockId, target.after, target.guard.blockRevision)
			: await deleteBlock(tx, target.studentId, target.blockId, target.guard.blockRevision)
	if (outcome.kind === 'not_found') return { kind: 'stale', issue: 'not_found' }
	if (outcome.kind === 'changed') return { kind: 'stale', issue: 'entry_changed' }
	return {
		kind: 'applied',
		after: { studentId: target.studentId, blockId: target.blockId, revision: outcome.block.revision },
	}
}

export function isNoteProposal(action: Pick<typeof chatActions.$inferSelect, 'kind' | 'target'>): boolean {
	return action.kind === 'change' && noteTarget.safeParse(action.target).success
}

export async function undoNoteProposal(
	executor: DbExecutor,
	action: Pick<typeof chatActions.$inferSelect, 'target' | 'before' | 'after'>
): Promise<NoteUndo> {
	const target = noteTarget.parse(action.target)
	const after = appliedAfter.parse(action.after)
	const outcome =
		target.operation === 'update_block'
			? await saveBlockText(
					executor,
					target.studentId,
					target.blockId,
					bodyBefore.parse(action.before).body,
					after.revision
				)
			: await restoreBlock(executor, target.studentId, target.blockId, after.revision)
	return outcome.kind === 'ok' ? { ok: true } : { ok: false, issue: blockIssue(outcome.kind) }
}
