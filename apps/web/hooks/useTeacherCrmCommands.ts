'use client'

import { useCallback, useMemo } from 'react'

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

export function useTeacherCrmCommands({ lessons, refresh, setState }: UseTeacherCrmCommandsInput) {
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

	const baseDeps = useMemo<TeacherCrmCommandBaseDeps>(
		() => ({ refreshInBackground, runCrmAction, setState }),
		[refreshInBackground, runCrmAction, setState]
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
