'use client'

import { useCallback } from 'react'

import { teacherCrmPaymentApi } from '@/lib/crm/api'

import type { CreatePaymentInput } from '@teacher-crm/api-types'

import type { TeacherCrmCommandBaseDeps } from './useTeacherCrmCommands.types'

export function useTeacherCrmPaymentCommands({
	refreshAfterMutation,
	runCrmAction,
	setState,
}: TeacherCrmCommandBaseDeps) {
	const recordPayment = useCallback(
		async (input: CreatePaymentInput) => {
			await runCrmAction('Record payment', async () => {
				const response = await teacherCrmPaymentApi.createPayment(input)
				setState((current) => ({
					...current,
					payments: [...current.payments.filter((payment) => payment.id !== response.payment.id), response.payment],
				}))
				await refreshAfterMutation()
			})
		},
		[refreshAfterMutation, runCrmAction, setState]
	)

	const deletePayment = useCallback(
		async (paymentId: string) => {
			await runCrmAction('Delete payment', async () => {
				await teacherCrmPaymentApi.deletePayment(paymentId)
				setState((current) => ({
					...current,
					payments: current.payments.filter((payment) => payment.id !== paymentId),
				}))
				await refreshAfterMutation()
			})
		},
		[refreshAfterMutation, runCrmAction, setState]
	)

	return { recordPayment, deletePayment }
}
