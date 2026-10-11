import { expect, type APIRequestContext } from '@playwright/test'

import { calendarReadStatus, calendarWriteStatus } from '../../packages/contracts/src/calendar.ts'
import { addDays, scheduleToday } from '../../packages/core/src/index.ts'
import { api, readSettings, readToday } from './api.ts'
import { cleanupFixtures, quote, registerFixture, reserveFixture, sql, teacherCredentials } from './data.ts'
import { record, uuid } from './input.ts'

export async function withCalendarToday(
	request: APIRequestContext,
	check: (fixture: { studentId: string; lessonId: string; futureId: string }) => Promise<void>
) {
	await api(request, 'POST', '/auth/sign-in', teacherCredentials())
	cleanupFixtures()
	const displayName = 'Alex Example 2189'
	reserveFixture(displayName)
	try {
		const created = record(
			await api(request, 'POST', '/students', {
				displayName,
				rateMinor: null,
				currency: null,
				defaultLessonMinutes: 60,
				parent: null,
				level: null,
				goals: null,
				timeZone: null,
			})
		)
		const studentId = uuid(record(created.student).id)
		registerFixture(displayName, studentId)
		const { defaultTimeZone } = await readSettings(request)
		const today = scheduleToday(new Date(), defaultTimeZone)
		await api(request, 'PUT', `/students/${studentId}/opening-balance`, {
			lessonsHundredths: 0,
			on: addDays(today, -3),
			expectedDefaultTimeZone: defaultTimeZone,
		})
		const lessonId = uuid(
			sql(`insert into lessons (student_id, starts_at, duration_minutes, time_zone)
values (${quote(studentId)}::uuid, now() - interval '1 day', 60, ${quote(defaultTimeZone)}) returning id`)[0]?.id
		)
		const futureId = uuid(
			sql(`insert into lessons (student_id, starts_at, duration_minutes, time_zone)
values (${quote(studentId)}::uuid, now() + interval '1 minute', 60, ${quote(defaultTimeZone)}) returning id`)[0]?.id
		)
		await check({ studentId, lessonId, futureId })
	} finally {
		cleanupFixtures()
		await api(request, 'POST', '/auth/sign-out', undefined, 204)
	}
}

export async function calendarTodayUnavailable(request: APIRequestContext) {
	await withCalendarToday(request, async ({ studentId, lessonId, futureId }) => {
		const response = record(await api(request, 'GET', '/today'))
		const read = calendarReadStatus.safeParse(response.calendarRead)
		const write = calendarWriteStatus.safeParse(response.calendarWrite)
		expect(read.success, 'Today supplies a validated Calendar read status').toBe(true)
		expect(write.success, 'Today supplies a validated Calendar write status').toBe(true)
		if (!read.success || !write.success) throw new Error('Today Calendar status is missing')
		expect(read.data.state).toBe('unavailable')
		expect(write.data.state).toBe('blocked')
		const today = await readToday(request)
		expect(
			today.lessons.some((block) => block.key === `l:${futureId}`),
			'Legacy future is hidden'
		).toBe(false)
		const history = [...today.lessons, ...today.earlier].find((block) => block.key === `l:${lessonId}`)
		expect(history?.actions.mark, 'Historical marking stays available').toBe(true)
		expect(
			today.paysSoon.some((card) => card.id === studentId),
			'Pays soon survives unavailable Calendar'
		).toBe(true)
		await api(request, 'POST', `/schedule/lessons/${lessonId}/mark`, { kind: 'done' })
		const marked = await readToday(request)
		expect(
			marked.earlier.some((block) => block.key === `l:${lessonId}`),
			'Marked earlier lesson leaves the queue'
		).toBe(false)
	})
}
