'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { toast } from 'sonner'

import { loadTeacherCrm, saveCurrentGoogleCalendarTokens, teacherCrmApi } from '@/lib/crm/api'
import { saveCrmError } from '@/lib/crm/error-log'
import { getPackageTotalPrice } from '@/lib/crm/model'
import type { StudentWithBalance, TeacherCrmState, TeacherCrmSummary } from '@/lib/crm/types'

import {
	GOOGLE_CALENDAR_REQUIRED_SCOPES,
	type CalendarBusyInterval,
	type CalendarListEntry,
	type CreateLessonInput,
	type CreatePaymentInput,
	type CreateStudentInput,
	type MarkAttendanceInput,
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
	calendarOptions: [],
	calendarSyncRecords: [],
}

type TeacherCrmPageCache = {
	state: TeacherCrmState
	summary: TeacherCrmSummary
	calendarOptions: CalendarListEntry[]
}

let teacherCrmPageCache: TeacherCrmPageCache | null = null

const emptyBalance = (studentId: string) => ({
	studentId,
	balance: 0,
	unpaidLessonCount: 0,
	overdue: false,
})

function mergeStudentIntoState(state: TeacherCrmState, student: Student): TeacherCrmState {
	return {
		...state,
		students: state.students.map((item) => (item.id === student.id ? student : item)),
	}
}

function mergeStudentIntoCache(student: Student) {
	if (!teacherCrmPageCache) return
	teacherCrmPageCache = {
		...teacherCrmPageCache,
		state: mergeStudentIntoState(teacherCrmPageCache.state, student),
	}
}

function crmErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : 'Teacher CRM API request failed'
}

function reportCrmError(source: string, error: unknown) {
	const message = crmErrorMessage(error)
	void saveCrmError({ source, message }).catch((logError) => {
		console.error('[teacher-crm] failed to persist CRM error', logError)
	})
	toast.error('CRM request failed', { description: message })
}

export function useTeacherCrm() {
	const [state, setState] = useState<TeacherCrmState>(() => teacherCrmPageCache?.state ?? emptyTeacherCrmState)
	const [summary, setSummary] = useState<TeacherCrmSummary>(() => teacherCrmPageCache?.summary ?? emptySummary)
	const [studentFilter, setStudentFilter] = useState<'all' | Student['status']>('all')
	const [isLoading, setIsLoading] = useState(!teacherCrmPageCache)
	const [calendarOptions, setCalendarOptions] = useState<CalendarListEntry[]>(
		() => teacherCrmPageCache?.calendarOptions ?? []
	)
	const [isCalendarImporting, setIsCalendarImporting] = useState(false)
	const calendarTokenSyncAttemptedRef = useRef(false)
	const calendarImportInFlightRef = useRef(false)
	const lastCalendarImportAtRef = useRef(0)

	const refresh = useCallback(async (options: { showLoading?: boolean } = {}) => {
		const showLoading = options.showLoading ?? !teacherCrmPageCache
		if (showLoading) setIsLoading(true)
		try {
			const next = await loadTeacherCrm()
			const nextCalendarOptions =
				next.state.calendarConnection.status === 'connected' ? (teacherCrmPageCache?.calendarOptions ?? []) : []
			setState(next.state)
			setSummary(next.summary)
			setCalendarOptions(nextCalendarOptions)
			teacherCrmPageCache = {
				state: next.state,
				summary: next.summary,
				calendarOptions: nextCalendarOptions,
			}
		} catch (refreshError) {
			reportCrmError('Load CRM data', refreshError)
		} finally {
			setIsLoading(false)
		}
	}, [])

	useEffect(() => {
		void refresh({ showLoading: !teacherCrmPageCache })
	}, [refresh])

	useEffect(() => {
		if (calendarTokenSyncAttemptedRef.current) return

		let cancelled = false
		calendarTokenSyncAttemptedRef.current = true
		saveCurrentGoogleCalendarTokens()
			.then((result) => {
				if (!cancelled && result.saved) void refresh({ showLoading: false })
			})
			.catch((error) => {
				if (!cancelled) reportCrmError('Save Google Calendar token', error)
			})

		return () => {
			cancelled = true
		}
	}, [refresh])

	useEffect(() => {
		const canLoadCalendars = state.calendarConnection.status === 'connected' && state.calendarConnection.tokenAvailable
		if (!canLoadCalendars) {
			setCalendarOptions([])
			if (teacherCrmPageCache) teacherCrmPageCache = { ...teacherCrmPageCache, calendarOptions: [] }
			return
		}

		let cancelled = false
		teacherCrmApi
			.listCalendars()
			.then((response) => {
				if (!cancelled) {
					setCalendarOptions(response.calendars)
					if (teacherCrmPageCache) {
						teacherCrmPageCache = { ...teacherCrmPageCache, calendarOptions: response.calendars }
					}
				}
			})
			.catch((error) => {
				if (!cancelled) reportCrmError('Load calendars', error)
			})

		return () => {
			cancelled = true
		}
	}, [state.calendarConnection.status, state.calendarConnection.tokenAvailable, state.calendarConnection.updatedAt])

	useEffect(() => {
		const canImport =
			state.calendarConnection.status === 'connected' &&
			state.calendarConnection.tokenAvailable &&
			Boolean(state.calendarConnection.selectedCalendarId)
		if (!canImport) return

		let cancelled = false
		const importCalendarChanges = (force = false) => {
			const nowMs = Date.now()
			if (calendarImportInFlightRef.current) return
			if (!force && nowMs - lastCalendarImportAtRef.current < 60_000) return

			calendarImportInFlightRef.current = true
			lastCalendarImportAtRef.current = nowMs
			setIsCalendarImporting(true)
			teacherCrmApi
				.importCalendarEvents()
				.then((response) => {
					if (!cancelled && response.updated > 0) void refresh({ showLoading: false })
				})
				.catch((error) => {
					if (!cancelled) reportCrmError('Import Google Calendar changes', error)
				})
				.finally(() => {
					calendarImportInFlightRef.current = false
					if (!cancelled) setIsCalendarImporting(false)
				})
		}

		const handleFocus = () => importCalendarChanges()
		const handleVisibilityChange = () => {
			if (document.visibilityState === 'visible') importCalendarChanges()
		}
		const intervalId = window.setInterval(() => importCalendarChanges(), 60_000)
		window.addEventListener('focus', handleFocus)
		document.addEventListener('visibilitychange', handleVisibilityChange)

		return () => {
			cancelled = true
			window.clearInterval(intervalId)
			window.removeEventListener('focus', handleFocus)
			document.removeEventListener('visibilitychange', handleVisibilityChange)
		}
	}, [
		refresh,
		state.calendarConnection.selectedCalendarId,
		state.calendarConnection.status,
		state.calendarConnection.tokenAvailable,
	])

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
			const response = await teacherCrmApi.updateStudent(studentId, input)
			setState((current) => mergeStudentIntoState(current, response.student))
			mergeStudentIntoCache(response.student)
			await refresh()
			mergeStudentIntoCache(response.student)
			setState((current) => mergeStudentIntoState(current, response.student))
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

	async function deleteLesson(lessonId: string) {
		await runCrmAction('Delete lesson', async () => {
			await teacherCrmApi.deleteLesson(lessonId)
			await refresh()
		})
	}

	async function markAttendance(input: MarkAttendanceInput) {
		await runCrmAction('Mark attendance', async () => {
			await teacherCrmApi.markAttendance(input)
			await refresh()
		})
	}

	async function markGroupAttended(lessonId: string) {
		const lesson = state.lessons.find((item) => item.id === lessonId)
		if (!lesson) return

		await markAttendance({
			lessonId,
			records: lesson.studentIds.map((studentId) => ({
				studentId,
				status: 'attended',
				billable: true,
			})),
		})
	}

	async function recordPayment(studentId: string) {
		const student = state.students.find((item) => item.id === studentId)
		const amount =
			student?.billingMode === 'package' && getPackageTotalPrice(student) > 0
				? getPackageTotalPrice(student)
				: (student?.defaultLessonPrice ?? 0)
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
		const needsCalendarToken =
			state.calendarConnection.status !== 'connected' || !state.calendarConnection.tokenAvailable
		if (needsCalendarToken) {
			try {
				const result = await saveCurrentGoogleCalendarTokens()
				if (result.saved) {
					await refresh({ showLoading: false })
					return
				}
			} catch (error) {
				reportCrmError('Save Google Calendar token', error)
			}
		}

		window.location.assign(`/auth/sign-in?next=${encodeURIComponent('/calendar')}`)
	}

	async function selectCalendar(calendarId: string, calendarName: string) {
		await runCrmAction('Select calendar', async () => {
			await teacherCrmApi.selectCalendar(calendarId, calendarName)
			await refresh()
		})
	}

	async function syncLesson(lessonId: string) {
		await runCrmAction('Sync lesson', async () => {
			await teacherCrmApi.syncLesson(lessonId)
			await refresh()
		})
	}

	async function checkCalendarConflicts(
		input: CreateLessonInput & { excludeLessonId?: string }
	): Promise<CalendarBusyInterval[]> {
		try {
			const response = await teacherCrmApi.listBusyIntervals({
				startsAt: input.startsAt,
				durationMinutes: input.durationMinutes,
				repeatWeekly: input.repeatWeekly,
				repeatCount: input.repeatCount,
				excludeLessonId: input.excludeLessonId,
			})
			return response.busy
		} catch (error) {
			const message = crmErrorMessage(error)
			void saveCrmError({ source: 'Check calendar conflicts', message }).catch((logError) => {
				console.error('[teacher-crm] failed to persist CRM error', logError)
			})
			return []
		}
	}

	return {
		state,
		summary,
		calendarOptions,
		isCalendarImporting,
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
		deleteLesson,
		markAttendance,
		markGroupAttended,
		recordPayment,
		deletePayment,
		connectCalendar,
		selectCalendar,
		syncLesson,
		checkCalendarConflicts,
		refresh,
	}
}
