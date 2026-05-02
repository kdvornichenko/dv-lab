'use client'

import { useCallback } from 'react'

import { teacherCrmPaymentApi } from '@/lib/crm/api'

import type { CreatePaymentInput } from '@teacher-crm/api-types'
import type { TeacherCrmCommandBaseDeps } from './useTeacherCrmCommands.types'

export function useTeacherCrmPaymentCommands({
	refreshInBackground,
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
				refreshInBackground()
			})
		},
		[refreshInBackground, runCrmAction, setState]
	)

	const deletePayment = useCallback(
		async (paymentId: string) => {
			await runCrmAction('Delete payment', async () => {
				await teacherCrmPaymentApi.deletePayment(paymentId)
				setState((current) => ({
					...current,
					payments: current.payments.filter((payment) => payment.id !== paymentId),
				}))
				refreshInBackground()
			})
		},
		[refreshInBackground, runCrmAction, setState]
	)

	return { recordPayment, deletePayment }
}
