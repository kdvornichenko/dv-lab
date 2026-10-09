import type { Context } from 'hono'
import { Hono } from 'hono'
import { z } from 'zod'

import { type PaymentResponse, type PaymentsResponse, recordPaymentRequest } from '@dv-lab/contracts'
import type { Database } from '@dv-lab/db'

import { type AppEnv, noStore, readJson, requireRole, requireSession } from '../auth/middleware.ts'
import { listCardPayments, recordPayment } from '../cards/payments.ts'
import { errorBody } from '../request-context.ts'

type PaymentRouteDeps = { db: Database }

const invalidRequest = (c: Context<AppEnv>) => c.json(errorBody('invalid_request', 'Invalid request'), 400)

const notFound = (c: Context<AppEnv>) => c.json(errorBody('not_found', 'Not Found'), 404)

function latestPaymentDate(now: Date): string {
	const limit = new Date(now.getTime())
	limit.setUTCDate(limit.getUTCDate() + 1)
	return limit.toISOString().slice(0, 10)
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
		if (input.paidOn > latestPaymentDate(new Date())) return invalidRequest(c)
		const result = await recordPayment(db, input)
		if (result.kind === 'not_found') return notFound(c)
		return c.json({ payment: result.payment } satisfies PaymentResponse, 201)
	})

	return routes
}
