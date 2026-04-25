'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import type {
	CreateLessonInput,
	CreatePaymentInput,
	CreateStudentInput,
	Student,
	UpdateStudentInput,
} from '@teacher-crm/api-types'

import { loadTeacherCrm, teacherCrmApi } from './api'
import { initialTeacherCrmState } from './seed'
import type { StudentWithBalance, TeacherCrmState, TeacherCrmSummary } from './types'

const now = () => new Date().toISOString()
const emptySummary: TeacherCrmSummary = {
	activeStudents: 0,
	todayLessons: 0,
	missingAttendance: 0,
	overdueStudents: 0,
	monthIncome: 0,
}

const emptyBalance = (studentId: string) => ({
	studentId,
	balance: 0,
	unpaidLessonCount: 0,
	overdue: false,
})

export function useTeacherCrm() {
	const [state, setState] = useState<TeacherCrmState>(initialTeacherCrmState)
	const [summary, setSummary] = useState<TeacherCrmSummary>(emptySummary)
	const [studentFilter, setStudentFilter] = useState<'all' | Student['status']>('all')
	const [error, setError] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(true)

	const refresh = useCallback(async () => {
		setIsLoading(true)
		setError(null)
		try {
			const next = await loadTeacherCrm()
			setState(next.state)
			setSummary(next.summary)
		} catch (refreshError) {
			setError(refreshError instanceof Error ? refreshError.message : 'Teacher CRM API request failed')
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

	async function addStudent(input: CreateStudentInput) {
		await teacherCrmApi.createStudent(input)
		await refresh()
	}

	async function updateStudent(studentId: string, input: UpdateStudentInput) {
		await teacherCrmApi.updateStudent(studentId, input)
		await refresh()
	}

	async function archiveStudent(studentId: string) {
		await teacherCrmApi.updateStudent(studentId, { status: 'archived' })
		await refresh()
	}

	async function addLesson() {
		const firstActiveStudent = state.students.find((student) => student.status === 'active')
		if (!firstActiveStudent) return

		const startsAt = new Date()
		startsAt.setDate(startsAt.getDate() + 1)
		startsAt.setHours(16, 0, 0, 0)

		const input: CreateLessonInput = {
			title: 'New lesson',
			startsAt: startsAt.toISOString(),
			durationMinutes: 60,
			topic: 'Conversation',
			notes: '',
			status: 'planned',
			studentIds: [firstActiveStudent.id],
		}
		await teacherCrmApi.createLesson(input)
		await refresh()
	}

	async function markGroupAttended(lessonId: string) {
		const lesson = state.lessons.find((item) => item.id === lessonId)
		if (!lesson) return

		await teacherCrmApi.markAttendance({
			lessonId,
			records: lesson.studentIds.map((studentId) => ({
				studentId,
				status: 'attended',
				billable: true,
			})),
		})
		await refresh()
	}

	async function recordPayment(studentId: string) {
		const amount = state.students.find((student) => student.id === studentId)?.defaultLessonPrice ?? 35
		const input: CreatePaymentInput = {
			studentId,
			amount,
			paidAt: now(),
			method: 'bank_transfer',
			comment: 'Manual payment',
		}
		await teacherCrmApi.createPayment(input)
		await refresh()
	}

	async function connectCalendar() {
		await teacherCrmApi.connectCalendar()
		await refresh()
	}

	async function syncLesson(lessonId: string) {
		await teacherCrmApi.syncLesson(lessonId)
		await refresh()
	}

	return {
		state,
		summary,
		visibleStudents,
		studentRows,
		studentFilter,
		setStudentFilter,
		isLoading,
		error,
		addStudent,
		updateStudent,
		archiveStudent,
		addLesson,
		markGroupAttended,
		recordPayment,
		connectCalendar,
		syncLesson,
		refresh,
	}
}
