import { diffLines } from 'diff'

import { CHAT_NOTE_CHANGED_LINES_MAX } from '@dv-lab/contracts'

export type NoteLine = { kind: 'same' | 'added' | 'removed'; text: string }

export type NoteHunks = { hunks: { lines: NoteLine[] }[]; more: number }

const CONTEXT_LINES = 2

export function noteLines(text: string): string[] {
	const lines = text
		.replace(/\r\n?/gu, '\n')
		.split('\n')
		.map((line) => line.trimEnd())
	while (lines.length > 0 && lines.at(-1) === '') lines.pop()
	return lines
}

export function noteText(text: string): string {
	return noteLines(text).join('\n')
}

export function sameNote(before: string, after: string): boolean {
	return noteText(before) === noteText(after)
}

export function isAddition(before: string, after: string): boolean {
	const old = noteLines(before)
	const next = noteLines(after)
	if (next.length === 0) return false
	let at = 0
	for (const line of next) if (at < old.length && line === old[at]) at += 1
	return at === old.length
}

export type ReviewKept = { text: string; kept: string[] }

function editDistance(left: readonly string[], right: readonly string[], limit: number): number {
	if (Math.abs(left.length - right.length) > limit) return limit + 1
	let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
	for (let row = 1; row <= left.length; row++) {
		const current = [row]
		let best = row
		for (let column = 1; column <= right.length; column++) {
			const cost = left[row - 1] === right[column - 1] ? 0 : 1
			const value = Math.min(
				(previous[column] ?? 0) + 1,
				(current[column - 1] ?? 0) + 1,
				(previous[column - 1] ?? 0) + cost
			)
			current.push(value)
			best = Math.min(best, value)
		}
		if (best > limit) return limit + 1
		previous = current
	}
	return previous[right.length] ?? limit + 1
}

function typoLimit(line: readonly string[]): number {
	return Math.max(2, Math.floor(line.length / 10))
}

export function reviewKeptText(before: string, after: string): ReviewKept {
	const old = noteLines(before)
	const next = noteLines(after)
	const mapped: (number | null)[] = old.map(() => null)
	const accepted = old.map((line) => line === '')
	const taken = new Set<number>()
	old.forEach((line, index) => {
		if (line === '') return
		const at = next.indexOf(line)
		if (at < 0) return
		accepted[index] = true
		mapped[index] = at
		taken.add(at)
	})
	const oldSet = new Set(old)
	next.forEach((line, index) => {
		if (oldSet.has(line)) taken.add(index)
	})
	old.forEach((line, index) => {
		if (accepted[index]) return
		const chars = Array.from(line)
		const limit = typoLimit(chars)
		const at = next.findIndex(
			(candidate, place) =>
				!taken.has(place) && candidate !== '' && editDistance(chars, Array.from(candidate), limit) <= limit
		)
		if (at < 0) return
		accepted[index] = true
		mapped[index] = at
		taken.add(at)
	})
	old.forEach((line, index) => {
		if (accepted[index]) return
		const twin = old.findIndex((other, place) => place !== index && other === line && accepted[place])
		if (twin < 0) return
		accepted[index] = true
		mapped[index] = mapped[twin] ?? null
	})
	const inserts = new Map<number, string[]>()
	const kept: string[] = []
	let anchor = -1
	old.forEach((line, index) => {
		const place = mapped[index]
		if (accepted[index]) {
			if (place !== null && place !== undefined) anchor = place
			return
		}
		kept.push(line)
		inserts.set(anchor, [...(inserts.get(anchor) ?? []), line])
	})
	if (kept.length === 0) return { text: next.join('\n'), kept }
	const lines = [...(inserts.get(-1) ?? [])]
	next.forEach((line, index) => {
		lines.push(line, ...(inserts.get(index) ?? []))
	})
	return { text: lines.join('\n'), kept }
}

function flatLines(before: string, after: string): NoteLine[] {
	const asText = (text: string) => {
		const lines = noteLines(text)
		return lines.length === 0 ? '' : `${lines.join('\n')}\n`
	}
	return diffLines(asText(before), asText(after)).flatMap((part) => {
		const kind: NoteLine['kind'] = part.added ? 'added' : part.removed ? 'removed' : 'same'
		const lines = part.value.split('\n')
		if (lines.at(-1) === '') lines.pop()
		return lines.map((text) => ({ kind, text }))
	})
}

export function noteHunks(before: string, after: string): NoteHunks {
	const lines = flatLines(before, after)
	const changed = lines.flatMap((line, index) => (line.kind === 'same' ? [] : [index]))
	const drawn = changed.slice(0, CHAT_NOTE_CHANGED_LINES_MAX)
	const shown = new Set<number>()
	for (const index of drawn) {
		shown.add(index)
		for (let near = index - CONTEXT_LINES; near <= index + CONTEXT_LINES; near++)
			if (lines[near]?.kind === 'same') shown.add(near)
	}
	const hunks: NoteHunks['hunks'] = []
	let previous = -2
	for (const index of [...shown].sort((left, right) => left - right)) {
		const line = lines[index]
		if (line === undefined) continue
		const last = hunks.at(-1)
		if (last !== undefined && index === previous + 1) last.lines.push(line)
		else hunks.push({ lines: [line] })
		previous = index
	}
	return { hunks, more: changed.length - drawn.length }
}
