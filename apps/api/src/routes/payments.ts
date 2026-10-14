import type { Context } from 'hono'
import { Hono } from 'hono'
import { z } from 'zod'

import {
	type PaymentResponse,
	type PaymentsResponse,
	assignPaymentRequest,
	paymentRevisionRequest,
	recordPaymentRequest,
	updatePaymentRequest,
} from '@dv-lab/contracts'
import type { Database } from '@dv-lab/db'

import { type AppEnv, noStore, readJson, readOptionalJson, requireRole, requireSession } from '../auth/middleware.ts'
import {
	assignPayment,
	deletePayment,
	listCardPayments,
	listUnassignedPayments,
	recordPayment,
	updatePayment,
} from '../cards/payments.ts'
import { errorBody } from '../request-context.ts'

type PaymentRouteDeps = { db: Database }

const invalidRequest = (c: Context<AppEnv>) => c.json(errorBody('invalid_request', 'Invalid request'), 400)

const notFound = (c: Context<AppEnv>) => c.json(errorBody('not_found', 'Not Found'), 404)

const paymentChanged = (c: Context<AppEnv>) => c.json(errorBody('precondition_failed', 'The payment changed'), 409)

function paymentId(c: Context<AppEnv>): string | null {
	const id = z.uuid().safeParse(c.req.param('id'))
	return id.success ? id.data : null
}

export function paymentRoutes({ db }: PaymentRouteDeps) {
	const routes = new Hono<AppEnv>()
	routes.use('*', noStore, requireSession(db), requireRole('teacher'))

	routes.get('/', async (c) => {
		const studentId = z.uuid().safeParse(c.req.query('student'))
		if (!studentId.success) return invalidRequest(c)
		const list = await listCardPayments(db, studentId.data)
		if (!list) return notFound(c)
		return c.json({ payments: list } satisfies PaymentsResponse, 200)
	})

	routes.post('/', async (c) => {
		const input = await readJson(c, recordPaymentRequest)
		if (!input) return invalidRequest(c)
		const result = await recordPayment(db, c.get('session').account.id, input)
		if (result.kind === 'not_found') return notFound(c)
		if (result.kind === 'invalid') return invalidRequest(c)
		if (result.kind === 'default_time_zone_changed')
			return c.json(errorBody(result.kind, 'Default time zone changed elsewhere. Refresh the page and try again.'), 409)
		return c.json({ payment: result.payment } satisfies PaymentResponse, 201)
	})

	routes.get('/unassigned', async (c) =>
		c.json({ payments: await listUnassignedPayments(db) } satisfies PaymentsResponse, 200)
	)

	routes.patch('/:id', async (c) => {
		const id = paymentId(c)
		if (id === null) return notFound(c)
		const input = await readJson(c, updatePaymentRequest)
		if (!input) return invalidRequest(c)
		const result = await updatePayment(db, c.get('session').account.id, id, input)
		switch (result.kind) {
			case 'not_found':
				return notFound(c)
			case 'invalid':
				return invalidRequest(c)
			case 'changed':
				return paymentChanged(c)
			case 'default_time_zone_changed':
				return c.json(
					errorBody(result.kind, 'Default time zone changed elsewhere. Refresh the page and try again.'),
					409
				)
			case 'updated':
				return c.json({ payment: result.payment } satisfies PaymentResponse, 200)
		}
	})

	routes.delete('/:id', async (c) => {
		const id = paymentId(c)
		if (id === null) return notFound(c)
		const input = await readOptionalJson(c, paymentRevisionRequest)
		if (!input) return invalidRequest(c)
		const result = await deletePayment(db, id, input.expectedRevision)
		if (result === 'not_found') return notFound(c)
		if (result === 'changed') return paymentChanged(c)
		return c.body(null, 204)
	})

	routes.post('/:id/assign', async (c) => {
		const id = paymentId(c)
		if (id === null) return notFound(c)
		const input = await readJson(c, assignPaymentRequest)
		if (!input) return invalidRequest(c)
		const result = await assignPayment(db, id, input)
		switch (result.kind) {
			case 'not_found':
				return notFound(c)
			case 'currency_required':
				return invalidRequest(c)
			case 'already_assigned':
				return c.json(errorBody('payment_already_assigned', 'This payment is already assigned'), 409)
			case 'changed':
				return paymentChanged(c)
			case 'assigned':
				return c.json({ payment: result.payment } satisfies PaymentResponse, 200)
		}
	})

	return routes
}
