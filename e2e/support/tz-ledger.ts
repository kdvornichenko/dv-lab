import { expect, type APIRequest, type APIRequestContext, type Page } from '@playwright/test'

import {
	COOKIE_NAME,
	TEACHER_LOGIN,
	sql as fixtureSql,
	startApi,
	studentCookie,
	teacherCookie,
} from '../../scripts/dev-checks/api.mjs'
import { api, readSettings, type Body } from './api.ts'
import { BASE, quote } from './data.ts'
import { addDays, mondayOf, VN, zonedDate, zonedTime } from './dates.ts'
import { integer, list, record, text, uuid } from './input.ts'
import type { Card, Fx } from './test.ts'
import { changeZone, MSK, NY, pickZone, setMain, settingsPage, zoneDialog } from './tz-settings.ts'
import { staleForms } from './tz-stale-forms.ts'
import { balanceEverywhere, dueRow, lessonRow, openToday, openWeekOf, pickDate } from './ui.ts'

function fixtureRows(query: string): Record<string, unknown>[] {
	try {
		const value: unknown = fixtureSql(`do $$ begin
if current_user <> 'dvlab_migrator' or current_database() !~ '_test$' then raise exception 'Fixture guard refused'; end if;
end $$; ${query}`)
		return list(record(value).rows).map(record)
	} catch {
		throw new Error('Settings fixture SQL failed; details suppressed')
	}
}

async function fixtureCall(request: APIRequestContext, method: string, body: Body | undefined, status: number) {
	const response = await request.fetch<unknown>('/settings', { method, data: body })
	try {
		expect(response.status()).toBe(status)
		const value: unknown = await response.json()
		return record(value)
	} finally {
		await response.dispose()
	}
}

export async function fixtureDefaults(factory: APIRequest): Promise<void> {
	const foreign = fixtureRows(
		`select count(*)::int as n from accounts where role = 'teacher' and status = 'active' and login <> ${quote(TEACHER_LOGIN)}`
	)
	if (integer(foreign[0]?.n) !== 0) throw new Error('Non-fixture teacher exists; account lifecycle refused')
	const server = await startApi({ port: 4203 })
	try {
		const cookie: unknown = await teacherCookie(server)
		const request = await factory.newContext({
			baseURL: server.base,
			extraHTTPHeaders: { origin: server.base, cookie: `${COOKIE_NAME}=${text(cookie)}` },
		})
		const account = fixtureRows(
			`select id from accounts where login = ${quote(TEACHER_LOGIN)} and role = 'teacher' and status = 'active'`
		)
		expect(account).toHaveLength(1)
		const id = quote(uuid(account[0]?.id))
		const read = () =>
			fixtureRows(
				`select pays_soon_lessons, default_time_zone, updated_at::text from teacher_settings where account_id = ${id}::uuid`
			)
		const original = read()
		try {
			fixtureRows(
				`delete from teacher_settings where account_id = ${id}::uuid and exists (select 1 from accounts where id = ${id}::uuid and login = ${quote(TEACHER_LOGIN)} and role = 'teacher')`
			)
			const defaults = record((await fixtureCall(request, 'GET', undefined, 200)).settings)
			expect(defaults).toEqual({ paysSoonLessons: 2, defaultTimeZone: VN })
			expect(read()).toHaveLength(0)
			const zoneOnly = await fixtureCall(request, 'PATCH', { defaultTimeZone: NY, expectedDefaultTimeZone: VN }, 200)
			expect(record(zoneOnly.settings)).toEqual({ paysSoonLessons: 2, defaultTimeZone: NY })
			expect(read()).toHaveLength(1)
			await fixtureCall(request, 'PATCH', { paysSoonLessons: 5 }, 200)
			expect(record((await fixtureCall(request, 'GET', undefined, 200)).settings)).toEqual({
				paysSoonLessons: 5,
				defaultTimeZone: NY,
			})
			await fixtureAccess(factory, server, request)
		} finally {
			try {
				const saved = original[0]
				if (!saved) fixtureRows(`delete from teacher_settings where account_id = ${id}::uuid`)
				else
					fixtureRows(`insert into teacher_settings (account_id, pays_soon_lessons, default_time_zone, updated_at)
values (${id}::uuid, ${integer(saved.pays_soon_lessons)}, ${quote(text(saved.default_time_zone))}, ${quote(text(saved.updated_at))}::timestamptz)
on conflict (account_id) do update set pays_soon_lessons = excluded.pays_soon_lessons, default_time_zone = excluded.default_time_zone, updated_at = excluded.updated_at`)
				expect(read()).toEqual(original)
			} finally {
				await request.dispose()
			}
		}
	} finally {
		const exit: unknown = await server.stop()
		expect(exit).toEqual({ code: 0, signal: null })
	}
}

async function fixtureAccess(
	factory: APIRequest,
	server: Awaited<ReturnType<typeof startApi>>,
	teacher: APIRequestContext
): Promise<void> {
	const before = await fixtureCall(teacher, 'GET', undefined, 200)
	const studentToken: unknown = await studentCookie(server)
	const student = await factory.newContext({
		baseURL: server.base,
		extraHTTPHeaders: { origin: server.base, cookie: `${COOKIE_NAME}=${text(studentToken)}` },
	})
	const anonymous = await factory.newContext({ baseURL: server.base, extraHTTPHeaders: { origin: server.base } })
	try {
		for (const method of ['GET', 'PATCH']) {
			const body = method === 'PATCH' ? { defaultTimeZone: MSK, expectedDefaultTimeZone: NY } : undefined
			await fixtureCall(student, method, body, 403)
			await fixtureCall(anonymous, method, body, 401)
		}
		const response = await teacher.patch<unknown>('/settings', {
			headers: { origin: 'https://invalid.example' },
			data: { defaultTimeZone: MSK, expectedDefaultTimeZone: NY },
		})
		expect(response.status()).toBe(403)
		await response.dispose()
		const token: unknown = await teacherCookie(server)
		const expired = await factory.newContext({
			baseURL: server.base,
			extraHTTPHeaders: { origin: server.base, cookie: `${COOKIE_NAME}=${text(token)}` },
		})
		try {
			const logout = await expired.post<unknown>('/auth/sign-out')
			expect(logout.status()).toBe(204)
			await logout.dispose()
			await fixtureCall(expired, 'PATCH', { defaultTimeZone: MSK, expectedDefaultTimeZone: NY }, 401)
		} finally {
			await expired.dispose()
		}
		expect(await fixtureCall(teacher, 'GET', undefined, 200)).toEqual(before)
	} finally {
		await student.dispose()
		await anonymous.dispose()
	}
}

export async function concurrentSettings(page: Page, factory: APIRequest): Promise<void> {
	const state = await page.context().storageState()
	const first = await factory.newContext({ storageState: state })
	const second = await factory.newContext({ storageState: state })
	try {
		await Promise.all([
			api(first, 'PATCH', '/settings', { defaultTimeZone: NY, expectedDefaultTimeZone: VN }, 200),
			api(second, 'PATCH', '/settings', { paysSoonLessons: 7 }, 200),
		])
		const expected = { defaultTimeZone: NY, paysSoonLessons: 7 }
		expect(await readSettings(first)).toEqual(expected)
		expect(await readSettings(second)).toEqual(expected)
		const stale = await api(second, 'PATCH', '/settings', { defaultTimeZone: MSK, expectedDefaultTimeZone: VN }, 409)
		expect(text(record(record(stale).error).code)).toBe('default_time_zone_changed')
		const invalidSettings: Body[] = [
			{},
			{ unexpected: true },
			{ defaultTimeZone: 'Mars/Olympus', expectedDefaultTimeZone: NY },
			{ defaultTimeZone: MSK },
			{ expectedDefaultTimeZone: NY },
			{ defaultTimeZone: MSK, expectedDefaultTimeZone: NY, accountId: 'foreign' },
			{ paysSoonLessons: 3, unexpected: true },
		]
		for (const body of invalidSettings) {
			await api(first, 'PATCH', '/settings', body, 400)
			expect(await readSettings(second)).toEqual(expected)
		}
	} finally {
		await first.dispose()
		await second.dispose()
	}
}

export async function staleDates(page: Page, fx: Fx, other: APIRequestContext): Promise<void> {
	const date = addDays(zonedDate(new Date(), VN), 14)
	const card = await fx.card('Alex Example 2187')
	const lesson = await fx.once(card.id, date, '10:00')
	const series = await fx.weekly(card.id, date, '12:00')
	await setMain(other, 'UTC')
	const before = fx.scheduleCounts(card.id)
	const detail = record(await api(other, 'GET', `/students/${card.id}`))
	const payments = await api(other, 'GET', `/payments?student=${card.id}`)
	const create = { studentId: card.id, date, startTime: '09:00', durationMinutes: 60, repeats: 'once' }
	await api(page.request, 'POST', '/schedule/lessons', create, 400)
	const stale: [string, string, Body][] = [
		['POST', '/schedule/lessons', create],
		['POST', `/schedule/lessons/${lesson}/move`, { date, startTime: '11:00' }],
		['POST', `/schedule/series/${series}/occurrences/${date}/move`, { date, startTime: '11:00' }],
		['POST', `/schedule/series/${series}/move`, { from: date, weekday: 3, startTime: '11:00' }],
		['POST', `/schedule/series/${series}/end`, { lastOn: date }],
		['PUT', `/students/${card.id}/opening-balance`, { on: addDays(date, -14), lessonsHundredths: 200 }],
		[
			'POST',
			'/payments',
			{
				studentId: card.id,
				paidOn: addDays(date, -14),
				amountMinor: 100,
				currency: 'USD',
				lessonsHundredths: 100,
				note: null,
			},
		],
	]
	for (const [method, path, body] of stale) {
		const result = await api(page.request, method, path, { ...body, expectedDefaultTimeZone: VN }, 409)
		expect(text(record(record(result).error).code)).toBe('default_time_zone_changed')
		expect(fx.scheduleCounts(card.id)).toEqual(before)
	}
	const after = record(await api(other, 'GET', `/students/${card.id}`))
	expect(after.student).toEqual(detail.student)
	expect(await api(other, 'GET', `/payments?student=${card.id}`)).toEqual(payments)
	await staleForms(page, other, { card, date, lesson, series })
}

async function accountingView(
	page: Page,
	fx: Fx,
	card: Card,
	zone: string,
	minutes: number,
	lessonId: string,
	paidOn: string
): Promise<void> {
	const response = record(await api(page.request, 'GET', '/today'))
	expect(text(response.defaultTimeZone)).toBe(zone)
	const now = new Date(text(response.asOf))
	expect(text(response.date)).toBe(zonedDate(now, zone))
	const detail = record(await api(page.request, 'GET', `/students/${card.id}`))
	const students = record(await api(page.request, 'GET', '/students'))
	for (const body of [detail, students]) expect(text(body.defaultTimeZone)).toBe(zone)
	const paysSoon = list(response.paysSoon)
		.map(record)
		.some((row) => row.id === card.id)
	expect(paysSoon).toBe(minutes <= 120)
	expect(integer(response.paysSoonLessons)).toBe(2)
	await balanceEverywhere(page, fx, card, `${minutes / 60} lessons left`, minutes)
	await page.getByRole('tab', { name: 'Payments', exact: true }).click()
	const paymentDay = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(
		new Date(`${paidOn}T12:00Z`)
	)
	await expect(page.getByRole('cell', { name: paymentDay, exact: true })).toBeVisible()
	await openToday(page)
	const heading = new Intl.DateTimeFormat('en-GB', {
		timeZone: zone,
		day: 'numeric',
		month: 'long',
	}).format(now)
	const weekday = new Intl.DateTimeFormat('en-GB', { timeZone: zone, weekday: 'long' }).format(now)
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${weekday}, ${heading}`)
	const present = list(response.lessons)
		.map(record)
		.some((row) => row.key === `l:${lessonId}`)
	const instant = new Date(`${addDays(paidOn, -1)}T17:30:00Z`)
	expect(present).toBe(zonedDate(instant, zone) === text(response.date))
	expect(
		list(response.earlier)
			.map(record)
			.some((row) => row.key === `l:${lessonId}`)
	).toBe(false)
	await expect(lessonRow(page, 'today-lessons', card)).toHaveCount(present ? 1 : 0)
	if (!paysSoon) await expect(dueRow(page, card)).toHaveCount(0)
}

async function paymentAfterMidnight(page: Page, card: Card): Promise<string> {
	await setMain(page.request, VN)
	const response = record(await api(page.request, 'GET', '/today'))
	const today = text(response.date)
	const tomorrow = addDays(today, 1)
	const label = (day: string) =>
		new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${day}T12:00Z`))
	await page.clock.install({ time: new Date(`${today}T23:59:58+07:00`) })
	await page.goto(`/students/${card.id}`)
	const opening = await page.locator('#opening-balance-on').innerText()
	await page.getByRole('button', { name: 'Record payment', exact: true }).click()
	await expect(page.locator('#record-payment-date')).toHaveText(label(today))
	await page.clock.setSystemTime(new Date(`${tomorrow}T00:01:00+07:00`))
	await page.evaluate(() => window.dispatchEvent(new Event('focus')))
	await expect(page.locator('#record-payment-date')).toHaveText(label(today))
	await pickDate(page, tomorrow, 'record-payment-date')
	await page.getByRole('dialog').getByRole('button', { name: 'Discard changes', exact: true }).click()
	await expect(page.locator('#opening-balance-on')).toHaveText(opening)
	await page.getByRole('button', { name: 'Record payment', exact: true }).click()
	const dialog = page.getByRole('dialog')
	await expect(page.locator('#record-payment-date')).toHaveText(label(tomorrow))
	await pickDate(page, today, 'record-payment-date')
	await dialog.getByLabel('Amount', { exact: true }).fill('1')
	await dialog.locator('#record-payment-currency').click()
	await page.getByRole('option', { name: 'USD $', exact: true }).click()
	await dialog.getByLabel('Lessons', { exact: true }).fill('1')
	const saved = page.waitForResponse(
		(value) => new URL(value.url()).pathname === '/api/payments' && value.request().method() === 'POST'
	)
	await dialog.getByRole('button', { name: 'Record payment', exact: true }).click()
	const result = await saved
	expect(result.status()).toBe(201)
	const body: unknown = await result.json()
	const payment = record(record(body).payment)
	expect(payment.paidOn).toBe(today)
	const id = uuid(payment.id)
	const persisted = list(record(await api(page.request, 'GET', `/payments?student=${card.id}`)).payments).map(record)
	expect(persisted.find((row) => row.id === id)?.paidOn).toBe(today)
	return id
}

export async function midnightAccounting(page: Page, fx: Fx): Promise<void> {
	const now = new Date()
	const day = zonedDate(now, VN)
	const lessonDay = zonedTime(now, VN) < '00:40' ? addDays(day, -1) : day
	const opening = addDays(lessonDay, -1)
	const card = await fx.card('Alex Example 2188')
	await fx.opening(card.id, 200, opening, VN)
	const lesson = await fx.once(card.id, lessonDay, '00:30', 60, VN)
	await fx.mark(lesson, 'done')
	const paymentsCreated: string[] = []
	try {
		for (const date of [opening, lessonDay]) {
			const payment = record(record(await fx.payment(card.id, date, 100, VN)).payment)
			paymentsCreated.push(uuid(payment.id))
		}
		await api(page.request, 'PATCH', '/settings', { paysSoonLessons: 2 })
		const before = record(record(await api(page.request, 'GET', `/students/${card.id}`)).student)
		const payments = await api(page.request, 'GET', `/payments?student=${card.id}`)
		await accountingView(page, fx, card, VN, 120, lesson, lessonDay)
		await page.goto(`/students/${card.id}`)
		const openingText = await page.locator('#opening-balance-on').innerText()
		await changeZone(page, MSK)
		await accountingView(page, fx, card, MSK, 180, lesson, lessonDay)
		const after = record(record(await api(page.request, 'GET', `/students/${card.id}`)).student)
		expect(after.openingBalance).toEqual(before.openingBalance)
		expect(await api(page.request, 'GET', `/payments?student=${card.id}`)).toEqual(payments)
		await page.goto(`/students/${card.id}`)
		await expect(page.locator('#opening-balance-on')).toHaveText(openingText)
		const week = await fx.week(mondayOf(opening))
		const saved = week.find((row) => row.key === `l:${lesson}`)
		expect(saved).toMatchObject({ startsAt: `${opening}T17:30:00.000Z`, mark: 'done' })
		await openWeekOf(page, opening)
		await expect(page.locator(`[data-date="${opening}"] button[data-key="l:${lesson}"]`)).toHaveCount(1)
		expect((await readSettings(page.request)).paysSoonLessons).toBe(2)
		paymentsCreated.push(await paymentAfterMidnight(page, card))
	} finally {
		for (const id of paymentsCreated) await api(page.request, 'DELETE', `/payments/${id}`, undefined, 204)
	}
}

export async function settingsExamples(page: Page, fx: Fx): Promise<void> {
	const pattern = `${BASE}/api/students`
	const aborted = Promise.withResolvers<void>()
	await page.route(pattern, async (route) => {
		await route.abort('failed')
		aborted.resolve()
	})
	try {
		await settingsPage(page)
		await pickZone(page, 'Time zone', MSK)
		await aborted.promise
		await expect(zoneDialog(page).getByText('Example', { exact: true })).toHaveCount(0)
		await expect(zoneDialog(page).getByRole('button', { name: 'Change to Moscow', exact: true })).toBeEnabled()
		await page.keyboard.press('Escape')
	} finally {
		await page.unroute(pattern)
	}
	const soon = new Date(Math.ceil((Date.now() + 120000) / 60000) * 60000)
	const card = await fx.card('Alex Example 2189')
	await fx.once(card.id, zonedDate(soon, VN), zonedTime(soon, VN), 60, VN)
	const rows = list(record(await api(page.request, 'GET', '/students')).students).map(record)
	const next = rows
		.filter((row) => row.nextLessonAt !== null)
		.sort((a, b) => text(a.nextLessonAt).localeCompare(text(b.nextLessonAt)))[0]
	if (next?.id !== card.id) throw new Error('Synthetic next lesson is not first; existing appointments preserved')
	expect(text(next.nextLessonAt)).toBe(soon.toISOString())
	await settingsPage(page)
	await pickZone(page, 'Time zone', MSK)
	const dialog = zoneDialog(page)
	await expect(dialog.getByText('Example', { exact: true })).toHaveCount(1)
	await expect(dialog).toContainText(card.name)
	await expect(dialog).toContainText(zonedTime(soon, VN))
	await expect(dialog).toContainText(zonedTime(soon, MSK))
	await page.keyboard.press('Escape')
}
