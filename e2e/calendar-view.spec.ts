import { scheduleDate } from '../packages/core/src/index.ts'
import { withCalendarToday } from './support/calendar-today.ts'
import {
	expectCalendarReadOnly,
	expectClosedGestures,
	expectOverlap,
	expectViewCases,
	observedView,
	observeWindow,
	openView,
	watchCalendarWrites,
} from './support/calendar-view.ts'
import { expect, test } from './support/test.ts'

test.use({ screenshot: 'off', trace: 'off', video: 'off' })

test('[calendar-view] unavailable does not display legacy future or accept gestures', async ({ page }) => {
	const writes = watchCalendarWrites(page)
	await withCalendarToday(page.request, async ({ futureId }) => {
		const window = await openView(page)
		expect(window.read.state).toBe('unavailable')
		await expect(
			page.getByText('No checked calendar view is available for these dates.', { exact: true })
		).toBeVisible()
		await expect(page.getByText('No Google Calendar events in this range.', { exact: true })).toHaveCount(0)
		await expect(page.locator(`[data-key="l:${futureId}"], [data-event-key]`)).toHaveCount(0)
		await expectCalendarReadOnly(page)
		await expectClosedGestures(page)
		await observeWindow(page, () => page.getByRole('button', { name: 'Next week', exact: true }).click())
		await expect(
			page.getByText('No checked calendar view is available for these dates.', { exact: true })
		).toBeVisible()
		await page.setViewportSize({ width: 375, height: 812 })
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
	})
	expect(writes(), 'Disabled Schedule never sends a calendar mutation').toBe(0)
})

test('[calendar-view] fresh provider events expose safe keyboard and pointer details', async ({ page }) => {
	const writes = watchCalendarWrites(page)
	const fixture = observedView()
	const window = await openView(page, fixture.weekStart)
	expect(window.read.state).toBe('fresh')
	await expect(page.getByText(/^Last checked:/)).toBeVisible()
	await expectViewCases(page, window, fixture)
	await expectOverlap(page, window, fixture.overlap)
	await expectClosedGestures(page)
	const button = page.locator('[data-event-key]:visible').first()
	await button.click()
	await expect(page.getByRole('dialog')).toBeVisible()
	await page.keyboard.press('Escape')
	await expect(button).toBeFocused()
	await page.setViewportSize({ width: 375, height: 812 })
	await expect(page.locator('[data-slot="calendar-agenda"]')).toBeVisible()
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
	await page.locator('[data-event-key]:visible').first().click()
	await expect(page.getByRole('dialog')).toBeVisible()
	await expectCalendarReadOnly(page)
	expect(writes(), 'Read-only details never submit calendar commands').toBe(0)
})

test('[calendar-view] last-known dates stay truthful and an uncovered week is unavailable', async ({ page }) => {
	const fixture = observedView()
	const window = await openView(page, fixture.weekStart)
	expect(window.read.state).toBe('last_known')
	if (!window.snapshotRange) throw new Error('A complete observed snapshot is required')
	const date = scheduleDate(new Date(window.snapshotRange.start), window.snapshotRange.timeZone)
	await expect(page.locator('[data-slot="schedule-window"]')).toHaveAttribute('data-snapshot-start', date)
	await expect(page.getByText('Read-only', { exact: true }).first()).toBeVisible()
	await expectCalendarReadOnly(page)
	await expectClosedGestures(page)
	const uncovered = await observeWindow(page, () =>
		page.getByRole('button', { name: 'Next week', exact: true }).click()
	)
	expect(uncovered.read.state, 'Operator fixture has no complete snapshot for the next week').toBe('unavailable')
	await expect(page.locator('[data-event-key]')).toHaveCount(0)
	await expect(page.getByText('No checked calendar view is available for these dates.', { exact: true })).toBeVisible()
})

test('[calendar-view] only a complete fresh empty window shows an empty calendar', async ({ page }) => {
	const fixture = observedView()
	const window = await openView(page, fixture.emptyWeekStart)
	expect(window.read.state).toBe('fresh')
	expect(window.events.length).toBe(0)
	await expect(page.getByText('No Google Calendar events in this range.', { exact: true })).toBeVisible()
	await expect(page.getByText('No checked calendar view is available for these dates.', { exact: true })).toHaveCount(0)
	await expectCalendarReadOnly(page)
})

test('[calendar-view] transport failure retains only the checked dates and disables writes', async ({ page }) => {
	const fixture = observedView()
	const window = await openView(page, fixture.weekStart)
	expect(window.read.state).toBe('fresh')
	await page.route('**/api/schedule/week?*', (route) => route.abort('connectionfailed'))
	await page.getByRole('button', { name: 'Refresh', exact: true }).click()
	await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled()
	await expect(page.getByText('Read-only', { exact: true }).first()).toBeVisible()
	await expect(page.locator('[data-slot="schedule-window"]')).toHaveAttribute('data-snapshot-start', fixture.weekStart)
	await expectCalendarReadOnly(page)
	await page.getByRole('button', { name: 'Next week', exact: true }).click()
	await expect(page.locator('[data-event-key]')).toHaveCount(0)
	await expect(page.getByText('No checked calendar view is available for these dates.', { exact: true })).toBeVisible()
})
