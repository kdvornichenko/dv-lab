'use client'

import { useCallback } from 'react'

import { teacherCrmCalendarApi } from '@/lib/crm/api'

import type { CreateCalendarBlockInput, UpdateCalendarBlockInput } from '@teacher-crm/api-types'

import type { TeacherCrmCalendarCommandDeps } from './useTeacherCrmCommands.types'

export function useTeacherCrmCalendarBlockCommands({
	ensureCalendarTokens,
	refreshInBackground,
	runCrmAction,
	setState,
}: TeacherCrmCalendarCommandDeps) {
	const addCalendarBlock = useCallback(
		async (input: CreateCalendarBlockInput) => {
			await runCrmAction('Add personal block', async () => {
				await ensureCalendarTokens()
				const response = await teacherCrmCalendarApi.createCalendarBlock(input)
				setState((current) => ({
					...current,
					calendarBlocks: [...current.calendarBlocks.filter((block) => block.id !== response.block.id), response.block],
				}))
				refreshInBackground()
			})
		},
		[ensureCalendarTokens, refreshInBackground, runCrmAction, setState]
	)

	const updateCalendarBlock = useCallback(
		async (blockId: string, input: UpdateCalendarBlockInput) => {
			await runCrmAction('Update personal block', async () => {
				await ensureCalendarTokens()
				const response = await teacherCrmCalendarApi.updateCalendarBlock(blockId, input)
				setState((current) => ({
					...current,
					calendarBlocks: current.calendarBlocks.map((block) => (block.id === blockId ? response.block : block)),
				}))
				refreshInBackground()
			})
		},
		[ensureCalendarTokens, refreshInBackground, runCrmAction, setState]
	)

	const deleteCalendarBlock = useCallback(
		async (blockId: string) => {
			await runCrmAction('Delete personal block', async () => {
				await teacherCrmCalendarApi.deleteCalendarBlock(blockId)
				setState((current) => ({
					...current,
					calendarBlocks: current.calendarBlocks.filter((block) => block.id !== blockId),
				}))
				refreshInBackground()
			})
		},
		[refreshInBackground, runCrmAction, setState]
	)

	return { addCalendarBlock, updateCalendarBlock, deleteCalendarBlock }
}
