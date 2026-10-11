import type { Context } from 'hono'
import { Hono } from 'hono'
import { z } from 'zod'

import {
	type ScheduleCreateResponse,
	type ScheduleLessonResponse,
	type ScheduleMarkResponse,
	type ScheduleOccurrenceResponse,
	type ScheduleSeriesResponse,
	createLessonRequest,
	endSeriesRequest,
	isIsoDate,
	lessonActionRequest,
	markLessonRequest,
	moveLessonRequest,
	moveSeriesRequest,
	scheduleWeekStart,
} from '@dv-lab/contracts'
import { addDays, startOfZonedDay, weekdayOf } from '@dv-lab/core'
import { type Database, readSnapshot } from '@dv-lab/db'

import { type AppEnv, noStore, readJson, requireRole, requireSession } from '../auth/middleware.ts'
import { readCalendarWindow } from '../calendar/read-model.ts'
import type { CalendarReads, CalendarReadContext, CalendarReadSelection } from '../calendar/reads.ts'
import { errorBody } from '../request-context.ts'
import {
	type ChangeFailure,
	cancelLesson,
	cancelOccurrence,
	moveLesson,
	moveOccurrence,
	restoreLesson,
	restoreOccurrence,
} from '../schedule/changes.ts'
import { markLesson, markOccurrence } from '../schedule/marks.ts'
import { createLesson } from '../schedule/schedule.ts'
import { endSeries, moveSeries } from '../schedule/series.ts'
import { readTeacherSettings } from '../settings/settings.ts'

type ScheduleRouteDeps = { db: Database; calendarReads?: CalendarReads }

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

export function scheduleRoutes({ db, calendarReads }: ScheduleRouteDeps) {
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
			start: startOfZonedDay(start, settings.defaultTimeZone),
			end: startOfZonedDay(addDays(start, 7), settings.defaultTimeZone),
			displayTimeZone: settings.defaultTimeZone,
		}
		await calendarReads?.refreshCalendarRead(context, selection)
		const week = await readSnapshot(db, (executor) => readCalendarWindow(executor, context, selection))
		const response = c.json(week, 200)
		calendarReads?.observePublicWeek(context, c.req.raw, response, week)
		return response
	})

	routes.post('/lessons', async (c) => {
		const input = await readJson(c, createLessonRequest)
		if (!input) return invalidRequest(c)
		const result = await createLesson(db, c.get('session').account.id, input)
		switch (result.kind) {
			case 'invalid':
				return invalidRequest(c)
			case 'default_time_zone_changed':
			case 'nonexistent_local_time':
				return refused(c, result)
			case 'lesson':
				return c.json({ lesson: result.lesson } satisfies ScheduleCreateResponse, 201)
			case 'series':
				return c.json({ series: result.series } satisfies ScheduleCreateResponse, result.existing ? 200 : 201)
		}
	})

	routes.post('/series/:id/occurrences/:originalOn/move', async (c) => {
		const ref = occurrenceParam(c)
		if (ref === null) return notFound(c)
		const input = await readJson(c, moveLessonRequest)
		if (!input) return invalidRequest(c)
		const result = await moveOccurrence(db, c.get('session').account.id, ref.seriesId, ref.originalOn, input)
		if (result.kind !== 'ok') return refused(c, result)
		return c.json({ occurrence: result.occurrence } satisfies ScheduleOccurrenceResponse, 200)
	})

	for (const [action, change] of [
		['cancel', cancelOccurrence],
		['restore', restoreOccurrence],
	] as const) {
		routes.post(`/series/:id/occurrences/:originalOn/${action}`, async (c) => {
			const ref = occurrenceParam(c)
			if (ref === null) return notFound(c)
			const input = await readJson(c, lessonActionRequest)
			if (!input) return invalidRequest(c)
			const result = await change(db, ref.seriesId, ref.originalOn, input, new Date())
			if (result.kind !== 'ok') return refused(c, result)
			return c.json({ occurrence: result.occurrence } satisfies ScheduleOccurrenceResponse, 200)
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

	routes.post('/lessons/:id/move', async (c) => {
		const id = idParam(c)
		if (id === null) return notFound(c)
		const input = await readJson(c, moveLessonRequest)
		if (!input) return invalidRequest(c)
		const result = await moveLesson(db, c.get('session').account.id, id, input)
		if (result.kind !== 'ok') return refused(c, result)
		return c.json({ lesson: result.lesson } satisfies ScheduleLessonResponse, 200)
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

	for (const [action, change] of [
		['cancel', cancelLesson],
		['restore', restoreLesson],
	] as const) {
		routes.post(`/lessons/:id/${action}`, async (c) => {
			const id = idParam(c)
			if (id === null) return notFound(c)
			const input = await readJson(c, lessonActionRequest)
			if (!input) return invalidRequest(c)
			const result = await change(db, id, input, new Date())
			if (result.kind !== 'ok') return refused(c, result)
			return c.json({ lesson: result.lesson } satisfies ScheduleLessonResponse, 200)
		})
	}

	routes.post('/series/:id/move', async (c) => {
		const id = idParam(c)
		if (id === null) return notFound(c)
		const input = await readJson(c, moveSeriesRequest)
		if (!input) return invalidRequest(c)
		const result = await moveSeries(db, c.get('session').account.id, id, input)
		if (result.kind === 'ends_before_new_day') {
			return c.json(
				errorBody('series_ends_before_new_day', 'The series ends before the first lesson on the new day'),
				400
			)
		}
		if (result.kind === 'today_passed') {
			return c.json(errorBody('series_today_passed', "Today's lesson of this series has already started"), 400)
		}
		if (result.kind !== 'ok') return refused(c, result)
		return c.json({ series: result.series } satisfies ScheduleSeriesResponse, 200)
	})

	routes.post('/series/:id/end', async (c) => {
		const id = idParam(c)
		if (id === null) return notFound(c)
		const input = await readJson(c, endSeriesRequest)
		if (!input) return invalidRequest(c)
		const result = await endSeries(db, c.get('session').account.id, id, input)
		if (result.kind !== 'ok') return refused(c, result)
		return c.json({ series: result.series } satisfies ScheduleSeriesResponse, 200)
	})

	return routes
}
