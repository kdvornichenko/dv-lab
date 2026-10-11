import { Hono } from 'hono'

import type { TodayResponse } from '@dv-lab/contracts'
import type { Database } from '@dv-lab/db'

import { type AppEnv, noStore, requireRole, requireSession } from '../auth/middleware.ts'
import { readSnapshot } from '../schedule/rows.ts'
import { readToday } from '../today/today.ts'

type TodayRouteDeps = { db: Database }

export function todayRoutes({ db }: TodayRouteDeps) {
	const routes = new Hono<AppEnv>()
	routes.use('*', noStore, requireSession(db), requireRole('teacher'))

	routes.get('/', async (c) => {
		const accountId = c.get('session').account.id
		const today = await readSnapshot(db, (executor) => readToday(executor, accountId, new Date()))
		return c.json(today satisfies TodayResponse, 200)
	})

	return routes
}
