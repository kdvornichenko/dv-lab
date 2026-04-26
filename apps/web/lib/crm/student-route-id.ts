import type { Student } from '@teacher-crm/api-types'

function compactId(value: string, length: number) {
	const compacted = value.replace(/[^a-zA-Z0-9]/g, '')
	return compacted.slice(0, Math.min(length, compacted.length)) || value
}

export function studentRouteId(studentId: string, allStudentIds: readonly string[]) {
	const maxLength = studentId.replace(/[^a-zA-Z0-9]/g, '').length || studentId.length

	for (let length = 8; length <= maxLength; length += 1) {
		const candidate = compactId(studentId, length)
		const duplicateCount = allStudentIds.filter((id) => compactId(id, length) === candidate).length
		if (duplicateCount <= 1) return candidate
	}

	return studentId
}

export function studentSettingsPath(studentId: string, allStudentIds: readonly string[]) {
	return `/students/${studentRouteId(studentId, allStudentIds)}`
}

export function findStudentByRouteId<T extends Student>(students: readonly T[], routeId: string) {
	const ids = students.map((student) => student.id)
	return students.find((student) => student.id === routeId || studentRouteId(student.id, ids) === routeId) ?? null
}
