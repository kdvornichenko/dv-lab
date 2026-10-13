import type { Context } from 'hono'
import { Hono } from 'hono'
import { z } from 'zod'

import {
	type ChatConversationResponse,
	type ChatConversationsResponse,
	type ChatStudentFacts,
	chatRecordsQuery,
	deleteConversationRequest,
	renameConversationRequest,
} from '@dv-lab/contracts'
import { type Database, readSnapshot } from '@dv-lab/db'

import { type AppEnv, noStore, readJson, requireRole, requireSession } from '../auth/middleware.ts'
import {
	createConversation,
	deleteConversation,
	listConversations,
	readConversation,
	renameConversation,
} from '../chat/conversations.ts'
import { readChatFacts } from '../chat/facts.ts'
import { errorBody } from '../request-context.ts'
import { readTeacherSettings } from '../settings/settings.ts'

type ChatRouteDeps = { db: Database }

const invalidRequest = (c: Context<AppEnv>) => c.json(errorBody('invalid_request', 'Invalid request'), 400)

const notFound = (c: Context<AppEnv>) => c.json(errorBody('not_found', 'Not Found'), 404)

const conversationChanged = (c: Context<AppEnv>) =>
	c.json(errorBody('precondition_failed', 'The conversation changed'), 409)

function conversationId(c: Context<AppEnv>): string | null {
	const id = z.uuid().safeParse(c.req.param('id'))
	return id.success ? id.data : null
}

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
		const conversation = await readConversation(db, c.get('session').account.id, id)
		if (conversation === null) return notFound(c)
		return c.json({ conversation } satisfies ChatConversationResponse, 200)
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
