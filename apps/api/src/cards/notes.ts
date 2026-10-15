import { and, asc, eq, isNull, sql } from 'drizzle-orm'

import type { SectionKind, StudentNote } from '@dv-lab/contracts'
import { type DbExecutor, studentNotes, students } from '@dv-lab/db'

export type NoteRetraction = { kind: 'retracted'; note: StudentNote } | { kind: 'changed' } | { kind: 'not_found' }

type NoteInput = { sectionKind: SectionKind; body: string }

const columns = {
	id: studentNotes.id,
	sectionKind: studentNotes.sectionKind,
	body: studentNotes.body,
	revision: studentNotes.revision,
	createdAt: studentNotes.createdAt,
	retractedAt: studentNotes.retractedAt,
}

type NoteRow = {
	id: string
	sectionKind: string
	body: string
	revision: number
	createdAt: Date
	retractedAt: Date | null
}

const toNote = (row: NoteRow): StudentNote => ({
	id: row.id,
	sectionKind: row.sectionKind as SectionKind,
	body: row.body,
	revision: row.revision,
	createdAt: row.createdAt.toISOString(),
	retractedAt: row.retractedAt ? row.retractedAt.toISOString() : null,
})

async function cardStatus(executor: DbExecutor, studentId: string): Promise<string | null> {
	const [row] = await executor.select({ status: students.status }).from(students).where(eq(students.id, studentId))
	return row?.status ?? null
}

export async function appendStudentNote(
	executor: DbExecutor,
	_accountId: string,
	studentId: string,
	input: NoteInput
): Promise<StudentNote | null> {
	if ((await cardStatus(executor, studentId)) !== 'active') return null
	const [row] = await executor
		.insert(studentNotes)
		.values({ studentId, sectionKind: input.sectionKind, body: input.body })
		.returning(columns)
	if (!row) throw new Error('student note insert returned no row')
	return toNote(row)
}

export async function listStudentNotes(
	executor: DbExecutor,
	_accountId: string,
	studentId: string
): Promise<StudentNote[] | null> {
	if ((await cardStatus(executor, studentId)) === null) return null
	const rows = await executor
		.select(columns)
		.from(studentNotes)
		.where(and(eq(studentNotes.studentId, studentId), isNull(studentNotes.retractedAt)))
		.orderBy(asc(studentNotes.createdAt), asc(studentNotes.id))
	return rows.map(toNote)
}

export async function retractStudentNote(
	executor: DbExecutor,
	_accountId: string,
	noteId: string,
	expectedRevision: number,
	studentId?: string
): Promise<NoteRetraction> {
	const [locked] = await executor
		.select({
			studentId: studentNotes.studentId,
			revision: studentNotes.revision,
			retractedAt: studentNotes.retractedAt,
		})
		.from(studentNotes)
		.where(eq(studentNotes.id, noteId))
		.for('update')
	if (!locked || (studentId !== undefined && locked.studentId !== studentId)) return { kind: 'not_found' }
	if (locked.retractedAt !== null || locked.revision !== expectedRevision) return { kind: 'changed' }
	const [row] = await executor
		.update(studentNotes)
		.set({ retractedAt: sql`now()`, revision: locked.revision + 1, updatedAt: sql`now()` })
		.where(eq(studentNotes.id, noteId))
		.returning(columns)
	if (!row) throw new Error('student note update returned no row')
	return { kind: 'retracted', note: toNote(row) }
}

export type NoteRestore = { kind: 'restored'; note: StudentNote } | { kind: 'changed' } | { kind: 'not_found' }

export async function restoreStudentNote(
	executor: DbExecutor,
	noteId: string,
	expectedRevision: number,
	studentId: string
): Promise<NoteRestore> {
	const [locked] = await executor
		.select({
			studentId: studentNotes.studentId,
			revision: studentNotes.revision,
			retractedAt: studentNotes.retractedAt,
		})
		.from(studentNotes)
		.where(eq(studentNotes.id, noteId))
		.for('update')
	if (!locked || locked.studentId !== studentId) return { kind: 'not_found' }
	if (locked.retractedAt === null || locked.revision !== expectedRevision) return { kind: 'changed' }
	const [row] = await executor
		.update(studentNotes)
		.set({ retractedAt: null, revision: locked.revision + 1, updatedAt: sql`now()` })
		.where(eq(studentNotes.id, noteId))
		.returning(columns)
	if (!row) throw new Error('student note update returned no row')
	return { kind: 'restored', note: toNote(row) }
}
