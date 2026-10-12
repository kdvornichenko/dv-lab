export const LENGTH_HELPER = 'Hours and minutes.'
export const LENGTH_ERROR = 'Enter the length.'

const MAX_MINUTES = 99 * 60 + 59

export interface LengthDraft {
	hours: string
	minutes: string
}

function pad(value: number): string {
	return String(value).padStart(2, '0')
}

export function draftOf(total: number): LengthDraft {
	const clamped = Math.min(Math.max(Math.trunc(total), 0), MAX_MINUTES)
	return { hours: pad(Math.floor(clamped / 60)), minutes: pad(clamped % 60) }
}

export function totalOf(draft: LengthDraft): number {
	return Math.min(Number(draft.hours || 0) * 60 + Number(draft.minutes || 0), MAX_MINUTES)
}

export function normalizeDraft(draft: LengthDraft): { draft: LengthDraft; minutes: number | null } {
	const total = totalOf(draft)
	return { draft: draftOf(total), minutes: total > 0 ? total : null }
}

export function stepDraft(draft: LengthDraft, field: 'hours' | 'minutes', direction: 1 | -1): LengthDraft {
	return draftOf(totalOf(draft) + direction * (field === 'hours' ? 60 : 5))
}
