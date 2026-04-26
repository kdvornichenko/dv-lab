import { Hono } from 'hono'

import {
	crmThemeSettingsSchema,
	updateSidebarSettingsSchema,
	type SidebarSettingsResponse,
	type ThemeSettingsResponse,
} from '@teacher-crm/api-types'

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
	.get('/theme', requirePermission('settings', 'manage'), async (context) => {
		const response: ThemeSettingsResponse = {
			ok: true,
			theme: await settingsService.getTheme(actorFromContext(context)),
		}
		return context.json(response, 200)
	})
	.put(
		'/sidebar',
		requirePermission('settings', 'manage'),
		validateJson(updateSidebarSettingsSchema),
		async (context) => {
			const response: SidebarSettingsResponse = {
				ok: true,
				items: await settingsService.saveSidebarItems(actorFromContext(context), context.req.valid('json')),
			}
			return context.json(response, 200)
		}
	)
	.put('/theme', requirePermission('settings', 'manage'), validateJson(crmThemeSettingsSchema), async (context) => {
		const response: ThemeSettingsResponse = {
			ok: true,
			theme: await settingsService.saveTheme(actorFromContext(context), context.req.valid('json')),
		}
		return context.json(response, 200)
	})
