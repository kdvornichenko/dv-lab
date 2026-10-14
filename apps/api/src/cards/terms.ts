import { and, desc, eq, inArray, isNotNull, isNull, lt, sql } from 'drizzle-orm'

import type { StudentTerm, TermAddedBy, TermRemovedBy, TermView } from '@dv-lab/contracts'
import { type DbExecutor, studentTerms, students, violatesUnique } from '@dv-lab/db'

type TermInput = { term: string; note: string | null }

type TermRow = typeof studentTerms.$inferSelect

type AddTermOptions = { addedBy?: TermAddedBy }

export type AddTermResult =
	{ kind: 'added'; term: StudentTerm; restored: boolean } | { kind: 'term_exists' } | { kind: 'not_found' }

export type RestoreTermResult =
	{ kind: 'restored'; term: StudentTerm } | { kind: 'term_exists' } | { kind: 'not_found' }

const REMOVED_KEEP_MS = 30 * 24 * 60 * 60 * 1000

const termColumns = {
	id: studentTerms.id,
	term: studentTerms.term,
	note: studentTerms.note,
	createdAt: studentTerms.createdAt,
	addedBy: studentTerms.addedBy,
	removedAt: studentTerms.removedAt,
	removedBy: studentTerms.removedBy,
}

type TermRead = Pick<TermRow, 'id' | 'term' | 'note' | 'createdAt' | 'addedBy' | 'removedAt' | 'removedBy'>

const toTerm = (row: TermRead): StudentTerm => ({
	id: row.id,
	term: row.term,
	note: row.note,
	createdAt: row.createdAt.toISOString(),
	addedBy: row.addedBy as TermAddedBy | null,
	removedAt: row.removedAt ? row.removedAt.toISOString() : null,
	removedBy: row.removedBy as TermRemovedBy | null,
})

async function cardExists(executor: DbExecutor, studentId: string): Promise<boolean> {
	const [row] = await executor.select({ id: students.id }).from(students).where(eq(students.id, studentId))
	return row !== undefined
}

export async function listTerms(
	executor: DbExecutor,
	studentId: string,
	view: TermView = 'words'
): Promise<StudentTerm[] | null> {
	if (!(await cardExists(executor, studentId))) return null
	const query = executor.select(termColumns).from(studentTerms)
	const rows =
		view === 'removed'
			? await query
					.where(and(eq(studentTerms.studentId, studentId), isNotNull(studentTerms.removedAt)))
					.orderBy(desc(studentTerms.removedAt), studentTerms.id)
			: await query
					.where(and(eq(studentTerms.studentId, studentId), isNull(studentTerms.removedAt)))
					.orderBy(sql`lower(${studentTerms.term})`, studentTerms.id)
	return rows.map(toTerm)
}

export function listRemovedTerms(executor: DbExecutor, studentId: string): Promise<StudentTerm[] | null> {
	return listTerms(executor, studentId, 'removed')
}

export async function addTerm(
	executor: DbExecutor,
	studentId: string,
	input: TermInput,
	options: AddTermOptions = {}
): Promise<AddTermResult> {
	if (!(await cardExists(executor, studentId))) return { kind: 'not_found' }
	const addedBy = options.addedBy ?? null
	const [existing] = await executor
		.select({ id: studentTerms.id, removedAt: studentTerms.removedAt })
		.from(studentTerms)
		.where(and(eq(studentTerms.studentId, studentId), sql`lower(${studentTerms.term}) = lower(${input.term})`))
		.for('update')
	if (existing && existing.removedAt === null) return { kind: 'term_exists' }
	if (existing) {
		const [row] = await executor
			.update(studentTerms)
			.set({ term: input.term, note: input.note, addedBy, removedAt: null, removedBy: null })
			.where(eq(studentTerms.id, existing.id))
			.returning(termColumns)
		if (!row) throw new Error('student term restore returned no row')
		return { kind: 'added', term: toTerm(row), restored: true }
	}
	try {
		const [row] = await executor
			.insert(studentTerms)
			.values({ studentId, term: input.term, note: input.note, addedBy })
			.returning(termColumns)
		if (!row) throw new Error('student term insert returned no row')
		return { kind: 'added', term: toTerm(row), restored: false }
	} catch (error) {
		if (violatesUnique(error, 'student_terms_term_uq')) return { kind: 'term_exists' }
		throw error
	}
}

export async function updateTermNote(
	executor: DbExecutor,
	studentId: string,
	termId: string,
	note: string | null
): Promise<StudentTerm | null> {
	const [row] = await executor
		.update(studentTerms)
		.set({ note })
		.where(and(eq(studentTerms.id, termId), eq(studentTerms.studentId, studentId)))
		.returning(termColumns)
	return row ? toTerm(row) : null
}

export async function deleteTerm(executor: DbExecutor, studentId: string, termId: string): Promise<boolean> {
	const rows = await executor
		.delete(studentTerms)
		.where(and(eq(studentTerms.id, termId), eq(studentTerms.studentId, studentId)))
		.returning({ id: studentTerms.id })
	return rows.length > 0
}

export async function removeTerms(
	executor: DbExecutor,
	studentId: string,
	termIds: readonly string[],
	by: Exclude<TermRemovedBy, 'teacher'>
): Promise<StudentTerm[]> {
	if (termIds.length === 0) return []
	const rows = await executor
		.update(studentTerms)
		.set({ removedAt: sql`now()`, removedBy: by })
		.where(
			and(eq(studentTerms.studentId, studentId), inArray(studentTerms.id, [...termIds]), isNull(studentTerms.removedAt))
		)
		.returning(termColumns)
	return rows.map(toTerm)
}

export async function restoreTerm(executor: DbExecutor, studentId: string, termId: string): Promise<RestoreTermResult> {
	try {
		const [row] = await executor
			.update(studentTerms)
			.set({ removedAt: null, removedBy: null })
			.where(and(eq(studentTerms.id, termId), eq(studentTerms.studentId, studentId), isNotNull(studentTerms.removedAt)))
			.returning(termColumns)
		return row ? { kind: 'restored', term: toTerm(row) } : { kind: 'not_found' }
	} catch (error) {
		if (violatesUnique(error, 'student_terms_term_uq')) return { kind: 'term_exists' }
		throw error
	}
}

export async function purgeRemovedTerms(executor: DbExecutor, now: Date): Promise<number> {
	const rows = await executor
		.delete(studentTerms)
		.where(
			and(isNotNull(studentTerms.removedAt), lt(studentTerms.removedAt, new Date(now.getTime() - REMOVED_KEEP_MS)))
		)
		.returning({ id: studentTerms.id })
	return rows.length
}

export async function addMissingTerms(
	executor: DbExecutor,
	studentId: string,
	terms: readonly TermInput[]
): Promise<number> {
	if (terms.length === 0) return 0
	const inserted = await executor
		.insert(studentTerms)
		.values(terms.map(({ term, note }) => ({ studentId, term, note })))
		.onConflictDoNothing()
		.returning({ id: studentTerms.id })
	return inserted.length
}
