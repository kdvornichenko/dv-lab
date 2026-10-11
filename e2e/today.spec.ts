import type { JSHandle, Locator, Page, Route, TestInfo } from '@playwright/test'

import { readSettings } from './support/api.ts'
import { calendarHistoryRead } from './support/calendar-history.ts'
import { calendarNextCards } from './support/calendar-next.ts'
import { calendarTodayUnavailable } from './support/calendar-today.ts'
import { BASE, cleanupFixtures } from './support/data.ts'
import { addDays, VN, vnToday } from './support/dates.ts'
import { expect, test, type Card, type Fx } from './support/test.ts'
import {
	concurrentSettings,
	fixtureDefaults,
	midnightAccounting,
	settingsExamples,
	staleDates,
} from './support/tz-ledger.ts'
import {
	cancelAndRetry,
	keyboardLayout,
	latePaysSoon,
	loadingFailure,
	pendingZone,
	secondZoneIdentity,
	staleSetting,
} from './support/tz-settings.ts'
import {
	balanceEverywhere,
	dueRow,
	expectDue,
	lessonRow,
	openToday,
	rowBodyStyles,
	screenshot,
	setThreshold,
	tile,
} from './support/ui.ts'

test('[calendar] next C2 cards preserve provider status through every response', async ({ page }) => {
	await calendarNextCards(page.request)
})

test('[calendar] C2 today unavailable preserves history and excludes legacy future', async ({ page }) => {
	await calendarTodayUnavailable(page.request)
})

async function profileHeader(page: Page, card: Card, unset: boolean): Promise<void> {
	await page.goto(`/students/${card.id}`)
	const heading = page.getByRole('heading', { name: card.name, exact: true, level: 1 })
	await expect(heading).toBeVisible()
	const header = page.locator('header').filter({ has: heading })
	await expect(header.getByText(unset ? 'Not set' : '0 lessons left', { exact: true })).toBeVisible()
	const opening = header.getByRole('button', { name: 'Set opening balance', exact: true })
	if (unset) {
		await expect(opening).toBeVisible()
		await expect(opening).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
	} else await expect(opening).toHaveCount(0)
}

async function initialTodayHeading(page: Page): Promise<void> {
	const response = await page.request.get<unknown>(`${BASE}/`)
	try {
		expect(response.status()).toBe(200)
		const serverNow = new Date(response.headers()['date'] ?? '')
		if (!Number.isFinite(serverNow.getTime())) throw new Error('SSR Date header is unavailable')
		expect(Math.abs(Date.now() - serverNow.getTime())).toBeLessThanOrEqual(5000)
		expect(vnToday(serverNow)).toBe(vnToday())
		const h1 = (await response.text()).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
		if (h1 === undefined) throw new Error('SSR h1 is missing')
		const title = h1.replace(/<!--[\s\S]*?-->|<[^>]*>/g, '').trim()
		expect(title).toBe('Today')
	} finally {
		await response.dispose()
	}
}

async function panelHeaders(page: Page, ids: string[]): Promise<void> {
	const remScale = await page
		.locator('html')
		.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize) / 16)
	expect(remScale).toBeGreaterThan(0)
	for (const id of ids) {
		const section = page.locator(`section[aria-labelledby="${id}"]`)
		const header = section.getByRole('heading', { level: 2 }).locator('..').locator('..')
		await expect(header).toBeVisible()
		const padding = await header.evaluate((element) => {
			const style = getComputedStyle(element)
			return [style.paddingTop, style.paddingBottom, style.paddingLeft, style.paddingRight].map((value) =>
				Number.parseFloat(value)
			)
		})
		for (const [index, expected] of [12, 8, 16, 16].entries())
			expect(padding[index]).toBeCloseTo(expected * remScale, 3)
	}
}

type ExitState = {
	firstExitAt: number | null
	removedAt: number | null
	maxFrameGap: number
	intermediateOpacity: boolean
	panelRetained: boolean
	transformChanged: boolean
	durations: number[]
	delays: number[]
}

async function observeExit(row: Locator): Promise<JSHandle<{ state: ExitState; stop: () => void }>> {
	return row.evaluateHandle((element) => {
		const panel = element.closest('section')
		const initialTransform = getComputedStyle(element).transform
		const state: ExitState = {
			firstExitAt: null,
			removedAt: null,
			maxFrameGap: 0,
			intermediateOpacity: false,
			panelRetained: true,
			transformChanged: false,
			durations: [],
			delays: [],
		}
		let frame = 0
		let previous = performance.now()
		const inspect = (): void => {
			const now = performance.now()
			if (!element.isConnected) {
				state.removedAt = now
				return
			}
			const style = getComputedStyle(element)
			const opacity = Number(style.opacity)
			if (opacity < 1 && state.firstExitAt === null) state.firstExitAt = now
			if (state.firstExitAt === null) {
				previous = now
				return
			}
			state.maxFrameGap = Math.max(state.maxFrameGap, now - previous)
			state.intermediateOpacity ||= opacity > 0 && opacity < 1
			state.panelRetained &&= panel?.isConnected === true
			state.transformChanged ||= style.transform !== initialTransform
			for (const animation of element.getAnimations()) {
				const effect = animation.effect
				if (!(effect instanceof KeyframeEffect) || effect.target !== element) continue
				if (Number(effect.getKeyframes().at(-1)?.opacity) !== 0) continue
				const timing = effect.getTiming()
				if (typeof timing?.duration === 'number') state.durations.push(timing.duration)
				if (typeof timing?.delay === 'number') state.delays.push(timing.delay)
			}
			previous = now
		}
		const tick = (): void => {
			inspect()
			if (state.removedAt === null) frame = requestAnimationFrame(tick)
		}
		const observer = new MutationObserver(inspect)
		observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['style', 'class'],
		})
		frame = requestAnimationFrame(tick)
		return {
			state,
			stop: () => {
				observer.disconnect()
				cancelAnimationFrame(frame)
			},
		}
	})
}

async function markEarlier(page: Page, fx: Fx, info: TestInfo, reduced: boolean): Promise<void> {
	await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' })
	const today = vnToday()
	const earlier = addDays(today, -20)
	const card = await fx.card('Alex Example 2188')
	await fx.opening(card.id, 200, addDays(today, -25))
	const lesson = await fx.once(card.id, earlier, '10:00')
	await setThreshold(page, 2)
	await openToday(page)
	const data = await fx.today()
	const ordered = [...data.earlier].sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))
	const index = ordered.findIndex((entry) => entry.key === `l:${lesson}`)
	expect(index).toBeGreaterThanOrEqual(0)
	if (index >= 8) {
		await expect(page.locator('section[aria-labelledby="today-earlier"] [data-slot="more-row"]')).toHaveText(
			`+${ordered.length - 8} more`
		)
		info.annotations.push({ type: 'ui-limit', description: 'earlier: fixture beyond the first 8 rows' })
		throw new Error('Earlier fixture is hidden by the eight-row limit; the UI click journey is unverified')
	}
	const row = lessonRow(page, 'today-earlier', card)
	const earlierLabel = new Intl.DateTimeFormat('en-GB', {
		timeZone: VN,
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		...(earlier.slice(0, 4) === today.slice(0, 4) ? {} : { year: 'numeric' as const }),
	})
		.format(new Date(`${earlier}T12:00:00Z`))
		.replace(',', '')
		.replace('Sept', 'Sep')
	await expect(row.locator('[data-slot="today-row-date"]')).toHaveText(earlierLabel)
	if (!reduced) {
		await rowBodyStyles(row, true)
		await panelHeaders(page, ['today-lessons', 'today-earlier', 'today-pays-soon'])
	}
	await expect(row).toHaveCSS('opacity', '1')
	const probe = await observeExit(row)
	try {
		const response = page.waitForResponse(
			(value) =>
				new URL(value.url()).pathname === `/api/schedule/lessons/${lesson}/mark` && value.request().method() === 'POST'
		)
		await row.getByRole('button', { name: `Mark ${card.name}, 10:00, as done`, exact: true }).click()
		expect((await response).status()).toBe(200)
		await expect.poll(() => probe.evaluate(({ state }) => state.removedAt), { timeout: 10000 }).not.toBeNull()
		const exit = await probe.evaluate(({ state }) => state)
		console.log(`EARLIER_EXIT ${JSON.stringify({ reduced, ...exit })}`)
		await info.attach(reduced ? 'earlier-exit-reduced' : 'earlier-exit-normal', {
			body: JSON.stringify(exit),
			contentType: 'application/json',
		})
		expect(exit.intermediateOpacity).toBe(true)
		expect(exit.panelRetained).toBe(true)
		expect(exit.maxFrameGap).toBeLessThanOrEqual(34)
		if (exit.firstExitAt === null || exit.removedAt === null) throw new Error('Earlier exit was not observed')
		if (exit.durations.length) {
			expect(exit.durations.every((duration) => duration === 80)).toBe(true)
		} else {
			expect(exit.removedAt - exit.firstExitAt).toBeGreaterThanOrEqual(46)
			expect(exit.removedAt - exit.firstExitAt).toBeLessThanOrEqual(114)
		}
		if (reduced) {
			expect(exit.transformChanged).toBe(false)
			expect(exit.delays.every((delay) => delay === 0)).toBe(true)
		}
	} finally {
		try {
			await probe.evaluate(({ stop }) => stop())
		} finally {
			await probe.dispose()
		}
	}
	await expect(row).toHaveCount(0)
	const after = await fx.today()
	expect(after.earlier.some((entry) => entry.key === `l:${lesson}`)).toBe(false)
	if (data.earlier.length === 1) {
		await expect(page.locator('section[aria-labelledby="today-earlier"]')).toHaveCount(0)
	} else {
		await expect(page.locator('section[aria-labelledby="today-earlier"]')).toBeVisible()
		info.annotations.push({ type: 'ui-limit', description: 'last Earlier panel exit unverified: other lessons remain' })
	}
	await expectDue(page, card, after.paysSoon, '1 lesson left', 'Pays soon', info)
	await balanceEverywhere(page, fx, card, '1 lesson left', 60)
	if (reduced) {
		await screenshot(
			page.locator('header').filter({ has: page.getByRole('heading', { name: card.name, exact: true }) }),
			info
		)
	}
}

function gate() {
	let release!: () => void
	const promise = new Promise<void>((resolve) => {
		release = resolve
	})
	return { promise, release }
}

async function thresholdWhileSaving(page: Page): Promise<void> {
	await setThreshold(page, 0)
	const field = page.getByLabel('Pays soon threshold (lessons)', { exact: true })
	const held = gate()
	const seen = gate()
	const pattern = '**/api/settings'
	const handler = async (route: Route): Promise<void> => {
		if (route.request().method() === 'PATCH') {
			seen.release()
			await held.promise
		}
		await route.continue()
	}
	await page.route(pattern, handler)
	const pending = page.waitForResponse(
		(value) => new URL(value.url()).pathname === '/api/settings' && value.request().method() === 'PATCH'
	)
	try {
		await field.fill('3')
		await field.press('Enter')
		await seen.promise
		await expect(field).toBeDisabled()
		await expect(field).toHaveValue('3')
		expect((await readSettings(page.request)).paysSoonLessons).toBe(0)
		held.release()
		expect((await pending).status()).toBe(200)
		await expect(field).toBeEnabled()
		await expect(field).toHaveValue('3')
		expect((await readSettings(page.request)).paysSoonLessons).toBe(3)
	} finally {
		held.release()
		try {
			await pending
		} finally {
			await page.unroute(pattern, handler)
		}
	}
	const next = page.waitForResponse(
		(value) => new URL(value.url()).pathname === '/api/settings' && value.request().method() === 'PATCH'
	)
	await field.fill('4')
	await field.press('Enter')
	expect((await next).status()).toBe(200)
	await expect(field).toBeEnabled()
	await expect(field).toHaveValue('4')
	expect((await readSettings(page.request)).paysSoonLessons).toBe(4)
}

test('Pays soon follows the threshold and the balance', async ({ page, fx }, info) => {
	const today = vnToday()
	const owing = await fx.card('Alex Example 2187')
	const soon = await fx.card('Alex Example 2188')
	const unset = await fx.card('Alex Example 2189')
	await fx.opening(owing.id, 0, addDays(today, -3))
	await fx.opening(soon.id, 200, addDays(today, -25))
	await profileHeader(page, unset, true)
	await profileHeader(page, owing, false)
	const lesson = await fx.once(owing.id, addDays(today, -1), '10:00')
	await fx.mark(lesson, 'done')
	await fx.once(soon.id, addDays(today, -20), '10:00')
	await balanceEverywhere(page, fx, owing, 'owes 1 lesson', -60)
	await balanceEverywhere(page, fx, soon, '2 lessons left', 120)
	expect((await fx.student(unset.id)).balanceMinutes).toBeNull()
	await setThreshold(page, 2)
	await initialTodayHeading(page)
	await openToday(page)
	let data = await fx.today()
	await expect(
		page
			.locator('section[aria-labelledby="today-pays-soon"]')
			.getByText('2 lessons or fewer left, or owing', { exact: true })
	).toBeVisible()
	await expectDue(page, owing, data.paysSoon, 'owes 1 lesson', 'Owes lessons', info)
	await expectDue(page, soon, data.paysSoon, '2 lessons left', 'Pays soon', info)
	expect(data.paysSoon.findIndex((row) => row.id === owing.id)).toBeLessThan(
		data.paysSoon.findIndex((row) => row.id === soon.id)
	)
	expect(data.paysSoon.some((row) => row.id === unset.id)).toBe(false)
	await expect(dueRow(page, unset)).toHaveCount(0)
	await expect(tile(page, 'Pays soon')).toHaveText(String(data.paysSoon.length))
	if (
		data.paysSoon.findIndex((row) => row.id === owing.id) < 8 &&
		data.paysSoon.findIndex((row) => row.id === soon.id) < 8
	) {
		const owingBox = await dueRow(page, owing).boundingBox()
		const soonBox = await dueRow(page, soon).boundingBox()
		expect(owingBox?.y).toBeLessThan(soonBox?.y ?? -1)
	}
	await setThreshold(page, 0)
	await openToday(page)
	data = await fx.today()
	expect(data.paysSoon.some((row) => row.id === owing.id)).toBe(true)
	expect(data.paysSoon.some((row) => row.id === soon.id)).toBe(false)
	await expectDue(page, owing, data.paysSoon, 'owes 1 lesson', 'Owes lessons', info)
	await expect(dueRow(page, soon)).toHaveCount(0)
	await page.goto('/settings')
	await page.getByRole('tab', { name: 'General', exact: true }).click()
	const field = page.getByLabel('Pays soon threshold (lessons)', { exact: true })
	await expect(field).toBeEnabled()
	await field.fill('21')
	await field.press('Enter')
	await expect(page.getByText('Use a whole number from 0 to 20.', { exact: true })).toBeVisible()
	expect((await readSettings(page.request)).paysSoonLessons).toBe(0)
	await panelHeaders(page, ['settings-payments'])
	await screenshot(page.locator('section[aria-labelledby="settings-payments"]'), info)
	await thresholdWhileSaving(page)
})

test('Earlier, not marked lists a past unmarked lesson until it is marked', async ({ page, fx }, info) => {
	try {
		await markEarlier(page, fx, info, false)
		cleanupFixtures()
		await markEarlier(page, fx, info, true)
	} finally {
		await page.emulateMedia({ reducedMotion: null })
	}
})

test('[tz] E01 E11 fixture teacher defaults and missing settings preserve access boundaries', async ({
	playwright,
}) => {
	await fixtureDefaults(playwright.request)
})

test.describe('account time zone [tz]', () => {
	test.use({ timezoneId: 'UTC' })
	test.beforeEach(async ({ fx }) => {
		void fx
	})
	test('E01 E02 same selection, Keep, Escape, scrim and failure preserve both zones; retry persists', async ({
		page,
	}) => {
		await cancelAndRetry(page)
	})
	test('E03 pending PATCH blocks repeated input and every close path', async ({ page }) => {
		await pendingZone(page)
	})
	test('E04 independent second, None, favorites and canonical collisions survive navigation', async ({ page }) => {
		await secondZoneIdentity(page)
	})
	test('E11 concurrent partial writes preserve both fields; raw invalid and stale input is refused', async ({
		page,
		playwright,
	}) => {
		await concurrentSettings(page, playwright.request)
	})
	test('E03 E04 E11 late real Pays soon response cannot roll back main or collision swap', async ({ page }) => {
		await latePaysSoon(page)
	})
	test('E11 settings opened before another writer require refresh without resubmission', async ({
		page,
		playwright,
	}) => {
		const other = await playwright.request.newContext({ storageState: await page.context().storageState() })
		try {
			await staleSetting(page, other)
		} finally {
			await other.dispose()
		}
	})
	test('E11 stale create, move, cut, end, opening and payment return 409 without writes', async ({
		page,
		fx,
		playwright,
	}) => {
		const other = await playwright.request.newContext({ storageState: await page.context().storageState() })
		try {
			await staleDates(page, fx, other)
		} finally {
			await other.dispose()
		}
	})
	test('E10 account midnight changes lesson deduction consistently and preserves calendar dates', async ({
		page,
		fx,
	}) => {
		await midnightAccounting(page, fx)
	})
	test('E12 unknown main never flashes Vietnam; failed initial read can be retried', async ({ page }) => {
		await initialTodayHeading(page)
		await loadingFailure(page)
	})
	test('E12 320px and desktop keep keyboard focus, readable actions and bounded layout', async ({ page }) => {
		await keyboardLayout(page)
	})
	test('E12 unavailable example is omitted; one real next lesson uses one instant', async ({ page, fx }) => {
		await settingsExamples(page, fx)
	})
})

test('[calendar] history excludes elapsed legacy and pending lessons from Earlier', async ({ page }) => {
	await calendarHistoryRead(page.request)
})
