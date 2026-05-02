'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from 'react'

import { reportCrmError } from '@/hooks/teacherCrmErrors'
import type { TeacherCrmCacheSnapshot, TeacherCrmLoadError } from '@/hooks/useTeacherCrmData.types'
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
	calendarBlocks: [],
	lessonOccurrenceExceptions: [],
}

const TEACHER_CRM_CACHE_TTL_MS = 30_000

let teacherCrmCache: TeacherCrmCacheSnapshot | null = null
let teacherCrmLoadPromise: Promise<Awaited<ReturnType<typeof loadTeacherCrm>>> | null = null

function isTeacherCrmCacheFresh(snapshot: TeacherCrmCacheSnapshot) {
	return Date.now() - snapshot.updatedAt < TEACHER_CRM_CACHE_TTL_MS
}

function writeTeacherCrmCache(update: Partial<Omit<TeacherCrmCacheSnapshot, 'updatedAt'>>) {
	const current = teacherCrmCache
	teacherCrmCache = {
		state: update.state ?? current?.state ?? emptyTeacherCrmState,
		summary: update.summary ?? current?.summary ?? emptySummary,
		calendarOptions: update.calendarOptions ?? current?.calendarOptions ?? [],
		updatedAt: Date.now(),
	}
	return teacherCrmCache
}

function loadTeacherCrmOnce() {
	teacherCrmLoadPromise ??= loadTeacherCrm().finally(() => {
		teacherCrmLoadPromise = null
	})
	return teacherCrmLoadPromise
}

export function useTeacherCrmData() {
	const initialCache = teacherCrmCache
	const [state, setStateValue] = useState<TeacherCrmState>(() => initialCache?.state ?? emptyTeacherCrmState)
	const [summary, setSummaryValue] = useState<TeacherCrmSummary>(() => initialCache?.summary ?? emptySummary)
	const [studentFilter, setStudentFilter] = useState<'all' | Student['status']>('all')
	const [isLoading, setIsLoading] = useState(() => !initialCache)
	const [loadError, setLoadError] = useState<TeacherCrmLoadError | null>(null)
	const [calendarOptions, setCalendarOptionsValue] = useState<CalendarListEntry[]>(
		() => initialCache?.calendarOptions ?? []
	)
	const calendarOptionsRef = useRef<CalendarListEntry[]>(initialCache?.calendarOptions ?? [])
	const refreshRequestIdRef = useRef(0)

	const setState = useCallback((nextState: SetStateAction<TeacherCrmState>) => {
		setStateValue((current) => {
			const resolved =
				typeof nextState === 'function'
					? (nextState as (value: TeacherCrmState) => TeacherCrmState)(current)
					: nextState
			writeTeacherCrmCache({ state: resolved })
			return resolved
		})
	}, [])

	const setSummary = useCallback((nextSummary: SetStateAction<TeacherCrmSummary>) => {
		setSummaryValue((current) => {
			const resolved =
				typeof nextSummary === 'function'
					? (nextSummary as (value: TeacherCrmSummary) => TeacherCrmSummary)(current)
					: nextSummary
			writeTeacherCrmCache({ summary: resolved })
			return resolved
		})
	}, [])

	const setCalendarOptions = useCallback((nextOptions: SetStateAction<CalendarListEntry[]>) => {
		setCalendarOptionsValue((current) => {
			const resolved =
				typeof nextOptions === 'function'
					? (nextOptions as (value: CalendarListEntry[]) => CalendarListEntry[])(current)
					: nextOptions
			calendarOptionsRef.current = resolved
			if (teacherCrmCache) writeTeacherCrmCache({ calendarOptions: resolved })
			return resolved
		})
	}, [])

	const refresh = useCallback(
		async (options: { showLoading?: boolean } = {}) => {
			const requestId = refreshRequestIdRef.current + 1
			refreshRequestIdRef.current = requestId
			const showLoading = options.showLoading ?? !teacherCrmCache
			if (showLoading) setIsLoading(true)
			try {
				const next = await loadTeacherCrmOnce()
				if (requestId !== refreshRequestIdRef.current) return
				setLoadError(null)
				const nextCalendarOptions =
					next.state.calendarConnection.status === 'connected' ? calendarOptionsRef.current : []
				setState((current) => ({
					...next.state,
					payments: current.payments,
					studentBalances: current.studentBalances,
				}))
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
						if (requestId !== refreshRequestIdRef.current) return
						const message = supplementError instanceof Error ? supplementError.message : 'Failed to load billing data'
						setLoadError({ source: 'billing', message })
						reportCrmError('Load CRM billing data', supplementError)
					})
			} catch (refreshError) {
				if (requestId !== refreshRequestIdRef.current) return
				const message = refreshError instanceof Error ? refreshError.message : 'Failed to load CRM data'
				setLoadError({ source: 'core', message })
				reportCrmError('Load CRM data', refreshError)
			} finally {
				if (requestId === refreshRequestIdRef.current) setIsLoading(false)
			}
		},
		[setCalendarOptions, setState, setSummary]
	)

	useEffect(() => {
		if (teacherCrmCache && isTeacherCrmCacheFresh(teacherCrmCache)) {
			setIsLoading(false)
			return
		}

		void refresh({ showLoading: !teacherCrmCache })
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
		loadError,
		refresh,
	}
}
