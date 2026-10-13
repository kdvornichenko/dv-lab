import { Hono } from 'hono'

import { type ChatStudentFacts, chatRecordsQuery } from '@dv-lab/contracts'
import { type Database, readSnapshot } from '@dv-lab/db'

import { type AppEnv, noStore, requireRole, requireSession } from '../auth/middleware.ts'
import { readChatFacts } from '../chat/facts.ts'
import { errorBody } from '../request-context.ts'
import { readTeacherSettings } from '../settings/settings.ts'

type ChatRouteDeps = { db: Database }

export function chatRoutes({ db }: ChatRouteDeps) {
	const routes = new Hono<AppEnv>()
	routes.use('*', noStore, requireSession(db), requireRole('teacher'))

	routes.get('/records', async (c) => {
		const query = chatRecordsQuery.safeParse(c.req.query())
		if (!query.success) return c.json(errorBody('invalid_request', 'Invalid request'), 400)
		const accountId = c.get('session').account.id
		const context = { accountId, now: new Date() }
		const facts = await readSnapshot(db, async (executor) => {
			const settings = await readTeacherSettings(executor, accountId)
			return readChatFacts(
				executor,
				Object.assign(context, { defaultTimeZone: settings.defaultTimeZone }),
				query.data.studentId,
				settings.paysSoonLessons
			)
		})
		if (facts === null) return c.json(errorBody('not_found', 'Not Found'), 404)
		return c.json(facts satisfies ChatStudentFacts, 200)
	})

	return routes
}
