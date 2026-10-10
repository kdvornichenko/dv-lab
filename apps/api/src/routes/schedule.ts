import type { Context } from 'hono'
import { Hono } from 'hono'

import {
	type ScheduleCreateResponse,
	type ScheduleWeekResponse,
	createLessonRequest,
	scheduleWeekStart,
} from '@dv-lab/contracts'
import { weekdayOf } from '@dv-lab/core'
import type { Database } from '@dv-lab/db'

import { type AppEnv, noStore, readJson, requireRole, requireSession } from '../auth/middleware.ts'
import { errorBody } from '../request-context.ts'
import { createLesson, readWeek } from '../schedule/schedule.ts'

type ScheduleRouteDeps = { db: Database }

const WEEK_START_MIN = '2000-01-03'

const WEEK_START_MAX = '2100-12-27'

const invalidRequest = (c: Context<AppEnv>) => c.json(errorBody('invalid_request', 'Invalid request'), 400)

function weekStart(value: string | undefined): string | null {
	const start = scheduleWeekStart.safeParse(value)
	if (!start.success) return null
	if (weekdayOf(start.data) !== 1 || start.data < WEEK_START_MIN || start.data > WEEK_START_MAX) return null
	return start.data
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

	return routes
}
