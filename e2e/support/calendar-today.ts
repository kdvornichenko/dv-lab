import { expect, type APIRequestContext, type Page } from '@playwright/test'

import { calendarReadStatus, calendarWriteStatus } from '../../packages/contracts/src/calendar.ts'
import { addDays, scheduleToday } from '../../packages/core/src/index.ts'
import { api, readSettings, readToday } from './api.ts'
import { cleanupFixtures, quote, registerFixture, reserveFixture, sql, teacherCredentials } from './data.ts'
import { list, record, text, uuid } from './input.ts'

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
		const clock = Date.now()
		const pastAt = new Date(clock - 86400000).toISOString()
		const futureAt = new Date(clock + 60000).toISOString()
		const lessonId = uuid(
			sql(`insert into lessons (student_id, starts_at, duration_minutes, time_zone)
values (${quote(studentId)}::uuid, ${quote(pastAt)}::timestamptz, 60, ${quote(defaultTimeZone)}) returning id`)[0]?.id
		)
		const futureId = uuid(
			sql(`insert into lessons (student_id, starts_at, duration_minutes, time_zone)
values (${quote(studentId)}::uuid, ${quote(futureAt)}::timestamptz, 60, ${quote(defaultTimeZone)}) returning id`)[0]?.id
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
		const startsAt = text(response.asOf)
		const boundaryId = uuid(
			sql(`insert into lessons (student_id, starts_at, duration_minutes, time_zone)
values (${quote(studentId)}::uuid, ${quote(startsAt)}::timestamptz, 60, ${quote(text(response.defaultTimeZone))}) returning id`)[0]
				?.id
		)
		const observed = record(await api(request, 'GET', '/today'))
		const asOf = text(observed.asOf)
		expect(startsAt <= asOf, 'Observed API time reaches the historical boundary').toBe(true)
		expect(
			list(observed.lessons)
				.map(record)
				.some((block) => block.key === `l:${boundaryId}`),
			'A lesson at or before asOf stays in Today history'
		).toBe(true)
		console.info(`C2 exact-asOf boundary: ${startsAt === asOf ? 'OBSERVED' : 'NOT_OBSERVED'}`)
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

export async function calendarTodayUi(page: Page) {
	await withCalendarToday(page.request, async ({ lessonId, studentId, futureId }) => {
		await page.goto('/')
		const status = page.getByText('No checked calendar view is available for these dates.', { exact: true })
		await expect(status).toBeVisible()
		await expect(page.getByText('No lessons today', { exact: true })).toHaveCount(0)
		await expect(page.locator(`[data-key="l:${futureId}"]`)).toHaveCount(0)
		await expect(page.locator('#today-pays-soon')).toBeVisible()
		const row = page.locator(`[data-key="l:${lessonId}"]`)
		await expect(row).toBeVisible()
		await row.locator('[data-slot="today-row-open"]').click()
		const dialog = page.getByRole('dialog')
		await expect(dialog).toBeVisible()
		await expect(dialog.getByRole('button', { name: 'Move lesson', exact: true })).toHaveCount(0)
		await expect(dialog.getByRole('button', { name: 'Cancel lesson', exact: true })).toHaveCount(0)
		await page.keyboard.press('Escape')
		await row.getByRole('button', { name: /as done$/ }).click()
		await expect(row).toHaveCount(0)
		await page.setViewportSize({ width: 390, height: 844 })
		await expect(status).toBeVisible()
		const bounds = await status.boundingBox()
		expect(
			bounds !== null && bounds.x >= 0 && bounds.x + bounds.width <= 390,
			'Calendar status fits narrow viewport'
		).toBe(true)
		await page.getByRole('button', { name: 'Refresh', exact: true }).click()
		await expect(status).toBeVisible()
		await page.goto('/students')
		const card = page.getByRole('row').filter({ has: page.locator(`a[href="/students/${studentId}"]`) })
		await expect(card.getByText('Next lesson could not be determined.', { exact: true })).toBeVisible()
		await expect(card.getByText('None', { exact: true })).toHaveCount(0)
		await expect(card.getByText('No next lesson', { exact: true })).toHaveCount(0)
	})
}
