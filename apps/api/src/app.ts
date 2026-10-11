import { upgradeWebSocket, type WebSocketLike } from '@hono/node-server'

import { sql } from 'drizzle-orm'
import { Hono, type Context, type MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { WSEvents } from 'hono/ws'
import type { Logger } from 'pino'

import type { Database } from '@dv-lab/db'

import { type AppEnv, originMatches, sameOrigin } from './auth/middleware.ts'
import type { SignIn } from './auth/sign-in.ts'
import type { ConnectionControl } from './calendar/connection-control.ts'
import type { CalendarConnection } from './calendar/connection.ts'
import type { CalendarReads } from './calendar/reads.ts'
import { errorBody, requestContext } from './request-context.ts'
import { authRoutes } from './routes/auth.ts'
import { googleRoutes } from './routes/google.ts'
import { paymentRoutes } from './routes/payments.ts'
import { scheduleRoutes } from './routes/schedule.ts'
import { settingsRoutes } from './routes/settings.ts'
import { studentRoutes } from './routes/students.ts'
import { todayRoutes } from './routes/today.ts'

export type AppDeps = {
	logger: Logger
	db: Database
	gitSha: string
	appOrigin: string
	production: boolean
	isStopping: () => boolean
	signIn: SignIn
	calendar?: CalendarConnection
	calendarControl?: ConnectionControl
	calendarReads?: CalendarReads
}

function clientErrorBody(status: number) {
	switch (status) {
		case 401:
			return errorBody('unauthenticated', 'Sign in required')
		case 403:
			return errorBody('forbidden', 'Forbidden')
		case 404:
			return errorBody('not_found', 'Not Found')
		default:
			return errorBody('invalid_request', 'Invalid request')
	}
}

const upgrade: (events: () => WSEvents<WebSocketLike>) => MiddlewareHandler<AppEnv, string, { outputFormat: 'ws' }> =
	upgradeWebSocket

export function createApp(deps: AppDeps) {
	const app = new Hono<AppEnv>()
	app.use('*', requestContext(deps.logger))
	app.use('*', sameOrigin(deps.appOrigin))
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
			if (!originMatches(c, deps.appOrigin)) return c.json(errorBody('forbidden_origin', 'Forbidden'), 403)
			await next()
		},
		upgrade(() => ({
			onMessage(event: { data: unknown }, ws: { send: (data: string) => void }) {
				if (typeof event.data === 'string') ws.send(event.data)
			},
		}))
	)
	app.route('/auth', authRoutes({ db: deps.db, signIn: deps.signIn, production: deps.production, logger: deps.logger }))
	app.route(
		'/google',
		googleRoutes({ db: deps.db, connection: deps.calendar, control: deps.calendarControl, isStopping: deps.isStopping })
	)
	app.route('/students', studentRoutes({ db: deps.db, calendarReads: deps.calendarReads }))
	app.route('/payments', paymentRoutes({ db: deps.db }))
	app.route('/schedule', scheduleRoutes({ db: deps.db, calendarReads: deps.calendarReads }))
	app.route('/settings', settingsRoutes({ db: deps.db }))
	app.route('/today', todayRoutes({ db: deps.db, calendarReads: deps.calendarReads }))
	app.onError((err: Error, c: Context<AppEnv, string, {}>) => {
		if (err instanceof HTTPException && err.status >= 400 && err.status < 500) {
			return c.json(clientErrorBody(err.status), err.status)
		}
		deps.logger.error({ err }, 'request failed')
		return c.json(errorBody('internal_error', 'Internal Server Error'), 500)
	})
	app.notFound((c: Context<AppEnv, string, {}>) => c.json(errorBody('not_found', 'Not Found'), 404))
	return app
}
