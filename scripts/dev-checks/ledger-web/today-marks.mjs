import { expect } from '@playwright/test'

import * as core from '../../../packages/core/src/index.ts'
import { api, check, failures, launch, shot, signIn } from '../web.mjs'
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

async function fixture(page) {
	const { date, minutes } = core.zonedParts(new Date(), VN)
	const name = 'Alex Example 2180 A'
	const studentId = await createCard(page, name)
	await setOpening(page, studentId, core.addDays(date, -3), 300)
	const time = hhmm(Math.max(0, minutes - 60))
	const lessonId = await createOnce(page, studentId, date, time)
	return { name, studentId, lessonId, time, date }
}

async function balance(page, studentId) {
	const result = await api(page, 'GET', `/students/${studentId}`)
	return result.json.student.balanceMinutes
}

function markRow(page, fx) {
	return rowLocator(page, 'today-lessons', fx.studentId)
}

function quick(row, fx, label) {
	return row.getByRole('button', { name: `Mark ${fx.name}, ${fx.time}, as ${label}` })
}

function menuButton(row, fx, label) {
	return row.getByRole('button', { name: `${fx.name}, ${fx.time}: ${label}. Change the mark` })
}

async function chooseMark(page, row, fx, current, next) {
	await menuButton(row, fx, current).click()
	await page.getByRole('menuitem', { name: next, exact: true }).click()
}

async function successfulMark(page, fx) {
	const row = markRow(page, fx)
	await quick(row, fx, 'done').waitFor()
	check('quick mark: both accessible actions are present', await quick(row, fx, 'no-show').isVisible())
	const beforeBalance = await balance(page, fx.studentId)
	const beforeTiles = await tileFacts(page)
	const beforeBox = await row.boundingBox()
	let hits = 0
	let release
	const gate = new Promise((resolve) => {
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
		button.click()
		button.click()
	})
	const savingBox = await row.boundingBox()
	check(
		'quick mark: saving preserves row geometry',
		beforeBox.width === savingBox.width && beforeBox.height === savingBox.height
	)
	check('quick mark: repeated click sends one request', hits === 1)
	await shot(page, 'ledger-today-marks', 'saving')
	release()
	await menuButton(row, fx, 'Done').waitFor()
	await page.unroute(path)
	check('quick mark: balance deducts the lesson', (await balance(page, fx.studentId)) === beforeBalance - 60)
	const afterTiles = await tileFacts(page)
	const value = (tiles, label) => Number(tiles.find((tile) => tile.label === label).value)
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
				!getComputedStyle(element.querySelector('[data-slot="today-row-name"]')).textDecorationLine.includes(
					'line-through'
				)
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
		(await api(page, 'GET', '/today')).json.lessons.find((block) => block.studentId === fx.studentId).mark === 'no_show'
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

async function failedAndStale(page, fx) {
	const row = markRow(page, fx)
	const path = `**/api/schedule/lessons/${fx.lessonId}/mark`
	await page.route(path, (route) =>
		route.fulfill({ status: 500, json: { error: { code: 'internal_error', message: 'fixture refusal' } } })
	)
	await quick(row, fx, 'done').click()
	await row.getByText(MARK_ERROR, { exact: true }).waitFor()
	check(
		'quick mark: refusal preserves unmarked lesson',
		(await readTodayApi(page)).lessons.find((block) => block.studentId === fx.studentId).mark === 'none'
	)
	await shot(page, 'ledger-today-marks', 'error')
	await page.unroute(path)
	let reads = 0
	const countRead = (request) => {
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

export async function todayMarks() {
	const { browser, page, problems } = await launch({ timezoneId: 'America/New_York' })
	await setTheme(page)
	try {
		await signIn(page)
		const fx = await fixture(page)
		await openToday(page)
		await successfulMark(page, fx)
		await failedAndStale(page, fx)
		check('today marks: no page errors', problems.filter((text) => text.startsWith('pageerror:')).length === 0)
		if (failures() === 0) console.log('TODAY_MARKS_PART1_OK')
	} finally {
		await browser.close()
		cleanupFixtures('today marks end')
	}
}
