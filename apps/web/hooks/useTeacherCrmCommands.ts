'use client'

import { useCallback, type Dispatch, type SetStateAction } from 'react'

import { reportCrmError } from '@/hooks/teacherCrmErrors'
import { teacherCrmLessonApi, teacherCrmPaymentApi, teacherCrmStudentApi } from '@/lib/crm/api'
import { mergeStudentIntoState } from '@/lib/crm/state'
import type { TeacherCrmState } from '@/lib/crm/types'

import type {
	CreateLessonInput,
	CreatePaymentInput,
	CreateStudentInput,
	Lesson,
	MarkAttendanceInput,
	UpdateLessonInput,
	UpdateStudentInput,
} from '@teacher-crm/api-types'

type RefreshTeacherCrm = (options?: { showLoading?: boolean }) => Promise<void>

export function useTeacherCrmCommands({
	lessons,
	refresh,
	setState,
}: {
	lessons: Lesson[]
	refresh: RefreshTeacherCrm
	setState: Dispatch<SetStateAction<TeacherCrmState>>
}) {
	const runCrmAction = useCallback(async (source: string, action: () => Promise<void>) => {
		try {
			await action()
		} catch (actionError) {
			reportCrmError(source, actionError)
			throw actionError
		}
	}, [])

	const addStudent = useCallback(
		async (input: CreateStudentInput) => {
			await runCrmAction('Add student', async () => {
				await teacherCrmStudentApi.createStudent(input)
				await refresh()
			})
		},
		[refresh, runCrmAction]
	)

	const updateStudent = useCallback(
		async (studentId: string, input: UpdateStudentInput) => {
			await runCrmAction('Update student', async () => {
				const response = await teacherCrmStudentApi.updateStudent(studentId, input)
				setState((current) => mergeStudentIntoState(current, response.student))
				await refresh()
			})
		},
		[refresh, runCrmAction, setState]
	)

	const archiveStudent = useCallback(
		async (studentId: string) => {
			await runCrmAction('Archive student', async () => {
				await teacherCrmStudentApi.updateStudent(studentId, { status: 'archived' })
				await refresh()
			})
		},
		[refresh, runCrmAction]
	)

	const deleteStudent = useCallback(
		async (studentId: string) => {
			await runCrmAction('Delete student', async () => {
				await teacherCrmStudentApi.deleteStudent(studentId)
				await refresh()
			})
		},
		[refresh, runCrmAction]
	)

	const addLesson = useCallback(
		async (input: CreateLessonInput) => {
			await runCrmAction('Add lesson', async () => {
				await teacherCrmLessonApi.createLesson(input)
				await refresh()
			})
		},
		[refresh, runCrmAction]
	)

	const updateLesson = useCallback(
		async (lessonId: string, input: UpdateLessonInput) => {
			await runCrmAction('Update lesson', async () => {
				await teacherCrmLessonApi.updateLesson(lessonId, input)
				await refresh()
			})
		},
		[refresh, runCrmAction]
	)

	const deleteLesson = useCallback(
		async (lessonId: string) => {
			await runCrmAction('Delete lesson', async () => {
				await teacherCrmLessonApi.deleteLesson(lessonId)
				await refresh()
			})
		},
		[refresh, runCrmAction]
	)

	const markAttendance = useCallback(
		async (input: MarkAttendanceInput) => {
			await runCrmAction('Mark attendance', async () => {
				await teacherCrmLessonApi.markAttendance(input)
				await refresh()
			})
		},
		[refresh, runCrmAction]
	)

	const markGroupAttended = useCallback(
		async (lessonId: string) => {
			const lesson = lessons.find((item) => item.id === lessonId)
			if (!lesson) return

			await markAttendance({
				lessonId,
				records: lesson.studentIds.map((studentId) => ({
					studentId,
					status: 'attended',
					billable: true,
				})),
			})
		},
		[lessons, markAttendance]
	)

	const recordPayment = useCallback(
		async (input: CreatePaymentInput) => {
			await runCrmAction('Record payment', async () => {
				await teacherCrmPaymentApi.createPayment(input)
				await refresh()
			})
		},
		[refresh, runCrmAction]
	)

	const deletePayment = useCallback(
		async (paymentId: string) => {
			await runCrmAction('Delete payment', async () => {
				await teacherCrmPaymentApi.deletePayment(paymentId)
				await refresh()
			})
		},
		[refresh, runCrmAction]
	)

	return {
		addStudent,
		updateStudent,
		archiveStudent,
		deleteStudent,
		addLesson,
		updateLesson,
		deleteLesson,
		markAttendance,
		markGroupAttended,
		recordPayment,
		deletePayment,
	}
}
