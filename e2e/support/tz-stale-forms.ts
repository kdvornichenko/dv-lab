import { expect, type APIRequestContext, type Locator, type Page, type Request } from '@playwright/test'

import {
	createLessonRequest,
	endSeriesRequest,
	moveLessonRequest,
	moveSeriesRequest,
} from '../../packages/contracts/src/schedule.ts'
import { openingBalanceRequest, recordPaymentRequest } from '../../packages/contracts/src/students.ts'
import { api, type Body } from './api.ts'
import { addDays, mondayOf, VN } from './dates.ts'
import { list, record, text, uuid } from './input.ts'
import type { Card } from './test.ts'
import { setMain } from './tz-settings.ts'
import { openWeekOf, pickDate, pickTime } from './ui.ts'

const STALE = 'Default time zone changed elsewhere. Refresh the page and try again.'

interface Fixtures {
	card: Card
	date: string
	lesson: string
	series: string
}

interface FilledForm {
	root: Locator
	submit: Locator
	draft: Locator[]
	main?: Locator
	method: 'POST' | 'PUT'
	path: string
	parse: (value: unknown) => object
	payload: Body
}

export async function staleForms(page: Page, other: APIRequestContext, fixtures: Fixtures): Promise<void> {
	for (const fill of [newLesson, moveOnce, moveWholeSeries, endSeries, openingBalance, payment]) {
		await setMain(other, VN)
		const ledger = fill === openingBalance || fill === payment
		if (ledger) await page.goto(`/students/${fixtures.card.id}`)
		else await openWeekOf(page, fixtures.date)
		const form = await fill(page, fixtures)
		await expect(form.submit).toBeEnabled()
		if (form.main) await expect(form.main).toContainText('VN')
		await refuseAndRefresh(page, other, fixtures, form, fill)
	}
}

async function draftValues(fields: Locator[]): Promise<string[]> {
	return Promise.all(
		fields.map(async (field) => {
			await expect(field).toBeVisible()
			return field.evaluate((element) =>
				element instanceof HTMLInputElement ? element.value : (element.textContent ?? '')
			)
		})
	)
}

async function persisted(request: APIRequestContext, { card, date }: Fixtures) {
	const student = record(await api(request, 'GET', `/students/${card.id}`))
	const payments = record(await api(request, 'GET', `/payments?student=${card.id}`))
	const week = record(await api(request, 'GET', `/schedule/week?start=${mondayOf(date)}`))
	return {
		student: record(student.student),
		payments: list(payments.payments).map(record),
		blocks: list(week.blocks)
			.map(record)
			.filter((row) => uuid(row.studentId) === card.id),
		series: list(week.series)
			.map(record)
			.filter((row) => uuid(row.studentId) === card.id),
	}
}

async function refuseAndRefresh(
	page: Page,
	other: APIRequestContext,
	fixtures: Fixtures,
	form: FilledForm,
	fill: (page: Page, fixtures: Fixtures) => Promise<FilledForm>
): Promise<void> {
	const fields = form.main ? [...form.draft, form.main] : form.draft
	const draft = await draftValues(fields)
	const mutations: Request[] = []
	const observe = (request: Request) => {
		if (
			new URL(request.url()).pathname.startsWith('/api/') &&
			['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())
		)
			mutations.push(request)
	}
	page.on('request', observe)
	try {
		await setMain(other, 'UTC')
		const before = await persisted(other, fixtures)
		await expect(form.root.getByText(STALE, { exact: true })).toHaveCount(0)
		await expect(form.submit).toBeEnabled()
		const refusal = page.waitForResponse(
			(response) =>
				new URL(response.url()).pathname === `/api${form.path}` && response.request().method() === form.method
		)
		await form.submit.click()
		const response = await refusal
		expect(response.status()).toBe(409)
		const error: unknown = await response.json()
		expect(text(record(record(error).error).code)).toBe('default_time_zone_changed')
		const payload: unknown = response.request().postDataJSON()
		expect(form.parse(payload)).toEqual({ ...form.payload, expectedDefaultTimeZone: VN })
		await expect(form.root.getByText(STALE, { exact: true })).toBeVisible()
		await expect(form.submit).toBeDisabled()
		await expect(form.submit).not.toHaveAttribute('aria-busy', 'true')
		const refresh = form.root.getByRole('button', { name: 'Refresh', exact: true })
		await expect(refresh).toBeEnabled()
		for (const field of form.draft) await expect(field).toBeEnabled()
		expect(await draftValues(fields)).toEqual(draft)
		expect(await persisted(other, fixtures)).toEqual(before)
		expect(mutations).toHaveLength(1)
		const path = form.path.startsWith('/schedule/') ? '/api/schedule/week' : `/api/students/${fixtures.card.id}`
		const reread = page.waitForResponse(
			(value) => new URL(value.url()).pathname === path && value.request().method() === 'GET'
		)
		await refresh.click()
		const authoritative = await reread
		expect(authoritative.status()).toBe(200)
		const body: unknown = await authoritative.json()
		expect(text(record(body).defaultTimeZone)).toBe('UTC')
		await expect(page.getByRole('dialog')).toHaveCount(0)
		const fresh = await fill(page, fixtures)
		await expect(fresh.root.getByText(STALE, { exact: true })).toHaveCount(0)
		await expect(fresh.submit).toBeEnabled()
		if (fresh.main) await expect(fresh.main).toContainText('UTC')
		await page.keyboard.press('Escape')
		expect(await persisted(other, fixtures)).toEqual(before)
		expect(mutations).toHaveLength(1)
	} finally {
		page.off('request', observe)
	}
}

async function newLesson(page: Page, { card, date }: Fixtures): Promise<FilledForm> {
	await page.getByRole('button', { name: 'New lesson', exact: true }).click()
	const root = page.getByRole('dialog', { name: 'New lesson', exact: true })
	await root.getByLabel('Student', { exact: true }).click()
	await page.getByRole('option', { name: card.name, exact: true }).click()
	await pickDate(page, date, 'new-lesson-date')
	await pickTime(page, '15:15', 'new-lesson-time')
	await root.locator('#new-lesson-length').fill('75')
	return {
		root,
		submit: root.getByRole('button', { name: 'Add lesson', exact: true }),
		draft: ['student', 'date', 'time', 'length', 'repeats'].map((field) => root.locator(`#new-lesson-${field}`)),
		main: root.locator('#new-lesson-time-label'),
		method: 'POST',
		path: '/schedule/lessons',
		parse: createLessonRequest.parse,
		payload: { studentId: card.id, date, startTime: '15:15', durationMinutes: 75, repeats: 'once' },
	}
}

async function lessonDialog(page: Page, key: string): Promise<Locator> {
	const block = page.locator(`[data-slot="week-grid-column"] button[data-key="${key}"]`)
	await expect(block).toHaveCount(1)
	await block.click()
	const dialog = page.getByRole('dialog')
	await expect(dialog).toBeVisible()
	return dialog
}

async function moveOnce(page: Page, { date, lesson }: Fixtures): Promise<FilledForm> {
	const dialog = await lessonDialog(page, `l:${lesson}`)
	await dialog.getByRole('button', { name: 'Move lesson', exact: true }).click()
	const root = dialog.getByRole('group', { name: 'Move lesson', exact: true })
	const next = addDays(date, 1)
	await pickDate(page, next)
	await pickTime(page, '16:15')
	return {
		root,
		submit: root.getByRole('button', { name: 'Move lesson', exact: true }),
		draft: [root.locator('#move-lesson-date'), root.locator('#move-lesson-time')],
		main: root.locator('#move-lesson-time-label'),
		method: 'POST',
		path: `/schedule/lessons/${lesson}/move`,
		parse: moveLessonRequest.parse,
		payload: { date: next, startTime: '16:15', expectedStartsAt: new Date(`${date}T10:00:00+07:00`).toISOString() },
	}
}

async function moveWholeSeries(page: Page, { date, series }: Fixtures): Promise<FilledForm> {
	const dialog = await lessonDialog(page, `s:${series}:${date}`)
	await dialog.getByRole('button', { name: 'Move series', exact: true }).click()
	const root = page.getByRole('dialog', { name: 'Move series', exact: true })
	const from = addDays(date, 1)
	await pickDate(page, from, 'move-series-from')
	await root.locator('#move-series-day').click()
	await page.getByRole('option', { name: 'Wednesday', exact: true }).click()
	await pickTime(page, '17:15', 'move-series-time')
	return {
		root,
		submit: root.getByRole('button', { name: 'Move series', exact: true }),
		draft: ['from', 'day', 'time'].map((field) => root.locator(`#move-series-${field}`)),
		main: root.locator('#move-series-time-label'),
		method: 'POST',
		path: `/schedule/series/${series}/move`,
		parse: moveSeriesRequest.parse,
		payload: { from, weekday: 3, startTime: '17:15' },
	}
}

async function endSeries(page: Page, { date, series }: Fixtures): Promise<FilledForm> {
	const dialog = await lessonDialog(page, `s:${series}:${date}`)
	await dialog.getByRole('button', { name: 'End series', exact: true }).click()
	const root = page.getByRole('dialog', { name: 'End this series?', exact: true })
	const lastOn = addDays(date, 7)
	await pickDate(page, lastOn, 'end-series-last')
	return {
		root,
		submit: root.getByRole('button', { name: 'End series', exact: true }),
		draft: [root.locator('#end-series-last')],
		main: root.getByText(/, every /),
		method: 'POST',
		path: `/schedule/series/${series}/end`,
		parse: endSeriesRequest.parse,
		payload: { lastOn },
	}
}

async function openingBalance(page: Page, { card, date }: Fixtures): Promise<FilledForm> {
	const root = page.locator('section[aria-labelledby="student-opening-balance"]')
	const on = addDays(date, -15)
	await root.locator('#opening-balance-lessons').fill('2.75')
	await pickDate(page, on, 'opening-balance-on')
	return {
		root,
		submit: root.getByRole('button', { name: 'Save opening balance', exact: true }),
		draft: [root.locator('#opening-balance-lessons'), root.locator('#opening-balance-on')],
		method: 'PUT',
		path: `/students/${card.id}/opening-balance`,
		parse: openingBalanceRequest.parse,
		payload: { on, lessonsHundredths: 275 },
	}
}

async function payment(page: Page, { card, date }: Fixtures): Promise<FilledForm> {
	await page.getByRole('button', { name: 'Record payment', exact: true }).click()
	const root = page.getByRole('dialog', { name: 'Record payment', exact: true })
	const paidOn = addDays(date, -15)
	await root.locator('#record-payment-amount').fill('11')
	await root.locator('#record-payment-currency').click()
	await page.getByRole('option', { name: 'USD $', exact: true }).click()
	await root.locator('#record-payment-lessons').fill('1.25')
	await root.locator('#record-payment-note').fill('Timezone draft')
	await pickDate(page, paidOn, 'record-payment-date')
	return {
		root,
		submit: root.getByRole('button', { name: 'Record payment', exact: true }),
		draft: ['amount', 'currency', 'lessons', 'note', 'date'].map((field) => root.locator(`#record-payment-${field}`)),
		method: 'POST',
		path: '/payments',
		parse: recordPaymentRequest.parse,
		payload: {
			studentId: card.id,
			paidOn,
			amountMinor: 1100,
			currency: 'USD',
			lessonsHundredths: 125,
			note: 'Timezone draft',
		},
	}
}
