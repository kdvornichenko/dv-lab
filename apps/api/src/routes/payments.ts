import { Hono } from 'hono'

import { createPaymentSchema, type PaymentMutationResponse, type PaymentsResponse } from '@teacher-crm/api-types'

import { apiError, errorResponse, notFoundResponse } from '../http/errors'
import { validateJson } from '../http/validation'
import { actorFromContext, requirePermission } from '../middleware/auth'
import { paymentService, PaymentServiceError } from '../services/payment-service'

export const paymentRoutes = new Hono()
	.get('/', requirePermission('payments', 'read'), async (context) => {
		const actor = actorFromContext(context)
		const response: PaymentsResponse = {
			ok: true,
			payments: await paymentService.listPayments(actor),
			balances: await paymentService.listStudentBalances(actor),
		}
		return context.json(response, 200)
	})
	.post('/', requirePermission('payments', 'write'), validateJson(createPaymentSchema), async (context) => {
		try {
			const response: PaymentMutationResponse = {
				ok: true,
				payment: await paymentService.createPayment(actorFromContext(context), context.req.valid('json')),
			}
			return context.json(response, 201)
		} catch (error) {
			if (error instanceof PaymentServiceError && error.code === 'STUDENT_NOT_FOUND') {
				return errorResponse(context, 404, apiError('STUDENT_NOT_FOUND', error.message))
			}
			throw error
		}
	})
	.delete('/:paymentId', requirePermission('payments', 'adjust'), async (context) => {
		const payment = await paymentService.deletePayment(actorFromContext(context), context.req.param('paymentId'))
		if (!payment) {
			return notFoundResponse(context, 'Payment not found', 'PAYMENT_NOT_FOUND')
		}
		const response: PaymentMutationResponse = { ok: true, payment }
		return context.json(response, 200)
	})
