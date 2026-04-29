import { Hono } from 'hono'

import type { DashboardResponse } from '@teacher-crm/api-types'

import { actorFromContext, requirePermission } from '../middleware/auth'
import { dashboardService } from '../services/dashboard-service'

export const dashboardRoutes = new Hono().get('/', requirePermission('dashboard', 'read'), async (context) => {
	const response: DashboardResponse = {
		ok: true,
		summary: await dashboardService.getDashboardSummary(actorFromContext(context)),
	}
	return context.json(response, 200)
})
