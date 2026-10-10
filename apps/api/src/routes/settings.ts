import type { Context } from 'hono'
import { Hono } from 'hono'

import { type SettingsResponse, updateSettingsRequest } from '@dv-lab/contracts'
import type { Database } from '@dv-lab/db'

import { type AppEnv, noStore, readJson, requireRole, requireSession } from '../auth/middleware.ts'
import { errorBody } from '../request-context.ts'
import { readSnapshot } from '../schedule/rows.ts'
import { readPaysSoonLessons, savePaysSoonLessons } from '../settings/settings.ts'

type SettingsRouteDeps = { db: Database }

const invalidRequest = (c: Context<AppEnv>) => c.json(errorBody('invalid_request', 'Invalid request'), 400)

export function settingsRoutes({ db }: SettingsRouteDeps) {
	const routes = new Hono<AppEnv>()
	routes.use('*', noStore, requireSession(db), requireRole('teacher'))

	routes.get('/', async (c) => {
		const accountId = c.get('session').account.id
		const paysSoonLessons = await readSnapshot(db, (executor) => readPaysSoonLessons(executor, accountId))
		return c.json({ settings: { paysSoonLessons } } satisfies SettingsResponse, 200)
	})

	routes.patch('/', async (c) => {
		const input = await readJson(c, updateSettingsRequest)
		if (!input) return invalidRequest(c)
		const paysSoonLessons = await savePaysSoonLessons(db, c.get('session').account.id, input.paysSoonLessons)
		return c.json({ settings: { paysSoonLessons } } satisfies SettingsResponse, 200)
	})

	return routes
}
