import { upgradeWebSocket } from '@hono/node-server'

import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import type { Logger } from 'pino'

import type { Database } from '@dv-lab/db'

import type { AppEnv } from './auth/middleware.ts'
import type { SignIn } from './auth/sign-in.ts'
import { errorBody, requestContext } from './request-context.ts'
import { authRoutes } from './routes/auth.ts'

export type AppDeps = {
	logger: Logger
	db: Database
	gitSha: string
	appOrigin: string
	production: boolean
	isStopping: () => boolean
	signIn: SignIn
}

export function createApp(deps: AppDeps) {
	const app = new Hono<AppEnv>()
	app.use('*', requestContext(deps.logger))
	app.get('/healthz', async (c) => {
		const sha = deps.gitSha
		if (deps.isStopping()) return c.json({ status: 'stopping', sha }, 503)
		try {
			await deps.db.execute(sql`select 1`)
			return c.json({ status: 'ok', sha, db: 'ok' })
		} catch (err) {
			deps.logger.warn({ err }, 'health database check failed')
			return c.json({ status: 'error', sha, db: 'error' }, 503)
		}
	})
	app.get(
		'/ws',
		async (c, next) => {
			if (c.req.header('origin') !== deps.appOrigin) return c.json(errorBody('forbidden_origin', 'Forbidden'), 403)
			await next()
		},
		upgradeWebSocket(() => ({
			onMessage(event, ws) {
				if (typeof event.data === 'string') ws.send(event.data)
			},
		}))
	)
	app.route('/auth', authRoutes({ db: deps.db, signIn: deps.signIn, production: deps.production, logger: deps.logger }))
	app.onError((err, c) => {
		deps.logger.error({ err }, 'request failed')
		return c.json(errorBody('internal_error', 'Internal Server Error'), 500)
	})
	app.notFound((c) => c.json(errorBody('not_found', 'Not Found'), 404))
	return app
}
