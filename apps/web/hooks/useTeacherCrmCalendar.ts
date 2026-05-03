'use client'

import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
} from 'react'

import { reportCrmError } from '@/hooks/teacherCrmErrors'
import { saveCurrentGoogleCalendarTokens, teacherCrmCalendarApi } from '@/lib/crm/api'
import type { TeacherCrmState } from '@/lib/crm/types'
import { createClient } from '@/lib/supabase/client'

import type { CalendarBusyInterval, CalendarListEntry, CreateLessonInput } from '@teacher-crm/api-types'

type RefreshTeacherCrm = (options?: { showLoading?: boolean; force?: boolean }) => Promise<void>

export function useTeacherCrmCalendar({
	calendarOptionsRef,
	refresh,
	setCalendarOptions,
	state,
}: {
	calendarOptionsRef: MutableRefObject<CalendarListEntry[]>
	refresh: RefreshTeacherCrm
	setCalendarOptions: Dispatch<SetStateAction<CalendarListEntry[]>>
	state: TeacherCrmState
}) {
	const [isCalendarImporting, setIsCalendarImporting] = useState(false)
	const lastSavedProviderTokenRef = useRef<string | null>(null)
	const calendarImportInFlightRef = useRef(false)
	const lastCalendarImportAtRef = useRef(0)
	const calendarImportFailureCountRef = useRef(0)
	const calendarSyncRetryKeyRef = useRef<string | null>(null)

	const runCalendarAction = useCallback(async (source: string, action: () => Promise<void>) => {
		try {
			await action()
		} catch (actionError) {
			reportCrmError(source, actionError)
			throw actionError
		}
	}, [])

	const saveCalendarTokenAndRefresh = useCallback(
		async (providerToken: string | null) => {
			if (!providerToken || lastSavedProviderTokenRef.current === providerToken) return false

			const result = await saveCurrentGoogleCalendarTokens()
			if (!result.saved) return false

			lastSavedProviderTokenRef.current = providerToken
			await refresh({ showLoading: false, force: true })
			return true
		},
		[refresh]
	)

	useEffect(() => {
		const supabase = createClient()
		let cancelled = false

		const syncSessionToken = (providerToken: string | null) => {
			saveCalendarTokenAndRefresh(providerToken).catch((error) => {
				if (!cancelled) reportCrmError('Save Google Calendar token', error)
			})
		}

		void supabase.auth.getSession().then(({ data: { session } }) => {
			if (!cancelled) syncSessionToken(session?.provider_token ?? null)
		})

		const { data } = supabase.auth.onAuthStateChange((_event, session) => {
			if (!cancelled) syncSessionToken(session?.provider_token ?? null)
		})

		return () => {
			cancelled = true
			data.subscription.unsubscribe()
		}
	}, [saveCalendarTokenAndRefresh])

	useEffect(() => {
		const canLoadCalendars = state.calendarConnection.status === 'connected' && state.calendarConnection.tokenAvailable
		if (!canLoadCalendars) {
			calendarOptionsRef.current = []
			setCalendarOptions([])
			return
		}

		let cancelled = false
		teacherCrmCalendarApi
			.listCalendars()
			.then((response) => {
				if (!cancelled) {
					calendarOptionsRef.current = response.calendars
					setCalendarOptions(response.calendars)
				}
			})
			.catch((error) => {
				if (!cancelled) reportCrmError('Load calendars', error)
			})

		return () => {
			cancelled = true
		}
	}, [
		calendarOptionsRef,
		setCalendarOptions,
		state.calendarConnection.status,
		state.calendarConnection.tokenAvailable,
		state.calendarConnection.updatedAt,
	])

	useEffect(() => {
		const canImport =
			state.calendarConnection.status === 'connected' &&
			state.calendarConnection.tokenAvailable &&
			Boolean(state.calendarConnection.selectedCalendarId)
		if (!canImport) return

		let cancelled = false
		const importCalendarChanges = (force = false) => {
			const nowMs = Date.now()
			const failureBackoffMs = Math.min(calendarImportFailureCountRef.current * 60_000, 15 * 60_000)
			if (calendarImportInFlightRef.current) return
			if (!force && nowMs - lastCalendarImportAtRef.current < 60_000 + failureBackoffMs) return

			calendarImportInFlightRef.current = true
			lastCalendarImportAtRef.current = nowMs
			setIsCalendarImporting(true)
			teacherCrmCalendarApi
				.importCalendarEvents()
				.then((response) => {
					calendarImportFailureCountRef.current = 0
					if (!cancelled && response.updated > 0) void refresh({ showLoading: false, force: true })
				})
				.catch((error) => {
					calendarImportFailureCountRef.current += 1
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
		importCalendarChanges(true)

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

	useEffect(() => {
		const canSync =
			state.calendarConnection.status === 'connected' &&
			state.calendarConnection.tokenAvailable &&
			Boolean(state.calendarConnection.selectedCalendarId)
		if (!canSync) return

		const retryableLessonIds = Array.from(
			new Set(
				state.calendarSyncRecords
					.filter((record) => record.status === 'failed' || record.status === 'not_synced')
					.map((record) => record.lessonId)
			)
		).sort()
		if (retryableLessonIds.length === 0) return

		const retryKey = `${state.calendarConnection.updatedAt}:${retryableLessonIds.join(',')}`
		if (calendarSyncRetryKeyRef.current === retryKey) return
		calendarSyncRetryKeyRef.current = retryKey

		let cancelled = false
		void Promise.allSettled(retryableLessonIds.map((lessonId) => teacherCrmCalendarApi.syncLesson(lessonId)))
			.then(() => {
				if (!cancelled) void refresh({ showLoading: false, force: true })
			})
			.catch((error) => {
				if (!cancelled) reportCrmError('Retry Google Calendar lesson sync', error)
			})

		return () => {
			cancelled = true
		}
	}, [
		refresh,
		state.calendarConnection.selectedCalendarId,
		state.calendarConnection.status,
		state.calendarConnection.tokenAvailable,
		state.calendarConnection.updatedAt,
		state.calendarSyncRecords,
	])

	const connectCalendar = useCallback(async () => {
		const needsCalendarToken =
			state.calendarConnection.status !== 'connected' || !state.calendarConnection.tokenAvailable
		if (needsCalendarToken) {
			try {
				const result = await saveCurrentGoogleCalendarTokens()
				if (result.saved) {
					await refresh({ showLoading: false, force: true })
					return
				}
			} catch (error) {
				reportCrmError('Save Google Calendar token', error)
			}
		}

		window.location.assign(`/auth/sign-in?next=${encodeURIComponent('/calendar')}`)
	}, [refresh, state.calendarConnection.status, state.calendarConnection.tokenAvailable])

	const selectCalendar = useCallback(
		async (calendarId: string, calendarName: string) => {
			await runCalendarAction('Select calendar', async () => {
				await teacherCrmCalendarApi.selectCalendar(calendarId, calendarName)
				await refresh()
			})
		},
		[refresh, runCalendarAction]
	)

	const syncLesson = useCallback(
		async (lessonId: string) => {
			await runCalendarAction('Sync lesson', async () => {
				await teacherCrmCalendarApi.syncLesson(lessonId)
				await refresh()
			})
		},
		[refresh, runCalendarAction]
	)

	const checkCalendarConflicts = useCallback(
		async (input: CreateLessonInput & { excludeLessonId?: string }): Promise<CalendarBusyInterval[]> => {
			try {
				const response = await teacherCrmCalendarApi.listBusyIntervals({
					startsAt: input.startsAt,
					durationMinutes: input.durationMinutes,
					repeatWeekly: input.repeatWeekly,
					repeatCount: input.repeatCount,
					excludeLessonId: input.excludeLessonId,
				})
				return response.busy
			} catch (error) {
				reportCrmError('Check calendar conflicts', error)
				throw error
			}
		},
		[]
	)

	return {
		isCalendarImporting,
		connectCalendar,
		selectCalendar,
		syncLesson,
		checkCalendarConflicts,
	}
}
