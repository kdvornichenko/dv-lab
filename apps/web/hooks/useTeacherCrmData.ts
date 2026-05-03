'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from 'react'

import { reportCrmError } from '@/hooks/teacherCrmErrors'
import type { TeacherCrmCacheSnapshot, TeacherCrmLoadError } from '@/hooks/useTeacherCrmData.types'
import { loadTeacherCrm, loadTeacherCrmSupplements } from '@/lib/crm/api'
import { emptyBalance } from '@/lib/crm/state'
import type { StudentWithBalance, TeacherCrmState, TeacherCrmSummary } from '@/lib/crm/types'
import { createClient } from '@/lib/supabase/client'

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
const teacherCrmLoadPromises = new Map<string, Promise<Awaited<ReturnType<typeof loadTeacherCrm>>>>()

function teacherCrmCacheKey(session: { user?: { id?: string } } | null) {
	return session?.user?.id ? `user:${session.user.id}` : null
}

async function currentTeacherCrmCacheKey() {
	const supabase = createClient()
	const {
		data: { session },
	} = await supabase.auth.getSession()
	return teacherCrmCacheKey(session)
}

function cacheForKey(cacheKey: string | null) {
	return cacheKey && teacherCrmCache?.cacheKey === cacheKey ? teacherCrmCache : null
}

function isTeacherCrmCacheFresh(snapshot: TeacherCrmCacheSnapshot) {
	return Date.now() - snapshot.updatedAt < TEACHER_CRM_CACHE_TTL_MS
}

function writeTeacherCrmCache(
	cacheKey: string | null,
	update: Partial<Omit<TeacherCrmCacheSnapshot, 'cacheKey' | 'updatedAt'>>
) {
	if (!cacheKey) return null
	const current = cacheForKey(cacheKey)
	teacherCrmCache = {
		cacheKey,
		state: update.state ?? current?.state ?? emptyTeacherCrmState,
		summary: update.summary ?? current?.summary ?? emptySummary,
		calendarOptions: update.calendarOptions ?? current?.calendarOptions ?? [],
		updatedAt: Date.now(),
	}
	return teacherCrmCache
}

function loadTeacherCrmOnce(cacheKey: string) {
	let loadPromise = teacherCrmLoadPromises.get(cacheKey)
	if (loadPromise) return loadPromise
	loadPromise = loadTeacherCrm().finally(() => {
		teacherCrmLoadPromises.delete(cacheKey)
	})
	teacherCrmLoadPromises.set(cacheKey, loadPromise)
	return loadPromise
}

export function useTeacherCrmData() {
	const [state, setStateValue] = useState<TeacherCrmState>(emptyTeacherCrmState)
	const [summary, setSummaryValue] = useState<TeacherCrmSummary>(emptySummary)
	const [studentFilter, setStudentFilter] = useState<'all' | Student['status']>('all')
	const [isLoading, setIsLoading] = useState(true)
	const [loadError, setLoadError] = useState<TeacherCrmLoadError | null>(null)
	const [calendarOptions, setCalendarOptionsValue] = useState<CalendarListEntry[]>([])
	const calendarOptionsRef = useRef<CalendarListEntry[]>([])
	const cacheKeyRef = useRef<string | null>(null)
	const refreshRequestIdRef = useRef(0)

	const setState = useCallback((nextState: SetStateAction<TeacherCrmState>) => {
		setStateValue((current) => {
			const resolved =
				typeof nextState === 'function'
					? (nextState as (value: TeacherCrmState) => TeacherCrmState)(current)
					: nextState
			writeTeacherCrmCache(cacheKeyRef.current, { state: resolved })
			return resolved
		})
	}, [])

	const setSummary = useCallback((nextSummary: SetStateAction<TeacherCrmSummary>) => {
		setSummaryValue((current) => {
			const resolved =
				typeof nextSummary === 'function'
					? (nextSummary as (value: TeacherCrmSummary) => TeacherCrmSummary)(current)
					: nextSummary
			writeTeacherCrmCache(cacheKeyRef.current, { summary: resolved })
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
			writeTeacherCrmCache(cacheKeyRef.current, { calendarOptions: resolved })
			return resolved
		})
	}, [])

	const refresh = useCallback(
		async (options: { showLoading?: boolean; awaitSupplements?: boolean; force?: boolean } = {}) => {
			const requestId = refreshRequestIdRef.current + 1
			refreshRequestIdRef.current = requestId
			const nextCacheKey = await currentTeacherCrmCacheKey()
			if (requestId !== refreshRequestIdRef.current) return
			cacheKeyRef.current = nextCacheKey
			if (!nextCacheKey) {
				teacherCrmCache = null
				teacherCrmLoadPromises.clear()
				setStateValue(emptyTeacherCrmState)
				setSummaryValue(emptySummary)
				setCalendarOptionsValue([])
				calendarOptionsRef.current = []
				setLoadError({ source: 'core', message: 'Authentication session is missing' })
				setIsLoading(false)
				return
			}

			if (options.force) teacherCrmLoadPromises.delete(nextCacheKey)
			const activeCache = options.force ? null : cacheForKey(nextCacheKey)
			const showLoading = options.showLoading ?? !activeCache
			if (showLoading) setIsLoading(true)
			try {
				const next = options.force ? await loadTeacherCrm() : await loadTeacherCrmOnce(nextCacheKey)
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
				const loadSupplements = async () => {
					try {
						const supplements = await loadTeacherCrmSupplements(next.state)
						if (requestId !== refreshRequestIdRef.current) return
						setState((current) => ({
							...current,
							payments: supplements.payments,
							studentBalances: supplements.studentBalances,
						}))
						setSummary(supplements.summary)
						for (const issue of supplements.issues) reportCrmError(issue.source, issue.error)
					} catch (supplementError) {
						if (requestId !== refreshRequestIdRef.current) return
						const message = supplementError instanceof Error ? supplementError.message : 'Failed to load billing data'
						setLoadError({ source: 'billing', message })
						reportCrmError('Load CRM billing data', supplementError)
					}
				}
				const supplementsPromise = loadSupplements()
				if (options.awaitSupplements) await supplementsPromise
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
		const supabase = createClient()
		let cancelled = false

		const applySession = (cacheKey: string | null) => {
			if (cancelled) return
			const previousCacheKey = cacheKeyRef.current
			cacheKeyRef.current = cacheKey
			const snapshot = cacheForKey(cacheKey)

			if (!cacheKey) {
				teacherCrmCache = null
				teacherCrmLoadPromises.clear()
				setStateValue(emptyTeacherCrmState)
				setSummaryValue(emptySummary)
				setCalendarOptionsValue([])
				calendarOptionsRef.current = []
				setLoadError(null)
				setIsLoading(false)
				return
			}

			if (previousCacheKey && previousCacheKey !== cacheKey) {
				teacherCrmCache = null
				teacherCrmLoadPromises.clear()
				setStateValue(emptyTeacherCrmState)
				setSummaryValue(emptySummary)
				setCalendarOptionsValue([])
				calendarOptionsRef.current = []
			}

			if (snapshot && isTeacherCrmCacheFresh(snapshot)) {
				setStateValue(snapshot.state)
				setSummaryValue(snapshot.summary)
				setCalendarOptionsValue(snapshot.calendarOptions)
				calendarOptionsRef.current = snapshot.calendarOptions
				setLoadError(null)
				setIsLoading(false)
				return
			}

			void refresh({ showLoading: !snapshot })
		}

		void supabase.auth.getSession().then(({ data: { session } }) => applySession(teacherCrmCacheKey(session)))
		const { data } = supabase.auth.onAuthStateChange((_event, session) => applySession(teacherCrmCacheKey(session)))

		return () => {
			cancelled = true
			data.subscription.unsubscribe()
		}
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
