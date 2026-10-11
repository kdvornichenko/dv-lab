import { Hono } from 'hono'

import type { TodayResponse } from '@dv-lab/contracts'
import { type Database, readSnapshot } from '@dv-lab/db'

import { type AppEnv, noStore, requireRole, requireSession } from '../auth/middleware.ts'
import type { CalendarReads } from '../calendar/reads.ts'
import { cardIds } from '../cards/cards.ts'
import { readTeacherSettings } from '../settings/settings.ts'
import { readToday, todayWindow } from '../today/today.ts'

type TodayRouteDeps = { db: Database; calendarReads?: CalendarReads }

export function todayRoutes({ db, calendarReads }: TodayRouteDeps) {
	const routes = new Hono<AppEnv>()
	routes.use('*', noStore, requireSession(db), requireRole('teacher'))

	routes.get('/', async (c) => {
		const accountId = c.get('session').account.id
		const context = { accountId, now: new Date() }
		const settings = await readTeacherSettings(db, accountId)
		const readContext = Object.assign(context, { defaultTimeZone: settings.defaultTimeZone })
		await calendarReads?.refreshCalendarRead(readContext, { kind: 'next', studentIds: await cardIds(db) })
		await calendarReads?.refreshCalendarRead(readContext, todayWindow(readContext))
		const today = await readSnapshot(db, async (executor) => {
			const settings = await readTeacherSettings(executor, accountId)
			return readToday(
				executor,
				Object.assign(readContext, { defaultTimeZone: settings.defaultTimeZone }),
				settings.paysSoonLessons
			)
		})
		return c.json(today satisfies TodayResponse, 200)
	})

	return routes
}
