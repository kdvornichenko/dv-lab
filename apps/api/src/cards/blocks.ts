import { type SQL, and, eq, isNull, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { type NoteBlock, SECTION_KINDS, type SectionKind } from '@dv-lab/contracts'
import { type DbExecutor, studentSections, students, violatesUnique } from '@dv-lab/db'

export type BlockWrite = { kind: 'ok'; block: NoteBlock } | { kind: 'changed' } | { kind: 'not_found' }

export type BlockNameWrite = BlockWrite | { kind: 'name_taken' }

export type BlockOrder = { kind: 'ok'; blocks: NoteBlock[] } | { kind: 'changed' } | { kind: 'not_found' }

type BlockInput = { name: string; body: string }

type BlockOrderItem = { id: string; expectedRevision: number }

type StandardText = { kind: SectionKind; body: string }

type BlockValues = {
	[Key in keyof typeof studentSections.$inferInsert]?: (typeof studentSections.$inferInsert)[Key] | SQL
}

const NAME_INDEX = 'student_sections_name_uq'

const STANDARD_NAMES: Record<SectionKind, string> = {
	general_info: 'General info',
	interests: 'Interests',
	level: 'Level',
	goals: 'Goals',
	typical_mistakes: 'Typical mistakes',
	lesson_ideas: 'Lesson ideas',
}

export function standardBlock(kind: SectionKind) {
	return { name: STANDARD_NAMES[kind], position: SECTION_KINDS.indexOf(kind) + 1 }
}

export function standardBlocks(studentId: string) {
	return SECTION_KINDS.map((kind) => ({ studentId, kind, body: '', ...standardBlock(kind) }))
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

export type BlockRow = {
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

function toBlock(row: BlockRow, fallbackPosition = standardRank(row.kind) + 1): NoteBlock {
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

async function liveRows(executor: DbExecutor, studentId: string, lock = false): Promise<BlockRow[]> {
	const query = executor
		.select(blockColumns)
		.from(studentSections)
		.where(and(eq(studentSections.studentId, studentId), isNull(studentSections.deletedAt)))
	const rows = lock ? await query.for('update') : await query
	return rows.sort(compareRows)
}

export async function listBlocks(executor: DbExecutor, studentId: string): Promise<NoteBlock[] | null> {
	if (!(await cardExists(executor, studentId))) return null
	const rows = await liveRows(executor, studentId)
	return rows.map((row, index) => toBlock(row, index + 1))
}

export async function standardRows(
	executor: DbExecutor,
	studentId: string
): Promise<Map<SectionKind, BlockRow> | null> {
	if (!(await cardExists(executor, studentId))) return null
	const rows = await executor.select(blockColumns).from(studentSections).where(eq(studentSections.studentId, studentId))
	const standard = new Map<SectionKind, BlockRow>()
	for (const row of rows) if (isStandardKind(row.kind)) standard.set(row.kind, row)
	return standard
}

async function lockBlock(executor: DbExecutor, studentId: string, blockId: string): Promise<BlockRow | null> {
	const [row] = await executor
		.select(blockColumns)
		.from(studentSections)
		.where(eq(studentSections.id, blockId))
		.for('update')
	return row && row.studentId === studentId ? row : null
}

async function writeBlock(
	executor: DbExecutor,
	blockId: string,
	values: BlockValues,
	revision: number
): Promise<NoteBlock> {
	const [row] = await executor
		.update(studentSections)
		.set({ ...values, revision: revision + 1, updatedAt: sql`now()` })
		.where(eq(studentSections.id, blockId))
		.returning(blockColumns)
	if (!row) throw new Error('note block update returned no row')
	return toBlock(row)
}

async function guardName<T>(
	executor: DbExecutor,
	run: (executor: DbExecutor) => Promise<T>
): Promise<T | { kind: 'name_taken' }> {
	try {
		return await executor.transaction((savepoint) => run(savepoint))
	} catch (error) {
		if (violatesUnique(error, NAME_INDEX)) return { kind: 'name_taken' }
		throw error
	}
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

export async function createBlock(executor: DbExecutor, studentId: string, input: BlockInput): Promise<BlockNameWrite> {
	if (!(await cardExists(executor, studentId))) return { kind: 'not_found' }
	return guardName(executor, async (tx): Promise<BlockWrite> => {
		const [last] = await tx
			.select({ position: sql<number>`coalesce(max(${studentSections.position}), 0)::int` })
			.from(studentSections)
			.where(and(eq(studentSections.studentId, studentId), isNull(studentSections.deletedAt)))
		const [row] = await tx
			.insert(studentSections)
			.values({
				studentId,
				kind: `b_${randomUUID().replaceAll('-', '')}`,
				name: input.name,
				body: input.body,
				position: (last?.position ?? 0) + 1,
			})
			.returning(blockColumns)
		if (!row) throw new Error('note block insert returned no row')
		return { kind: 'ok', block: toBlock(row) }
	})
}

export function renameBlock(
	executor: DbExecutor,
	studentId: string,
	blockId: string,
	name: string,
	expectedRevision: number
): Promise<BlockNameWrite> {
	return guardName(executor, async (tx): Promise<BlockWrite> => {
		const locked = await lockBlock(tx, studentId, blockId)
		if (!locked || locked.deletedAt !== null) return { kind: 'not_found' }
		if (locked.revision !== expectedRevision) return { kind: 'changed' }
		return { kind: 'ok', block: await writeBlock(tx, blockId, { name }, locked.revision) }
	})
}

export async function deleteBlock(
	executor: DbExecutor,
	studentId: string,
	blockId: string,
	expectedRevision: number
): Promise<BlockWrite> {
	const locked = await lockBlock(executor, studentId, blockId)
	if (!locked || locked.deletedAt !== null) return { kind: 'not_found' }
	if (locked.revision !== expectedRevision) return { kind: 'changed' }
	return { kind: 'ok', block: await writeBlock(executor, blockId, { deletedAt: sql`now()` }, locked.revision) }
}

export function restoreBlock(
	executor: DbExecutor,
	studentId: string,
	blockId: string,
	expectedRevision: number
): Promise<BlockNameWrite> {
	return guardName(executor, async (tx): Promise<BlockWrite> => {
		const locked = await lockBlock(tx, studentId, blockId)
		if (!locked) return { kind: 'not_found' }
		if (locked.deletedAt === null || locked.revision !== expectedRevision) return { kind: 'changed' }
		return { kind: 'ok', block: await writeBlock(tx, blockId, { deletedAt: null }, locked.revision) }
	})
}

export async function reorderBlocks(
	executor: DbExecutor,
	studentId: string,
	order: readonly BlockOrderItem[]
): Promise<BlockOrder> {
	if (!(await cardExists(executor, studentId))) return { kind: 'not_found' }
	const rows = await liveRows(executor, studentId, true)
	const byId = new Map(rows.map((row) => [row.id, row]))
	const complete =
		order.length === rows.length &&
		new Set(order.map((item) => item.id)).size === order.length &&
		order.every((item) => byId.get(item.id)?.revision === item.expectedRevision)
	if (!complete) return { kind: 'changed' }
	const blocks: NoteBlock[] = []
	for (const [index, item] of order.entries()) {
		const row = byId.get(item.id)
		if (!row) return { kind: 'changed' }
		const position = index + 1
		blocks.push(
			row.position === position ? toBlock(row) : await writeBlock(executor, row.id, { position }, row.revision)
		)
	}
	return { kind: 'ok', blocks }
}

async function upsertStandardText(
	executor: DbExecutor,
	studentId: string,
	kind: SectionKind,
	body: string,
	named: boolean
): Promise<BlockRow> {
	const standard = standardBlock(kind)
	const [row] = await executor
		.insert(studentSections)
		.values({ studentId, kind, body, position: standard.position, name: named ? standard.name : null })
		.onConflictDoUpdate({
			target: [studentSections.studentId, studentSections.kind],
			set: {
				body,
				revision: sql`${studentSections.revision} + 1`,
				updatedAt: sql`now()`,
				deletedAt: null,
				...(named ? {} : { name: null }),
			},
		})
		.returning(blockColumns)
	if (!row) throw new Error('note block upsert returned no row')
	return row
}

export async function writeStandardText(
	executor: DbExecutor,
	studentId: string,
	kind: SectionKind,
	body: string
): Promise<BlockRow | null> {
	if (!(await cardExists(executor, studentId))) return null
	try {
		return await executor.transaction((savepoint) => upsertStandardText(savepoint, studentId, kind, body, true))
	} catch (error) {
		if (!violatesUnique(error, NAME_INDEX)) throw error
	}
	return upsertStandardText(executor, studentId, kind, body, false)
}

export async function fillStandardBlocks(
	executor: DbExecutor,
	studentId: string,
	texts: readonly StandardText[]
): Promise<number> {
	const firstByKind = new Map<SectionKind, string>()
	for (const { kind, body } of texts) if (!firstByKind.has(kind)) firstByKind.set(kind, body)
	if (firstByKind.size === 0) return 0
	const written = await executor
		.insert(studentSections)
		.values([...firstByKind].map(([kind, body]) => ({ studentId, kind, body, ...standardBlock(kind) })))
		.onConflictDoUpdate({
			target: [studentSections.studentId, studentSections.kind],
			set: {
				body: sql`excluded.body`,
				revision: sql`${studentSections.revision} + 1`,
				updatedAt: sql`now()`,
			},
			setWhere: sql`${studentSections.body} = '' and ${studentSections.deletedAt} is null and excluded.body <> ''`,
		})
		.returning({ kind: studentSections.kind })
	return written.length
}
