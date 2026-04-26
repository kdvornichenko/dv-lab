import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

import type { Context } from 'hono'

import { serverEnv } from './config/env'
import { optionalAuth, requireAuth } from './middleware/auth'
import { authRoutes } from './routes/auth'
import { calendarRoutes } from './routes/calendar'
import { dashboardRoutes } from './routes/dashboard'
import { errorRoutes } from './routes/errors'
import { lessonRoutes } from './routes/lessons'
import { paymentRoutes } from './routes/payments'
import { settingsRoutes } from './routes/settings'
import { studentRoutes } from './routes/students'

const defaultCorsOrigins = ['http://localhost:3000', 'https://dv-lab.dev', 'https://www.dv-lab.dev']
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

export const app = new Hono()

app.use('*', logger())
app.use(
	'*',
	cors({
		origin: allowedCorsOrigin,
		allowMethods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'PATCH', 'OPTIONS'],
		credentials: true,
		maxAge: 600,
	})
)
app.use('*', optionalAuth)

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

app.notFound((context) =>
	withCorsHeaders(context, context.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404))
)

app.onError((error, context) => {
	console.error(error)
	return withCorsHeaders(
		context,
		context.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, 500)
	)
})

export type ApiApp = typeof app
