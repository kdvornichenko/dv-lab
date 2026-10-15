import { serve } from '@hono/node-server'

import type { Server } from 'node:http'
import { WebSocketServer } from 'ws'

import { createDb } from '@dv-lab/db'

import { createApp } from './app.ts'
import { createHousekeeping } from './auth/housekeeping.ts'
import { createSignIn } from './auth/sign-in.ts'
import { createCalendarCommands } from './calendar/commands.ts'
import { createConnectionControl } from './calendar/connection-control.ts'
import { createConnection } from './calendar/connection.ts'
import { createEventTitles } from './calendar/event-titles.ts'
import { createGoogleGateway } from './calendar/gateway.ts'
import { createCredentials } from './calendar/google-access.ts'
import { createConnectionLease } from './calendar/lease.ts'
import { createCalendarObservation } from './calendar/observation.ts'
import { googleSyncSource } from './calendar/sync-provider.ts'
import { createCalendarSync } from './calendar/sync.ts'
import { createTokenEnvelope } from './calendar/token-envelope.ts'
import { createCalendarWatch } from './calendar/watch.ts'
import { createCalendarWorker } from './calendar/worker.ts'
import { createChatProvider } from './chat/provider.ts'
import { createChat } from './chat/runs.ts'
import { loadConfig, type CalendarConfig } from './config.ts'
import { createLifecycle } from './lifecycle.ts'
import { createWebPushDeliver } from './push/deliver.ts'
import { createPushScheduler } from './push/scheduler.ts'
import { createLogger } from './request-context.ts'

const config = loadConfig(process.env)
const logger = createLogger(config.LOG_LEVEL)
const { pool, db } = createDb(config.databaseUrl)
pool.on('error', (err) => logger.error({ err }, 'database pool error'))

const lifecycle = createLifecycle({
	deadlineMs: config.SHUTDOWN_DEADLINE_MS,
	logger,
	exit: (code) => process.exit(code),
})

const production = config.NODE_ENV === 'production'
const signIn = createSignIn({ db, logger, requireClientIp: production })
const housekeeping = createHousekeeping({ db, logger })
const calendar = config.calendar.enabled ? createCalendar(config.calendar) : undefined
await calendar?.worker.start()
calendar?.sync.start()
const chat = config.chat.enabled
	? createChat({
			db,
			logger,
			provider: createChatProvider({ apiKey: config.chat.apiKey }),
			calendarCommands: calendar?.commands,
			eventTitles: calendar?.eventTitles,
		})
	: undefined
await chat?.sweepInterrupted()
const pushScheduler =
	config.push.enabled && config.NODE_ENV !== 'test'
		? createPushScheduler({ db, logger, deliver: createWebPushDeliver({ push: config.push, db, logger }) })
		: undefined

function createCalendar(calendarConfig: Extract<CalendarConfig, { enabled: true }>) {
	const lease = createConnectionLease(pool)
	const envelope = createTokenEnvelope(calendarConfig)
	const gateway = createGoogleGateway(calendarConfig)
	const observation = createCalendarObservation({ logger, gitSha: config.GIT_SHA })
	const credentials = createCredentials({ db, lease, envelope, gateway, observation })
	const watch = createCalendarWatch({ db, source: gateway, appOrigin: config.APP_ORIGIN, logger })
	const sync = createCalendarSync({
		db,
		source: googleSyncSource(gateway),
		watch,
		credentials,
		logger,
		isStopping: lifecycle.isStopping,
	})
	const wake = (connectionId: string) => void sync.wake(connectionId)
	const connection = createConnection({ db, lease, envelope, gateway, credentials, observation, watch, wake })
	const control = createConnectionControl({
		db,
		lease,
		credentials,
		envelope,
		gateway,
		watch,
		logger,
		observation,
		isStopping: lifecycle.isStopping,
	})
	const worker = createCalendarWorker({
		db,
		lease,
		databaseUrl: config.databaseUrl,
		credentials,
		gateway,
		logger,
		isStopping: lifecycle.isStopping,
		afterApply: wake,
	})
	const commands = createCalendarCommands({ db, credentials, gateway, wake: worker.admit, resume: worker.resume })
	const eventTitles = createEventTitles({ db, credentials, source: gateway })
	return {
		connection,
		control,
		commands,
		worker,
		sync,
		eventTitles,
		resources: [sync, worker, control, lease, credentials],
	}
}

const app = createApp({
	logger,
	db,
	gitSha: config.GIT_SHA,
	appOrigin: config.APP_ORIGIN,
	production,
	isStopping: lifecycle.isStopping,
	signIn,
	chat,
	calendar: calendar?.connection,
	calendarControl: calendar?.control,
	calendarCommands: calendar?.commands,
	eventTitles: calendar?.eventTitles,
	calendarWake: calendar ? (connectionId) => void calendar.sync.wake(connectionId) : undefined,
	push: config.push.enabled ? { enabled: true, publicKey: config.push.publicKey } : { enabled: false },
})

const wss = new WebSocketServer({ noServer: true, maxPayload: 65536 })

const server = serve(
	{
		fetch: app.fetch,
		port: config.PORT,
		websocket: { server: wss },
	},
	(info) => logger.info({ port: info.port }, 'listening')
) as Server

housekeeping.start()
calendar?.control.start()
pushScheduler?.start()

lifecycle.manage({
	server,
	wss,
	resources: [
		housekeeping,
		...(pushScheduler ? [pushScheduler] : []),
		...(chat ? [chat] : []),
		...(calendar?.resources ?? []),
		{ name: 'pg-pool', close: () => pool.end() },
	],
})
