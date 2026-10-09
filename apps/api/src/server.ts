import { serve } from '@hono/node-server'

import type { Server } from 'node:http'
import { WebSocketServer } from 'ws'

import { createDb } from '@dv-lab/db'

import { createApp } from './app.ts'
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

const app = createApp({
	logger,
	db,
	gitSha: config.GIT_SHA,
	appOrigin: config.APP_ORIGIN,
	isStopping: lifecycle.isStopping,
})

const wss = new WebSocketServer({ noServer: true, maxPayload: 65536 })

const server = serve({ fetch: app.fetch, port: config.PORT, websocket: { server: wss } }, (info) =>
	logger.info({ port: info.port }, 'listening')
) as Server

lifecycle.manage({ server, wss, resources: [{ name: 'pg-pool', close: () => pool.end() }] })
