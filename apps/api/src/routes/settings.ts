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
import { readBudgetSnapshot, usageByConversation } from '../chat/budget.ts'
import { modelCapabilities } from '../chat/model-config.ts'
import { errorBody } from '../request-context.ts'
import {
	readAssistantSettings,
	readTeacherSettings,
	saveAssistantSettings,
	saveTeacherSettings,
} from '../settings/settings.ts'

type SettingsRouteDeps = { db: Database; chatEnabled?: boolean }

const USAGE_ROWS = 5

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

	async function assistantResponse(accountId: string): Promise<AssistantSettingsResponse> {
		const read = await readSnapshot(db, async (executor) => {
			const settings = await readAssistantSettings(executor, accountId)
			const { budget, periodId } = await readBudgetSnapshot(executor, accountId)
			const usage = await usageByConversation(executor, accountId, periodId, USAGE_ROWS)
			return { settings, budget, usage }
		})
		const capabilities = await modelCapabilities(read.settings, async () => chatEnabled)
		return { settings: read.settings, capabilities, budget: read.budget, usage: read.usage }
	}

	routes.get('/assistant', async (c) => c.json(await assistantResponse(c.get('session').account.id), 200))

	routes.patch('/assistant', async (c) => {
		const input = await readJson(c, saveAssistantSettingsRequest)
		if (!input) return invalidRequest(c)
		const accountId = c.get('session').account.id
		const result = await saveAssistantSettings(db, accountId, input)
		if (!result.ok) return invalidRequest(c)
		return c.json(await assistantResponse(accountId), 200)
	})

	return routes
}
