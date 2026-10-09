import { Hono } from 'hono'
import type { Logger } from 'pino'
import { requestContext } from './request-context.ts'

export type AppDeps = { logger: Logger }

export function createApp(deps: AppDeps) {
	const app = new Hono<{ Variables: { requestId: string } }>()
	app.use('*', requestContext(deps.logger))
	app.get('/healthz', (c) => c.json({ status: 'ok' }))
	return app
}
