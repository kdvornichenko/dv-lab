import type { Page } from '@playwright/test'

import type {
	StudentResponse,
	ErrorResponse,
	ScheduleSeriesResponse,
	ScheduleLessonResponse,
} from '../../../packages/contracts/src/index.ts'
import * as core from '../../../packages/core/src/index.ts'
import { api, check, sql } from '../browser-context.ts'
import { quote, whenText } from './format.ts'
import { VN } from './navigation.ts'

export const READ_LIKE = 'Alex Example 2007%'

export const NAME_A = 'Alex Example 2007 A'

export const NAME_B = 'Alex Example 2007 B'

export async function createCard(page: Page, name: string, minutes: number, goals: string | null) {
	const result = await api<StudentResponse & Partial<ErrorResponse>>(page, 'POST', '/students', {
		displayName: name,
		rateMinor: null,
		currency: null,
		defaultLessonMinutes: minutes,
		parent: null,
		level: null,
		goals,
		timeZone: null,
	})
	check(`${name} card created`, result.status === 201, String(result.status))
	return result.json!.student.id
}

export async function readFixtures(page: Page) {
	const today = core.zonedParts(new Date(), VN).date
	const wednesday = core.firstOnOrAfter(core.addDays(today, 1), 3)
	const a = await createCard(page, NAME_A, 60, 'Prepare for a speaking test')
	const b = await createCard(page, NAME_B, 30, null)
	const series = await api<ScheduleSeriesResponse & Partial<ErrorResponse>>(page, 'POST', '/schedule/lessons', {
		studentId: a,
		date: wednesday,
		startTime: '18:00',
		durationMinutes: 60,
		repeats: 'weekly',
	})
	check('series A created', series.status === 201 && Boolean(series.json?.series?.id), String(series.status))
	const single = await api<ScheduleLessonResponse & Partial<ErrorResponse>>(page, 'POST', '/schedule/lessons', {
		studentId: b,
		date: wednesday,
		startTime: '18:30',
		durationMinutes: 60,
		repeats: 'once',
	})
	check('single B on the same Wednesday created', single.status === 201, String(single.status))
	const thursday = core.addDays(wednesday, 1)
	const short = await api<ScheduleLessonResponse & Partial<ErrorResponse>>(page, 'POST', '/schedule/lessons', {
		studentId: b,
		date: thursday,
		startTime: '09:00',
		durationMinutes: 30,
		repeats: 'once',
	})
	check('short single B on Thursday created', short.status === 201, String(short.status))
	const seriesId = series.json!.series.id
	const movedFrom = core.addDays(wednesday, 7)
	const movedTo = core.addDays(wednesday, 9)
	sql(
		`insert into lesson_exceptions (series_id, original_on, kind, starts_at, duration_minutes) values (${quote(seriesId)}, ${quote(movedFrom)}, 'moved', ${quote(whenText(movedTo, '10:00'))}, 60)`
	)
	const cancelledOn = core.addDays(wednesday, 14)
	sql(
		`insert into lesson_exceptions (series_id, original_on, kind) values (${quote(seriesId)}, ${quote(cancelledOn)}, 'cancelled')`
	)
	const farFrom = core.addDays(wednesday, 21)
	const farTo = core.addDays(wednesday, 26)
	sql(
		`insert into lesson_exceptions (series_id, original_on, kind, starts_at, duration_minutes) values (${quote(seriesId)}, ${quote(farFrom)}, 'moved', ${quote(whenText(farTo, '11:00'))}, 60)`
	)
	const pastDate = core.addDays(today, -1)
	const past = await api<ScheduleLessonResponse & Partial<ErrorResponse>>(page, 'POST', '/schedule/lessons', {
		studentId: b,
		date: pastDate,
		startTime: '10:00',
		durationMinutes: 60,
		repeats: 'once',
	})
	check('past single B created', past.status === 201, String(past.status))
	return {
		today,
		a,
		b,
		seriesId,
		wednesday,
		thursday,
		movedFrom,
		movedTo,
		farFrom,
		farTo,
		pastDate,
		cancelledOn,
		week0: core.mondayOf(wednesday),
		week1: core.mondayOf(movedFrom),
		week2: core.mondayOf(cancelledOn),
	}
}
