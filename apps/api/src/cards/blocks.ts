import { and, eq, isNull, sql } from 'drizzle-orm'

import { type NoteBlock, SECTION_KINDS, type SectionKind } from '@dv-lab/contracts'
import { type DbExecutor, studentSections, students } from '@dv-lab/db'

export type BlockWrite = { kind: 'ok'; block: NoteBlock } | { kind: 'changed' } | { kind: 'not_found' }

const STANDARD_NAMES: Record<SectionKind, string> = {
	general_info: 'General info',
	interests: 'Interests',
	level: 'Level',
	goals: 'Goals',
	typical_mistakes: 'Typical mistakes',
	lesson_ideas: 'Lesson ideas',
}

export function standardBlocks(studentId: string) {
	return SECTION_KINDS.map((kind, index) => ({
		studentId,
		kind,
		body: '',
		name: STANDARD_NAMES[kind],
		position: index + 1,
	}))
}

export function standardBlock(kind: SectionKind) {
	return { name: STANDARD_NAMES[kind], position: SECTION_KINDS.indexOf(kind) + 1 }
}

const blockColumns = {
	id: studentSections.id,
	studentId: studentSections.studentId,
	kind: studentSections.kind,
	name: studentSections.name,
	body: studentSections.body,
	position: studentSections.position,
	revision: studentSections.revision,
	updatedAt: studentSections.updatedAt,
	deletedAt: studentSections.deletedAt,
}

type BlockRow = {
	id: string
	studentId: string
	kind: string
	name: string | null
	body: string
	position: number | null
	revision: number
	updatedAt: Date
	deletedAt: Date | null
}

export function isStandardKind(key: string): key is SectionKind {
	return (SECTION_KINDS as readonly string[]).includes(key)
}

const standardRank = (key: string) => (isStandardKind(key) ? SECTION_KINDS.indexOf(key) : SECTION_KINDS.length)

function blockName(row: Pick<BlockRow, 'kind' | 'name'>): string {
	if (row.name !== null) return row.name
	return isStandardKind(row.kind) ? STANDARD_NAMES[row.kind] : row.kind
}

function compareRows(left: BlockRow, right: BlockRow): number {
	const leftPosition = left.position ?? Number.POSITIVE_INFINITY
	const rightPosition = right.position ?? Number.POSITIVE_INFINITY
	if (leftPosition !== rightPosition) return leftPosition < rightPosition ? -1 : 1
	const rank = standardRank(left.kind) - standardRank(right.kind)
	if (rank !== 0) return rank
	return left.kind < right.kind ? -1 : left.kind > right.kind ? 1 : 0
}

function toBlock(row: BlockRow, fallbackPosition: number): NoteBlock {
	return {
		id: row.id,
		key: row.kind,
		name: blockName(row),
		body: row.body,
		position: row.position ?? fallbackPosition,
		revision: row.revision,
		updatedAt: row.updatedAt.toISOString(),
		standard: isStandardKind(row.kind),
	}
}

async function cardExists(executor: DbExecutor, studentId: string): Promise<boolean> {
	const [row] = await executor.select({ id: students.id }).from(students).where(eq(students.id, studentId))
	return row !== undefined
}

async function liveRows(executor: DbExecutor, studentId: string): Promise<BlockRow[]> {
	const rows = await executor
		.select(blockColumns)
		.from(studentSections)
		.where(and(eq(studentSections.studentId, studentId), isNull(studentSections.deletedAt)))
	return rows.sort(compareRows)
}

export async function listBlocks(executor: DbExecutor, studentId: string): Promise<NoteBlock[] | null> {
	if (!(await cardExists(executor, studentId))) return null
	const rows = await liveRows(executor, studentId)
	return rows.map((row, index) => toBlock(row, index + 1))
}

async function lockBlock(executor: DbExecutor, studentId: string, blockId: string): Promise<BlockRow | null> {
	const [row] = await executor.select(blockColumns).from(studentSections).where(eq(studentSections.id, blockId)).for('update')
	return row && row.studentId === studentId ? row : null
}

async function writeBlock(
	executor: DbExecutor,
	blockId: string,
	values: Partial<typeof studentSections.$inferInsert>,
	revision: number
): Promise<NoteBlock> {
	const [row] = await executor
		.update(studentSections)
		.set({ ...values, revision: revision + 1, updatedAt: sql`now()` })
		.where(eq(studentSections.id, blockId))
		.returning(blockColumns)
	if (!row) throw new Error('note block update returned no row')
	return toBlock(row, row.position ?? standardRank(row.kind) + 1)
}

export async function saveBlockText(
	executor: DbExecutor,
	studentId: string,
	blockId: string,
	body: string,
	expectedRevision: number
): Promise<BlockWrite> {
	const locked = await lockBlock(executor, studentId, blockId)
	if (!locked || locked.deletedAt !== null) return { kind: 'not_found' }
	if (locked.revision !== expectedRevision) return { kind: 'changed' }
	return { kind: 'ok', block: await writeBlock(executor, blockId, { body }, locked.revision) }
}
