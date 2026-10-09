import { eq, sql } from 'drizzle-orm'

import { SECTION_KINDS, type SectionKind, type StudentSection } from '@dv-lab/contracts'
import { type DbExecutor, studentSections, students } from '@dv-lab/db'

type SectionInput = { kind: SectionKind; body: string }

const sectionColumns = {
	kind: studentSections.kind,
	body: studentSections.body,
	updatedAt: studentSections.updatedAt,
}

async function cardExists(executor: DbExecutor, studentId: string): Promise<boolean> {
	const [row] = await executor.select({ id: students.id }).from(students).where(eq(students.id, studentId))
	return row !== undefined
}

export async function listSections(executor: DbExecutor, studentId: string): Promise<StudentSection[] | null> {
	if (!(await cardExists(executor, studentId))) return null
	const rows = await executor
		.select(sectionColumns)
		.from(studentSections)
		.where(eq(studentSections.studentId, studentId))
	const saved = new Map(rows.map((row) => [row.kind, row]))
	return SECTION_KINDS.map((kind) => {
		const row = saved.get(kind)
		return { kind, body: row?.body ?? '', updatedAt: row ? row.updatedAt.toISOString() : null }
	})
}

export async function saveSection(
	executor: DbExecutor,
	studentId: string,
	kind: SectionKind,
	body: string
): Promise<StudentSection | null> {
	if (!(await cardExists(executor, studentId))) return null
	const [row] = await executor
		.insert(studentSections)
		.values({ studentId, kind, body })
		.onConflictDoUpdate({
			target: [studentSections.studentId, studentSections.kind],
			set: { body, updatedAt: sql`now()` },
		})
		.returning(sectionColumns)
	if (!row) throw new Error('student section upsert returned no row')
	return { kind, body: row.body, updatedAt: row.updatedAt.toISOString() }
}

export async function addMissingSections(
	executor: DbExecutor,
	studentId: string,
	sections: readonly SectionInput[]
): Promise<number> {
	if (sections.length === 0) return 0
	const inserted = await executor
		.insert(studentSections)
		.values(sections.map(({ kind, body }) => ({ studentId, kind, body })))
		.onConflictDoNothing({ target: [studentSections.studentId, studentSections.kind] })
		.returning({ kind: studentSections.kind })
	return inserted.length
}
