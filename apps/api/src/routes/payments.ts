import { Hono } from 'hono'

import { createPaymentSchema, type PaymentMutationResponse, type PaymentsResponse } from '@teacher-crm/api-types'

import { validateJson } from '../http/validation'
import { actorFromContext, requirePermission } from '../middleware/auth'
import { paymentService } from '../services/payment-service'

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
		const response: PaymentMutationResponse = {
			ok: true,
			payment: await paymentService.createPayment(actorFromContext(context), context.req.valid('json')),
		}
		return context.json(response, 201)
	})
	.delete('/:paymentId', requirePermission('payments', 'adjust'), async (context) => {
		const payment = await paymentService.deletePayment(actorFromContext(context), context.req.param('paymentId'))
		if (!payment) {
			return context.json({ ok: false, error: { code: 'PAYMENT_NOT_FOUND', message: 'Payment not found' } }, 404)
		}
		const response: PaymentMutationResponse = { ok: true, payment }
		return context.json(response, 200)
	})
