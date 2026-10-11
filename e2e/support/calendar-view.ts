import { expect, type Page, type Response } from '@playwright/test'

import { z } from 'zod'

import {
	googleScheduleWindow,
	type CalendarEventView,
	type GoogleScheduleWindow,
} from '../../packages/contracts/src/calendar.ts'
import { addDays, mondayOf, scheduleDate } from '../../packages/core/src/index.ts'
import { PRIVATE_DIR } from './data.ts'
import { readPrivateJson } from './target.ts'

const viewFixture = z.strictObject({
	kind: z.literal('observed-google-view'),
	ownership: z.literal('dv-lab-synthetic'),
	weekStart: z.iso.date(),
	emptyWeekStart: z.iso.date(),
	overlap: z.tuple([z.string().regex(/^[0-9a-f]{64}$/), z.string().regex(/^[0-9a-f]{64}$/)]),
	cases: z
		.array(
			z.strictObject({
				role: z.enum(['timed', 'all_day', 'available', 'hidden_title', 'transition', 'lesson']),
				eventKey: z.string().regex(/^[0-9a-f]{64}$/),
			})
		)
		.min(6),
})

export function observedView() {
	const parsed = viewFixture.safeParse(readPrivateJson(`${PRIVATE_DIR}/calendar-view.json`))
	if (!parsed.success) throw new Error('Observed synthetic Calendar view fixture is required')
	const fixture = parsed.data
	if (
		mondayOf(fixture.weekStart) !== fixture.weekStart ||
		mondayOf(fixture.emptyWeekStart) !== fixture.emptyWeekStart ||
		new Set(fixture.cases.map((item) => item.role)).size !== 6
	)
		throw new Error('Observed Calendar fixture needs a Monday and every view case')
	return fixture
}

export async function observeWindow(
	page: Page,
	action: () => Promise<void | Response | null>
): Promise<GoogleScheduleWindow> {
	const pending = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/schedule/week')
	await action()
	const response = await pending
	expect(response.status(), 'Public window read succeeds').toBe(200)
	const value: unknown = await response.json()
	const parsed = googleScheduleWindow.safeParse(value)
	if (!parsed.success) throw new Error('Public GoogleScheduleWindow is invalid')
	return parsed.data
}

export async function openView(page: Page, monday?: string) {
	let window = await observeWindow(page, () => page.goto('/schedule'))
	if (monday === undefined) return window
	const current = scheduleDate(new Date(window.requestedRange.start), window.requestedRange.timeZone)
	const distance = (Date.parse(`${monday}T00:00:00Z`) - Date.parse(`${current}T00:00:00Z`)) / 604800000
	if (!Number.isInteger(distance)) throw new Error('Observed fixture does not align with the public week')
	const name = distance < 0 ? 'Previous week' : 'Next week'
	for (let step = 0; step < Math.abs(distance); step++)
		window = await observeWindow(page, () => page.getByRole('button', { name, exact: true }).click())
	return window
}

export async function expectCalendarReadOnly(page: Page) {
	await expect(page.getByRole('button', { name: 'New lesson', exact: true })).toBeDisabled()
	for (const name of [
		'Save',
		'Move lesson',
		'Cancel lesson',
		'Restore lesson',
		'Whole series',
		'End series',
		'Assign',
		'Ignore',
	])
		await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
	await expect(page.getByText('Saved', { exact: true })).toHaveCount(0)
}

export function watchCalendarWrites(page: Page) {
	let count = 0
	page.on('request', (request) => {
		if (request.method() !== 'GET' && /^\/api\/schedule\/(lessons|series)(\/|$)/.test(new URL(request.url()).pathname))
			count++
	})
	return () => count
}

export async function expectOverlap(page: Page, window: GoogleScheduleWindow, keys: readonly [string, string]) {
	const first = window.events.find((event) => event.eventKey === keys[0])
	const second = window.events.find((event) => event.eventKey === keys[1])
	if (
		!first ||
		!second ||
		first.eventKey === second.eventKey ||
		first.when.kind !== 'timed' ||
		second.when.kind !== 'timed'
	)
		throw new Error('Two distinct observed timed events are required')
	expect(
		Date.parse(first.when.startsAt) < Date.parse(second.when.endsAt) &&
			Date.parse(second.when.startsAt) < Date.parse(first.when.endsAt),
		'Observed provider events overlap'
	).toBe(true)
	const left = await page.locator(`[data-slot="week-grid"] [data-event-key="${keys[0]}"]`).first().boundingBox()
	const right = await page.locator(`[data-slot="week-grid"] [data-event-key="${keys[1]}"]`).first().boundingBox()
	if (!left || !right) throw new Error('Rendered overlapping events are required')
	expect(
		left.x + left.width <= right.x || right.x + right.width <= left.x,
		'Overlapping events occupy separate lanes'
	).toBe(true)
}

export async function expectClosedGestures(page: Page) {
	const column = page.locator('[data-slot="week-grid-column"]:visible').last()
	if ((await column.count()) === 0) return
	const bounds = await column.boundingBox()
	if (bounds === null) throw new Error('Visible Calendar column is required')
	const body = await page.locator('[data-slot="week-grid-body"]').boundingBox()
	if (body === null) throw new Error('Calendar scroller is required')
	const x = bounds.x + bounds.width - 1
	const y = body.y + 100
	await page.mouse.click(x, y)
	await page.mouse.move(x, y)
	await page.mouse.down()
	await page.mouse.move(x, y + 96, { steps: 4 })
	await page.mouse.up()
	await expect(page.locator('[data-slot="week-grid-frame"]')).toHaveCount(0)
	await expect(page.getByRole('dialog')).toHaveCount(0)
}

function expectCaseRole(event: CalendarEventView, role: ReturnType<typeof observedView>['cases'][number]['role']) {
	if (role === 'timed') expect(event.when.kind === 'timed' && event.binding.kind === 'external').toBe(true)
	if (role === 'all_day') expect(event.when.kind).toBe('all_day')
	if (role === 'available') expect(event.blocksTime).toBe(false)
	if (role === 'hidden_title') expect(event.title === null, 'Fixture has a restricted title').toBe(true)
	if (role === 'transition') expect(event.binding.kind).toBe('transition')
	if (role === 'lesson') expect(event.binding.kind).toBe('lesson')
}

async function expectAllDayDates(page: Page, event: CalendarEventView, weekStart: string) {
	if (event.when.kind !== 'all_day') return
	for (let day = 0; day < 7; day++) {
		const date = addDays(weekStart, day)
		const count = date >= event.when.startsOn && date < event.when.endsBefore ? 1 : 0
		await expect(
			page.locator(`[data-slot="calendar-all-day"] [data-date="${date}"] [data-event-key="${event.eventKey}"]`)
		).toHaveCount(count)
	}
}

export async function expectViewCases(
	page: Page,
	window: GoogleScheduleWindow,
	fixture: ReturnType<typeof observedView>
) {
	for (const item of fixture.cases) {
		const event = window.events.find((event) => event.eventKey === item.eventKey)
		if (!event) throw new Error('Observed synthetic event is absent from the public window')
		const button = page.locator(`[data-event-key="${item.eventKey}"]:visible`).first()
		await expect(button).toBeVisible()
		expectCaseRole(event, item.role)
		await expectAllDayDates(page, event, fixture.weekStart)
		await button.focus()
		await page.keyboard.press('Enter')
		const dialog = page.getByRole('dialog')
		await expect(dialog).toBeVisible()
		await expect(dialog.getByText('Read-only', { exact: true })).toBeVisible()
		if (item.role === 'available') await expect(dialog.getByText('Available', { exact: true })).toBeVisible()
		if (item.role === 'hidden_title')
			await expect(dialog.getByRole('heading', { name: 'Busy', exact: true })).toBeVisible()
		if (item.role === 'all_day') await expect(dialog.getByText('All day', { exact: true })).toBeVisible()
		await expect(dialog.locator('[data-slot="lesson-mark-row"]')).toHaveCount(0)
		await expectCalendarReadOnly(page)
		await dialog.getByRole('button', { name: 'Close', exact: true }).click()
		await expect(button).toBeFocused()
	}
}
