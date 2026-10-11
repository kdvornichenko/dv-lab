import { serve } from '@hono/node-server'

import type { Server } from 'node:http'
import { WebSocketServer } from 'ws'

import { createDb } from '@dv-lab/db'

import { createApp } from './app.ts'
import { createHousekeeping } from './auth/housekeeping.ts'
import { createSignIn } from './auth/sign-in.ts'
import { createConnectionControl } from './calendar/connection-control.ts'
import { createConnection } from './calendar/connection.ts'
import { createCredentials } from './calendar/credentials.ts'
import { createGoogleGateway } from './calendar/gateway.ts'
import { createConnectionLease } from './calendar/lease.ts'
import { createCalendarReads } from './calendar/reads.ts'
import { createTokenEnvelope } from './calendar/token-envelope.ts'
import { loadConfig, type CalendarConfig } from './config.ts'
import { createLifecycle } from './lifecycle.ts'
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

function createCalendar(calendarConfig: Extract<CalendarConfig, { enabled: true }>) {
	const lease = createConnectionLease(pool)
	const envelope = createTokenEnvelope(calendarConfig)
	const gateway = createGoogleGateway(calendarConfig)
	const credentials = createCredentials({ lease, envelope, gateway })
	const connection = createConnection({ db, lease, envelope, gateway, credentials })
	const control = createConnectionControl({
		db,
		lease,
		credentials,
		envelope,
		gateway,
		logger,
		isStopping: lifecycle.isStopping,
	})
	const reads = createCalendarReads({ db, gateway, credentials })
	return { connection, control, reads, resources: [control, lease, credentials] }
}

const app = createApp({
	logger,
	db,
	gitSha: config.GIT_SHA,
	appOrigin: config.APP_ORIGIN,
	production,
	isStopping: lifecycle.isStopping,
	signIn,
	calendar: calendar?.connection,
	calendarControl: calendar?.control,
	calendarReads: calendar?.reads,
})

const wss = new WebSocketServer({ noServer: true, maxPayload: 65536 })

const server = serve({ fetch: app.fetch, port: config.PORT, websocket: { server: wss } }, (info) =>
	logger.info({ port: info.port }, 'listening')
) as Server

housekeeping.start()
calendar?.control.start()

lifecycle.manage({
	server,
	wss,
	resources: [housekeeping, ...(calendar?.resources ?? []), { name: 'pg-pool', close: () => pool.end() }],
})
