import type { Locator, Page } from '@playwright/test'

import { googleScheduleWindow, type CalendarEventView } from '../../packages/contracts/src/calendar.ts'
import { addDays, mondayOf, scheduleDate } from '../../packages/core/src/index.ts'
import { api } from './api.ts'
import { calendarCommandFixture, parseCalendarResponse } from './calendar-commands.ts'
import { observedView, openView, watchCalendarWrites } from './calendar-view.ts'
import { expect, test } from './test.ts'

async function dragTo(page: Page, block: Locator, date: string, time: string, release = true) {
	await block.scrollIntoViewIfNeeded()
	await block.evaluate((button) => {
		const body = button.closest<HTMLElement>('[data-slot="week-grid-body"]')
		if (body)
			body.scrollTop += button.getBoundingClientRect().top - body.getBoundingClientRect().top - body.clientHeight / 2
	})
	const source = await block.boundingBox()
	const column = await page.locator(`[data-slot="week-grid-column"][data-date="${date}"]`).boundingBox()
	if (!source || !column) throw new Error('Visible Calendar drag source and destination required')
	const [hours, minutes] = time.split(':').map(Number)
	await page.mouse.move(source.x + source.width / 2, source.y + 3)
	await page.mouse.down()
	await page.mouse.move(source.x + source.width / 2 + 8, source.y + 3)
	await page.mouse.move(column.x + column.width / 2, column.y + (hours * 60 + minutes) * 0.8 + 3, { steps: 12 })
	if (release) await page.mouse.up()
}

async function readOnlyLabel(page: Page, event: CalendarEventView, block: Locator) {
	if (event.editBlock === null) return
	await expect(block).toHaveAttribute('aria-label', /Read-only$/)
	await block.hover()
	await expect(page.locator('[data-slot="event-tooltip"]').getByText('Read-only', { exact: true })).toBeVisible()
	await block.click()
	await expect(page.getByRole('button', { name: 'Move lesson', exact: true })).toHaveCount(0)
	await expect(page.getByRole('button', { name: 'Cancel lesson', exact: true })).toHaveCount(0)
	await page.keyboard.press('Escape')
}

export async function calendarLessonDrag(page: Page) {
	test.setTimeout(300000)
	const fixture = await calendarCommandFixture(page.request)
	const window = await openView(page, observedView().weekStart)
	const event = window.events.find(
		(item) =>
			item.binding.kind === 'lesson' &&
			item.binding.ref.kind === 'single' &&
			item.binding.studentId === fixture.studentId &&
			item.when.kind === 'timed' &&
			item.editBlock === null &&
			item.status === 'confirmed' &&
			Date.parse(item.when.startsAt) > Date.now()
	)
	if (!event || event.when.kind !== 'timed') throw new Error('Retained future writable synthetic lesson required')
	const zone = window.requestedRange.timeZone
	const sourceDate = scheduleDate(new Date(event.when.startsAt), zone)
	const date = sourceDate === addDays(observedView().weekStart, 6) ? sourceDate : addDays(sourceDate, 1)
	const time = new Intl.DateTimeFormat('en-GB', {
		timeZone: zone,
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
	}).format(new Date(event.when.startsAt))
	const [hour, minute] = time.split(':').map(Number)
	const duration = (Date.parse(event.when.endsAt) - Date.parse(event.when.startsAt)) / 60000
	const targetHour = hour * 60 + minute + 60 + duration <= 1440 ? hour + 1 : hour - 1
	const targetTime = `${String(targetHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
	const block = page.locator(`[data-slot="week-grid-body"] [data-event-key="${event.eventKey}"]`)
	const writes = watchCalendarWrites(page)
	const end = new Date(event.when.endsAt)
	const endDay =
		scheduleDate(end, zone) === sourceDate
			? ''
			: `${new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short' }).format(end)} `
	const endTime = new Intl.DateTimeFormat('en-GB', {
		timeZone: zone,
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
	}).format(end)
	await expect(block).toHaveAccessibleName(
		`${event.title?.trim() || 'Busy'}, ${time}–${endDay}${endTime}, Planned, ${event.blocksTime ? 'Busy' : 'Available'}, Editable`
	)
	await block.hover()
	const tooltip = page.locator('[data-slot="event-tooltip"]')
	await expect(tooltip.getByText('Planned', { exact: true })).toBeVisible()
	await expect(tooltip.getByText('Editable', { exact: true })).toBeVisible()
	await expect(tooltip.getByText(event.blocksTime ? 'Busy' : 'Available', { exact: true })).toBeVisible()
	await expect(tooltip.getByText('Read-only', { exact: true })).toHaveCount(0)
	expect(
		window.events.some((item) => item.when.kind === 'timed' && item.editBlock !== null),
		'Retained read-only timed event required for CAL-UI-02 negative path'
	).toBe(true)
	for (const fenced of window.events.filter(
		(item) =>
			item.when.kind === 'timed' &&
			(item.editBlock !== null || item.status === 'cancelled' || Date.parse(item.when.startsAt) <= Date.now())
	)) {
		if (fenced.when.kind !== 'timed') continue
		const fencedDate = scheduleDate(new Date(fenced.when.startsAt), zone)
		if (mondayOf(fencedDate) !== observedView().weekStart) continue
		const locked = page.locator(`[data-slot="week-grid-body"] [data-event-key="${fenced.eventKey}"]`).first()
		await readOnlyLabel(page, fenced, locked)
		await dragTo(page, locked, fencedDate, targetTime)
		await expect(page.getByRole('group', { name: 'Move lesson', exact: true })).toHaveCount(0)
		await page.keyboard.press('Escape')
	}
	await block.click()
	await expect(page.getByRole('button', { name: 'Move lesson', exact: true })).toBeEnabled()
	await expect(page.getByRole('button', { name: 'Cancel lesson', exact: true })).toBeEnabled()
	await expect(page.getByRole('group', { name: 'Move lesson', exact: true })).toHaveCount(0)
	await page.keyboard.press('Escape')
	await dragTo(page, block, sourceDate, time)
	await expect(page.getByRole('group', { name: 'Move lesson', exact: true })).toHaveCount(0)
	for (const cancellation of ['Escape', 'blur', 'pointercancel']) {
		await dragTo(page, block, date, targetTime, false)
		if (cancellation === 'Escape') await page.keyboard.press('Escape')
		else if (cancellation === 'blur') await page.evaluate(() => globalThis.window.dispatchEvent(new Event('blur')))
		else await block.dispatchEvent('pointercancel', { pointerId: 1 })
		await page.mouse.up()
		await expect(page.getByRole('group', { name: 'Move lesson', exact: true })).toHaveCount(0)
	}
	expect(writes(), 'Cancelled gestures never mutate').toBe(0)
	await dragTo(page, block, date, targetTime)
	const form = page.getByRole('group', { name: 'Move lesson', exact: true })
	await expect(form).toBeVisible()
	await expect(form.locator('#move-lesson-time')).toContainText(targetTime)
	await expect(form.getByRole('button', { name: 'Move lesson', exact: true })).toBeEnabled()
	expect(writes(), 'Drop only proposes the checked move').toBe(0)
	await form.getByRole('button', { name: 'Close', exact: true }).click()
	await page.keyboard.press('Escape')
	expect(writes()).toBe(0)
	await dragTo(page, block, date, targetTime)
	await expect(form.getByRole('button', { name: 'Move lesson', exact: true })).toBeEnabled()
	await form.getByRole('button', { name: 'Move lesson', exact: true }).click()
	await expect(form).toHaveCount(0)
	const after = parseCalendarResponse(
		googleScheduleWindow,
		await api(page.request, 'GET', `/schedule/week?start=${mondayOf(date)}`)
	)
	const moved = after.events.find((item) => item.eventKey === event.eventKey)
	if (!moved || moved.when.kind !== 'timed') throw new Error('Confirmed moved lesson required')
	expect(Date.parse(moved.when.endsAt) - Date.parse(moved.when.startsAt)).toBe(
		Date.parse(event.when.endsAt) - Date.parse(event.when.startsAt)
	)
	expect(scheduleDate(new Date(moved.when.startsAt), zone)).toBe(date)
	expect(
		new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
			new Date(moved.when.startsAt)
		)
	).toBe(targetTime)
	await page.reload()
	await expect(block).toContainText(targetTime)
}
