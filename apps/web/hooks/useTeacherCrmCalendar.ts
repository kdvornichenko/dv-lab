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

import { crmErrorMessage, reportCrmError } from '@/hooks/teacherCrmErrors'
import { saveCurrentGoogleCalendarTokens, teacherCrmCalendarApi } from '@/lib/crm/api'
import { saveCrmError } from '@/lib/crm/error-log'
import type { TeacherCrmState } from '@/lib/crm/types'

import type { CalendarBusyInterval, CalendarListEntry, CreateLessonInput } from '@teacher-crm/api-types'

type RefreshTeacherCrm = (options?: { showLoading?: boolean }) => Promise<void>

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
	const calendarTokenSyncAttemptedRef = useRef(false)
	const calendarImportInFlightRef = useRef(false)
	const lastCalendarImportAtRef = useRef(0)
	const calendarImportFailureCountRef = useRef(0)

	const runCalendarAction = useCallback(async (source: string, action: () => Promise<void>) => {
		try {
			await action()
		} catch (actionError) {
			reportCrmError(source, actionError)
			throw actionError
		}
	}, [])

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
					if (!cancelled && response.updated > 0) void refresh({ showLoading: false })
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
		importCalendarChanges()

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

	const connectCalendar = useCallback(async () => {
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
				const message = crmErrorMessage(error)
				void saveCrmError({ source: 'Check calendar conflicts', message }).catch((logError) => {
					console.error('[teacher-crm] failed to persist CRM error', logError)
				})
				return []
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
