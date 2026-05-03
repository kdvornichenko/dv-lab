import { Hono } from 'hono'
import { z } from 'zod'

import {
	calendarBusyQuerySchema,
	calendarBlockIdParamSchema,
	createCalendarBlockSchema,
	updateCalendarBlockSchema,
	calendarUpsertLessonEventSchema,
	type CalendarBlockMutationResponse,
	type CalendarBlocksResponse,
	type CalendarBusyResponse,
	type CalendarConnectionResponse,
	type CalendarImportResponse,
	type CalendarListResponse,
	type CalendarResponse,
	type CalendarSyncResponse,
} from '@teacher-crm/api-types'

import { apiError, errorResponse, notFoundResponse } from '../http/errors'
import { validateJson, validateParams } from '../http/validation'
import { actorFromContext, requirePermission } from '../middleware/auth'
import { calendarService } from '../services/calendar-service'

function normalizeBusyIntervalTitle<T extends { title?: string | null }>(interval: T) {
	return {
		...interval,
		title: interval.title?.trim() || 'Busy time',
	}
}

const selectCalendarSchema = z.object({
	calendarId: z.string().min(1),
	calendarName: z.string().min(1),
})

const providerTokensSchema = z.object({
	email: z.string().email().optional(),
	providerToken: z.string().min(1),
	providerRefreshToken: z.string().min(1).nullable().optional(),
	expiresAt: z.string().optional(),
})

export const calendarRoutes = new Hono()
	.get('/connection', requirePermission('calendar', 'read'), async (context) => {
		const state = await calendarService.getCalendarState(actorFromContext(context))
		const response: CalendarResponse = { ok: true, ...state }
		return context.json(response, 200)
	})
	.get('/calendars', requirePermission('calendar', 'read'), async (context) => {
		const response: CalendarListResponse = {
			ok: true,
			calendars: await calendarService.listCalendars(actorFromContext(context)),
		}
		return context.json(response, 200)
	})
	.get('/blocks', requirePermission('calendar', 'read'), async (context) => {
		const response: CalendarBlocksResponse = {
			ok: true,
			blocks: await calendarService.listCalendarBlocks(actorFromContext(context)),
		}
		return context.json(response, 200)
	})
	.post('/blocks', requirePermission('calendar', 'sync'), validateJson(createCalendarBlockSchema), async (context) => {
		const response: CalendarBlockMutationResponse = {
			ok: true,
			block: await calendarService.createCalendarBlock(actorFromContext(context), context.req.valid('json')),
		}
		return context.json(response, 201)
	})
	.patch(
		'/blocks/:blockId',
		requirePermission('calendar', 'sync'),
		validateParams(calendarBlockIdParamSchema),
		validateJson(updateCalendarBlockSchema),
		async (context) => {
			const block = await calendarService.updateCalendarBlock(
				actorFromContext(context),
				context.req.param('blockId'),
				context.req.valid('json')
			)
			if (!block) return notFoundResponse(context, 'Calendar block not found')
			const response: CalendarBlockMutationResponse = { ok: true, block }
			return context.json(response, 200)
		}
	)
	.delete(
		'/blocks/:blockId',
		requirePermission('calendar', 'sync'),
		validateParams(calendarBlockIdParamSchema),
		async (context) => {
			const block = await calendarService.deleteCalendarBlock(actorFromContext(context), context.req.param('blockId'))
			if (!block) return notFoundResponse(context, 'Calendar block not found')
			const response: CalendarBlockMutationResponse = { ok: true, block }
			return context.json(response, 200)
		}
	)
	.post('/busy', requirePermission('calendar', 'read'), validateJson(calendarBusyQuerySchema), async (context) => {
		const busy = await calendarService.listBusyIntervals(actorFromContext(context), context.req.valid('json'))
		const response: CalendarBusyResponse = { ok: true, busy: busy.map(normalizeBusyIntervalTitle) }
		return context.json(response, 200)
	})
	.post('/connections', requirePermission('calendar', 'connect'), async (context) => {
		const user = context.get('user')
		if (!user?.email) {
			return errorResponse(context, 400, apiError('VALIDATION_FAILED', 'Google account email is required'))
		}

		const response: CalendarConnectionResponse = {
			ok: true,
			connection: await calendarService.connectCalendar(actorFromContext(context), user.email),
		}
		return context.json(response, 200)
	})
	.post(
		'/provider-tokens',
		requirePermission('calendar', 'connect'),
		validateJson(providerTokensSchema),
		async (context) => {
			const input = context.req.valid('json')
			const email = context.get('user')?.email
			if (!email) {
				return errorResponse(context, 400, apiError('VALIDATION_FAILED', 'Google account email is required'))
			}

			const response: CalendarConnectionResponse = {
				ok: true,
				connection: await calendarService.saveProviderTokens(actorFromContext(context), {
					email,
					providerToken: input.providerToken,
					providerRefreshToken: input.providerRefreshToken,
					expiresAt: input.expiresAt,
				}),
			}
			return context.json(response, 200)
		}
	)
	.patch(
		'/connection',
		requirePermission('calendar', 'connect'),
		validateJson(selectCalendarSchema),
		async (context) => {
			const input = context.req.valid('json')
			const response: CalendarConnectionResponse = {
				ok: true,
				connection: await calendarService.selectCalendar(
					actorFromContext(context),
					input.calendarId,
					input.calendarName
				),
			}
			return context.json(response, 200)
		}
	)
	.post(
		'/sync-events',
		requirePermission('calendar', 'sync'),
		validateJson(calendarUpsertLessonEventSchema),
		async (context) => {
			const input = context.req.valid('json')
			if (input.syncPolicy === 'skip') {
				const sync = await calendarService.ensureCalendarSyncRecord(
					actorFromContext(context),
					input.lessonId,
					'disabled'
				)
				if (!sync) return notFoundResponse(context, 'Lesson not found')
				const response: CalendarSyncResponse = { ok: true, sync }
				return context.json(response, 200)
			}

			const sync = await calendarService.syncLessonToCalendar(actorFromContext(context), input.lessonId)
			if (!sync) return notFoundResponse(context, 'Lesson not found')
			if (sync.status === 'failed') {
				return errorResponse(
					context,
					500,
					apiError('INTERNAL_ERROR', sync.lastError ?? 'Google Calendar event sync failed', { sync })
				)
			}
			const response: CalendarSyncResponse = { ok: true, sync }
			return context.json(response, 200)
		}
	)
	.post('/import-events', requirePermission('calendar', 'sync'), async (context) => {
		const result = await calendarService.importSyncedLessonsFromCalendar(actorFromContext(context))
		const response: CalendarImportResponse = { ok: true, ...result }
		return context.json(response, 200)
	})
