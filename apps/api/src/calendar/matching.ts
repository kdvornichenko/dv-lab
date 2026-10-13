import { normalizeDisplayName, type CalendarEventSuggestion } from '@dv-lab/contracts'

export type MatchStudent = { id: string; displayName: string }
export type StudentNames = ReadonlyMap<string, readonly string[]>
export type SuggestionCandidate = {
	eventId: string
	recurringEventId: string | null
	summary: string | null
	status: string
	eventType: string
	timed: boolean
	seriesRule: 'weekly' | 'other' | null
}

export function canonicalName(value: string): string {
	return normalizeDisplayName(value).normalize('NFC').toLowerCase()
}

export function studentNames(students: readonly MatchStudent[]): StudentNames {
	const names = new Map<string, string[]>()
	for (const student of students) {
		const key = canonicalName(student.displayName)
		if (!key) continue
		names.set(key, [...(names.get(key) ?? []), student.id])
	}
	return names
}

export function suggestionFor(
	event: SuggestionCandidate,
	students: StudentNames,
	ignores: ReadonlySet<string>
): CalendarEventSuggestion | null {
	if (event.eventType !== 'default' || event.status === 'cancelled' || !event.timed || event.summary === null)
		return null
	if (ignores.has(event.eventId) || (event.recurringEventId !== null && ignores.has(event.recurringEventId)))
		return null
	if (event.recurringEventId !== null && event.seriesRule !== 'weekly') return null
	const matches = students.get(canonicalName(event.summary)) ?? []
	if (matches.length !== 1) return null
	return { studentId: matches[0], scope: event.recurringEventId === null ? 'event' : 'series' }
}
