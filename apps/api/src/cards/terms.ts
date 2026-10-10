import { and, eq, sql } from 'drizzle-orm'

import type { StudentTerm } from '@dv-lab/contracts'
import { type DbExecutor, studentTerms, students, violatesUnique } from '@dv-lab/db'

type TermInput = { term: string; note: string | null }

type TermRow = typeof studentTerms.$inferSelect

export type AddTermResult = { kind: 'added'; term: StudentTerm } | { kind: 'term_exists' } | { kind: 'not_found' }

const termColumns = {
	id: studentTerms.id,
	term: studentTerms.term,
	note: studentTerms.note,
	createdAt: studentTerms.createdAt,
}

const toTerm = (row: Pick<TermRow, 'id' | 'term' | 'note' | 'createdAt'>): StudentTerm => ({
	id: row.id,
	term: row.term,
	note: row.note,
	createdAt: row.createdAt.toISOString(),
})

async function cardExists(executor: DbExecutor, studentId: string): Promise<boolean> {
	const [row] = await executor.select({ id: students.id }).from(students).where(eq(students.id, studentId))
	return row !== undefined
}

export async function listTerms(executor: DbExecutor, studentId: string): Promise<StudentTerm[] | null> {
	if (!(await cardExists(executor, studentId))) return null
	const rows = await executor
		.select(termColumns)
		.from(studentTerms)
		.where(eq(studentTerms.studentId, studentId))
		.orderBy(sql`lower(${studentTerms.term})`, studentTerms.id)
	return rows.map(toTerm)
}

export async function addTerm(executor: DbExecutor, studentId: string, input: TermInput): Promise<AddTermResult> {
	if (!(await cardExists(executor, studentId))) return { kind: 'not_found' }
	try {
		const [row] = await executor
			.insert(studentTerms)
			.values({ studentId, term: input.term, note: input.note })
			.returning(termColumns)
		if (!row) throw new Error('student term insert returned no row')
		return { kind: 'added', term: toTerm(row) }
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
