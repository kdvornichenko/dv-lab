import type { Context } from 'hono'
import { Hono } from 'hono'
import { z } from 'zod'

import {
	type ScheduleCreateResponse,
	type ScheduleOccurrenceResponse,
	type ScheduleWeekResponse,
	createLessonRequest,
	isIsoDate,
	lessonActionRequest,
	moveLessonRequest,
	scheduleWeekStart,
} from '@dv-lab/contracts'
import { weekdayOf } from '@dv-lab/core'
import type { Database } from '@dv-lab/db'

import { type AppEnv, noStore, readJson, requireRole, requireSession } from '../auth/middleware.ts'
import { errorBody } from '../request-context.ts'
import { type ChangeFailure, cancelOccurrence, moveOccurrence, restoreOccurrence } from '../schedule/changes.ts'
import { createLesson, readWeek } from '../schedule/schedule.ts'

type ScheduleRouteDeps = { db: Database }

const WEEK_START_MIN = '2000-01-03'

const WEEK_START_MAX = '2100-12-27'

const invalidRequest = (c: Context<AppEnv>) => c.json(errorBody('invalid_request', 'Invalid request'), 400)

const notFound = (c: Context<AppEnv>) => c.json(errorBody('not_found', 'Not Found'), 404)

const lessonChanged = (c: Context<AppEnv>) =>
	c.json(errorBody('lesson_changed', 'This lesson was changed elsewhere'), 409)

function refused(c: Context<AppEnv>, failure: ChangeFailure) {
	switch (failure.kind) {
		case 'not_found':
			return notFound(c)
		case 'changed':
			return lessonChanged(c)
		case 'invalid':
			return invalidRequest(c)
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

export function scheduleRoutes({ db }: ScheduleRouteDeps) {
	const routes = new Hono<AppEnv>()
	routes.use('*', noStore, requireSession(db), requireRole('teacher'))

	routes.get('/week', async (c) => {
		const start = weekStart(c.req.query('start'))
		if (start === null) return invalidRequest(c)
		return c.json((await readWeek(db, start, new Date())) satisfies ScheduleWeekResponse, 200)
	})

	routes.post('/lessons', async (c) => {
		const input = await readJson(c, createLessonRequest)
		if (!input) return invalidRequest(c)
		const result = await createLesson(db, input, new Date())
		switch (result.kind) {
			case 'invalid':
				return invalidRequest(c)
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
		const result = await moveOccurrence(db, ref.seriesId, ref.originalOn, input, new Date())
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

	return routes
}
