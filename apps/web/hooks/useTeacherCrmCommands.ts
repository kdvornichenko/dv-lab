'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'

import { reportCrmError } from '@/hooks/teacherCrmErrors'
import { useTeacherCrmCalendarBlockCommands } from '@/hooks/useTeacherCrmCalendarBlockCommands'
import { useTeacherCrmLessonCommands } from '@/hooks/useTeacherCrmLessonCommands'
import { useTeacherCrmPaymentCommands } from '@/hooks/useTeacherCrmPaymentCommands'
import { useTeacherCrmStudentCommands } from '@/hooks/useTeacherCrmStudentCommands'
import { saveCurrentGoogleCalendarTokens } from '@/lib/crm/api'

import type {
	TeacherCrmCalendarCommandDeps,
	TeacherCrmCommandBaseDeps,
	UseTeacherCrmCommandsInput,
} from './useTeacherCrmCommands.types'

const CALENDAR_TOKEN_SAVE_TTL_MS = 5 * 60_000
const MUTATION_REFRESH_DEBOUNCE_MS = 250

export function useTeacherCrmCommands({ lessons, refresh, setState }: UseTeacherCrmCommandsInput) {
	const calendarTokenSaveRef = useRef<{ attemptedAt: number; inFlight: Promise<void> | null }>({
		attemptedAt: 0,
		inFlight: null,
	})
	const refreshTimeoutRef = useRef<number | null>(null)
	const refreshInFlightRef = useRef<Promise<void> | null>(null)
	const pendingRefreshRef = useRef(false)

	const runCrmAction = useCallback(async (source: string, action: () => Promise<void>) => {
		try {
			await action()
		} catch (actionError) {
			reportCrmError(source, actionError)
			throw actionError
		}
	}, [])

	const startBackgroundRefresh = useCallback(() => {
		if (refreshInFlightRef.current) {
			pendingRefreshRef.current = true
			return
		}

		pendingRefreshRef.current = false
		const refreshPromise = refresh({ showLoading: false, awaitSupplements: false, force: true }).catch(
			(refreshError) => {
				reportCrmError('Refresh CRM after mutation', refreshError)
			}
		)
		refreshInFlightRef.current = refreshPromise
		void refreshPromise.finally(() => {
			if (refreshInFlightRef.current === refreshPromise) refreshInFlightRef.current = null
			if (!pendingRefreshRef.current) return
			pendingRefreshRef.current = false
			refreshTimeoutRef.current = window.setTimeout(() => {
				refreshTimeoutRef.current = null
				startBackgroundRefresh()
			}, MUTATION_REFRESH_DEBOUNCE_MS)
		})
	}, [refresh])

	const refreshAfterMutation = useCallback(async () => {
		if (refreshTimeoutRef.current !== null) window.clearTimeout(refreshTimeoutRef.current)
		refreshTimeoutRef.current = window.setTimeout(() => {
			refreshTimeoutRef.current = null
			startBackgroundRefresh()
		}, MUTATION_REFRESH_DEBOUNCE_MS)
	}, [startBackgroundRefresh])

	const ensureCalendarTokens = useCallback(async () => {
		const tokenSave = calendarTokenSaveRef.current
		const now = Date.now()
		if (tokenSave.inFlight) return tokenSave.inFlight
		if (now - tokenSave.attemptedAt < CALENDAR_TOKEN_SAVE_TTL_MS) return

		const savePromise = saveCurrentGoogleCalendarTokens()
			.then(() => {
				tokenSave.attemptedAt = Date.now()
			})
			.catch((tokenError) => {
				reportCrmError('Save Google Calendar token', tokenError)
			})
		tokenSave.inFlight = savePromise
		try {
			await savePromise
		} finally {
			if (tokenSave.inFlight === savePromise) tokenSave.inFlight = null
		}
	}, [])

	useEffect(() => {
		return () => {
			if (refreshTimeoutRef.current !== null) window.clearTimeout(refreshTimeoutRef.current)
		}
	}, [])

	const baseDeps = useMemo<TeacherCrmCommandBaseDeps>(
		() => ({ refreshAfterMutation, runCrmAction, setState }),
		[refreshAfterMutation, runCrmAction, setState]
	)
	const calendarDeps = useMemo<TeacherCrmCalendarCommandDeps>(
		() => ({ ...baseDeps, ensureCalendarTokens }),
		[baseDeps, ensureCalendarTokens]
	)

	const studentCommands = useTeacherCrmStudentCommands(baseDeps)
	const lessonCommands = useTeacherCrmLessonCommands({ ...calendarDeps, lessons })
	const calendarBlockCommands = useTeacherCrmCalendarBlockCommands(calendarDeps)
	const paymentCommands = useTeacherCrmPaymentCommands(baseDeps)

	return {
		...studentCommands,
		...lessonCommands,
		...calendarBlockCommands,
		...paymentCommands,
	}
}
