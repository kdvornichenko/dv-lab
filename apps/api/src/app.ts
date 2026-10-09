import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import type { Logger } from 'pino'

import type { Database } from '@dv-lab/db'

import { errorBody, requestContext } from './request-context.ts'

export type AppDeps = {
	logger: Logger
	db: Pick<Database, 'execute'>
	gitSha: string
	isStopping: () => boolean
}

export function createApp(deps: AppDeps) {
	const app = new Hono<{ Variables: { requestId: string } }>()
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
	app.onError((err, c) => {
		deps.logger.error({ err }, 'request failed')
		return c.json(errorBody('internal_error', 'Internal Server Error'), 500)
	})
	app.notFound((c) => c.json(errorBody('not_found', 'Not Found'), 404))
	return app
}
