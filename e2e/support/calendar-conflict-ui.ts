import type { Page } from '@playwright/test'

import {
	googleConnectionSnapshot,
	googleConflictRequest,
	googleConflictResult,
} from '../../packages/contracts/src/calendar.ts'
import { addDays, mondayOf } from '../../packages/core/src/index.ts'
import { api } from './api.ts'
import { parseCalendarResponse } from './calendar-commands.ts'
import { conflictFixture } from './calendar-conflicts.ts'
import { armCalendarFault, calendarFaultEvidence, disarmCalendarFault } from './calendar-fault-control.ts'
import { openView } from './calendar-view.ts'
import { expect, test } from './test.ts'
import { pickDate, pickTime } from './ui.ts'

async function openCreate(page: Page, empty = false) {
	const fixture = await conflictFixture(page.request)
	const sample = fixture.cases.find((item) =>
		empty
			? item.expectedState === 'complete' &&
				item.expectedEventKeys.length === 0 &&
				item.request.proposal.operation === 'create' &&
				item.request.proposal.input.repeats === 'once'
			: item.name === 'single'
	)
	if (!sample || sample.request.proposal.operation !== 'create')
		throw new Error(
			empty
				? 'Retained zero-overlap create proposal is required for K5'
				: 'Retained create conflict proposal is required'
		)
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

async function zeroOverlapUi(page: Page) {
	const { dialog } = await openCreate(page, true)
	await expect(dialog.getByRole('button', { name: 'Add lesson', exact: true })).toBeEnabled()
	const success = dialog.locator('[data-slot="google-conflicts"] [data-slot="banner"]')
	await expect(success).toHaveText('No Google Calendar overlaps in the checked range.')
	await expect(success.getByText(/Checked range:|Checked at:|\d{4}-\d{2}-\d{2}T/)).toHaveCount(0)
	await page.keyboard.press('Escape')
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
	await expect(dialog.locator('[data-slot="google-conflicts"]')).not.toContainText(/\d{4}-\d{2}-\d{2}T\d{2}:/)
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
	const weeklyCheck = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/google/conflicts')
	await page.getByRole('option', { name: 'Every week', exact: true }).click()
	const weeklyInput: unknown = JSON.parse((await weeklyCheck).postData() ?? 'null')
	const checkedInput = parseCalendarResponse(googleConflictRequest, weeklyInput)
	if (sample.request.proposal.operation !== 'create') throw new Error('Create proposal is required')
	expect(checkedInput.checkThrough).toBe(addDays(mondayOf(sample.request.proposal.input.date), 6))
	await expect(dialog.getByRole('button', { name: 'Add series', exact: true })).toBeEnabled()
	await expect(dialog.getByRole('button', { name: 'Check through: Choose date', exact: true })).toHaveCount(0)
	await expect(
		dialog.getByText('Only the checked period is covered. Later occurrences have not been checked.')
	).toBeVisible()
	await dialog.getByRole('button', { name: /^Check through:/ }).focus()
	await page.keyboard.press('Enter')
	await expect(page.getByRole('grid')).toBeVisible()
	await page.keyboard.press('Escape')
	await expect(dialog).toBeVisible()
	await pickDate(page, sample.request.proposal.input.date, 'google-check-through')
	await expect(dialog.getByRole('button', { name: 'Add series', exact: true })).toBeEnabled()
	await dialog.getByRole('button', { name: /^Check through:/ }).click()
	await page.locator('[data-day][data-selected-single="true"]').click()
	await expect(dialog.getByRole('button', { name: 'Check through: Choose date', exact: true })).toHaveCount(0)
	await expect(dialog.getByRole('button', { name: 'Add series', exact: true })).toBeEnabled()
	await page.keyboard.press('Escape')
	await zeroOverlapUi(page)
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
