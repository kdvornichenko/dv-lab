import { Hono } from 'hono'

export const authRoutes = new Hono().get('/me', (context) => {
	const user = context.get('user')
	return context.json({ ok: true, user }, 200)
})
