import type { Context } from 'hono'
import { Hono } from 'hono'

import { type SettingsResponse, updateSettingsRequest } from '@dv-lab/contracts'
import { type Database, readSnapshot } from '@dv-lab/db'

import { type AppEnv, noStore, readJson, requireRole, requireSession } from '../auth/middleware.ts'
import { errorBody } from '../request-context.ts'
import { readTeacherSettings, saveTeacherSettings } from '../settings/settings.ts'

type SettingsRouteDeps = { db: Database }

const invalidRequest = (c: Context<AppEnv>) => c.json(errorBody('invalid_request', 'Invalid request'), 400)

export function settingsRoutes({ db }: SettingsRouteDeps) {
	const routes = new Hono<AppEnv>()
	routes.use('*', noStore, requireSession(db), requireRole('teacher'))

	routes.get('/', async (c) => {
		const accountId = c.get('session').account.id
		const settings = await readSnapshot(db, (executor) => readTeacherSettings(executor, accountId))
		return c.json({ settings } satisfies SettingsResponse, 200)
	})

	routes.patch('/', async (c) => {
		const input = await readJson(c, updateSettingsRequest)
		if (!input) return invalidRequest(c)
		const result = await saveTeacherSettings(db, c.get('session').account.id, input)
		if (!result.ok)
			return c.json(
				errorBody(result.error, 'Default time zone changed elsewhere. Refresh the page and try again.'),
				409
			)
		return c.json({ settings: result.settings } satisfies SettingsResponse, 200)
	})

	return routes
}
