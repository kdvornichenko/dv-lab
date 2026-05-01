import { Hono } from 'hono'
import type { Context } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { randomUUID } from 'node:crypto'

import { serverEnv } from './config/env'
import { apiError, redactSensitiveText, sanitizeErrorDetails } from './http/errors'
import { createOptionalAuth, requireAuth, type ApiHonoEnv } from './middleware/auth'
import { authRoutes } from './routes/auth'
import { calendarRoutes } from './routes/calendar'
import { dashboardRoutes } from './routes/dashboard'
import { errorRoutes } from './routes/errors'
import { lessonRoutes } from './routes/lessons'
import { paymentRoutes } from './routes/payments'
import { settingsRoutes } from './routes/settings'
import { studentRoutes } from './routes/students'
import { type DbContextOptions, runWithDbContext } from './services/db-context'
import { type ApiMemoryStore, runWithStorageContext } from './services/storage-context'

const defaultCorsOrigins = ['http://localhost:3000']
const corsOrigins = Array.from(
	new Set([
		serverEnv.APP_ORIGIN,
		...defaultCorsOrigins,
		...(serverEnv.CORS_ORIGINS ?? '')
			.split(',')
			.map((origin) => origin.trim())
			.filter(Boolean),
	])
)

function allowedCorsOrigin(origin: string) {
	return corsOrigins.includes(origin) ? origin : null
}

function withCorsHeaders(context: Context, response: Response) {
	const origin = context.req.header('origin')
	const allowOrigin = origin ? allowedCorsOrigin(origin) : null
	if (!allowOrigin) return response

	response.headers.set('Access-Control-Allow-Origin', allowOrigin)
	response.headers.set('Access-Control-Allow-Credentials', 'true')
	response.headers.append('Vary', 'Origin')
	return response
}

export type CreateAppOptions = {
	storeNamespace?: string
	auth?: Parameters<typeof createOptionalAuth>[0]
	db?: DbContextOptions
	memoryStore?: ApiMemoryStore
}

function assertRuntimeStorageConfigured(options: CreateAppOptions) {
	if (serverEnv.NODE_ENV !== 'production') return
	if (options.db && options.db.db === null) {
		throw new Error('Production API cannot run with an explicitly null database context')
	}
	if (options.memoryStore) {
		throw new Error('Production API cannot run with in-memory storage')
	}
}

export function createApp(options: CreateAppOptions = {}) {
	assertRuntimeStorageConfigured(options)

	const app = new Hono<ApiHonoEnv>()

	app.use('*', logger())
	app.use('*', async (context, next) => {
		const requestId = context.req.header('x-request-id')?.trim() || randomUUID()
		context.set('requestId', requestId)
		await next()
		context.header('x-request-id', requestId)
	})
	app.use(
		'*',
		cors({
			origin: allowedCorsOrigin,
			allowMethods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'PATCH', 'OPTIONS'],
			credentials: true,
			maxAge: 600,
		})
	)
	app.use('*', async (context, next) => {
		context.set('storeNamespace', options.storeNamespace)
		await next()
	})
	if (options.db) {
		app.use('*', async (_context, next) => runWithDbContext(options.db!, next))
	}
	if (options.memoryStore) {
		app.use('*', async (_context, next) => runWithStorageContext({ memoryStore: options.memoryStore }, next))
	}
	app.use('*', createOptionalAuth(options.auth))

	app.get('/healthz', (context) => context.json({ ok: true, service: 'teacher-crm-api' }, 200))

	app.use('/auth/me', requireAuth)
	app.route('/auth', authRoutes)
	app.use('/students', requireAuth)
	app.use('/students/*', requireAuth)
	app.use('/lessons', requireAuth)
	app.use('/lessons/*', requireAuth)
	app.use('/payments', requireAuth)
	app.use('/payments/*', requireAuth)
	app.use('/calendar', requireAuth)
	app.use('/calendar/*', requireAuth)
	app.use('/dashboard', requireAuth)
	app.use('/dashboard/*', requireAuth)
	app.use('/settings', requireAuth)
	app.use('/settings/*', requireAuth)
	app.use('/errors', requireAuth)
	app.use('/errors/*', requireAuth)
	app.route('/students', studentRoutes)
	app.route('/lessons', lessonRoutes)
	app.route('/payments', paymentRoutes)
	app.route('/calendar', calendarRoutes)
	app.route('/dashboard', dashboardRoutes)
	app.route('/settings', settingsRoutes)
	app.route('/errors', errorRoutes)

	app.notFound((context) => withCorsHeaders(context, context.json(apiError('NOT_FOUND', 'Route not found'), 404)))

	app.onError((error, context) => {
		const requestId = context.get('requestId')
		console.error('[teacher-crm] unhandled api error', {
			requestId,
			method: context.req.method,
			path: context.req.path,
			error: sanitizeErrorDetails(error),
		})
		const body = apiError('INTERNAL_ERROR', redactSensitiveText('Internal server error'))
		return withCorsHeaders(
			context,
			context.json({ ...body, error: { ...body.error, ...(requestId ? { requestId } : {}) } }, 500)
		)
	})

	return app
}

export const app = createApp()

export type ApiApp = ReturnType<typeof createApp>
