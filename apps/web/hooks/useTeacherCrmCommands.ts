'use client'

import { useCallback, type Dispatch, type SetStateAction } from 'react'

import { reportCrmError } from '@/hooks/teacherCrmErrors'
import {
	saveCurrentGoogleCalendarTokens,
	teacherCrmLessonApi,
	teacherCrmPaymentApi,
	teacherCrmStudentApi,
} from '@/lib/crm/api'
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

	const refreshInBackground = useCallback(() => {
		void refresh({ showLoading: false })
	}, [refresh])

	const ensureCalendarTokens = useCallback(async () => {
		try {
			await saveCurrentGoogleCalendarTokens()
		} catch (tokenError) {
			reportCrmError('Save Google Calendar token', tokenError)
		}
	}, [])

	const addStudent = useCallback(
		async (input: CreateStudentInput) => {
			await runCrmAction('Add student', async () => {
				const response = await teacherCrmStudentApi.createStudent(input)
				setState((current) => ({
					...current,
					students: [...current.students.filter((student) => student.id !== response.student.id), response.student],
				}))
				refreshInBackground()
			})
		},
		[refreshInBackground, runCrmAction, setState]
	)

	const updateStudent = useCallback(
		async (studentId: string, input: UpdateStudentInput) => {
			await runCrmAction('Update student', async () => {
				const response = await teacherCrmStudentApi.updateStudent(studentId, input)
				setState((current) => mergeStudentIntoState(current, response.student))
				refreshInBackground()
			})
		},
		[refreshInBackground, runCrmAction, setState]
	)

	const archiveStudent = useCallback(
		async (studentId: string) => {
			await runCrmAction('Archive student', async () => {
				const response = await teacherCrmStudentApi.updateStudent(studentId, { status: 'archived' })
				setState((current) => mergeStudentIntoState(current, response.student))
				refreshInBackground()
			})
		},
		[refreshInBackground, runCrmAction, setState]
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
				refreshInBackground()
			})
		},
		[refreshInBackground, runCrmAction, setState]
	)

	const addLesson = useCallback(
		async (input: CreateLessonInput) => {
			await runCrmAction('Add lesson', async () => {
				await ensureCalendarTokens()
				const response = await teacherCrmLessonApi.createLesson(input)
				setState((current) => ({
					...current,
					lessons: [...current.lessons.filter((lesson) => lesson.id !== response.lesson.id), response.lesson],
				}))
				refreshInBackground()
			})
		},
		[ensureCalendarTokens, refreshInBackground, runCrmAction, setState]
	)

	const updateLesson = useCallback(
		async (lessonId: string, input: UpdateLessonInput) => {
			await runCrmAction('Update lesson', async () => {
				await ensureCalendarTokens()
				const response = await teacherCrmLessonApi.updateLesson(lessonId, input)
				setState((current) => ({
					...current,
					lessons: current.lessons.map((lesson) => (lesson.id === lessonId ? response.lesson : lesson)),
				}))
				refreshInBackground()
			})
		},
		[ensureCalendarTokens, refreshInBackground, runCrmAction, setState]
	)

	const deleteLesson = useCallback(
		async (lessonId: string) => {
			await runCrmAction('Delete lesson', async () => {
				await teacherCrmLessonApi.deleteLesson(lessonId)
				setState((current) => ({
					...current,
					lessons: current.lessons.filter((lesson) => lesson.id !== lessonId),
					attendance: current.attendance.filter((record) => record.lessonId !== lessonId),
					calendarSyncRecords: current.calendarSyncRecords.filter((record) => record.lessonId !== lessonId),
				}))
				refreshInBackground()
			})
		},
		[refreshInBackground, runCrmAction, setState]
	)

	const markAttendance = useCallback(
		async (input: MarkAttendanceInput) => {
			await runCrmAction('Mark attendance', async () => {
				const response = await teacherCrmLessonApi.markAttendance(input)
				setState((current) => {
					const key = (record: { lessonId: string; studentId: string }) => `${record.lessonId}:${record.studentId}`
					const nextAttendance = new Map(current.attendance.map((record) => [key(record), record]))
					for (const record of response.attendance) nextAttendance.set(key(record), record)
					return { ...current, attendance: Array.from(nextAttendance.values()) }
				})
				refreshInBackground()
			})
		},
		[refreshInBackground, runCrmAction, setState]
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
				const response = await teacherCrmPaymentApi.createPayment(input)
				setState((current) => ({
					...current,
					payments: [...current.payments.filter((payment) => payment.id !== response.payment.id), response.payment],
				}))
				refreshInBackground()
			})
		},
		[refreshInBackground, runCrmAction, setState]
	)

	const deletePayment = useCallback(
		async (paymentId: string) => {
			await runCrmAction('Delete payment', async () => {
				await teacherCrmPaymentApi.deletePayment(paymentId)
				setState((current) => ({
					...current,
					payments: current.payments.filter((payment) => payment.id !== paymentId),
				}))
				refreshInBackground()
			})
		},
		[refreshInBackground, runCrmAction, setState]
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
