import { Hono } from 'hono'
import type { Logger } from 'pino'
import { errorBody, requestContext } from './request-context.ts'

export type AppDeps = { logger: Logger }

export function createApp(deps: AppDeps) {
	const app = new Hono<{ Variables: { requestId: string } }>()
	app.use('*', requestContext(deps.logger))
	app.get('/healthz', (c) => c.json({ status: 'ok' }))
	app.onError((err, c) => {
		deps.logger.error({ err }, 'request failed')
		return c.json(errorBody('internal_error', 'Internal Server Error'), 500)
	})
	app.notFound((c) => c.json(errorBody('not_found', 'Not Found'), 404))
	return app
}
