import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

import { serverEnv } from './config/env'
import { optionalAuth, requireAuth } from './middleware/auth'
import { authRoutes } from './routes/auth'
import { calendarRoutes } from './routes/calendar'
import { dashboardRoutes } from './routes/dashboard'
import { lessonRoutes } from './routes/lessons'
import { paymentRoutes } from './routes/payments'
import { studentRoutes } from './routes/students'

export const app = new Hono()

app.use('*', logger())
app.use(
	'*',
	cors({
		origin: [serverEnv.APP_ORIGIN, 'http://localhost:3000'],
		credentials: true,
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
app.route('/students', studentRoutes)
app.route('/lessons', lessonRoutes)
app.route('/payments', paymentRoutes)
app.route('/calendar', calendarRoutes)
app.route('/dashboard', dashboardRoutes)

app.notFound((context) => context.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404))

app.onError((error, context) => {
	console.error(error)
	return context.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, 500)
})

export type ApiApp = typeof app
