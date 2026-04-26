import { Hono } from 'hono'

import { saveCrmErrorSchema, type CrmErrorLogMutationResponse, type CrmErrorLogResponse } from '@teacher-crm/api-types'

import { validateJson } from '../http/validation'
import { actorFromContext, requirePermission } from '../middleware/auth'
import { errorLogService } from '../services/error-log-service'

export const errorRoutes = new Hono()
	.get('/', requirePermission('settings', 'manage'), async (context) => {
		const response: CrmErrorLogResponse = {
			ok: true,
			errors: await errorLogService.listErrors(actorFromContext(context)),
		}
		return context.json(response, 200)
	})
	.post('/', requirePermission('settings', 'manage'), validateJson(saveCrmErrorSchema), async (context) => {
		const response: CrmErrorLogMutationResponse = {
			ok: true,
			error: await errorLogService.saveError(actorFromContext(context), context.req.valid('json')),
		}
		return context.json(response, 201)
	})
	.delete('/', requirePermission('settings', 'manage'), async (context) => {
		await errorLogService.clearErrors(actorFromContext(context))
		return context.json({ ok: true }, 200)
	})
	.delete('/:errorId', requirePermission('settings', 'manage'), async (context) => {
		const entry = await errorLogService.deleteError(actorFromContext(context), context.req.param('errorId'))
		if (!entry) return context.json({ ok: false, error: { code: 'ERROR_NOT_FOUND', message: 'Error not found' } }, 404)
		return context.json({ ok: true, error: entry }, 200)
	})
