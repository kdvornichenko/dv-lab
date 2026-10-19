const REF_LENGTH = 8
const MESSAGE_REF = /^m?([0-9a-f]{8})$/u
const PROPOSAL_REF = /^p?([0-9a-f]{8})$/u
const MARKER = /\[Message (m[0-9a-f]{8})\]/gu

export const messageRef = (id: string) => `m${id.slice(0, REF_LENGTH)}`

export const proposalRef = (id: string) => `p${id.slice(0, REF_LENGTH)}`

export const messageMarker = (id: string) => `[Message ${messageRef(id)}]`

export function messagePrefix(ref: string): string | null {
	return MESSAGE_REF.exec(ref.trim().toLowerCase())?.[1] ?? null
}

export function proposalPrefix(ref: string): string | null {
	return PROPOSAL_REF.exec(ref.trim().toLowerCase())?.[1] ?? null
}

export function lastMarker(text: string): { ref: string; index: number } | null {
	const match = [...text.matchAll(MARKER)].at(-1)
	return match?.[1] === undefined ? null : { ref: match[1], index: match.index }
}
