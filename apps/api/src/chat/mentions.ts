import { inArray } from 'drizzle-orm'

import { CHAT_MENTIONS_MAX, splitsSurrogatePair, type MentionBinding } from '@dv-lab/contracts'
import { students, type DbExecutor } from '@dv-lab/db'

import { listLessonStudents } from '../cards/cards.ts'

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

export async function studentNames(executor: DbExecutor, ids: readonly string[]): Promise<Map<string, string>> {
	const wanted = [...new Set(ids)]
	if (wanted.length === 0) return new Map()
	const rows = await executor
		.select({ id: students.id, displayName: students.displayName })
		.from(students)
		.where(inArray(students.id, wanted))
	return new Map(rows.map((row) => [row.id, row.displayName]))
}

const NAME_MAX = 200

function escape(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

export function replyMentions(body: string, people: ReadonlyMap<string, string>): MentionBinding[] {
	const taken: MentionBinding[] = []
	const named = [...people]
		.map(([studentId, name]) => ({ studentId, name: name.normalize('NFC').trim() }))
		.filter((person) => person.name.length >= 2 && person.name.length <= NAME_MAX)
		.sort((left, right) => right.name.length - left.name.length)
	for (const person of named) {
		const pattern = new RegExp(`(?<![\\p{L}\\p{Nd}])${escape(person.name)}(?![\\p{L}\\p{Nd}])`, 'giu')
		for (const match of body.matchAll(pattern)) {
			const start = match.index
			const end = start + match[0].length
			if (taken.some((binding) => start < binding.end && binding.start < end)) continue
			taken.push({ studentId: person.studentId, text: match[0], start, end })
			break
		}
	}
	return taken.sort((left, right) => left.start - right.start)
}

const WORD = /[\p{L}\p{N}\p{M}]/u

function nameKey(value: string): string {
	return value.normalize('NFC').toLocaleLowerCase()
}

function wordBefore(text: string, at: number): boolean {
	const before = Array.from(text.slice(Math.max(0, at - 2), at)).at(-1)
	return before !== undefined && WORD.test(before)
}

function wordAfter(text: string, end: number): boolean {
	const after = text.codePointAt(end)
	return after !== undefined && WORD.test(String.fromCodePoint(after))
}

export async function typedMentions(
	executor: DbExecutor,
	text: string,
	bindings: readonly MentionBinding[]
): Promise<MentionBinding[]> {
	if (!text.includes('@') || bindings.length >= CHAT_MENTIONS_MAX) return []
	const byKey = new Map<string, string[]>()
	const lengths = new Set<number>()
	for (const row of await listLessonStudents(executor)) {
		const name = row.displayName.normalize('NFC').trim()
		if (name === '') continue
		const key = nameKey(name)
		byKey.set(key, [...(byKey.get(key) ?? []), row.id])
		for (const length of [name.length, name.normalize('NFD').length]) if (length <= NAME_MAX) lengths.add(length)
	}
	const longestFirst = [...lengths].sort((left, right) => right - left)
	const found: MentionBinding[] = []
	let free = 0
	for (let at = text.indexOf('@'); at >= 0; at = text.indexOf('@', at + 1)) {
		if (bindings.length + found.length >= CHAT_MENTIONS_MAX) break
		if (at < free || wordBefore(text, at)) continue
		const start = at + 1
		for (const length of longestFirst) {
			const end = start + length
			if (end > text.length || splitsSurrogatePair(text, end) || wordAfter(text, end)) continue
			const ids = byKey.get(nameKey(text.slice(start, end)))
			if (ids === undefined) continue
			free = end
			const covered = bindings.some((binding) => start < binding.end && binding.start < end)
			if (ids.length === 1 && !covered) found.push({ studentId: ids[0]!, text: text.slice(start, end), start, end })
			break
		}
	}
	return found
}
