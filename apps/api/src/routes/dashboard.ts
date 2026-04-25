import { Hono } from 'hono'

import { actorFromContext, requirePermission } from '../middleware/auth'
import { memoryStore } from '../services/memory-store'

export const dashboardRoutes = new Hono().get('/', requirePermission('dashboard', 'read'), (context) => {
	return context.json({ ok: true, summary: memoryStore.getDashboardSummary(actorFromContext(context)) }, 200)
})
