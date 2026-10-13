import { inArray } from 'drizzle-orm'

import { splitsSurrogatePair, type MentionBinding } from '@dv-lab/contracts'
import { students, type DbExecutor } from '@dv-lab/db'

export type MentionCheck = { kind: 'ok'; bindings: MentionBinding[] } | { kind: 'stale'; studentId: string }

function sameName(left: string, right: string): boolean {
	return left.normalize('NFC').trim() === right.normalize('NFC').trim()
}

function placed(text: string, binding: MentionBinding): boolean {
	return (
		binding.start < binding.end &&
		binding.end <= text.length &&
		!splitsSurrogatePair(text, binding.start) &&
		!splitsSurrogatePair(text, binding.end) &&
		text.slice(binding.start, binding.end) === binding.text
	)
}

function overlapping(bindings: readonly MentionBinding[]): boolean {
	const sorted = [...bindings].sort((left, right) => left.start - right.start)
	return sorted.some((binding, index) => index > 0 && binding.start < sorted[index - 1]!.end)
}

export async function validateMentions(
	executor: DbExecutor,
	_accountId: string,
	text: string,
	bindings: readonly MentionBinding[]
): Promise<MentionCheck> {
	const misplaced = bindings.find((binding) => !placed(text, binding))
	if (misplaced) return { kind: 'stale', studentId: misplaced.studentId }
	if (overlapping(bindings)) return { kind: 'stale', studentId: bindings[0]!.studentId }
	const ids = [...new Set(bindings.map((binding) => binding.studentId))]
	const rows = ids.length
		? await executor
				.select({ id: students.id, displayName: students.displayName, status: students.status })
				.from(students)
				.where(inArray(students.id, ids))
		: []
	const byId = new Map(rows.map((row) => [row.id, row]))
	for (const binding of bindings) {
		const row = byId.get(binding.studentId)
		if (!row || row.status !== 'active' || !sameName(row.displayName, binding.text))
			return { kind: 'stale', studentId: binding.studentId }
	}
	return { kind: 'ok', bindings: [...bindings].sort((left, right) => left.start - right.start) }
}
