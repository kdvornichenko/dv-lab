import type { Context } from 'hono'
import { Hono } from 'hono'

import {
	type PushConfigResponse,
	type PushSubscribeResponse,
	pushPresenceRequest,
	pushSubscribeRequest,
	pushUnsubscribeRequest,
} from '@dv-lab/contracts'
import { type Database, readSnapshot } from '@dv-lab/db'

import { type AppEnv, noStore, readJson, requireRole, requireSession } from '../auth/middleware.ts'
import { recordPresence } from '../push/presence.ts'
import { listDevices, removeSubscription, saveSubscription, touchSubscription } from '../push/subscriptions.ts'
import { errorBody } from '../request-context.ts'

export type PushPublicConfig = { enabled: false } | { enabled: true; publicKey: string }

type PushRouteDeps = { db: Database; push?: PushPublicConfig }

const invalidRequest = (c: Context<AppEnv>) => c.json(errorBody('invalid_request', 'Invalid request'), 400)

export function pushRoutes({ db, push }: PushRouteDeps) {
	const routes = new Hono<AppEnv>()
	routes.use('*', noStore, requireSession(db), requireRole('teacher'))

	routes.get('/config', async (c) => {
		const accountId = c.get('session').account.id
		const devices = await readSnapshot(db, (executor) => listDevices(executor, accountId))
		const body: PushConfigResponse = push?.enabled
			? { enabled: true, publicKey: push.publicKey, devices }
			: { enabled: false, publicKey: null, devices }
		return c.json(body, 200)
	})

	routes.post('/subscriptions', async (c) => {
		const input = await readJson(c, pushSubscribeRequest)
		if (!input) return invalidRequest(c)
		const result = await saveSubscription(db, c.get('session').account.id, input)
		if (result.kind === 'taken') return c.json(errorBody('forbidden', 'This device is registered to another account'), 409)
		return c.json({ id: result.id } satisfies PushSubscribeResponse, result.kind === 'created' ? 201 : 200)
	})

	routes.delete('/subscriptions', async (c) => {
		const input = await readJson(c, pushUnsubscribeRequest)
		if (!input) return invalidRequest(c)
		await removeSubscription(db, c.get('session').account.id, input.endpoint)
		return c.body(null, 204)
	})

	routes.post('/presence', async (c) => {
		const input = await readJson(c, pushPresenceRequest)
		if (!input) return invalidRequest(c)
		const accountId = c.get('session').account.id
		if (!(await touchSubscription(db, accountId, input.endpoint, input.secondTimeZone)))
			return c.json(errorBody('not_found', 'Not Found'), 404)
		recordPresence(accountId, input.endpoint, input.screen, input.studentId ?? null)
		return c.body(null, 204)
	})

	return routes
}
