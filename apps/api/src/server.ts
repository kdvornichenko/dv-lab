import { serve } from '@hono/node-server'

import type { Server } from 'node:http'
import { WebSocketServer } from 'ws'

import { createDb } from '@dv-lab/db'

import { createApp } from './app.ts'
import { createHousekeeping } from './auth/housekeeping.ts'
import { createSignIn } from './auth/sign-in.ts'
import { loadConfig } from './config.ts'
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

const app = createApp({
	logger,
	db,
	gitSha: config.GIT_SHA,
	appOrigin: config.APP_ORIGIN,
	production,
	isStopping: lifecycle.isStopping,
	signIn,
})

const wss = new WebSocketServer({ noServer: true, maxPayload: 65536 })

const server = serve({ fetch: app.fetch, port: config.PORT, websocket: { server: wss } }, (info) =>
	logger.info({ port: info.port }, 'listening')
) as Server

housekeeping.start()

lifecycle.manage({ server, wss, resources: [housekeeping, { name: 'pg-pool', close: () => pool.end() }] })
