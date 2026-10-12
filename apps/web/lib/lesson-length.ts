import { LESSON_MINUTES_MAX, LESSON_MINUTES_MIN } from '@dv-lab/contracts'

export const LENGTH_HELPER = 'Minutes or h:mm.'

export function parseLength(text: string): number | null {
	const trimmed = text.trim()
	if (/^\d+$/.test(trimmed)) return Number(trimmed)
	const match = /^(\d+):(\d{1,2})$/.exec(trimmed)
	if (!match) return null
	const minutes = Number(match[2])
	return minutes < 60 ? Number(match[1]) * 60 + minutes : null
}

export function formatLength(minutes: number): string {
	return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
}

export function normalizeLength(text: string): string {
	const minutes = parseLength(text)
	return minutes === null ? text.trim() : formatLength(minutes)
}

export function lengthError(text: string): string | undefined {
	const minutes = parseLength(text)
	if (minutes === null || minutes === 0) return 'Enter the length.'
	if (minutes < LESSON_MINUTES_MIN || minutes > LESSON_MINUTES_MAX)
		return `Use ${formatLength(LESSON_MINUTES_MIN)} to ${formatLength(LESSON_MINUTES_MAX)}.`
	return undefined
}
