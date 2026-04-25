import { Hono } from 'hono'

import { createPaymentSchema } from '@teacher-crm/api-types'

import { validateJson } from '../http/validation'
import { actorFromContext, requirePermission } from '../middleware/auth'
import { memoryStore } from '../services/memory-store'

export const paymentRoutes = new Hono()
	.get('/', requirePermission('payments', 'read'), (context) =>
		context.json(
			{
				ok: true,
				payments: memoryStore.listPayments(actorFromContext(context)),
				balances: memoryStore.listStudentBalances(actorFromContext(context)),
			},
			200
		)
	)
	.post('/', requirePermission('payments', 'write'), validateJson(createPaymentSchema), (context) => {
		return context.json(
			{ ok: true, payment: memoryStore.createPayment(actorFromContext(context), context.req.valid('json')) },
			201
		)
	})
