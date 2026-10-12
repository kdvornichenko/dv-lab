import { Hono, type Context } from 'hono'

import {
	googleCallbackQuery,
	googleConnectRequest,
	googleConfirmRevokedRequest,
	googleDisconnectRequest,
	googleCommandByRequestParams,
	googleCommandParams,
	googleUnresolvedCommandsQuery,
	googleResumeCommandRequest,
	googleConflictRequest,
} from '@dv-lab/contracts'
import type { Database } from '@dv-lab/db'

import { type AppEnv, noStore, readJson, requireRole, requireSession } from '../auth/middleware.ts'
import type { CalendarCommands } from '../calendar/commands.ts'
import type { ConnectionControl } from '../calendar/connection-control.ts'
import type { CalendarConnection } from '../calendar/connection.ts'
import { CalendarFault } from '../calendar/gateway.ts'
import { CommandFault, commandSnapshot, findRequest, readCommand, unresolvedCommands } from '../calendar/journal.ts'
import type { ConsentActor } from '../calendar/oauth-session.ts'
import { opaqueVersion } from '../calendar/read-state.ts'
import { errorBody } from '../request-context.ts'

type GoogleRouteDeps = {
	db: Database
	connection?: CalendarConnection
	control?: ConnectionControl
	commands?: CalendarCommands
	isStopping: () => boolean
}

function actor(c: Context<AppEnv, string, {}>): ConsentActor {
	const session = c.get('session')
	return { accountId: session.account.id, sessionToken: session.token }
}

function refusal(c: Context<AppEnv, string, {}>, error: unknown) {
	if (error instanceof CommandFault) return c.json(errorBody(error.code, 'Calendar command refused'), error.status)
	if (error instanceof CalendarFault) {
		switch (error.code) {
			case 'connection_required':
			case 'reconnect_required':
			case 'permission_required':
			case 'command_pending':
			case 'disconnect_failed':
			case 'external_change':
				return c.json(errorBody(error.code, 'Calendar action is unavailable'), 409)
		}
	}
	return c.json(errorBody('provider_unavailable', 'Calendar is unavailable'), 503)
}

export function googleRoutes({ db, connection, control, commands, isStopping }: GoogleRouteDeps) {
	const routes = new Hono<AppEnv>()
	routes.use(
		'*',
		noStore,
		async (c, next) => {
			c.header('Referrer-Policy', 'no-referrer')
			await next()
		},
		requireSession(db),
		requireRole('teacher')
	)

	routes.get('/callback', async (c) => {
		const parsed = googleCallbackQuery.safeParse(c.req.query())
		if (!parsed.success) return c.redirect('/settings?google=invalid_state', 303)
		if (!connection || isStopping()) return c.redirect('/settings?google=provider_unavailable', 303)
		try {
			await connection.completeConsent(actor(c), parsed.data)
			return c.redirect('/settings?google=connected', 303)
		} catch (error) {
			const reason = error instanceof CalendarFault ? error.code : 'provider_unavailable'
			return c.redirect(`/settings?google=${reason}`, 303)
		}
	})
	routes.get('/connection', async (c) => {
		if (!connection || isStopping()) return refusal(c, null)
		return c.json(await connection.readConnection(actor(c).accountId))
	})
	routes.post('/conflicts', async (c) => {
		const input = await readJson(c, googleConflictRequest)
		if (!input) return c.json(errorBody('invalid_request', 'Invalid request'), 400)
		if (!commands || isStopping())
			return c.json({
				state: 'unavailable',
				inputKey: opaqueVersion([JSON.stringify(input)]),
				reason: 'provider_unavailable',
			})
		return c.json(await commands.checkCalendarConflicts({ accountId: actor(c).accountId, now: new Date() }, input))
	})
	routes.post('/connect', async (c) => {
		if (!(await readJson(c, googleConnectRequest))) return c.json(errorBody('invalid_request', 'Invalid request'), 400)
		if (!connection || isStopping()) return refusal(c, null)
		try {
			return c.json(await connection.beginConsent(actor(c)))
		} catch (error) {
			return refusal(c, error)
		}
	})
	routes.post('/disconnect', async (c) => {
		if (!(await readJson(c, googleDisconnectRequest)))
			return c.json(errorBody('invalid_request', 'Invalid request'), 400)
		if (!control || isStopping()) return refusal(c, null)
		try {
			return c.json(await control.disconnect(actor(c)), 202)
		} catch (error) {
			return refusal(c, error)
		}
	})
	routes.post('/disconnect/confirm-revoked', async (c) => {
		if (!(await readJson(c, googleConfirmRevokedRequest)))
			return c.json(errorBody('invalid_request', 'Explicit confirmation is required'), 400)
		if (!control || isStopping()) return refusal(c, null)
		try {
			return c.json(await control.confirmRevoked(actor(c)))
		} catch (error) {
			return refusal(c, error)
		}
	})
	routes.get('/commands/by-request/:requestId', async (c) => {
		const parsed = googleCommandByRequestParams.safeParse(c.req.param())
		if (!parsed.success) return c.json(errorBody('invalid_request', 'Invalid request'), 400)
		const command = await findRequest(db, actor(c).accountId, parsed.data.requestId)
		if (!command) return c.json(errorBody('not_found', 'Not Found'), 404)
		return c.json(commandSnapshot(command))
	})
	routes.get('/commands', async (c) => {
		if (!googleUnresolvedCommandsQuery.safeParse(c.req.query()).success)
			return c.json(errorBody('invalid_request', 'Invalid request'), 400)
		return c.json({ commands: (await unresolvedCommands(db, actor(c).accountId)).map(commandSnapshot) })
	})
	routes.get('/commands/:commandId', async (c) => {
		const parsed = googleCommandParams.safeParse(c.req.param())
		if (!parsed.success) return c.json(errorBody('invalid_request', 'Invalid request'), 400)
		try {
			const context = { accountId: actor(c).accountId, now: new Date() }
			return c.json(
				commands
					? await commands.readCalendarCommand(context, parsed.data.commandId)
					: commandSnapshot(await readCommand(db, context.accountId, parsed.data.commandId))
			)
		} catch (error) {
			return refusal(c, error)
		}
	})
	routes.post('/commands/:commandId/resume', async (c) => {
		const parsed = googleCommandParams.safeParse(c.req.param())
		if (!parsed.success || !(await readJson(c, googleResumeCommandRequest)))
			return c.json(errorBody('invalid_request', 'Invalid request'), 400)
		if (!commands || isStopping()) return refusal(c, new CalendarFault('connection_required'))
		try {
			return c.json(
				await commands.resumeCalendarCommand({ accountId: actor(c).accountId, now: new Date() }, parsed.data.commandId),
				202
			)
		} catch (error) {
			return refusal(c, error)
		}
	})
	return routes
}
