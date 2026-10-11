import type { Locator, Page, Request, Route, TestInfo } from '@playwright/test'

import { calendarHistoryMarks } from './support/calendar-history.ts'
import { BASE, cleanupFixtures } from './support/data.ts'
import { addDays, mondayOf, startedSlotToday, VN, vnToday } from './support/dates.ts'
import { expect, test, type Fx } from './support/test.ts'
import { crossZoneTail, markedPastMove } from './support/tz-schedule.ts'
import {
	balanceEverywhere,
	changeQuickMark,
	chooseMark,
	lessonRow,
	markRadio,
	openLesson,
	openToday,
	openTodayLesson,
	rowBodyStyles,
	screenshot,
	tile,
} from './support/ui.ts'

async function narrowToday(page: Page, row: Locator, info: TestInfo): Promise<void> {
	await page.setViewportSize({ width: 320, height: 800 })
	try {
		await expect
			.poll(() =>
				row.evaluate((element) => {
					const box = element.getBoundingClientRect()
					return box.left >= 0 && box.right <= window.innerWidth
				})
			)
			.toBe(true)
		expect(await page.locator('[data-slot="stat-value"]').count()).toBeGreaterThan(0)
		expect(
			await page.locator('[data-slot="stat-value"]').evaluateAll((elements) =>
				elements.every((element) => {
					const box = element.getBoundingClientRect()
					return box.left >= 0 && box.right <= window.innerWidth
				})
			)
		).toBe(true)
		expect(await page.locator('html').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
		await row.screenshot({ path: info.outputPath('today-filled-320.png') })
	} finally {
		await page.setViewportSize({ width: 1280, height: 800 })
	}
}

async function keyboardQuickMark(page: Page, row: Locator, name: string, time: string): Promise<void> {
	const control = row.getByRole('button', { name: `Mark ${name}, ${time}, as done`, exact: true })
	await row.locator('button[data-slot="today-row-open"]').focus()
	await page.keyboard.press('Tab')
	await expect(control).toBeFocused()
	expect(await control.evaluate((element) => element.matches(':focus-visible'))).toBe(true)
	expect(await control.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe('none')
	await page.keyboard.press('Enter')
}

async function keyboardToday(page: Page, fx: Fx, info: TestInfo): Promise<void> {
	cleanupFixtures()
	const date = vnToday()
	const time = startedSlotToday()
	const card = await fx.card('Alex Example 2183')
	await fx.opening(card.id, 300, addDays(date, -3))
	const lesson = await fx.once(card.id, date, time)
	await openToday(page)
	const row = lessonRow(page, 'today-lessons', card)
	await narrowToday(page, row, info)
	const response = page.waitForResponse(
		(value) =>
			new URL(value.url()).pathname === `/api/schedule/lessons/${lesson}/mark` && value.request().method() === 'POST'
	)
	await keyboardQuickMark(page, row, card.name, time)
	expect((await response).status()).toBe(200)
	await expect(
		row.getByRole('button', { name: `${card.name}, ${time}: Done. Change the mark`, exact: true })
	).toBeVisible()
	expect(fx.markKind(lesson)).toBe('done')
	const open = row.locator('button[data-slot="today-row-open"]')
	await open.focus()
	await page.keyboard.press('Enter')
	const dialog = page.getByRole('dialog')
	await expect(markRadio(dialog, 'Done')).toBeChecked()
	await page.keyboard.press('Escape')
	await expect(dialog).toHaveCount(0)
	await expect(open).toBeFocused()
	await balanceEverywhere(page, fx, card, '2 lessons left', 120)
}

async function attemptDisabled(page: Page, control: Locator): Promise<void> {
	await expect(control).toBeDisabled()
	const bounds = await control.boundingBox()
	if (!bounds) throw new Error('Pending control is not observable')
	await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
	await control.press('Enter')
}

async function delayedMark(
	page: Page,
	path: string,
	start: () => Promise<void>,
	blocked: () => Promise<void>,
	settled: () => Promise<void>
): Promise<void> {
	let release!: () => void
	const held = new Promise<void>((resolve) => {
		release = resolve
	})
	let seen!: () => void
	const started = new Promise<void>((resolve) => {
		seen = resolve
	})
	let posts = 0
	const observe = (request: Request): void => {
		if (request.method() === 'POST' && new URL(request.url()).pathname.startsWith('/api/schedule/')) posts += 1
	}
	let deferred = false
	const handler = async (route: Route): Promise<void> => {
		if (route.request().method() === 'POST' && !deferred) {
			deferred = true
			seen()
			await held
		}
		await route.continue()
	}
	const pattern = `${BASE}${path}`
	page.on('request', observe)
	await page.route(pattern, handler)
	const response = page.waitForResponse(
		(value) => new URL(value.url()).pathname === path && value.request().method() === 'POST'
	)
	try {
		await start()
		await started
		await blocked()
		expect(posts).toBe(1)
		release()
		expect((await response).status()).toBe(200)
		await settled()
		expect(posts).toBe(1)
	} finally {
		release()
		try {
			await response
		} finally {
			page.off('request', observe)
			await page.unroute(pattern, handler)
		}
	}
}

async function blockedDialog(page: Page, dialog: Locator, fields: boolean): Promise<void> {
	for (const label of ['Scheduled', 'Done', 'No-show']) await expect(markRadio(dialog, label)).toBeDisabled()
	for (const label of ['Move series', 'End series'])
		await attemptDisabled(page, dialog.getByRole('button', { name: label, exact: true }))
	if (fields) {
		for (const id of ['move-lesson-date', 'move-lesson-time']) await attemptDisabled(page, dialog.locator(`#${id}`))
		const inputs = dialog.locator('input, textarea, select')
		for (const input of await inputs.all()) await expect(input).toBeDisabled()
		await attemptDisabled(page, dialog.getByRole('button', { name: 'Discard changes', exact: true }))
		await attemptDisabled(
			page,
			dialog
				.getByRole('group', { name: 'Move lesson', exact: true })
				.getByRole('button', { name: 'Move lesson', exact: true })
		)
	} else {
		for (const label of ['Move lesson', 'Cancel lesson'])
			await attemptDisabled(page, dialog.getByRole('button', { name: label, exact: true }))
	}
	const close = dialog.getByRole('button', { name: 'Close', exact: true })
	if (await close.count()) await attemptDisabled(page, close)
	await page.keyboard.press('Escape')
	await expect(dialog).toBeVisible()
	await expect(page.getByRole('dialog')).toHaveCount(1)
	await expect(dialog.locator('[data-slot="lesson-cancel-question"]')).toHaveCount(0)
}

async function pendingDialogMark(page: Page, fx: Fx): Promise<void> {
	cleanupFixtures()
	const date = addDays(vnToday(), 7)
	const card = await fx.card('Alex Example 2182')
	await fx.opening(card.id, 300, addDays(vnToday(), -3))
	const series = await fx.weekly(card.id, date, '10:00')
	await fx.moveOccurrence(series, date, addDays(vnToday(), -1), '10:00')
	await fx.markOccurrence(series, date, 'done')
	await fx.moveOccurrence(series, date, date, '10:00')
	for (const fields of [false, true]) {
		const dialog = await openLesson(page, card, date, '10:00')
		if (fields) await dialog.getByRole('button', { name: 'Move lesson', exact: true }).click()
		const label = fields ? 'Done' : 'No-show'
		await delayedMark(
			page,
			`/api/schedule/series/${series}/occurrences/${date}/mark`,
			async () => {
				await markRadio(dialog, label).click()
			},
			async () => {
				await blockedDialog(page, dialog, fields)
			},
			async () => {
				await expect(markRadio(dialog, label)).toBeChecked()
				await expect(markRadio(dialog, label)).toBeEnabled()
				await expect(dialog.getByRole('button', { name: 'Move series', exact: true })).toBeEnabled()
				if (fields) {
					await expect(dialog.locator('#move-lesson-date')).toBeEnabled()
					await dialog.getByRole('button', { name: 'Discard changes', exact: true }).click()
				}
				await expect(dialog.getByRole('button', { name: 'Move lesson', exact: true })).toBeEnabled()
				await expect(dialog.getByRole('button', { name: 'Cancel lesson', exact: true })).toBeEnabled()
			}
		)
		await page.keyboard.press('Escape')
		await expect(dialog).toHaveCount(0)
		const current = (await fx.week(mondayOf(date))).find(
			(entry) => entry.key === `s:${series}:${date}` && entry.outcome === (fields ? 'done' : 'no_show')
		)
		expect(current?.mark).toBe(fields ? 'done' : 'no_show')
		await balanceEverywhere(page, fx, card, '2 lessons left', 120)
	}
}

async function pendingQuickMark(
	page: Page,
	row: Locator,
	cardName: string,
	time: string,
	lesson: string
): Promise<void> {
	const open = row.locator('button[data-slot="today-row-open"]')
	await delayedMark(
		page,
		`/api/schedule/lessons/${lesson}/mark`,
		async () => {
			await row.getByRole('button', { name: `Mark ${cardName}, ${time}, as done`, exact: true }).click()
		},
		async () => {
			await attemptDisabled(page, open)
			await expect(page.getByRole('dialog')).toHaveCount(0)
		},
		async () => {
			await expect(
				row.getByRole('button', { name: `${cardName}, ${time}: Done. Change the mark`, exact: true })
			).toBeVisible()
			await expect(open).toBeEnabled()
			await open.click()
			const dialog = page.getByRole('dialog')
			await expect(markRadio(dialog, 'Done')).toBeChecked()
			await page.keyboard.press('Escape')
			await expect(dialog).toHaveCount(0)
		}
	)
}

async function assertRealClock(page: Page, date: string): Promise<void> {
	const response = await page.request.get(`${BASE}/api/schedule/week?start=${mondayOf(date)}`)
	try {
		expect(response.status()).toBe(200)
		const serverDate = Date.parse(response.headers()['date'] ?? '')
		if (!Number.isFinite(serverDate))
			throw new Error('Server Date header is unavailable; real clock coherence is unverified')
		expect(Math.abs(Date.now() - serverDate)).toBeLessThanOrEqual(5000)
	} finally {
		await response.dispose()
	}
}

async function clockPermissions(page: Page, fx: Fx): Promise<void> {
	cleanupFixtures()
	const boundary = new Date(Math.ceil((Date.now() + 180000) / 60000) * 60000)
	const date = vnToday(boundary)
	if (date !== vnToday()) throw new Error('Vietnam day boundary is too close for this journey')
	const time = new Intl.DateTimeFormat('en-GB', {
		timeZone: VN,
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
	}).format(boundary)
	const singleCard = await fx.card('Alex Example 2182')
	const seriesCard = await fx.card('Alex Example 2183')
	await fx.opening(singleCard.id, 300, addDays(date, -3))
	await fx.opening(seriesCard.id, 300, addDays(date, -3))
	const single = await fx.once(singleCard.id, date, time)
	const series = await fx.weekly(seriesCard.id, date, time)
	await fx.moveOccurrence(series, date, addDays(date, -1), '10:00')
	await fx.markOccurrence(series, date, 'done')
	await fx.moveOccurrence(series, date, date, time)
	const key = `s:${series}:${date}`
	const beforeWeek = await fx.week(mondayOf(date))
	expect(beforeWeek.find((entry) => entry.key === `l:${single}`)?.actions.mark).toBe(false)
	const beforeToday = (await fx.today()).lessons.find((entry) => entry.key === key && entry.outcome === 'done')
	expect(beforeToday?.actions.mark).toBe(true)
	expect(beforeToday?.actions.series).toBe(true)
	const scheduleDialog = await openLesson(page, singleCard, date, time)
	for (const label of ['Scheduled', 'Done', 'No-show']) await expect(markRadio(scheduleDialog, label)).toBeDisabled()
	const todayPage = await page.context().newPage()
	try {
		await openToday(todayPage)
		const todayDialog = await openTodayLesson(todayPage, seriesCard)
		await expect(markRadio(todayDialog, 'Done')).toBeChecked()
		await expect(todayDialog.getByRole('button', { name: 'Move series', exact: true })).toBeVisible()
		await expect(todayDialog.getByRole('button', { name: 'End series', exact: true })).toBeVisible()
		await assertRealClock(page, date)
		expect(Date.now()).toBeLessThan(boundary.getTime() - 5000)
		await expect
			.poll(() => Date.now(), { timeout: boundary.getTime() - Date.now() + 10000, intervals: [1000] })
			.toBeGreaterThanOrEqual(boundary.getTime())
		await assertRealClock(page, date)
		const afterWeek = await fx.week(mondayOf(date))
		expect(afterWeek.find((entry) => entry.key === `l:${single}`)?.actions.mark).toBe(true)
		const afterToday = (await fx.today()).lessons.find((entry) => entry.key === key && entry.outcome === 'done')
		expect(afterToday?.actions.mark).toBe(true)
		expect(afterToday?.actions.series).toBe(false)
		for (const label of ['Scheduled', 'Done', 'No-show'])
			await expect(markRadio(scheduleDialog, label)).toBeEnabled({ timeout: 75000 })
		await expect(todayDialog.getByRole('button', { name: 'Move series', exact: true })).toHaveCount(0, {
			timeout: 75000,
		})
		await expect(todayDialog.getByRole('button', { name: 'End series', exact: true })).toHaveCount(0)
		await expect(todayDialog.getByRole('button', { name: 'Move lesson', exact: true })).toBeVisible()
		await chooseMark(page, scheduleDialog, 'Done', 'Deducts 1 lesson (60 min).')
		expect(fx.markKind(single)).toBe('done')
		await balanceEverywhere(page, fx, singleCard, '2 lessons left', 120)
		await balanceEverywhere(todayPage, fx, seriesCard, '2 lessons left', 120)
	} finally {
		await todayPage.close()
	}
}

test('dialog marks deduct by lesson length', async ({ page, fx }, info) => {
	const today = vnToday()
	const yesterday = addDays(today, -1)
	const card = await fx.card('Alex Example 2182')
	await fx.opening(card.id, 500, addDays(today, -3))
	await fx.once(card.id, yesterday, '10:00', 60)
	await fx.once(card.id, yesterday, '12:00', 90)
	let dialog = await openLesson(page, card, yesterday, '10:00')
	if (info.project.name === 'dark') await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/)
	else await expect(page.locator('html')).not.toHaveClass(/(^|\s)dark(\s|$)/)
	await expect(markRadio(dialog, 'Scheduled')).toBeChecked()
	await expect(
		dialog.getByText('Not marked yet. Nothing is deducted until you mark it.', { exact: true })
	).toBeVisible()
	await chooseMark(page, dialog, 'Done', 'Deducts 1 lesson (60 min).')
	await page.keyboard.press('Escape')
	await balanceEverywhere(page, fx, card, '4 lessons left', 240)
	dialog = await openLesson(page, card, yesterday, '12:00')
	await chooseMark(page, dialog, 'Done', 'Deducts 1.5 lessons (90 min).')
	await screenshot(dialog, info)
	await page.keyboard.press('Escape')
	await balanceEverywhere(page, fx, card, '2.5 lessons left', 150)
})

test('dialog corrections recompute the balance everywhere', async ({ page, fx }, info) => {
	const today = vnToday()
	const yesterday = addDays(today, -1)
	const card = await fx.card('Alex Example 2182')
	await fx.opening(card.id, 500, addDays(today, -3))
	const sixty = await fx.once(card.id, yesterday, '10:00', 60)
	const ninety = await fx.once(card.id, yesterday, '12:00', 90)
	await fx.mark(sixty, 'done')
	await fx.mark(ninety, 'done')
	await balanceEverywhere(page, fx, card, '2.5 lessons left', 150)
	for (const step of [
		{
			label: 'No-show',
			help: 'Deducts 1.5 lessons (90 min).',
			balance: '2.5 lessons left',
			minutes: 150,
			kind: 'no_show',
		},
		{
			label: 'Scheduled',
			help: 'Not marked yet. Nothing is deducted until you mark it.',
			balance: '4 lessons left',
			minutes: 240,
			kind: 'none',
		},
		{ label: 'Done', help: 'Deducts 1.5 lessons (90 min).', balance: '2.5 lessons left', minutes: 150, kind: 'done' },
	]) {
		const dialog = await openLesson(page, card, yesterday, '12:00')
		await chooseMark(page, dialog, step.label, step.help)
		await page.keyboard.press('Escape')
		await balanceEverywhere(page, fx, card, step.balance, step.minutes)
		expect(fx.markCount(card.id)).toBe(2)
		expect(fx.markKind(ninety)).toBe(step.kind)
	}
	await screenshot(await openLesson(page, card, yesterday, '12:00'), info)
	await page.keyboard.press('Escape')
	await pendingDialogMark(page, fx)
	await keyboardToday(page, fx, info)
})

test('Today quick marks set and correct a mark', async ({ page, fx }, info) => {
	test.setTimeout(420000)
	const today = vnToday()
	const time = startedSlotToday()
	const card = await fx.card('Alex Example 2183')
	await fx.opening(card.id, 300, addDays(today, -3))
	const lesson = await fx.once(card.id, today, time)
	await openToday(page)
	const row = lessonRow(page, 'today-lessons', card)
	await rowBodyStyles(row, false)
	await expect(row.getByRole('button', { name: `Mark ${card.name}, ${time}, as no-show`, exact: true })).toBeVisible()
	const beforeToMark = Number(await tile(page, 'To mark').innerText())
	const beforeDone = Number(await tile(page, 'Done').innerText())
	await pendingQuickMark(page, row, card.name, time, lesson)
	await expect(page.getByRole('button', { name: 'Dismiss', exact: true })).toHaveCount(0)
	await expect(tile(page, 'To mark')).toHaveText(String(beforeToMark - 1))
	await expect(tile(page, 'Done')).toHaveText(String(beforeDone + 1))
	expect(fx.markKind(lesson)).toBe('done')
	await balanceEverywhere(page, fx, card, '2 lessons left', 120)
	await openToday(page)
	await changeQuickMark(page, card, time, 'Done', 'No-show')
	await expect(
		row.getByRole('button', { name: `${card.name}, ${time}: No-show. Change the mark`, exact: true })
	).toBeVisible()
	await expect(page.getByRole('button', { name: 'Dismiss', exact: true })).toHaveCount(0)
	expect(fx.markKind(lesson)).toBe('no_show')
	await balanceEverywhere(page, fx, card, '2 lessons left', 120)
	await openToday(page)
	await changeQuickMark(page, card, time, 'No-show', 'Clear mark')
	await expect(row.getByRole('button', { name: `Mark ${card.name}, ${time}, as done`, exact: true })).toBeVisible()
	await expect(row.getByRole('button', { name: `Mark ${card.name}, ${time}, as no-show`, exact: true })).toBeVisible()
	await expect(tile(page, 'To mark')).toHaveText(String(beforeToMark))
	await expect(tile(page, 'Done')).toHaveText(String(beforeDone))
	await expect(page.getByRole('button', { name: 'Dismiss', exact: true })).toHaveCount(0)
	expect(fx.markKind(lesson)).toBe('none')
	await screenshot(row, info)
	await balanceEverywhere(page, fx, card, '3 lessons left', 180)
	await clockPermissions(page, fx)
})

test.describe('mark history across zones [tz]', () => {
	test.use({ timezoneId: 'UTC' })
	test('E05 E10 D-17 moves a marked past lesson and rejects stale expectedStartsAt without double deduction', async ({
		page,
		fx,
	}) => {
		await markedPastMove(page, fx)
	})
	for (const action of ['cut', 'end'] as const) {
		test(`E09 E10 ${action} keeps the natural prefix, finite tail, moved-past marks and lineage once`, async ({
			page,
			fx,
		}) => {
			await crossZoneTail(page, fx, action)
		})
	}
})
test('[calendar] history preserves marks and refuses unconfirmed elapsed lessons', async ({ page }) => {
	await calendarHistoryMarks(page.request)
})
