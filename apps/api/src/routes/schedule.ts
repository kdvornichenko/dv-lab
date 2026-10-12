import type { Context } from 'hono'
import { Hono } from 'hono'
import { z } from 'zod'

import {
	type ScheduleMarkResponse,
	createCalendarLessonRequest,
	moveCalendarLessonRequest,
	calendarLessonActionRequest,
	moveCalendarSeriesRequest,
	endCalendarSeriesRequest,
	isIsoDate,
	markLessonRequest,
	scheduleWeekStart,
} from '@dv-lab/contracts'
import { scheduleWeekRange, weekdayOf } from '@dv-lab/core'
import { type Database, readSnapshot } from '@dv-lab/db'

import { type AppEnv, noStore, readJson, requireRole, requireSession } from '../auth/middleware.ts'
import type { CalendarCommands } from '../calendar/commands.ts'
import { CalendarFault } from '../calendar/gateway.ts'
import { CommandFault } from '../calendar/journal.ts'
import { readCalendarWindow } from '../calendar/read-model.ts'
import type { CalendarReads, CalendarReadContext, CalendarReadSelection } from '../calendar/reads.ts'
import { errorBody } from '../request-context.ts'
import type { ChangeFailure } from '../schedule/changes.ts'
import { markLesson, markOccurrence } from '../schedule/marks.ts'
import { readTeacherSettings } from '../settings/settings.ts'

type ScheduleRouteDeps = { db: Database; calendarReads?: CalendarReads; calendarCommands?: CalendarCommands }

const WEEK_START_MIN = '2000-01-03'

const WEEK_START_MAX = '2100-12-27'

const invalidRequest = (c: Context<AppEnv>) => c.json(errorBody('invalid_request', 'Invalid request'), 400)

const notFound = (c: Context<AppEnv>) => c.json(errorBody('not_found', 'Not Found'), 404)

const lessonChanged = (c: Context<AppEnv>) =>
	c.json(errorBody('lesson_changed', 'This lesson was changed elsewhere'), 409)

function refused(c: Context<AppEnv, string>, failure: ChangeFailure) {
	switch (failure.kind) {
		case 'not_found':
			return notFound(c)
		case 'changed':
			return lessonChanged(c)
		case 'invalid':
			return invalidRequest(c)
		case 'not_started':
			return c.json(errorBody('lesson_not_started', 'This lesson has not started yet'), 400)
		case 'default_time_zone_changed':
			return c.json(
				errorBody(failure.kind, 'Default time zone changed elsewhere. Refresh the page and try again.'),
				409
			)
		case 'nonexistent_local_time':
			return c.json(
				errorBody(failure.kind, 'This time does not exist in the selected time zone. Choose another time.'),
				400
			)
	}
}

function weekStart(value: string | undefined): string | null {
	const start = scheduleWeekStart.safeParse(value)
	if (!start.success) return null
	if (weekdayOf(start.data) !== 1 || start.data < WEEK_START_MIN || start.data > WEEK_START_MAX) return null
	return start.data
}

function idParam(c: Context<AppEnv>): string | null {
	const id = z.uuid().safeParse(c.req.param('id'))
	return id.success ? id.data : null
}

function occurrenceParam(c: Context<AppEnv>): { seriesId: string; originalOn: string } | null {
	const seriesId = idParam(c)
	const originalOn = c.req.param('originalOn')
	if (seriesId === null || originalOn === undefined || !isIsoDate(originalOn)) return null
	return { seriesId, originalOn }
}

function commandRefusal(c: Context<AppEnv, string, {}>, error: unknown) {
	if (error instanceof CommandFault) return c.json(errorBody(error.code, 'Calendar command refused'), error.status)
	if (error instanceof CalendarFault) {
		switch (error.code) {
			case 'connection_required':
			case 'reconnect_required':
			case 'permission_required':
			case 'command_pending':
				return c.json(errorBody(error.code, 'Calendar command is unavailable'), 409)
		}
	}
	return c.json(errorBody('provider_unavailable', 'Calendar is unavailable'), 503)
}

export function scheduleRoutes({ db, calendarReads, calendarCommands }: ScheduleRouteDeps) {
	const routes = new Hono<AppEnv>()
	routes.use('*', noStore, requireSession(db), requireRole('teacher'))

	routes.get('/week', async (c) => {
		const start = weekStart(c.req.query('start'))
		if (start === null) return invalidRequest(c)
		const accountId = c.get('session').account.id
		const context: CalendarReadContext = { accountId, now: new Date() }
		const settings = await readTeacherSettings(db, accountId)
		const selection: CalendarReadSelection = {
			kind: 'window',
			...scheduleWeekRange(start, settings.defaultTimeZone),
			displayTimeZone: settings.defaultTimeZone,
		}
		await calendarReads?.refreshCalendarRead(context, selection)
		const week = await readSnapshot(db, (executor) => readCalendarWindow(executor, context, selection))
		const response = c.json(week, 200)
		calendarReads?.observePublicWeek(context, c.req.raw, response, week)
		return response
	})

	routes.post('/lessons', async (c) => {
		const input = await readJson(c, createCalendarLessonRequest)
		if (!input) return invalidRequest(c)
		if (!calendarCommands) return commandRefusal(c, new CalendarFault('connection_required'))
		try {
			const result = await calendarCommands.submitCalendarCommand(
				{ accountId: c.get('session').account.id, now: new Date() },
				{ operation: 'create', input }
			)
			return c.json(result, 202)
		} catch (error) {
			return commandRefusal(c, error)
		}
	})

	for (const operation of ['move', 'cancel', 'restore'] as const) {
		routes.post(`/lessons/:id/${operation}`, async (c) => {
			const id = idParam(c)
			if (!id) return notFound(c)
			if (!calendarCommands) return commandRefusal(c, new CalendarFault('connection_required'))
			try {
				const context = { accountId: c.get('session').account.id, now: new Date() }
				const ref = { kind: 'single' as const, lessonId: id }
				if (operation === 'move') {
					const input = await readJson(c, moveCalendarLessonRequest)
					if (!input) return invalidRequest(c)
					return c.json(await calendarCommands.submitCalendarCommand(context, { operation, ref, input }), 202)
				}
				const input = await readJson(c, calendarLessonActionRequest)
				if (!input) return invalidRequest(c)
				return c.json(await calendarCommands.submitCalendarCommand(context, { operation, ref, input }), 202)
			} catch (error) {
				return commandRefusal(c, error)
			}
		})
	}

	for (const operation of ['move', 'cancel', 'restore'] as const) {
		routes.post(`/series/:id/occurrences/:originalOn/${operation}`, async (c) => {
			const occurrence = occurrenceParam(c)
			if (!occurrence) return notFound(c)
			if (!calendarCommands) return commandRefusal(c, new CalendarFault('connection_required'))
			try {
				const context = { accountId: c.get('session').account.id, now: new Date() }
				const ref = { kind: 'series' as const, ...occurrence }
				if (operation === 'move') {
					const input = await readJson(c, moveCalendarLessonRequest)
					if (!input) return invalidRequest(c)
					return c.json(await calendarCommands.submitCalendarCommand(context, { operation, ref, input }), 202)
				}
				const input = await readJson(c, calendarLessonActionRequest)
				if (!input) return invalidRequest(c)
				return c.json(await calendarCommands.submitCalendarCommand(context, { operation, ref, input }), 202)
			} catch (error) {
				return commandRefusal(c, error)
			}
		})
	}
	for (const operation of ['move_series', 'end_series'] as const) {
		routes.post(`/series/:id/${operation === 'move_series' ? 'move' : 'end'}`, async (c) => {
			const id = idParam(c)
			if (!id) return notFound(c)
			if (!calendarCommands) return commandRefusal(c, new CalendarFault('connection_required'))
			try {
				const context = { accountId: c.get('session').account.id, now: new Date() }
				if (operation === 'move_series') {
					const input = await readJson(c, moveCalendarSeriesRequest)
					if (!input) return invalidRequest(c)
					return c.json(await calendarCommands.submitCalendarCommand(context, { operation, seriesId: id, input }), 202)
				}
				const input = await readJson(c, endCalendarSeriesRequest)
				if (!input) return invalidRequest(c)
				return c.json(await calendarCommands.submitCalendarCommand(context, { operation, seriesId: id, input }), 202)
			} catch (error) {
				return commandRefusal(c, error)
			}
		})
	}

	routes.post('/series/:id/occurrences/:originalOn/mark', async (c) => {
		const ref = occurrenceParam(c)
		if (ref === null) return notFound(c)
		const input = await readJson(c, markLessonRequest)
		if (!input) return invalidRequest(c)
		const result = await markOccurrence(
			db,
			c.get('session').account.id,
			ref.seriesId,
			ref.originalOn,
			input,
			new Date()
		)
		if (result.kind !== 'ok') return refused(c, result)
		return c.json({ mark: result.mark } satisfies ScheduleMarkResponse, 200)
	})

	routes.post('/lessons/:id/mark', async (c) => {
		const id = idParam(c)
		if (id === null) return notFound(c)
		const input = await readJson(c, markLessonRequest)
		if (!input) return invalidRequest(c)
		const result = await markLesson(db, c.get('session').account.id, id, input, new Date())
		if (result.kind !== 'ok') return refused(c, result)
		return c.json({ mark: result.mark } satisfies ScheduleMarkResponse, 200)
	})

	return routes
}
