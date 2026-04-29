'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { reportCrmError } from '@/hooks/teacherCrmErrors'
import { loadTeacherCrm, loadTeacherCrmSupplements } from '@/lib/crm/api'
import { emptyBalance } from '@/lib/crm/state'
import type { StudentWithBalance, TeacherCrmState, TeacherCrmSummary } from '@/lib/crm/types'

import { GOOGLE_CALENDAR_REQUIRED_SCOPES, type CalendarListEntry, type Student } from '@teacher-crm/api-types'

export const emptySummary: TeacherCrmSummary = {
	activeStudents: 0,
	todayLessons: 0,
	missingAttendance: 0,
	overdueStudents: 0,
	monthIncome: 0,
	monthIncomeByCurrency: { RUB: 0, KZT: 0 },
}

export const emptyTeacherCrmState: TeacherCrmState = {
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

export function useTeacherCrmData() {
	const [state, setState] = useState<TeacherCrmState>(emptyTeacherCrmState)
	const [summary, setSummary] = useState<TeacherCrmSummary>(emptySummary)
	const [studentFilter, setStudentFilter] = useState<'all' | Student['status']>('all')
	const [isLoading, setIsLoading] = useState(true)
	const [calendarOptions, setCalendarOptions] = useState<CalendarListEntry[]>([])
	const calendarOptionsRef = useRef<CalendarListEntry[]>([])
	const refreshRequestIdRef = useRef(0)

	const refresh = useCallback(async (options: { showLoading?: boolean } = {}) => {
		const requestId = refreshRequestIdRef.current + 1
		refreshRequestIdRef.current = requestId
		const showLoading = options.showLoading ?? true
		if (showLoading) setIsLoading(true)
		try {
			const next = await loadTeacherCrm()
			if (requestId !== refreshRequestIdRef.current) return
			const nextCalendarOptions = next.state.calendarConnection.status === 'connected' ? calendarOptionsRef.current : []
			setState(next.state)
			setSummary(next.summary)
			setCalendarOptions(nextCalendarOptions)
			for (const issue of next.issues) reportCrmError(issue.source, issue.error)
			void loadTeacherCrmSupplements(next.state)
				.then((supplements) => {
					if (requestId !== refreshRequestIdRef.current) return
					setState((current) => ({
						...current,
						payments: supplements.payments,
						studentBalances: supplements.studentBalances,
					}))
					setSummary(supplements.summary)
					for (const issue of supplements.issues) reportCrmError(issue.source, issue.error)
				})
				.catch((supplementError) => {
					if (requestId === refreshRequestIdRef.current) reportCrmError('Load CRM billing data', supplementError)
				})
		} catch (refreshError) {
			if (requestId === refreshRequestIdRef.current) reportCrmError('Load CRM data', refreshError)
		} finally {
			if (requestId === refreshRequestIdRef.current) setIsLoading(false)
		}
	}, [])

	useEffect(() => {
		void refresh()
	}, [refresh])

	const studentRows = useMemo<StudentWithBalance[]>(
		() =>
			state.students.map((student) => ({
				...student,
				balance: state.studentBalances.find((balance) => balance.studentId === student.id) ?? emptyBalance(student),
			})),
		[state.studentBalances, state.students]
	)
	const visibleStudents = useMemo(
		() => studentRows.filter((student) => studentFilter === 'all' || student.status === studentFilter),
		[studentFilter, studentRows]
	)

	return {
		state,
		setState,
		summary,
		calendarOptions,
		setCalendarOptions,
		calendarOptionsRef,
		visibleStudents,
		studentRows,
		studentFilter,
		setStudentFilter,
		isLoading,
		refresh,
	}
}
