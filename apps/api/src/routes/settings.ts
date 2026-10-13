import type { Context } from 'hono'
import { Hono } from 'hono'

import {
	type AssistantSettingsResponse,
	type SettingsResponse,
	saveAssistantSettingsRequest,
	updateSettingsRequest,
} from '@dv-lab/contracts'
import { type Database, readSnapshot } from '@dv-lab/db'

import { type AppEnv, noStore, readJson, requireRole, requireSession } from '../auth/middleware.ts'
import { modelCapabilities } from '../chat/model-config.ts'
import { errorBody } from '../request-context.ts'
import {
	readAssistantSettings,
	readTeacherSettings,
	saveAssistantSettings,
	saveTeacherSettings,
} from '../settings/settings.ts'

type SettingsRouteDeps = { db: Database; chatEnabled?: boolean }

const invalidRequest = (c: Context<AppEnv>) => c.json(errorBody('invalid_request', 'Invalid request'), 400)

export function settingsRoutes({ db, chatEnabled = false }: SettingsRouteDeps) {
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

	routes.get('/assistant', async (c) => {
		const accountId = c.get('session').account.id
		const settings = await readSnapshot(db, (executor) => readAssistantSettings(executor, accountId))
		const capabilities = await modelCapabilities(settings, async () => chatEnabled)
		return c.json({ settings, capabilities } satisfies AssistantSettingsResponse, 200)
	})

	routes.patch('/assistant', async (c) => {
		const input = await readJson(c, saveAssistantSettingsRequest)
		if (!input) return invalidRequest(c)
		const result = await saveAssistantSettings(db, c.get('session').account.id, input)
		if (!result.ok) return invalidRequest(c)
		const capabilities = await modelCapabilities(result.settings, async () => chatEnabled)
		return c.json({ settings: result.settings, capabilities } satisfies AssistantSettingsResponse, 200)
	})

	return routes
}
