import type { Lesson, Student } from '@teacher-crm/api-types'

export function formatMoney(value: number) {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		maximumFractionDigits: 0,
	}).format(value)
}

export function formatTime(value: string) {
	return new Intl.DateTimeFormat('en-US', {
		hour: '2-digit',
		minute: '2-digit',
	}).format(new Date(value))
}

export function studentNames(lesson: Lesson, students: Student[]) {
	const names = lesson.studentIds.map((id) => students.find((student) => student.id === id)?.fullName).filter(Boolean)
	return names.length > 0 ? names.join(', ') : 'No students'
}
