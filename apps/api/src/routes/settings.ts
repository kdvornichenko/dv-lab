import type { Context } from 'hono'
import { Hono } from 'hono'
import { z } from 'zod'

import {
	CHAT_REQUEST_LIMITS,
	type AssistantSettingsResponse,
	type CommandLimits,
	type CommandLimitsResponse,
	type CommandPromptResponse,
	type CommandPromptsResponse,
	type CommandResponse,
	type CommandsResponse,
	type SettingsResponse,
	commandLimitsRequest,
	commandStatusRequest,
	createCommandRequest,
	saveAssistantSettingsRequest,
	saveCommandPromptRequest,
	updateCommandRequest,
	updateSettingsRequest,
} from '@dv-lab/contracts'
import { type Database, readSnapshot } from '@dv-lab/db'

import { type AppEnv, noStore, readJson, requireRole, requireSession } from '../auth/middleware.ts'
import { readBudgetSnapshot, usageByConversation } from '../chat/budget.ts'
import {
	type CommandResult,
	allowedToolList,
	createCommand,
	draftLimits,
	readCommands,
	setCommandStatus,
	updateCommand,
} from '../chat/commands.ts'
import { modelCapabilities } from '../chat/model-config.ts'
import { isPromptCommand, readCommandPrompts, saveCommandPrompt } from '../chat/prompts.ts'
import { errorBody } from '../request-context.ts'
import {
	readAssistantSettings,
	readTeacherSettings,
	saveAssistantSettings,
	saveTeacherSettings,
} from '../settings/settings.ts'

type SettingsRouteDeps = { db: Database; availability?: (modelId: string) => Promise<boolean> }

const USAGE_ROWS = 5

const invalidRequest = (c: Context<AppEnv>) => c.json(errorBody('invalid_request', 'Invalid request'), 400)

const commandId = z.uuid()

function limitsText(limits: CommandLimits | null): string {
	if (limits === null) return 'The command needs too many tools'
	return `${limits.strict} of ${CHAT_REQUEST_LIMITS.strict} strict, ${limits.optional} of ${CHAT_REQUEST_LIMITS.optional} optional, ${limits.union} of ${CHAT_REQUEST_LIMITS.union} union`
}

function commandFailure(c: Context<AppEnv>, result: Extract<CommandResult, { ok: false }>) {
	switch (result.error) {
		case 'not_found':
			return c.json(errorBody('not_found', 'Command not found'), 404)
		case 'changed':
			return c.json(errorBody('precondition_failed', 'The command changed'), 409)
		case 'name_taken':
			return c.json(errorBody('name_taken', 'A command with this name already exists'), 409)
		case 'name_reserved':
			return c.json(errorBody('name_reserved', 'This name belongs to a built-in command'), 409)
		case 'too_many_tools':
			return c.json(errorBody('too_many_tools', limitsText(result.limits)), 409)
		case 'tool_not_allowed':
			return c.json(errorBody('tool_not_allowed', 'This tool cannot be used in a command'), 400)
	}
}

export function settingsRoutes({ db, availability }: SettingsRouteDeps) {
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
		const capabilities = await modelCapabilities(read.settings, availability ?? (async () => false))
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

	routes.get('/assistant/prompts', async (c) => {
		const accountId = c.get('session').account.id
		const prompts = await readSnapshot(db, (executor) => readCommandPrompts(executor, accountId))
		return c.json({ prompts } satisfies CommandPromptsResponse, 200)
	})

	routes.put('/assistant/prompts/:command', async (c) => {
		const command = `/${c.req.param('command')}`
		if (!isPromptCommand(command)) return invalidRequest(c)
		const input = await readJson(c, saveCommandPromptRequest)
		if (!input) return invalidRequest(c)
		const result = await saveCommandPrompt(db, c.get('session').account.id, command, input.body, input.expectedRevision)
		if (!result.ok) return c.json(errorBody('precondition_failed', 'The prompt changed'), 409)
		return c.json({ prompt: result.prompt } satisfies CommandPromptResponse, 200)
	})

	routes.get('/assistant/commands', async (c) => {
		const accountId = c.get('session').account.id
		const status = c.req.query('status') === 'active' ? 'active' : null
		const commands = await readSnapshot(db, (executor) => readCommands(executor, accountId, status))
		return c.json(
			{ commands, allowedTools: allowedToolList(), limits: CHAT_REQUEST_LIMITS } satisfies CommandsResponse,
			200
		)
	})

	routes.post('/assistant/commands/limits', async (c) => {
		const input = await readJson(c, commandLimitsRequest)
		if (!input) return invalidRequest(c)
		return c.json({ limits: draftLimits(input.tools, input.blocks) } satisfies CommandLimitsResponse, 200)
	})

	routes.post('/assistant/commands', async (c) => {
		const input = await readJson(c, createCommandRequest)
		if (!input) return invalidRequest(c)
		const result = await createCommand(db, c.get('session').account.id, input)
		if (!result.ok) return commandFailure(c, result)
		return c.json({ command: result.command } satisfies CommandResponse, 201)
	})

	routes.put('/assistant/commands/:id', async (c) => {
		const id = commandId.safeParse(c.req.param('id'))
		const input = await readJson(c, updateCommandRequest)
		if (!id.success || !input) return invalidRequest(c)
		const result = await updateCommand(db, c.get('session').account.id, id.data, input)
		if (!result.ok) return commandFailure(c, result)
		return c.json({ command: result.command } satisfies CommandResponse, 200)
	})

	for (const [action, status] of [
		['archive', 'archived'],
		['restore', 'active'],
	] as const) {
		routes.post(`/assistant/commands/:id/${action}`, async (c) => {
			const id = commandId.safeParse(c.req.param('id'))
			const input = await readJson(c, commandStatusRequest)
			if (!id.success || !input) return invalidRequest(c)
			const result = await setCommandStatus(db, c.get('session').account.id, id.data, status, input.expectedRevision)
			if (!result.ok) return commandFailure(c, result)
			return c.json({ command: result.command } satisfies CommandResponse, 200)
		})
	}

	return routes
}
