import { Hono, type Context } from 'hono'

import {
	googleCallbackQuery,
	googleConnectRequest,
	googleConfirmRevokedRequest,
	googleDisconnectRequest,
} from '@dv-lab/contracts'
import type { Database } from '@dv-lab/db'

import { type AppEnv, noStore, readJson, requireRole, requireSession } from '../auth/middleware.ts'
import type { ConnectionControl } from '../calendar/connection-control.ts'
import type { CalendarConnection } from '../calendar/connection.ts'
import { CalendarFault } from '../calendar/gateway.ts'
import type { ConsentActor } from '../calendar/oauth-session.ts'
import { errorBody } from '../request-context.ts'

type GoogleRouteDeps = {
	db: Database
	connection?: CalendarConnection
	control?: ConnectionControl
	isStopping: () => boolean
}

function actor(c: Context<AppEnv, string, {}>): ConsentActor {
	const session = c.get('session')
	return { accountId: session.account.id, sessionToken: session.token }
}

function refusal(c: Context<AppEnv, string, {}>, error: unknown) {
	if (error instanceof CalendarFault) {
		switch (error.code) {
			case 'connection_required':
			case 'reconnect_required':
			case 'permission_required':
			case 'command_pending':
			case 'disconnect_failed':
				return c.json(errorBody(error.code, 'Calendar action is unavailable'), 409)
		}
	}
	return c.json(errorBody('provider_unavailable', 'Calendar is unavailable'), 503)
}

export function googleRoutes({ db, connection, control, isStopping }: GoogleRouteDeps) {
	const routes = new Hono<AppEnv>()
	routes.use(
		'*',
		noStore,
		async (c, next) => {
			c.header('Referrer-Policy', 'no-referrer')
			await next()
		},
		requireSession(db),
		requireRole('teacher')
	)

	routes.get('/callback', async (c) => {
		const parsed = googleCallbackQuery.safeParse(c.req.query())
		if (!parsed.success) return c.redirect('/settings?google=invalid_state', 303)
		if (!connection || isStopping()) return c.redirect('/settings?google=provider_unavailable', 303)
		try {
			await connection.completeConsent(actor(c), parsed.data)
			return c.redirect('/settings?google=connected', 303)
		} catch (error) {
			const reason = error instanceof CalendarFault ? error.code : 'provider_unavailable'
			return c.redirect(`/settings?google=${reason}`, 303)
		}
	})
	routes.get('/connection', async (c) => {
		if (!connection || isStopping()) return refusal(c, null)
		return c.json(await connection.readConnection(actor(c).accountId))
	})
	routes.post('/connect', async (c) => {
		if (!(await readJson(c, googleConnectRequest))) return c.json(errorBody('invalid_request', 'Invalid request'), 400)
		if (!connection || isStopping()) return refusal(c, null)
		try {
			return c.json(await connection.beginConsent(actor(c)))
		} catch (error) {
			return refusal(c, error)
		}
	})
	routes.post('/disconnect', async (c) => {
		if (!(await readJson(c, googleDisconnectRequest)))
			return c.json(errorBody('invalid_request', 'Invalid request'), 400)
		if (!control || isStopping()) return refusal(c, null)
		try {
			return c.json(await control.disconnect(actor(c)), 202)
		} catch (error) {
			return refusal(c, error)
		}
	})
	routes.post('/disconnect/confirm-revoked', async (c) => {
		if (!(await readJson(c, googleConfirmRevokedRequest)))
			return c.json(errorBody('invalid_request', 'Explicit confirmation is required'), 400)
		if (!control || isStopping()) return refusal(c, null)
		try {
			return c.json(await control.confirmRevoked(actor(c)))
		} catch (error) {
			return refusal(c, error)
		}
	})
	return routes
}
