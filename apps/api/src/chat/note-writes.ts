import { eq } from 'drizzle-orm'
import { z } from 'zod'

import {
	type ChatNoteChangeBlock,
	type ChatNoteIssue,
	type NoteBlock,
	addTermRequest,
	createBlockRequest,
} from '@dv-lab/contracts'
import { type DbExecutor, chatActions, students } from '@dv-lab/db'

import {
	type BlockWrite,
	createBlock,
	deleteBlock,
	listBlocks,
	lockLiveBlock,
	restoreBlock,
	saveBlockText,
	standardBlock,
} from '../cards/blocks.ts'
import { noteHunks, noteText } from '../cards/note-diff.ts'
import { restoreStudentNote } from '../cards/notes.ts'
import { addTerm, deleteTerm, findLiveTerm, lockTerms, removeTerms, restoreTerm, updateTerm } from '../cards/terms.ts'
import type { ActionSource, ChatContext } from './actions.ts'
import { insertAction } from './messages.ts'
import type { ToolContext } from './tool-registry.ts'

export type NoteCard = { id: string; displayName: string }

export type NoteRefusal =
	'student_not_found' | 'block_not_found' | 'block_name_taken' | 'invalid_arguments' | 'terms_not_found'

export type NoteOutcome = { kind: 'block'; block: ChatNoteChangeBlock } | { kind: 'refused'; code: NoteRefusal }

export type NoteUndo = { ok: true } | { ok: false; issue?: ChatNoteIssue }

type NoteParts = Partial<Pick<ChatNoteChangeBlock, 'hunks' | 'more' | 'words' | 'state' | 'undo'>>

const blockRef = { studentId: z.uuid(), blockId: z.uuid() }

const noteTarget = z.discriminatedUnion('op', [
	z.object({ op: z.literal('block_text'), ...blockRef }),
	z.object({ op: z.literal('block_create'), ...blockRef }),
	z.object({ op: z.literal('block_delete'), ...blockRef }),
	z.object({ op: z.literal('words_add'), studentId: z.uuid() }),
	z.object({ op: z.literal('words_remove'), studentId: z.uuid() }),
	z.object({ op: z.literal('review'), studentId: z.uuid() }),
])

const termSnapshot = z.object({ termId: z.uuid(), term: z.string(), note: z.string().nullable() })

const reviewBefore = z.object({
	blocks: z.array(z.object({ blockId: z.uuid(), body: z.string(), revision: z.number().int().min(1) })),
	words: z.array(termSnapshot),
})

const reviewAfter = z.object({
	blocks: z.array(z.object({ blockId: z.uuid(), revision: z.number().int().min(1) })),
	words: z.array(termSnapshot),
	removedWords: z.array(z.uuid()),
	entries: z.array(z.object({ entryId: z.uuid(), revision: z.number().int().min(1) })),
})

export type ReviewRecord = { before: z.infer<typeof reviewBefore>; after: z.infer<typeof reviewAfter> }

export type ReviewEnd = 'nothing' | 'changed'

const revisionAfter = z.object({ revision: z.number().int().min(1) })

const wordsAdded = z.object({
	words: z.array(z.object({ termId: z.uuid(), term: z.string(), note: z.string().nullable(), restored: z.boolean() })),
})

const wordsRemoved = z.object({ termIds: z.array(z.uuid()) })

const GENERAL_INFO = 'general_info'

type WordInput = { term: string; note: string | null }

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

export function blockIssue(outcome: Exclude<BlockWrite['kind'], 'ok'> | 'name_taken'): ChatNoteIssue {
	if (outcome === 'not_found') return 'not_found'
	if (outcome === 'name_taken') return 'name_taken'
	return 'block_changed'
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

export async function deleteEmptyBlock(
	executor: DbExecutor,
	context: ChatContext,
	source: ActionSource,
	card: NoteCard,
	block: NoteBlock
): Promise<ChatNoteChangeBlock | null> {
	const deleted = await deleteBlock(executor, card.id, block.id, block.revision)
	if (deleted.kind !== 'ok') return null
	const actionId = await receiptAction(executor, context, source, {
		target: { op: 'block_delete', studentId: card.id, blockId: block.id },
		after: { revision: deleted.block.revision },
	})
	return noteChange(actionId, 'receipt', card, blockTarget(block), 'deleted')
}

export function createNoteBlock(
	context: ToolContext,
	studentId: string,
	name: string,
	text: string
): Promise<NoteOutcome> {
	return context.db.transaction(async (tx): Promise<NoteOutcome> => {
		const input = createBlockRequest.safeParse({ name, body: noteText(text) })
		if (!input.success) return { kind: 'refused', code: 'invalid_arguments' }
		const card = await noteCard(tx, studentId)
		if (card === null) return { kind: 'refused', code: 'student_not_found' }
		const created = await createBlock(tx, studentId, input.data)
		if (created.kind === 'name_taken') return { kind: 'refused', code: 'block_name_taken' }
		if (created.kind !== 'ok') return { kind: 'refused', code: 'student_not_found' }
		const actionId = await receiptAction(tx, context.chat, context.source, {
			target: { op: 'block_create', studentId, blockId: created.block.id },
			after: { revision: created.block.revision },
		})
		const shown = noteChange(
			actionId,
			'receipt',
			card,
			blockTarget(created.block),
			'created',
			noteHunks('', created.block.body)
		)
		await context.persist(tx, shown)
		return { kind: 'block', block: shown }
	})
}

const WORDS_CHANGED: NoteUndo = { ok: false, issue: 'words_changed' }

async function undoWordsAdded(
	executor: DbExecutor,
	studentId: string,
	after: z.infer<typeof wordsAdded>
): Promise<NoteUndo> {
	const ids = after.words.map((word) => word.termId)
	const rows = new Map((await lockTerms(executor, studentId, ids)).map((row) => [row.id, row]))
	const unchanged = after.words.every((word) => {
		const row = rows.get(word.termId)
		return row !== undefined && row.removedAt === null && row.term === word.term && row.note === word.note
	})
	if (!unchanged) return WORDS_CHANGED
	for (const word of after.words.filter((item) => !item.restored))
		if (!(await deleteTerm(executor, studentId, word.termId))) throw new Error('chat word undo deleted no row')
	const restored = after.words.filter((word) => word.restored).map((word) => word.termId)
	await removeTerms(executor, studentId, restored, 'chat')
	return { ok: true }
}

async function undoWordsRemoved(
	executor: DbExecutor,
	studentId: string,
	after: z.infer<typeof wordsRemoved>
): Promise<NoteUndo> {
	const rows = new Map((await lockTerms(executor, studentId, after.termIds)).map((row) => [row.id, row]))
	if (!after.termIds.every((id) => rows.get(id)?.removedAt != null)) return WORDS_CHANGED
	for (const id of after.termIds) {
		const restored = await restoreTerm(executor, studentId, id)
		if (restored.kind !== 'restored') throw new Error('chat word undo restored no row')
	}
	return { ok: true }
}

export function addVocabulary(
	context: ToolContext,
	studentId: string,
	words: readonly WordInput[]
): Promise<NoteOutcome> {
	return context.db.transaction(async (tx): Promise<NoteOutcome> => {
		const parsed = words.map((word) => addTermRequest.safeParse(word))
		const valid = parsed.flatMap((item) => (item.success ? [item.data] : []))
		if (valid.length !== words.length) return { kind: 'refused', code: 'invalid_arguments' }
		const card = await noteCard(tx, studentId)
		if (card === null) return { kind: 'refused', code: 'student_not_found' }
		const seen = new Set<string>()
		const shownWords: ChatNoteChangeBlock['words'] = []
		const added: z.infer<typeof wordsAdded>['words'] = []
		for (const word of valid) {
			const key = word.term.toLocaleLowerCase()
			if (seen.has(key)) continue
			seen.add(key)
			const outcome = await addTerm(tx, studentId, word, { addedBy: 'chat' })
			if (outcome.kind === 'added') {
				const { id: termId, term, note } = outcome.term
				added.push({ termId, term, note, restored: outcome.restored })
				shownWords.push({ termId, term, state: outcome.restored ? 'restored' : 'added' })
				continue
			}
			const live = outcome.kind === 'term_exists' ? await findLiveTerm(tx, studentId, word.term) : null
			if (live === null) return { kind: 'refused', code: 'student_not_found' }
			shownWords.push({ termId: live.id, term: live.term, state: 'already' })
		}
		const target: ChatNoteChangeBlock['target'] = { kind: 'vocabulary' }
		if (added.length === 0) {
			const already = await alreadyWritten(tx, context.chat, context.source, card, target)
			const shown = { ...already, words: shownWords }
			await context.persist(tx, shown)
			return { kind: 'block', block: shown }
		}
		const actionId = await receiptAction(tx, context.chat, context.source, {
			target: { op: 'words_add', studentId },
			after: { words: added },
		})
		const shown = noteChange(actionId, 'receipt', card, target, 'words_added', { words: shownWords })
		await context.persist(tx, shown)
		return { kind: 'block', block: shown }
	})
}

export function removeVocabulary(
	context: ToolContext,
	studentId: string,
	termIds: readonly string[]
): Promise<NoteOutcome> {
	return context.db.transaction(async (tx): Promise<NoteOutcome> => {
		const card = await noteCard(tx, studentId)
		if (card === null) return { kind: 'refused', code: 'student_not_found' }
		const removed = await removeTerms(tx, studentId, [...new Set(termIds)], 'chat')
		if (removed.length === 0) return { kind: 'refused', code: 'terms_not_found' }
		const actionId = await receiptAction(tx, context.chat, context.source, {
			target: { op: 'words_remove', studentId },
			after: { termIds: removed.map((term) => term.id) },
		})
		const shown = noteChange(actionId, 'receipt', card, { kind: 'vocabulary' }, 'words_removed', {
			words: removed.map((term) => ({ termId: term.id, term: term.term, state: 'removed' as const })),
		})
		await context.persist(tx, shown)
		return { kind: 'block', block: shown }
	})
}

export async function appendNoteLine(
	executor: DbExecutor,
	context: ChatContext,
	source: ActionSource,
	studentId: string,
	line: string
): Promise<ChatNoteChangeBlock | null> {
	const card = await noteCard(executor, studentId)
	if (card === null) return null
	const blocks = (await listBlocks(executor, studentId)) ?? []
	let chosen = blocks.find((block) => block.key === GENERAL_INFO) ?? blocks[0]
	if (chosen === undefined) {
		const created = await createBlock(executor, studentId, { name: standardBlock(GENERAL_INFO).name, body: '' })
		if (created.kind !== 'ok') return null
		chosen = created.block
	}
	const block = await lockLiveBlock(executor, studentId, chosen.id)
	if (block === null) return null
	const current = noteText(block.body)
	const added = noteText(line)
	return appendToBlock(executor, context, source, card, block, current === '' ? added : `${current}\n${added}`)
}

const REVIEW_CHANGED: NoteUndo = { ok: false, issue: 'block_changed' }

async function undoReview(
	executor: DbExecutor,
	studentId: string,
	before: ReviewRecord['before'],
	after: ReviewRecord['after']
): Promise<NoteUndo> {
	const blockRevisions = new Map(after.blocks.map((block) => [block.blockId, block.revision]))
	for (const block of before.blocks) {
		const revision = blockRevisions.get(block.blockId)
		if (revision === undefined) return REVIEW_CHANGED
		const saved = await saveBlockText(executor, studentId, block.blockId, block.body, revision)
		if (saved.kind !== 'ok') return REVIEW_CHANGED
	}
	const written = new Map(after.words.map((word) => [word.termId, word]))
	for (const word of before.words) {
		const current = written.get(word.termId)
		if (current === undefined) return REVIEW_CHANGED
		const expected = { term: current.term, note: current.note, removedAt: null }
		const reverted = await updateTerm(executor, studentId, word.termId, { term: word.term, note: word.note }, expected)
		if (reverted.kind !== 'ok') return REVIEW_CHANGED
	}
	const removed = await lockTerms(executor, studentId, after.removedWords)
	const stillRemoved =
		removed.length === after.removedWords.length &&
		removed.every((term) => term.removedAt !== null && term.removedBy === 'review')
	if (!stillRemoved) return REVIEW_CHANGED
	for (const termId of after.removedWords)
		if ((await restoreTerm(executor, studentId, termId)).kind !== 'restored') return REVIEW_CHANGED
	for (const entry of after.entries)
		if ((await restoreStudentNote(executor, entry.entryId, entry.revision, studentId)).kind !== 'restored')
			return REVIEW_CHANGED
	return { ok: true }
}

export function reviewAction(
	executor: DbExecutor,
	context: ChatContext,
	source: ActionSource,
	studentId: string,
	record: ReviewRecord | ReviewEnd
): Promise<string> {
	const target = { op: 'review', studentId }
	if (typeof record === 'string')
		return insertAction(executor, {
			accountId: context.accountId,
			...source,
			kind: 'note',
			state: 'refused',
			target,
			result: { kind: record },
		})
	return receiptAction(executor, context, source, { target, ...record })
}

export function isNoteWrite(action: Pick<typeof chatActions.$inferSelect, 'kind' | 'target'>): boolean {
	return action.kind === 'note' && noteTarget.safeParse(action.target).success
}

export async function undoNoteWrite(
	executor: DbExecutor,
	action: Pick<typeof chatActions.$inferSelect, 'target' | 'before' | 'after'>
): Promise<NoteUndo> {
	const target = noteTarget.parse(action.target)
	if (target.op === 'words_add') return undoWordsAdded(executor, target.studentId, wordsAdded.parse(action.after))
	if (target.op === 'words_remove')
		return undoWordsRemoved(executor, target.studentId, wordsRemoved.parse(action.after))
	if (target.op === 'review')
		return undoReview(executor, target.studentId, reviewBefore.parse(action.before), reviewAfter.parse(action.after))
	const after = revisionAfter.parse(action.after)
	const outcome =
		target.op === 'block_text'
			? await saveBlockText(
					executor,
					target.studentId,
					target.blockId,
					bodyBefore.parse(action.before).body,
					after.revision
				)
			: target.op === 'block_create'
				? await deleteBlock(executor, target.studentId, target.blockId, after.revision)
				: await restoreBlock(executor, target.studentId, target.blockId, after.revision)
	return outcome.kind === 'ok' ? { ok: true } : { ok: false, issue: blockIssue(outcome.kind) }
}
