import type { Context } from 'hono'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'

import {
	type CalendarActionResponse,
	type ChatConversationReadResponse,
	type ChatConversationResponse,
	type ChatConversationsResponse,
	type ChatRecordsRefreshResponse,
	type ChatStreamEvent,
	type ChatStudentFacts,
	type ChatTurnResponse,
	type SendMessageResponse,
	type UndoResponse,
	chatRecordsQuery,
	chatRecordsRefreshRequest,
	conversationModelRequest,
	deleteConversationRequest,
	renameConversationRequest,
	sendMessageRequest,
	undoRequest,
} from '@dv-lab/contracts'
import { type Database, readSnapshot } from '@dv-lab/db'

import { type AppEnv, noStore, readJson, requireRole, requireSession } from '../auth/middleware.ts'
import { readSession } from '../auth/sessions.ts'
import type { CalendarCommands } from '../calendar/commands.ts'
import { type ChatContext, sendMessage, undoAction } from '../chat/actions.ts'
import { type CalendarOutcome, checkCalendarAction, confirmCalendarChange } from '../chat/calendar.ts'
import {
	createConversation,
	deleteConversation,
	listConversations,
	readConversation,
	renameConversation,
	setConversationModel,
} from '../chat/conversations.ts'
import { readChatFacts, readChatRecords } from '../chat/facts.ts'
import { listMessages, unsettledActionIds } from '../chat/messages.ts'
import { type ChatRunner, turnSnapshot } from '../chat/runs.ts'
import { activeTurn, isActive, toTurn } from '../chat/turns.ts'
import { errorBody } from '../request-context.ts'
import { readTeacherSettings } from '../settings/settings.ts'

type ChatRouteDeps = {
	db: Database
	calendarCommands?: CalendarCommands
	chat?: ChatRunner
	availability?: (modelId: string) => Promise<boolean>
}

const HEARTBEAT_MS = 15000

const emptyRequest = z.strictObject({})

const invalidRequest = (c: Context<AppEnv>) => c.json(errorBody('invalid_request', 'Invalid request'), 400)

const notFound = (c: Context<AppEnv>) => c.json(errorBody('not_found', 'Not Found'), 404)

const conversationChanged = (c: Context<AppEnv>) =>
	c.json(errorBody('precondition_failed', 'The conversation changed'), 409)

function conversationId(c: Context<AppEnv>): string | null {
	const id = z.uuid().safeParse(c.req.param('id'))
	return id.success ? id.data : null
}

export function chatRoutes({ db, calendarCommands, chat, availability }: ChatRouteDeps) {
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

	routes.post('/records/refresh', async (c) => {
		const input = await readJson(c, chatRecordsRefreshRequest)
		if (!input) return invalidRequest(c)
		const context = await chatContext(c)
		const block = await readSnapshot(db, async (executor) => {
			const settings = await readTeacherSettings(executor, context.accountId)
			return readChatRecords(executor, context, input.key, settings.paysSoonLessons)
		})
		if (block === null) return notFound(c)
		return c.json({ block } satisfies ChatRecordsRefreshResponse, 200)
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
			const messages = await listMessages(executor, accountId, id)
			const active = await activeTurn(executor, id)
			return { conversation, messages, turn: active === null ? null : toTurn(active) }
		})
		if (read === null) return notFound(c)
		return c.json(read satisfies ChatConversationReadResponse, 200)
	})

	routes.post('/conversations/:id/messages', async (c) => {
		const id = conversationId(c)
		if (id === null) return notFound(c)
		const input = await readJson(c, sendMessageRequest)
		if (!input) return invalidRequest(c)
		const result = await sendMessage(db, await chatContext(c), id, input, chat ?? null)
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

	routes.get('/turns/:id', async (c) => {
		const id = conversationId(c)
		if (id === null) return notFound(c)
		const snapshot = await readSnapshot(db, (executor) => turnSnapshot(executor, c.get('session').account.id, id))
		if (snapshot === null) return notFound(c)
		return c.json({ turn: snapshot.turn } satisfies ChatTurnResponse, 200)
	})

	routes.post('/turns/:id/stop', async (c) => {
		const id = conversationId(c)
		if (id === null) return notFound(c)
		if (!(await readJson(c, emptyRequest))) return invalidRequest(c)
		const accountId = c.get('session').account.id
		const turn = chat
			? await chat.stopTurn(accountId, id)
			: await readSnapshot(db, async (executor) => (await turnSnapshot(executor, accountId, id))?.turn ?? null)
		if (turn === null) return notFound(c)
		return c.json({ turn } satisfies ChatTurnResponse, 200)
	})

	routes.get('/turns/:id/stream', async (c) => {
		const id = conversationId(c)
		if (id === null) return notFound(c)
		const session = c.get('session')
		const accountId = session.account.id
		const first = await readSnapshot(db, (executor) => turnSnapshot(executor, accountId, id))
		if (first === null) return notFound(c)
		const response = streamSSE(c, async (stream) => {
			const queue: ChatStreamEvent[] = []
			let wake: (() => void) | null = null
			let closed = false
			const notify = () => {
				const next = wake
				wake = null
				next?.()
			}
			stream.onAbort(() => {
				closed = true
				notify()
			})
			const unsubscribe =
				chat?.subscribe(id, (event) => {
					queue.push(event)
					notify()
				}) ?? null
			const send = (event: ChatStreamEvent) => stream.writeSSE({ event: event.type, data: JSON.stringify(event) })
			try {
				const snapshot = await readSnapshot(db, (executor) => turnSnapshot(executor, accountId, id))
				if (snapshot === null) return
				await send({ type: 'snapshot', seq: snapshot.seq, turn: snapshot.turn, message: snapshot.message })
				let open = isActive(snapshot.turn.state) && unsubscribe !== null
				while (open && !closed) {
					if (queue.length === 0) {
						const waited = await new Promise<boolean>((resolve) => {
							const timer = setTimeout(() => resolve(false), HEARTBEAT_MS)
							wake = () => {
								clearTimeout(timer)
								resolve(true)
							}
						})
						if (closed) break
						if (!waited && queue.length === 0) {
							if ((await readSession(db, session.token)) === null) break
							await send({ type: 'heartbeat' })
							continue
						}
					}
					for (const event of queue.splice(0)) {
						if ((event.type === 'text' || event.type === 'block') && event.seq <= snapshot.seq) continue
						await send(event)
						if (event.type === 'state' && !isActive(event.turn.state)) open = false
					}
				}
			} finally {
				unsubscribe?.()
			}
		})
		response.headers.set('Cache-Control', 'no-store, no-transform')
		return response
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

	routes.patch('/conversations/:id/model', async (c) => {
		const id = conversationId(c)
		if (id === null) return notFound(c)
		const input = await readJson(c, conversationModelRequest)
		if (!input) return invalidRequest(c)
		const accountId = c.get('session').account.id
		const result = await db.transaction((tx) =>
			setConversationModel(tx, accountId, id, input, availability ?? (async () => false))
		)
		if (result.kind === 'not_found') return notFound(c)
		if (result.kind === 'changed') return conversationChanged(c)
		if (result.kind === 'invalid') return invalidRequest(c)
		return c.json({ conversation: result.conversation } satisfies ChatConversationResponse, 200)
	})

	routes.delete('/conversations/:id', async (c) => {
		const id = conversationId(c)
		if (id === null) return notFound(c)
		const input = await readJson(c, deleteConversationRequest)
		if (!input) return invalidRequest(c)
		const accountId = c.get('session').account.id
		const context = await chatContext(c)
		for (const actionId of await unsettledActionIds(db, accountId, id))
			await checkCalendarAction(db, calendarCommands, context, actionId)
		const result = await db.transaction((tx) => deleteConversation(tx, accountId, id, input))
		if (result.kind === 'not_found') return notFound(c)
		if (result.kind === 'changed') return conversationChanged(c)
		if (result.kind === 'pending') return c.json(errorBody('busy', 'The conversation has unfinished work'), 409)
		return c.body(null, 204)
	})

	return routes
}
