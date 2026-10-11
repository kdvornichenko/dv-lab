import { expect } from '@playwright/test'
import type { Request } from '@playwright/test'
import type { Page, Locator } from '@playwright/test'

import type { StudentResponse, ErrorResponse, TodayResponse } from '../../../packages/contracts/src/index.ts'
import * as core from '../../../packages/core/src/index.ts'
import { api, check, failures, shot, signIn } from '../browser-context.ts'
import { withBrowser } from '../browser-journey.ts'
import {
	VN,
	cleanupFixtures,
	createCard,
	createOnce,
	hhmm,
	openToday,
	readTodayApi,
	rowLocator,
	setOpening,
	setTheme,
	tileFacts,
} from './common.mjs'

const MARK_ERROR = 'Could not save the mark. Try again.'

async function fixture(page: Page) {
	const { date, minutes } = core.zonedParts(new Date(), VN)
	const name = 'Alex Example 2180 A'
	const studentId = await createCard(page, name)
	await setOpening(page, studentId, core.addDays(date, -3), 300)
	const time = hhmm(Math.max(0, minutes - 60))
	const lessonId = await createOnce(page, studentId, date, time)
	return { name, studentId, lessonId, time, date }
}

async function balance(page: Page, studentId: string) {
	const result = await api<StudentResponse & Partial<ErrorResponse>>(page, 'GET', `/students/${studentId}`)
	return result.json!.student.balanceMinutes
}

function markRow(page: Page, fx: Awaited<ReturnType<typeof fixture>>) {
	return rowLocator(page, 'today-lessons', fx.studentId)
}

function quick(row: Locator, fx: Awaited<ReturnType<typeof fixture>>, label: string) {
	return row.getByRole('button', { name: `Mark ${fx.name}, ${fx.time}, as ${label}` })
}

function menuButton(row: Locator, fx: Awaited<ReturnType<typeof fixture>>, label: string) {
	return row.getByRole('button', { name: `${fx.name}, ${fx.time}: ${label}. Change the mark` })
}

async function chooseMark(
	page: Page,
	row: Locator,
	fx: Awaited<ReturnType<typeof fixture>>,
	current: string,
	next: string
) {
	await menuButton(row, fx, current).click()
	await page.getByRole('menuitem', { name: next, exact: true }).click()
}

async function successfulMark(page: Page, fx: Awaited<ReturnType<typeof fixture>>) {
	const row = markRow(page, fx)
	await quick(row, fx, 'done').waitFor()
	check('quick mark: both accessible actions are present', await quick(row, fx, 'no-show').isVisible())
	const beforeBalance = await balance(page, fx.studentId)
	const beforeTiles = await tileFacts(page)
	const beforeBox = await row.boundingBox()
	let hits = 0
	let release: (() => void) | undefined
	const gate = new Promise<void>((resolve) => {
		release = resolve
	})
	const path = `**/api/schedule/lessons/${fx.lessonId}/mark`
	await page.route(path, async (route) => {
		hits += 1
		await gate
		await route.continue()
	})
	await quick(row, fx, 'done').click()
	await page.waitForTimeout(150)
	check(
		'quick mark: both buttons disabled while saving',
		(await quick(row, fx, 'done').isDisabled()) && (await quick(row, fx, 'no-show').isDisabled())
	)
	check(
		'quick mark: spinner on pressed button',
		(await quick(row, fx, 'done').locator('svg path[pathLength]').count()) === 1
	)
	await quick(row, fx, 'done').evaluate((button) => {
		;(button as HTMLButtonElement).click()
		;(button as HTMLButtonElement).click()
	})
	const savingBox = await row.boundingBox()
	check(
		'quick mark: saving preserves row geometry',
		beforeBox!.width === savingBox!.width && beforeBox!.height === savingBox!.height
	)
	check('quick mark: repeated click sends one request', hits === 1)
	await shot(page, 'ledger-today-marks', 'saving')
	release!()
	await menuButton(row, fx, 'Done').waitFor()
	await page.unroute(path)
	check('quick mark: balance deducts the lesson', (await balance(page, fx.studentId)) === beforeBalance! - 60)
	const afterTiles = await tileFacts(page)
	const value = (tiles: Awaited<ReturnType<typeof tileFacts>>, label: string) =>
		Number(tiles.find((tile: Awaited<ReturnType<typeof tileFacts>>[number]) => tile.label === label)!.value)
	check(
		'quick mark: counters refreshed',
		value(afterTiles, 'Done') === value(beforeTiles, 'Done') + 1 &&
			value(afterTiles, 'To mark') === value(beforeTiles, 'To mark') - 1
	)
	check(
		'quick mark: marked row is muted and not struck',
		await row.evaluate(
			(element) =>
				element.classList.contains('text-muted-foreground') &&
				!getComputedStyle(
					element.querySelector<HTMLElement>('[data-slot="today-row-name"]')!
				).textDecorationLine.includes('line-through')
		)
	)
	check(
		'quick mark: opens no dialog or toast',
		(await page.getByRole('dialog').count()) === 0 && (await page.locator('[data-slot="toast"]').count()) === 0
	)
	await chooseMark(page, row, fx, 'Done', 'No-show')
	await menuButton(row, fx, 'No-show').waitFor()
	check(
		'quick mark: correction persisted',
		(await api<TodayResponse & Partial<ErrorResponse>>(page, 'GET', '/today')).json!.lessons.find(
			(block) => block.studentId === fx.studentId
		)!.mark === 'no_show'
	)
	await menuButton(row, fx, 'No-show').click()
	const menu = page.getByRole('menu')
	await expect(menu).toHaveCSS('width', '168px')
	await expect(page.getByRole('menuitem').first()).toHaveCSS('height', '28px')
	await page.getByRole('menuitem').first().focus()
	check(
		'quick mark: menu width and compact rows',
		(await menu.evaluate((element) => getComputedStyle(element).width)) === '168px' &&
			(await page
				.getByRole('menuitem')
				.first()
				.evaluate((element) => getComputedStyle(element).height)) === '28px'
	)
	await page.keyboard.press('ArrowDown')
	check(
		'quick mark: arrows move menu focus',
		await page
			.getByRole('menuitem', { name: 'No-show', exact: true })
			.evaluate((element) => element === document.activeElement)
	)
	await page.keyboard.press('Escape')
	await menu.waitFor({ state: 'detached' })
	check(
		'quick mark: Escape closes only menu',
		(await page.getByRole('menu').count()) === 0 && (await menuButton(row, fx, 'No-show').isVisible())
	)
	await chooseMark(page, row, fx, 'No-show', 'Clear mark')
	await quick(row, fx, 'done').waitFor()
	check('quick mark: clear restores balance', (await balance(page, fx.studentId)) === beforeBalance)
}

async function failedAndStale(page: Page, fx: Awaited<ReturnType<typeof fixture>>) {
	const row = markRow(page, fx)
	const path = `**/api/schedule/lessons/${fx.lessonId}/mark`
	await page.route(path, (route) =>
		route.fulfill({ status: 500, json: { error: { code: 'internal_error', message: 'fixture refusal' } } })
	)
	await quick(row, fx, 'done').click()
	await row.getByText(MARK_ERROR, { exact: true }).waitFor()
	check(
		'quick mark: refusal preserves unmarked lesson',
		(await readTodayApi(page))!.lessons.find((block) => block.studentId === fx.studentId)!.mark === 'none'
	)
	await shot(page, 'ledger-today-marks', 'error')
	await page.unroute(path)
	let reads = 0
	const countRead = (request: Request) => {
		if (request.url().endsWith('/api/today')) reads += 1
	}
	page.on('request', countRead)
	await page.route(path, (route) =>
		route.fulfill({ status: 409, json: { error: { code: 'lesson_changed', message: 'fixture stale' } } })
	)
	await quick(row, fx, 'no-show').click()
	await page.waitForResponse((response) => response.url().endsWith('/api/today'))
	await page.waitForTimeout(200)
	check(
		'quick mark: stale refreshes Today and clears previous error',
		reads > 0 && (await row.getByText(MARK_ERROR, { exact: true }).count()) === 0
	)
	page.off('request', countRead)
	await page.unroute(path)
}

async function sharedDialogs(page: Page, fx: Awaited<ReturnType<typeof fixture>>) {
	const row = markRow(page, fx)
	await quick(row, fx, 'done').click()
	await menuButton(row, fx, 'Done').waitFor()
	check('row action: quick Done does not open the lesson dialog', (await page.getByRole('dialog').count()) === 0)
	const trigger = row.locator('[data-slot="today-row-open"]')
	await trigger.focus()
	await page.keyboard.press('Enter')
	const dialog = page.getByRole('dialog')
	await dialog.waitFor()
	check(
		'row action: Enter opens the shared Mark dialog',
		await dialog.getByRole('radiogroup', { name: 'Mark' }).isVisible()
	)
	check(
		'row action: started lesson offers Move and Cancel',
		(await dialog.getByRole('button', { name: 'Move lesson' }).isVisible()) &&
			(await dialog.getByRole('button', { name: 'Cancel lesson' }).isVisible())
	)
	await page.keyboard.press('Escape')
	await dialog.waitFor({ state: 'detached' })
	await expect(trigger).toBeFocused()
	check('row action: Escape returns focus to the row', true)
	await trigger.click()
	const tiles = await tileFacts(page)
	const todayBefore = Number(tiles.find((tile) => tile.label === 'Today')!.value)
	await dialog.getByRole('button', { name: 'Cancel lesson' }).click()
	await dialog.getByRole('button', { name: 'Yes, cancel' }).click()
	await expect(row).toHaveAttribute('data-status', 'cancelled')
	check(
		'row action: cancellation strikes the name',
		await row
			.locator('[data-slot="today-row-name"]')
			.evaluate((element) => getComputedStyle(element).textDecorationLine.includes('line-through'))
	)
	check(
		'row action: cancellation removes quick marks',
		(await row.getByRole('button', { name: /Change the mark/ }).count()) === 0
	)
	const after = await tileFacts(page)
	check(
		'row action: cancellation updates Today count',
		Number(after.find((tile) => tile.label === 'Today')!.value) === todayBefore - 1
	)
	await shot(page, 'ledger-today-marks', 'cancelled-dialog')
	await dialog.getByRole('button', { name: 'Return to schedule' }).click()
	await expect(row).toHaveAttribute('data-status', 'done')
	await page.keyboard.press('Escape')
	await dialog.waitFor({ state: 'detached' })
	await expect(trigger).toBeFocused()
	await menuButton(row, fx, 'Done').waitFor()
	check('row action: restore keeps the persisted mark', await menuButton(row, fx, 'Done').isVisible())
	await shot(page, 'ledger-today-marks', 'row-dialog-focus')
}

async function earlierMarks(page: Page, fx: Awaited<ReturnType<typeof fixture>>) {
	const yesterday = core.addDays(fx.date, -1)
	await createOnce(page, fx.studentId, yesterday, '00:01')
	await openToday(page)
	const row = rowLocator(page, 'today-earlier', fx.studentId)
	const earlier = { ...fx, time: '00:01' }
	await quick(row, earlier, 'done').waitFor()
	await quick(row, earlier, 'done').click()
	await row.waitFor({ state: 'detached' })
	const data = await readTodayApi(page)
	check(
		'earlier mark: saved row leaves response and panel',
		!data!.earlier.some((block) => block.studentId === fx.studentId)
	)
	check(
		'earlier mark: panel remains exactly while other rows exist',
		(await page.locator('section[aria-labelledby="today-earlier"]').count()) > 0 === data!.earlier.length > 0
	)
}

export async function todayMarks() {
	await withBrowser(
		{ timezoneId: 'America/New_York' },
		async ({ page, problems }) => {
			await setTheme(page)
			await signIn(page)
			const fx = await fixture(page)
			await openToday(page)
			await successfulMark(page, fx)
			await failedAndStale(page, fx)
			check('today marks: no page errors', problems.filter((text) => text.startsWith('pageerror:')).length === 0)
			if (failures() === 0) console.log('TODAY_MARKS_PART1_OK')
			await sharedDialogs(page, fx)
			await earlierMarks(page, fx)
			if (failures() === 0) console.log('LEDGER_WEB_TODAY_MARKS_OK')
		},
		() => cleanupFixtures('today marks end')
	)
}
