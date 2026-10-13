import type { Context } from 'hono'
import { Hono } from 'hono'
import { z } from 'zod'

import {
	type CalendarActionResponse,
	type ChatConversationReadResponse,
	type ChatConversationResponse,
	type ChatConversationsResponse,
	type ChatStudentFacts,
	type SendMessageResponse,
	type UndoResponse,
	chatRecordsQuery,
	deleteConversationRequest,
	renameConversationRequest,
	sendMessageRequest,
	undoRequest,
} from '@dv-lab/contracts'
import { type Database, readSnapshot } from '@dv-lab/db'

import { type AppEnv, noStore, readJson, requireRole, requireSession } from '../auth/middleware.ts'
import type { CalendarCommands } from '../calendar/commands.ts'
import { type ChatContext, sendMessage, undoAction } from '../chat/actions.ts'
import { type CalendarOutcome, checkCalendarAction, confirmCalendarChange } from '../chat/calendar.ts'
import {
	createConversation,
	deleteConversation,
	listConversations,
	readConversation,
	renameConversation,
} from '../chat/conversations.ts'
import { readChatFacts } from '../chat/facts.ts'
import { listMessages } from '../chat/messages.ts'
import { errorBody } from '../request-context.ts'
import { readTeacherSettings } from '../settings/settings.ts'

type ChatRouteDeps = { db: Database; calendarCommands?: CalendarCommands }

const emptyRequest = z.strictObject({})

const invalidRequest = (c: Context<AppEnv>) => c.json(errorBody('invalid_request', 'Invalid request'), 400)

const notFound = (c: Context<AppEnv>) => c.json(errorBody('not_found', 'Not Found'), 404)

const conversationChanged = (c: Context<AppEnv>) =>
	c.json(errorBody('precondition_failed', 'The conversation changed'), 409)

function conversationId(c: Context<AppEnv>): string | null {
	const id = z.uuid().safeParse(c.req.param('id'))
	return id.success ? id.data : null
}

export function chatRoutes({ db, calendarCommands }: ChatRouteDeps) {
	const routes = new Hono<AppEnv>()
	routes.use('*', noStore, requireSession(db), requireRole('teacher'))

	async function chatContext(c: Context<AppEnv>): Promise<ChatContext> {
		const accountId = c.get('session').account.id
		const settings = await readTeacherSettings(db, accountId)
		return {
			accountId,
			now: new Date(),
			defaultTimeZone: settings.defaultTimeZone,
			calendarEnabled: calendarCommands !== undefined,
		}
	}

	function calendarReply(c: Context<AppEnv>, outcome: CalendarOutcome, status: 200 | 202) {
		if (outcome.kind === 'not_found') return notFound(c)
		if (outcome.kind !== 'ok') return c.json(errorBody('precondition_failed', 'The action cannot be changed'), 409)
		return c.json({ block: outcome.block } satisfies CalendarActionResponse, status)
	}

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

	routes.post('/conversations', async (c) => {
		const accountId = c.get('session').account.id
		const conversation = await createConversation(db, accountId)
		return c.json({ conversation } satisfies ChatConversationResponse, 201)
	})

	routes.get('/conversations', async (c) => {
		const accountId = c.get('session').account.id
		const conversations = await listConversations(db, accountId)
		return c.json({ conversations } satisfies ChatConversationsResponse, 200)
	})

	routes.get('/conversations/:id', async (c) => {
		const id = conversationId(c)
		if (id === null) return notFound(c)
		const accountId = c.get('session').account.id
		const read = await readSnapshot(db, async (executor) => {
			const conversation = await readConversation(executor, accountId, id)
			if (conversation === null) return null
			return { conversation, messages: await listMessages(executor, accountId, id), turn: null }
		})
		if (read === null) return notFound(c)
		return c.json(read satisfies ChatConversationReadResponse, 200)
	})

	routes.post('/conversations/:id/messages', async (c) => {
		const id = conversationId(c)
		if (id === null) return notFound(c)
		const input = await readJson(c, sendMessageRequest)
		if (!input) return invalidRequest(c)
		const result = await sendMessage(db, await chatContext(c), id, input)
		if (result.kind === 'not_found') return notFound(c)
		if (result.kind === 'conflict') return c.json(errorBody('precondition_failed', 'The request changed'), 409)
		if (result.kind === 'busy') return c.json(errorBody('busy', 'A reply is still coming'), 409)
		const body = {
			conversation: result.conversation,
			messages: result.messages,
			turn: result.turn,
		} satisfies SendMessageResponse
		return c.json(body, result.replayed ? 200 : 201)
	})

	routes.post('/actions/:id/undo', async (c) => {
		const id = conversationId(c)
		if (id === null) return notFound(c)
		const input = await readJson(c, undoRequest)
		if (!input) return invalidRequest(c)
		const result = await undoAction(db, await chatContext(c), id, input, calendarCommands)
		if (result.kind === 'not_found') return notFound(c)
		if (result.kind !== 'ok') return c.json(errorBody('precondition_failed', 'The action cannot be undone'), 409)
		return c.json({ block: result.block } satisfies UndoResponse, 200)
	})

	routes.post('/actions/:id/confirm', async (c) => {
		const id = conversationId(c)
		if (id === null) return notFound(c)
		if (!(await readJson(c, emptyRequest))) return invalidRequest(c)
		const outcome = await confirmCalendarChange(db, calendarCommands, await chatContext(c), id)
		return calendarReply(c, outcome, 202)
	})

	routes.post('/actions/:id/check', async (c) => {
		const id = conversationId(c)
		if (id === null) return notFound(c)
		if (!(await readJson(c, emptyRequest))) return invalidRequest(c)
		const outcome = await checkCalendarAction(db, calendarCommands, await chatContext(c), id)
		return calendarReply(c, outcome, 200)
	})

	routes.patch('/conversations/:id', async (c) => {
		const id = conversationId(c)
		if (id === null) return notFound(c)
		const input = await readJson(c, renameConversationRequest)
		if (!input) return invalidRequest(c)
		const accountId = c.get('session').account.id
		const result = await db.transaction((tx) => renameConversation(tx, accountId, id, input))
		if (result.kind === 'not_found') return notFound(c)
		if (result.kind === 'changed') return conversationChanged(c)
		return c.json({ conversation: result.conversation } satisfies ChatConversationResponse, 200)
	})

	routes.delete('/conversations/:id', async (c) => {
		const id = conversationId(c)
		if (id === null) return notFound(c)
		const input = await readJson(c, deleteConversationRequest)
		if (!input) return invalidRequest(c)
		const accountId = c.get('session').account.id
		const result = await db.transaction((tx) => deleteConversation(tx, accountId, id, input))
		if (result.kind === 'not_found') return notFound(c)
		if (result.kind === 'changed') return conversationChanged(c)
		return c.body(null, 204)
	})

	return routes
}
