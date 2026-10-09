import { Hono } from 'hono'
import type { Logger } from 'pino'

import { type MeResponse, type SignInResponse, signInRequest } from '@dv-lab/contracts'
import type { Database } from '@dv-lab/db'

import { type AppEnv, clientIp, noStore, readJson, requireSession, setSessionCookie } from '../auth/middleware.ts'
import type { SignIn } from '../auth/sign-in.ts'
import { errorBody } from '../request-context.ts'

type AuthRouteDeps = { db: Database; signIn: SignIn; production: boolean; logger: Logger }

export function authRoutes({ db, signIn, production }: AuthRouteDeps) {
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
		return c.json(errorBody('invalid_credentials', 'Wrong login or password'), 401)
	})

	routes.get('/me', requireSession(db), (c) => {
		const { account, renewDue } = c.get('session')
		return c.json({ account, renewDue } satisfies MeResponse, 200)
	})

	return routes
}
