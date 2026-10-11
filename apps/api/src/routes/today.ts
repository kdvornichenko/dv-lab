import { Hono } from 'hono'

import type { TodayResponse } from '@dv-lab/contracts'
import { type Database, readSnapshot } from '@dv-lab/db'

import { type AppEnv, noStore, requireRole, requireSession } from '../auth/middleware.ts'
import { readTeacherSettings } from '../settings/settings.ts'
import { readToday } from '../today/today.ts'

type TodayRouteDeps = { db: Database }

export function todayRoutes({ db }: TodayRouteDeps) {
	const routes = new Hono<AppEnv>()
	routes.use('*', noStore, requireSession(db), requireRole('teacher'))

	routes.get('/', async (c) => {
		const accountId = c.get('session').account.id
		const today = await readSnapshot(db, async (executor) => {
			const now = new Date()
			const settings = await readTeacherSettings(executor, accountId)
			return readToday(executor, { now, defaultTimeZone: settings.defaultTimeZone }, settings.paysSoonLessons)
		})
		return c.json(today satisfies TodayResponse, 200)
	})

	return routes
}
