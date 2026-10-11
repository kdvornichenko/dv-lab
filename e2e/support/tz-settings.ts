import { expect, type APIRequestContext, type Locator, type Page, type Route } from '@playwright/test'

import { api, readSettings } from './api.ts'
import { BASE } from './data.ts'
import { VN } from './dates.ts'
import { record } from './input.ts'

export const NY = 'America/New_York'
export const MSK = 'Europe/Moscow'
const SECOND = 'dv-lab.schedule.second-zone'
const FAVORITES = 'dv-lab.time-zones.favorites'
const SETTINGS = `${BASE}/api/settings`
const STALE = 'Default time zone changed elsewhere. Refresh the page and try again.'

export const mainField = (page: Page) => page.getByLabel('Time zone', { exact: true })
export const secondField = (page: Page) => page.getByLabel('Second zone', { exact: true })
export const zoneDialog = (page: Page) => page.getByRole('alertdialog', { name: 'Change the default time zone?' })

export async function settingsPage(page: Page): Promise<void> {
	await page.goto('/settings')
	await page.getByRole('tab', { name: 'General', exact: true }).click()
	await expect(mainField(page)).toBeEnabled()
}

export async function setMain(request: APIRequestContext, zone: string): Promise<void> {
	const before = await readSettings(request)
	if (before.defaultTimeZone === zone) return
	await api(request, 'PATCH', '/settings', { defaultTimeZone: zone, expectedDefaultTimeZone: before.defaultTimeZone })
	expect((await readSettings(request)).defaultTimeZone).toBe(zone)
}

export async function pickZone(page: Page, label: 'Time zone' | 'Second zone', zone: string): Promise<void> {
	await page.getByLabel(label, { exact: true }).click()
	await page.getByRole('combobox', { name: 'Search time zones', exact: true }).fill(zone === 'none' ? 'None' : zone)
	await page.locator(`[role="option"][data-value="${zone}"]`).click()
}

export async function confirmZone(page: Page, status = 200): Promise<void> {
	const response = page.waitForResponse((value) => value.url() === SETTINGS && value.request().method() === 'PATCH')
	await zoneDialog(page)
		.getByRole('button', { name: /^Change to / })
		.click()
	expect((await response).status()).toBe(status)
}

export async function changeZone(page: Page, zone: string): Promise<void> {
	await settingsPage(page)
	await pickZone(page, 'Time zone', zone)
	await confirmZone(page)
	await expect(zoneDialog(page)).toHaveCount(0)
	await expect(mainField(page)).toContainText(zone)
	await expect(mainField(page)).toBeFocused()
}

async function preferences(page: Page) {
	return page.evaluate(
		([second, favorites]) => [localStorage.getItem(second), localStorage.getItem(favorites)],
		[SECOND, FAVORITES]
	)
}

async function expectZones(page: Page, main: string, second: string): Promise<void> {
	await expect(mainField(page)).toContainText(main)
	await expect(secondField(page)).toContainText(second === 'none' ? 'None' : second)
	expect((await readSettings(page.request)).defaultTimeZone).toBe(main)
	expect(await page.evaluate((key) => localStorage.getItem(key), SECOND)).toBe(second)
}

export async function cancelAndRetry(page: Page): Promise<void> {
	await settingsPage(page)
	await pickZone(page, 'Second zone', MSK)
	const before = await readSettings(page.request)
	const stored = await preferences(page)
	let patches = 0
	const observe = (route: Route) => {
		if (route.request().method() === 'PATCH') patches += 1
		return route.continue()
	}
	await page.route(SETTINGS, observe)
	try {
		await pickZone(page, 'Time zone', VN)
		await expect(zoneDialog(page)).toHaveCount(0)
		for (const exit of ['keep', 'escape', 'scrim']) {
			await pickZone(page, 'Time zone', MSK)
			await expect(mainField(page)).toContainText(VN)
			const keep = zoneDialog(page).getByRole('button', { name: 'Keep Vietnam', exact: true })
			await expect(keep).toBeFocused()
			if (exit === 'keep') await keep.click()
			else if (exit === 'escape') await page.keyboard.press('Escape')
			else await page.mouse.click(2, 2)
			await expect(zoneDialog(page)).toHaveCount(0)
			await expect(mainField(page)).toBeFocused()
			expect(await readSettings(page.request)).toEqual(before)
			expect(await preferences(page)).toEqual(stored)
		}
		expect(patches).toBe(0)
	} finally {
		await page.unroute(SETTINGS, observe)
	}
	const abort = (route: Route) => (route.request().method() === 'PATCH' ? route.abort('failed') : route.continue())
	await page.route(SETTINGS, abort)
	try {
		await pickZone(page, 'Time zone', MSK)
		await zoneDialog(page).getByRole('button', { name: 'Change to Moscow', exact: true }).click()
		await expect(zoneDialog(page).getByText('Could not save the time zone. Try again.', { exact: true })).toBeVisible()
		await expect(mainField(page)).not.toHaveAttribute('aria-invalid', 'true')
		expect(await readSettings(page.request)).toEqual(before)
		expect(await preferences(page)).toEqual(stored)
	} finally {
		await page.unroute(SETTINGS, abort)
	}
	await confirmZone(page)
	await expect(zoneDialog(page)).toHaveCount(0)
	await expectZones(page, MSK, VN)
	await page.reload()
	await expectZones(page, MSK, VN)
}

async function blockedClose(page: Page, dialog: Locator): Promise<void> {
	const confirm = dialog.getByRole('button', { name: 'Saving…', exact: true })
	await expect(confirm).toBeDisabled()
	await expect(dialog.getByRole('button', { name: /^Keep / })).toBeDisabled()
	const bounds = await confirm.boundingBox()
	if (!bounds) throw new Error('Pending confirmation is not visible')
	await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
	await confirm.press('Enter')
	await page.keyboard.press('Escape')
	await page.mouse.click(2, 2)
	await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toHaveCount(0)
	await expect(dialog).toBeVisible()
}

export async function pendingZone(page: Page): Promise<void> {
	await settingsPage(page)
	await pickZone(page, 'Second zone', MSK)
	await pickZone(page, 'Time zone', MSK)
	const hold = Promise.withResolvers<void>()
	const seen = Promise.withResolvers<void>()
	let patches = 0
	const handler = async (route: Route) => {
		if (route.request().method() === 'PATCH') {
			patches += 1
			seen.resolve()
			await hold.promise
		}
		await route.continue()
	}
	await page.route(SETTINGS, handler)
	try {
		const done = confirmZone(page)
		await seen.promise
		await expect(mainField(page)).toBeDisabled()
		await expect(mainField(page)).toContainText(VN)
		await blockedClose(page, zoneDialog(page))
		expect(patches).toBe(1)
		expect((await readSettings(page.request)).defaultTimeZone).toBe(VN)
		hold.resolve()
		await done
		await expect(zoneDialog(page)).toHaveCount(0)
		await expect(page.getByText('Default time zone changed to Moscow (MSK).', { exact: true })).toHaveCount(1)
		await expectZones(page, MSK, VN)
		expect(patches).toBe(1)
	} finally {
		hold.resolve()
		await page.unroute(SETTINGS, handler)
	}
}

export async function latePaysSoon(page: Page): Promise<void> {
	await settingsPage(page)
	await pickZone(page, 'Second zone', MSK)
	const old = await readSettings(page.request)
	const threshold = old.paysSoonLessons === 4 ? 5 : 4
	const saved = Promise.withResolvers<void>()
	const deliver = Promise.withResolvers<void>()
	const delivered = Promise.withResolvers<void>()
	const handler = async (route: Route) => {
		if (route.request().method() !== 'PATCH') return route.continue()
		const body: unknown = route.request().postDataJSON()
		if (!('paysSoonLessons' in record(body))) return route.continue()
		const response = await route.fetch<unknown>()
		try {
			expect(response.status()).toBe(200)
			const value: unknown = await response.json()
			expect(record(record(value).settings)).toMatchObject({ defaultTimeZone: VN, paysSoonLessons: threshold })
			saved.resolve()
			await deliver.promise
			await route.fulfill({ response })
			delivered.resolve()
		} finally {
			await response.dispose()
		}
	}
	await page.route(SETTINGS, handler)
	try {
		const field = page.getByLabel('Pays soon threshold (lessons)', { exact: true })
		await field.fill(String(threshold))
		await field.press('Enter')
		await saved.promise
		expect((await readSettings(page.request)).paysSoonLessons).toBe(threshold)
		await pickZone(page, 'Time zone', MSK)
		await confirmZone(page)
		await expectZones(page, MSK, VN)
		deliver.resolve()
		await delivered.promise
		await expect(field).toBeEnabled()
		await expect(field).toHaveValue(String(threshold))
		await expectZones(page, MSK, VN)
		await page.goto('/schedule')
		await expect(page.getByRole('button', { name: 'Second time zone', exact: true })).toContainText('VN')
		await settingsPage(page)
		await page.reload()
		await expectZones(page, MSK, VN)
		expect((await readSettings(page.request)).paysSoonLessons).toBe(threshold)
	} finally {
		deliver.resolve()
		await page.unroute(SETTINGS, handler)
	}
}

export async function secondZoneIdentity(page: Page): Promise<void> {
	await settingsPage(page)
	await pickZone(page, 'Second zone', MSK)
	await changeZone(page, 'UTC')
	await expectZones(page, 'UTC', MSK)
	await pickZone(page, 'Second zone', 'none')
	await changeZone(page, VN)
	await expectZones(page, VN, 'none')
	await secondField(page).click()
	const search = page.getByRole('combobox', { name: 'Search time zones', exact: true })
	await search.fill('Asia/Bangkok')
	await expect(page.getByRole('option')).toHaveCount(1)
	await search.fill('Asia/Saigon')
	await expect(page.getByRole('option')).toHaveCount(0)
	await search.fill('America/New_York')
	const star = page.getByRole('button', { name: new RegExp(`^(Add|Remove) ${NY} (to|from) favorites$`) })
	const starred = await star.getAttribute('aria-pressed')
	await star.focus()
	await page.keyboard.press('Space')
	await expect(star).toHaveAttribute('aria-pressed', starred === 'true' ? 'false' : 'true')
	await expect(secondField(page)).toContainText('None')
	await page.keyboard.press('Escape')
	await page.evaluate(
		([key, value]) => {
			localStorage.setItem(key, value)
			window.dispatchEvent(new Event('dv-lab:time-zones'))
		},
		[SECOND, 'US/Eastern']
	)
	await changeZone(page, NY)
	await expectZones(page, NY, VN)
	const favorites = (await preferences(page))[1]
	await page.evaluate((key) => localStorage.setItem(key, 'US/Eastern'), SECOND)
	await page.reload()
	await expectZones(page, NY, 'none')
	expect((await preferences(page))[1]).toBe(favorites)
	await page.goto('/schedule')
	await expect(page.getByRole('button', { name: 'Second time zone', exact: true })).toContainText('No second zone')
	await expect(page.locator('[data-slot="time-second"]')).toHaveCount(0)
}

export async function staleSetting(page: Page, other: APIRequestContext): Promise<void> {
	await settingsPage(page)
	await pickZone(page, 'Second zone', MSK)
	await pickZone(page, 'Time zone', MSK)
	const before = await preferences(page)
	await setMain(other, NY)
	await confirmZone(page, 409)
	await expect(page.getByText(STALE, { exact: true }).first()).toBeVisible()
	expect((await readSettings(other)).defaultTimeZone).toBe(NY)
	expect(await preferences(page)).toEqual(before)
	await expect(page.getByText(/^Default time zone changed to /)).toHaveCount(0)
	await page.reload()
	await expectZones(page, NY, MSK)
}

export async function loadingFailure(page: Page): Promise<void> {
	await setMain(page.request, NY)
	const held = Promise.withResolvers<void>()
	const started = Promise.withResolvers<void>()
	const handler = async (route: Route) => {
		if (route.request().method() !== 'GET') return route.continue()
		started.resolve()
		await held.promise
		await route.abort('failed')
	}
	await page.route(SETTINGS, handler)
	try {
		await page.goto('/settings')
		await started.promise
		await expect(page.getByText(VN, { exact: false })).toHaveCount(0)
		await expect(secondField(page)).toBeDisabled()
		held.resolve()
		await expect(page.getByText('Could not load the time zone. Refresh the page.', { exact: true })).toBeVisible()
		await expect(mainField(page)).toBeDisabled()
	} finally {
		held.resolve()
		await page.unroute(SETTINGS, handler)
	}
	await page.getByRole('button', { name: 'Refresh', exact: true }).first().click()
	await expect(mainField(page)).toContainText(NY)
	await expect(mainField(page)).toBeEnabled()
}

export async function keyboardLayout(page: Page): Promise<void> {
	await settingsPage(page)
	for (const copy of [
		'The zone your schedule is built in. Lesson times, Today and balances use it.',
		'New lessons and series are created in this zone. Lessons and series you already have keep the zone they were created in.',
		'Saved in this browser.',
	])
		await expect(page.getByText(copy, { exact: true })).toBeVisible()
	await expect(
		page.locator('#settings-default-time-zone').getByText('Saved to your account.', { exact: true })
	).toBeVisible()
	for (const width of [320, 1280]) {
		await page.setViewportSize({ width, height: 800 })
		await mainField(page).focus()
		await page.keyboard.press('Space')
		const search = page.getByRole('combobox', { name: 'Search time zones', exact: true })
		await search.fill('no-such-time-zone')
		await expect(page.getByText('No time zones found', { exact: true })).toBeVisible()
		await expect(page.getByText('Try a city, a country or an abbreviation like CET.', { exact: true })).toBeVisible()
		await search.fill('America')
		expect(await page.getByRole('option').count()).toBeGreaterThan(1)
		await search.fill('America/Argentina/La_Rioja')
		await expect(page.getByRole('option')).toHaveCount(1)
		await page.keyboard.press('ArrowDown')
		await page.keyboard.press('Enter')
		const dialog = zoneDialog(page)
		await expect(dialog.getByText('What changes', { exact: true })).toBeVisible()
		await expect(dialog.getByText('What stays', { exact: true })).toBeVisible()
		const keep = dialog.getByRole('button', { name: 'Keep Vietnam', exact: true })
		const change = dialog.getByRole('button', { name: /^Change to / })
		await expect(keep).toBeFocused()
		await page.keyboard.press('Shift+Tab')
		expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true)
		await page.keyboard.press('Tab')
		await expect(keep).toBeFocused()
		await change.scrollIntoViewIfNeeded()
		await expect(change).toBeInViewport()
		await keep.scrollIntoViewIfNeeded()
		await expect(keep).toBeInViewport()
		const boxes = await Promise.all([dialog.boundingBox(), keep.boundingBox(), change.boundingBox()])
		const [outer, safe, primary] = boxes
		if (!outer || !safe || !primary) throw new Error('Dialog geometry is unavailable')
		expect(outer.x).toBeGreaterThanOrEqual(16)
		expect(outer.x + outer.width).toBeLessThanOrEqual(width - 16)
		if (width === 320) {
			expect(primary.y).toBeLessThan(safe.y)
			expect(primary.height).toBeGreaterThanOrEqual(40)
		}
		expect(await page.locator('html').evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
		await page.keyboard.press('Escape')
		await expect(mainField(page)).toBeFocused()
	}
}
