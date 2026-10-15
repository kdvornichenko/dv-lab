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
