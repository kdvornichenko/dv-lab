'use client'

import { useCallback } from 'react'

import { teacherCrmStudentApi } from '@/lib/crm/api'
import { mergeStudentIntoState } from '@/lib/crm/state'

import type { CreateStudentInput, UpdateStudentInput } from '@teacher-crm/api-types'

import type { TeacherCrmCommandBaseDeps } from './useTeacherCrmCommands.types'

export function useTeacherCrmStudentCommands({
	refreshAfterMutation,
	runCrmAction,
	setState,
}: TeacherCrmCommandBaseDeps) {
	const addStudent = useCallback(
		async (input: CreateStudentInput) => {
			await runCrmAction('Add student', async () => {
				const response = await teacherCrmStudentApi.createStudent(input)
				setState((current) => ({
					...current,
					students: [...current.students.filter((student) => student.id !== response.student.id), response.student],
				}))
				await refreshAfterMutation()
			})
		},
		[refreshAfterMutation, runCrmAction, setState]
	)

	const updateStudent = useCallback(
		async (studentId: string, input: UpdateStudentInput) => {
			await runCrmAction('Update student', async () => {
				const response = await teacherCrmStudentApi.updateStudent(studentId, input)
				setState((current) => mergeStudentIntoState(current, response.student))
				await refreshAfterMutation()
			})
		},
		[refreshAfterMutation, runCrmAction, setState]
	)

	const archiveStudent = useCallback(
		async (studentId: string) => {
			await runCrmAction('Archive student', async () => {
				const response = await teacherCrmStudentApi.updateStudent(studentId, { status: 'archived' })
				setState((current) => mergeStudentIntoState(current, response.student))
				await refreshAfterMutation()
			})
		},
		[refreshAfterMutation, runCrmAction, setState]
	)

	const deleteStudent = useCallback(
		async (studentId: string) => {
			await runCrmAction('Delete student', async () => {
				await teacherCrmStudentApi.deleteStudent(studentId)
				setState((current) => ({
					...current,
					students: current.students.filter((student) => student.id !== studentId),
					lessons: current.lessons.flatMap((lesson) => {
						if (!lesson.studentIds.includes(studentId)) return [lesson]
						const studentIds = lesson.studentIds.filter((id) => id !== studentId)
						return studentIds.length > 0 ? [{ ...lesson, studentIds }] : []
					}),
					attendance: current.attendance.filter((record) => record.studentId !== studentId),
					payments: current.payments.filter((payment) => payment.studentId !== studentId),
					studentBalances: current.studentBalances.filter((balance) => balance.studentId !== studentId),
				}))
				await refreshAfterMutation()
			})
		},
		[refreshAfterMutation, runCrmAction, setState]
	)

	return { addStudent, updateStudent, archiveStudent, deleteStudent }
}
