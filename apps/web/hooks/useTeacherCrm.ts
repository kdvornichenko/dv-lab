'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { toast } from 'sonner'

import { loadTeacherCrm, teacherCrmApi } from '@/lib/crm/api'
import { saveCrmError } from '@/lib/crm/error-log'
import type { StudentWithBalance, TeacherCrmState, TeacherCrmSummary } from '@/lib/crm/types'

import {
	GOOGLE_CALENDAR_REQUIRED_SCOPES,
	LESSON_PRICE_RUB,
	type CreateLessonInput,
	type CreatePaymentInput,
	type CreateStudentInput,
	type Student,
	type UpdateLessonInput,
	type UpdateStudentInput,
} from '@teacher-crm/api-types'

const now = () => new Date().toISOString()
const emptySummary: TeacherCrmSummary = {
	activeStudents: 0,
	todayLessons: 0,
	missingAttendance: 0,
	overdueStudents: 0,
	monthIncome: 0,
}

const emptyTeacherCrmState: TeacherCrmState = {
	students: [],
	lessons: [],
	attendance: [],
	payments: [],
	studentBalances: [],
	calendarConnection: {
		id: 'cal_empty',
		provider: 'google',
		email: null,
		status: 'not_connected',
		requiredScopes: [...GOOGLE_CALENDAR_REQUIRED_SCOPES],
		grantedScopes: [],
		tokenAvailable: false,
		selectedCalendarId: null,
		selectedCalendarName: null,
		connectedAt: null,
		updatedAt: new Date(0).toISOString(),
	},
	calendarSyncRecords: [],
}

const emptyBalance = (studentId: string) => ({
	studentId,
	balance: 0,
	unpaidLessonCount: 0,
	overdue: false,
})

function crmErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : 'Teacher CRM API request failed'
}

function reportCrmError(source: string, error: unknown) {
	const message = crmErrorMessage(error)
	saveCrmError({ source, message })
	toast.error('CRM request failed', { description: message })
}

export function useTeacherCrm() {
	const [state, setState] = useState<TeacherCrmState>(emptyTeacherCrmState)
	const [summary, setSummary] = useState<TeacherCrmSummary>(emptySummary)
	const [studentFilter, setStudentFilter] = useState<'all' | Student['status']>('all')
	const [isLoading, setIsLoading] = useState(true)

	const refresh = useCallback(async () => {
		setIsLoading(true)
		try {
			const next = await loadTeacherCrm()
			setState(next.state)
			setSummary(next.summary)
		} catch (refreshError) {
			reportCrmError('Load CRM data', refreshError)
		} finally {
			setIsLoading(false)
		}
	}, [])

	useEffect(() => {
		void refresh()
	}, [refresh])

	const studentRows = useMemo<StudentWithBalance[]>(
		() =>
			state.students.map((student) => ({
				...student,
				balance: state.studentBalances.find((balance) => balance.studentId === student.id) ?? emptyBalance(student.id),
			})),
		[state.studentBalances, state.students]
	)
	const visibleStudents = useMemo(
		() => studentRows.filter((student) => studentFilter === 'all' || student.status === studentFilter),
		[studentFilter, studentRows]
	)

	async function runCrmAction(source: string, action: () => Promise<void>) {
		try {
			await action()
		} catch (actionError) {
			reportCrmError(source, actionError)
			throw actionError
		}
	}

	async function addStudent(input: CreateStudentInput) {
		await runCrmAction('Add student', async () => {
			await teacherCrmApi.createStudent(input)
			await refresh()
		})
	}

	async function updateStudent(studentId: string, input: UpdateStudentInput) {
		await runCrmAction('Update student', async () => {
			await teacherCrmApi.updateStudent(studentId, input)
			await refresh()
		})
	}

	async function archiveStudent(studentId: string) {
		await runCrmAction('Archive student', async () => {
			await teacherCrmApi.updateStudent(studentId, { status: 'archived' })
			await refresh()
		})
	}

	async function deleteStudent(studentId: string) {
		await runCrmAction('Delete student', async () => {
			await teacherCrmApi.deleteStudent(studentId)
			await refresh()
		})
	}

	async function addLesson(input: CreateLessonInput) {
		await runCrmAction('Add lesson', async () => {
			await teacherCrmApi.createLesson(input)
			await refresh()
		})
	}

	async function updateLesson(lessonId: string, input: UpdateLessonInput) {
		await runCrmAction('Update lesson', async () => {
			await teacherCrmApi.updateLesson(lessonId, input)
			await refresh()
		})
	}

	async function markGroupAttended(lessonId: string) {
		const lesson = state.lessons.find((item) => item.id === lessonId)
		if (!lesson) return

		await runCrmAction('Mark attendance', async () => {
			await teacherCrmApi.markAttendance({
				lessonId,
				records: lesson.studentIds.map((studentId) => ({
					studentId,
					status: 'attended',
					billable: true,
				})),
			})
			await refresh()
		})
	}

	async function recordPayment(studentId: string) {
		const student = state.students.find((item) => item.id === studentId)
		const amount =
			student?.billingMode === 'package' && student.packageTotalPrice > 0
				? student.packageTotalPrice
				: (student?.defaultLessonPrice ?? LESSON_PRICE_RUB.default)
		const input: CreatePaymentInput = {
			studentId,
			amount,
			paidAt: now(),
			method: 'bank_transfer',
			comment: 'Manual payment',
		}
		await runCrmAction('Record payment', async () => {
			await teacherCrmApi.createPayment(input)
			await refresh()
		})
	}

	async function deletePayment(paymentId: string) {
		await runCrmAction('Delete payment', async () => {
			await teacherCrmApi.deletePayment(paymentId)
			await refresh()
		})
	}

	async function connectCalendar() {
		await runCrmAction('Connect calendar', async () => {
			await teacherCrmApi.connectCalendar()
			await refresh()
		})
	}

	async function syncLesson(lessonId: string) {
		await runCrmAction('Sync lesson', async () => {
			await teacherCrmApi.syncLesson(lessonId)
			await refresh()
		})
	}

	return {
		state,
		summary,
		visibleStudents,
		studentRows,
		studentFilter,
		setStudentFilter,
		isLoading,
		addStudent,
		updateStudent,
		archiveStudent,
		deleteStudent,
		addLesson,
		updateLesson,
		markGroupAttended,
		recordPayment,
		deletePayment,
		connectCalendar,
		syncLesson,
		refresh,
	}
}
