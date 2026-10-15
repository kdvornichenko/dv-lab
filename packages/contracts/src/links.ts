import type { ScheduleOccurrenceRef } from './schedule.ts'

export function encodeLessonRef(ref: ScheduleOccurrenceRef): string {
	return ref.kind === 'single' ? `single:${ref.lessonId}` : `series:${ref.seriesId}:${ref.originalOn}`
}

export function lessonLink(date: string, ref: ScheduleOccurrenceRef): string {
	return `/schedule?week=${date}&lesson=${encodeURIComponent(encodeLessonRef(ref))}`
}

export function studentPaymentsLink(studentId: string): string {
	return `/students/${studentId}?tab=payments`
}
