import { Hono } from 'hono'

import { updateSidebarSettingsSchema, type SidebarSettingsResponse } from '@teacher-crm/api-types'

import { validateJson } from '../http/validation'
import { actorFromContext, requirePermission } from '../middleware/auth'
import { settingsService } from '../services/settings-service'

export const settingsRoutes = new Hono()
	.get('/sidebar', requirePermission('settings', 'manage'), async (context) => {
		const response: SidebarSettingsResponse = {
			ok: true,
			items: await settingsService.listSidebarItems(actorFromContext(context)),
		}
		return context.json(response, 200)
	})
	.put('/sidebar', requirePermission('settings', 'manage'), validateJson(updateSidebarSettingsSchema), async (context) => {
		const response: SidebarSettingsResponse = {
			ok: true,
			items: await settingsService.saveSidebarItems(actorFromContext(context), context.req.valid('json')),
		}
		return context.json(response, 200)
	})
