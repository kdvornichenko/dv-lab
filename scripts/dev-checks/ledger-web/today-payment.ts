import { expect } from '@playwright/test'
import type { Page, Locator } from '@playwright/test'

import type { PaymentsResponse, ErrorResponse } from '../../../packages/contracts/src/index.ts'
import * as core from '../../../packages/core/src/index.ts'
import { BASE, api, check, failures, shot, signIn } from '../browser-context.ts'
import { withBrowser } from '../browser-journey.ts'
import { cleanupFixtures, createCard, openProfile, openToday, readTodayApi, setOpening, setTheme } from './common.mjs'

async function fixtures(page: Page) {
	const today = core.scheduleToday(new Date())
	const a = await createCard(page, 'Alex Example 2181 A', 60, { rateMinor: 10000, currency: 'RUB' })
	const b = await createCard(page, 'Alex Example 2181 B', 60, { rateMinor: 20000, currency: 'KZT' })
	await setOpening(page, a, core.addDays(today, -3), 100)
	await setOpening(page, b, core.addDays(today, -3), 100)
	return { a, b, aName: 'Alex Example 2181 A', bName: 'Alex Example 2181 B' }
}

async function payments(page: Page, studentId: string) {
	const result = await api<PaymentsResponse & Partial<ErrorResponse>>(page, 'GET', `/payments?student=${studentId}`)
	return result.json!.payments
}

async function openPayment(page: Page) {
	await page.getByRole('button', { name: 'Add payment', exact: true }).click()
	const dialog = page.getByRole('dialog')
	await dialog.waitFor()
	return dialog
}

async function choose(page: Page, dialog: Locator, name: string) {
	await dialog.locator('#record-payment-student').click()
	await page.getByRole('option', { name, exact: true }).click()
	await page.getByRole('listbox').waitFor({ state: 'detached' })
}

async function headerStates(page: Page) {
	const path = '**/api/today'
	await page.route(path, async (route) => {
		await new Promise((resolve) => setTimeout(resolve, 900))
		await route.fulfill({ status: 500, json: {} })
	})
	await page.goto(`${BASE}/`)
	await page.getByRole('button', { name: 'Add payment', exact: true }).waitFor()
	check('payment: Add payment is present while Today loads', (await page.locator('[data-slot="skeleton"]').count()) > 0)
	await page.getByText('Could not load Today', { exact: true }).waitFor()
	check(
		'payment: Add payment remains after Today read error',
		await page.getByRole('button', { name: 'Add payment', exact: true }).isVisible()
	)
	const dialog = await openPayment(page)
	check('payment: optional variant starts with Student', await dialog.getByText('Student', { exact: true }).isVisible())
	check(
		'payment: no student blocks saving',
		await dialog.getByRole('button', { name: 'Save payment', exact: true }).isDisabled()
	)
	await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
	await dialog.waitFor({ state: 'detached' })
	await page.unroute(path)
}

async function selectionRace(page: Page, fx: Awaited<ReturnType<typeof fixtures>>) {
	await openToday(page)
	const dialog = await openPayment(page)
	await page.route(`**/api/students/${fx.a}`, async (route) => {
		const response = await route.fetch<unknown>()
		await new Promise((resolve) => setTimeout(resolve, 1500))
		await route.fulfill({ response })
	})
	await choose(page, dialog, fx.aName)
	check(
		'payment: pending student prevents save',
		await dialog.getByRole('button', { name: 'Save payment', exact: true }).isDisabled()
	)
	await choose(page, dialog, fx.bName)
	await expect(dialog.locator('#record-payment-currency')).toContainText('₸')
	await page.waitForTimeout(1700)
	check(
		'payment: late student response keeps the latest selection',
		(await dialog.locator('#record-payment-student').textContent())!.includes(fx.bName)
	)
	check(
		'payment: latest student currency stays selected',
		(await dialog.locator('#record-payment-currency').textContent())!.includes('₸')
	)
	await page.unroute(`**/api/students/${fx.a}`)
	await choose(page, dialog, fx.aName)
	await expect(dialog.locator('#record-payment-currency')).toContainText('₽')
	return dialog
}

async function recordFromToday(page: Page, fx: Awaited<ReturnType<typeof fixtures>>) {
	const before = await readTodayApi(page)
	check(
		'payment: fixture starts in Pays soon',
		before!.paysSoon.some((student) => student.id === fx.a) && before!.paysSoonLessons === 2
	)
	const dialog = await selectionRace(page, fx)
	await dialog.getByLabel('Amount', { exact: true }).fill('200')
	await expect(dialog.getByLabel('Lessons', { exact: true })).toHaveValue('2')
	await page.route('**/api/payments', (route) => route.fulfill({ status: 500, json: {} }))
	await dialog.getByRole('button', { name: 'Save payment', exact: true }).click()
	await dialog.getByText('Could not record the payment. Try again.', { exact: true }).waitFor()
	check(
		'payment: failure writes no payment and keeps inputs',
		(await payments(page, fx.a)).length === 0 &&
			(await dialog.getByLabel('Amount', { exact: true }).inputValue()) === '200'
	)
	await page.unroute('**/api/payments')
	await shot(page, 'ledger-today-payment', 'selected')
	await dialog.getByRole('button', { name: 'Save payment', exact: true }).click()
	await dialog.waitFor({ state: 'detached' })
	await expect.poll(async () => (await readTodayApi(page))!.paysSoon.some((student) => student.id === fx.a)).toBe(false)
	await expect(page.locator(`[data-slot="due-row"][data-student-id="${fx.a}"]`)).toHaveCount(0)
	const rows = await payments(page, fx.a)
	check(
		'payment: persisted once for the chosen student',
		rows.length === 1 &&
			rows[0].studentId === fx.a &&
			rows[0].creditedMinutes === 120 &&
			(await payments(page, fx.b)).length === 0
	)
	await shot(page, 'ledger-today-payment', 'saved')
}

async function recordFromProfile(page: Page, fx: Awaited<ReturnType<typeof fixtures>>) {
	await openProfile(page, fx.a)
	await page.getByRole('button', { name: 'Record payment', exact: true }).click()
	const dialog = page.getByRole('dialog')
	await dialog.waitFor()
	check('payment: preset profile has no Student field', (await dialog.locator('#record-payment-student').count()) === 0)
	await dialog.getByLabel('Amount', { exact: true }).fill('100')
	await dialog.getByRole('button', { name: 'Record payment', exact: true }).click()
	await dialog.waitFor({ state: 'detached' })
	const rows = await payments(page, fx.a)
	check(
		'payment: preset profile still records a payment',
		rows.length === 2 && rows.every((row) => row.studentId === fx.a)
	)
}

export async function todayPayment() {
	await withBrowser(
		{ timezoneId: 'America/New_York' },
		async ({ page, problems }) => {
			await setTheme(page)
			await signIn(page)
			const fx = await fixtures(page)
			await headerStates(page)
			await recordFromToday(page, fx)
			await recordFromProfile(page, fx)
			check('today payment: no page errors', problems.filter((text) => text.startsWith('pageerror:')).length === 0)
			if (failures() === 0) console.log('LEDGER_WEB_TODAY_PAYMENT_OK')
		},
		() => cleanupFixtures('today payment end')
	)
}
