import { Hono } from 'hono'
import { z } from 'zod'

import { calendarUpsertLessonEventSchema } from '@teacher-crm/api-types'

import { validateJson } from '../http/validation'
import { actorFromContext, requirePermission } from '../middleware/auth'
import { memoryStore } from '../services/memory-store'

const selectCalendarSchema = z.object({
	calendarId: z.string().min(1),
	calendarName: z.string().min(1),
})

export const calendarRoutes = new Hono()
	.get('/connection', requirePermission('calendar', 'read'), (context) =>
		context.json(
			{
				ok: true,
				connection: memoryStore.getCalendarConnection(actorFromContext(context)),
				syncRecords: memoryStore.listCalendarSyncRecords(actorFromContext(context)),
			},
			200
		)
	)
	.post('/connections', requirePermission('calendar', 'connect'), (context) => {
		const user = context.get('user')
		if (!user?.email) {
			return context.json(
				{ ok: false, error: { code: 'GOOGLE_EMAIL_REQUIRED', message: 'Google account email is required' } },
				400
			)
		}

		return context.json(
			{ ok: true, connection: memoryStore.connectCalendar(actorFromContext(context), user.email) },
			200
		)
	})
	.patch('/connection', requirePermission('calendar', 'connect'), validateJson(selectCalendarSchema), (context) => {
		const input = context.req.valid('json')
		return context.json(
			{
				ok: true,
				connection: memoryStore.selectCalendar(actorFromContext(context), input.calendarId, input.calendarName),
			},
			200
		)
	})
	.post(
		'/sync-events',
		requirePermission('calendar', 'sync'),
		validateJson(calendarUpsertLessonEventSchema),
		(context) => {
			const input = context.req.valid('json')
			if (input.syncPolicy === 'skip') {
				return context.json(
					{
						ok: true,
						sync: memoryStore.ensureCalendarSyncRecord(actorFromContext(context), input.lessonId, 'disabled'),
					},
					200
				)
			}

			const sync = memoryStore.syncLessonToCalendar(actorFromContext(context), input.lessonId)
			if (!sync) return context.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Lesson not found' } }, 404)
			return context.json({ ok: true, sync }, 200)
		}
	)
