import { SECTION_KINDS, type SectionKind, type StudentSection } from '@dv-lab/contracts'
import type { DbExecutor } from '@dv-lab/db'

import { fillStandardBlocks, standardRows, writeStandardText } from './blocks.ts'

type SectionInput = { kind: SectionKind; body: string }

export async function listSections(executor: DbExecutor, studentId: string): Promise<StudentSection[] | null> {
	const rows = await standardRows(executor, studentId)
	if (rows === null) return null
	return SECTION_KINDS.filter((kind) => !rows.get(kind)?.deletedAt).map((kind) => {
		const row = rows.get(kind)
		return { kind, body: row?.body ?? '', updatedAt: row ? row.updatedAt.toISOString() : null }
	})
}

export async function saveSection(
	executor: DbExecutor,
	studentId: string,
	kind: SectionKind,
	body: string
): Promise<StudentSection | null> {
	const row = await writeStandardText(executor, studentId, kind, body)
	return row === null ? null : { kind, body: row.body, updatedAt: row.updatedAt.toISOString() }
}

export function addMissingSections(
	executor: DbExecutor,
	studentId: string,
	sections: readonly SectionInput[]
): Promise<number> {
	return fillStandardBlocks(executor, studentId, sections)
}
