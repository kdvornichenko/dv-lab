import type { ChatActionLinkBlock, ScheduleOccurrenceRef } from '@dv-lab/contracts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/

export function isCalendarDay(value: string | null | undefined): value is string {
	if (value === null || value === undefined || !DATE.test(value)) return false
	const parsed = new Date(`${value}T00:00:00Z`)
	return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function encodeLessonRef(ref: ScheduleOccurrenceRef): string {
	return ref.kind === 'single' ? `single:${ref.lessonId}` : `series:${ref.seriesId}:${ref.originalOn}`
}

export function parseLessonRef(value: string | null | undefined): ScheduleOccurrenceRef | null {
	if (value === null || value === undefined) return null
	const [kind, id, on, ...rest] = value.split(':')
	if (rest.length > 0 || id === undefined || !UUID.test(id)) return null
	if (kind === 'single' && on === undefined) return { kind: 'single', lessonId: id }
	if (kind === 'series' && isCalendarDay(on)) return { kind: 'series', seriesId: id, originalOn: on }
	return null
}

export function lessonHref(date: string, ref: ScheduleOccurrenceRef): string {
	return `/schedule?week=${date}&lesson=${encodeURIComponent(encodeLessonRef(ref))}`
}

export function dayHref(date: string): string {
	return `/schedule?week=${date}&day=${date}`
}

export function studentHref(studentId: string, params?: Record<string, string>): string {
	const query = params === undefined ? '' : `?${new URLSearchParams(params).toString()}`
	return `/students/${studentId}${query}`
}

export function actionLinkHref(block: ChatActionLinkBlock): string | null {
	if (block.kind === 'schedule_day') return isCalendarDay(block.date) ? dayHref(block.date) : null
	if (block.kind === 'settings') return block.tab === null ? '/settings' : `/settings?tab=${block.tab}`
	if (block.studentId === null || block.studentName === null) return null
	if (block.kind === 'payments')
		return studentHref(block.studentId, {
			tab: 'payments',
			...(block.dialog === 'payment' ? { dialog: 'payment' } : {}),
		})
	if (block.kind === 'overview')
		return studentHref(block.studentId, block.dialog === 'details' ? { dialog: 'details' } : undefined)
	return studentHref(block.studentId, { tab: block.kind })
}
