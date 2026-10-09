import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import type { Logger } from 'pino'

import { type MeResponse, SESSION_COOKIE, type SignInResponse, signInRequest } from '@dv-lab/contracts'
import type { Database } from '@dv-lab/db'

import {
	type AppEnv,
	clearSessionCookie,
	clientIp,
	noStore,
	readJson,
	refusalResponse,
	requireSession,
	setSessionCookie,
} from '../auth/middleware.ts'
import { deleteSession, renewSession } from '../auth/sessions.ts'
import type { SignIn } from '../auth/sign-in.ts'
import { errorBody } from '../request-context.ts'

type AuthRouteDeps = { db: Database; signIn: SignIn; production: boolean; logger: Logger }

export function authRoutes({ db, signIn, production, logger }: AuthRouteDeps) {
	const routes = new Hono<AppEnv>()
	routes.use('*', noStore)

	routes.post('/sign-in', async (c) => {
		const input = await readJson(c, signInRequest)
		if (!input) return c.json(errorBody('invalid_request', 'Invalid request'), 400)
		const ip = clientIp(c, production)
		const outcome = await signIn.attempt({ login: input.login, password: input.password, ip })
		if (outcome.kind === 'ok') {
			setSessionCookie(c, outcome.token)
			return c.json({ account: outcome.account } satisfies SignInResponse, 200)
		}
		logger.warn({ outcome: outcome.kind, clientIp: ip }, 'sign-in refused')
		if (outcome.kind === 'invalid_credentials') {
			return c.json(errorBody('invalid_credentials', 'Wrong login or password'), 401)
		}
		return refusalResponse(c, outcome)
	})

	routes.get('/me', requireSession(db), (c) => {
		const { account, renewDue } = c.get('session')
		return c.json({ account, renewDue } satisfies MeResponse, 200)
	})

	routes.post('/renew', requireSession(db), async (c) => {
		const { token } = c.get('session')
		if (!(await renewSession(db, token))) return c.json(errorBody('unauthenticated', 'Sign in required'), 401)
		setSessionCookie(c, token)
		return c.body(null, 204)
	})

	routes.post('/sign-out', async (c) => {
		await deleteSession(db, getCookie(c, SESSION_COOKIE))
		clearSessionCookie(c)
		return c.body(null, 204)
	})

	return routes
}
