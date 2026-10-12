import type { Page } from '@playwright/test'

import { googleConnectionSnapshot, googleConflictResult } from '../../packages/contracts/src/calendar.ts'
import { api } from './api.ts'
import { parseCalendarResponse } from './calendar-commands.ts'
import { conflictFixture } from './calendar-conflicts.ts'
import { armCalendarFault, calendarFaultEvidence, disarmCalendarFault } from './calendar-fault-control.ts'
import { openView } from './calendar-view.ts'
import { expect, test } from './test.ts'
import { pickDate, pickTime } from './ui.ts'

async function openCreate(page: Page) {
	const fixture = await conflictFixture(page.request)
	const sample = fixture.cases.find((item) => item.name === 'single')
	if (!sample || sample.request.proposal.operation !== 'create')
		throw new Error('Retained create conflict proposal is required')
	const input = sample.request.proposal.input
	await openView(page, sample.weekStart)
	await page.getByRole('button', { name: 'New lesson', exact: true }).click()
	const dialog = page.getByRole('dialog', { name: 'New lesson', exact: true })
	await dialog.getByLabel('Student', { exact: true }).click()
	await page.getByRole('option', { name: fixture.studentName, exact: true }).click()
	await pickDate(page, input.date, 'new-lesson-date')
	await pickTime(page, input.startTime, 'new-lesson-time')
	await dialog.locator('#new-lesson-length').fill(String(input.durationMinutes))
	return { fixture, sample, dialog }
}

export async function conflictCreateUi(page: Page) {
	test.setTimeout(300000)
	const response = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/google/conflicts')
	const { dialog, sample } = await openCreate(page)
	const save = dialog.getByRole('button', { name: 'Add lesson', exact: true })
	const raw: unknown = await (await response).json()
	const result = parseCalendarResponse(googleConflictResult, raw)
	expect(result.state).toBe('complete')
	await expect(save).toBeEnabled()
	if (result.state === 'complete' && result.events.length)
		await expect(
			dialog.getByText('You can still save this change. Google Calendar must confirm it before it is saved.')
		).toBeVisible()
	const fault = armCalendarFault({
		method: 'GET',
		resource: 'events',
		page: 'first',
		action: 'delay_response',
		delayMs: 5000,
	})
	try {
		await dialog.locator('#new-lesson-length').fill('61')
		await expect(save).toBeDisabled()
		await expect
			.poll(() => calendarFaultEvidence(fault).some((item) => item.phase === 'response_held'), { timeout: 20000 })
			.toBe(true)
		await dialog.locator('#new-lesson-length').fill('62')
		await expect(save).toBeDisabled()
		await dialog.locator('#new-lesson-length').fill('61')
		await expect(save).toBeDisabled()
	} finally {
		disarmCalendarFault(fault)
	}
	await expect(save).toBeEnabled()
	await dialog.locator('#new-lesson-length').fill('')
	await expect(save).toBeDisabled()
	await dialog.locator('#new-lesson-length').fill('61')
	await expect(save).toBeEnabled()
	await dialog.locator('#new-lesson-repeats').click()
	await page.getByRole('option', { name: 'Every week', exact: true }).click()
	await expect(dialog.getByRole('button', { name: 'Check through: Choose date', exact: true })).toBeVisible()
	await expect(dialog.getByRole('button', { name: 'Add series', exact: true })).toBeDisabled()
	await expect(dialog.getByRole('button', { name: 'Check overlaps', exact: true })).toBeDisabled()
	await dialog.getByRole('button', { name: 'Check through: Choose date', exact: true }).focus()
	await page.keyboard.press('Enter')
	await expect(page.getByRole('grid')).toBeVisible()
	await page.keyboard.press('Escape')
	await expect(dialog).toBeVisible()
	if (sample.request.proposal.operation !== 'create') throw new Error('Create proposal is required')
	await pickDate(page, sample.request.proposal.input.date, 'google-check-through')
	await expect(dialog.getByRole('button', { name: 'Add series', exact: true })).toBeEnabled()
	await dialog.getByRole('button', { name: /^Check through:/ }).click()
	await page.locator('[data-day][data-selected-single="true"]').click()
	await expect(dialog.getByRole('button', { name: 'Check through: Choose date', exact: true })).toBeVisible()
	await expect(dialog.getByRole('button', { name: 'Add series', exact: true })).toBeDisabled()
}

export async function conflictReconnectUi(page: Page) {
	test.setTimeout(300000)
	const { dialog, fixture } = await openCreate(page)
	if (!fixture.reconnectGeneration)
		throw new Error('Actual operator-controlled same-calendar reconnect boundary is required')
	const expectedGeneration = fixture.reconnectGeneration
	const before = parseCalendarResponse(googleConnectionSnapshot, await api(page.request, 'GET', '/google/connection'))
	const inputs = await dialog.locator('#new-lesson-length').inputValue()
	const tabOpened = page.context().waitForEvent('page')
	await dialog.getByRole('link', { name: 'Open calendar settings', exact: true }).click()
	const settings = await tabOpened
	expect(
		await settings.evaluate(() => {
			const opener: unknown = window.opener
			return opener === null
		})
	).toBe(true)
	await expect(settings).toHaveURL(/\/settings\?tab=calendar/)
	await expect
		.poll(
			async () => {
				const current = parseCalendarResponse(
					googleConnectionSnapshot,
					await api(page.request, 'GET', '/google/connection')
				)
				return (
					current.state === 'connected' &&
					current.generation >= expectedGeneration &&
					current.generation > before.generation &&
					current.calendar?.id === before.calendar?.id
				)
			},
			{ timeout: 90000 }
		)
		.toBe(true)
	await page.bringToFront()
	await expect(dialog.locator('#new-lesson-length')).toHaveValue(inputs)
	await expect(dialog.getByRole('button', { name: 'Add lesson', exact: true })).toBeEnabled()
	await settings.close()
}
