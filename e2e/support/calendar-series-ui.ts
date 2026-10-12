import type { Locator, Page } from '@playwright/test'

import {
	calendarCommandReceipt,
	calendarCommandSnapshot,
	googleConnectionSnapshot,
	googleConflictResult,
	googleScheduleWindow,
	moveCalendarSeriesRequest,
} from '../../packages/contracts/src/calendar.ts'
import { mondayOf, zonedParts } from '../../packages/core/src/index.ts'
import { api, readSettings } from './api.ts'
import { parseCalendarResponse } from './calendar-commands.ts'
import { conflictFixture } from './calendar-conflicts.ts'
import { armCalendarFault, calendarFaultEvidence, disarmCalendarFault } from './calendar-fault-control.ts'
import { openView } from './calendar-view.ts'
import { quote, sql } from './data.ts'
import { expect, test } from './test.ts'
import { setMain } from './tz-settings.ts'
import { pickDate, pickTime } from './ui.ts'

type Sample = NonNullable<Awaited<ReturnType<typeof conflictFixture>>['uiCases']>[number]

async function openMove(page: Page, sample: Sample, studentId: string) {
	const view = await openView(page, sample.weekStart)
	const event = view.events.find((item) => item.eventKey === sample.eventKey)
	if (!event || event.binding.kind !== 'lesson' || event.when.kind !== 'timed')
		throw new Error('Owned timed target is required')
	if (event.binding.studentId !== studentId) throw new Error('Move target is outside the retained synthetic ledger')
	const ref = event.binding.ref
	const startsAt = event.when.startsAt
	await page.locator(`[data-event-key="${event.eventKey}"]:visible`).first().click()
	if (sample.name === 'missing_context') {
		expect(ref.kind).toBe('series')
		if (ref.kind === 'series') expect(view.series.some((item) => item.series.id === ref.seriesId)).toBe(false)
		await expect(page.getByRole('button', { name: 'Move series', exact: true })).toHaveCount(0)
		return null
	}
	if (sample.request.proposal.operation === 'move_series') {
		if (ref.kind !== 'series') throw new Error('Whole series requires a canonical instance')
		const context = view.series.find((item) => item.series.id === ref.seriesId)
		if (!context?.series.referenceOccurrence?.ruleStartsAt) throw new Error('Natural series reference is required')
		await page.getByRole('button', { name: 'Move series', exact: true }).click()
		const dialog = page.getByRole('dialog', { name: 'Move series', exact: true })
		const natural = zonedParts(new Date(context.series.referenceOccurrence.ruleStartsAt), view.requestedRange.timeZone)
		await expect(dialog.locator('#move-series-day')).toContainText(
			['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][natural.weekday - 1]
		)
		await expect(dialog.locator('#move-series-time')).toContainText(natural.time)
		if (sample.name === 'moved_reference')
			expect(context.series.referenceOccurrence.actualStartsAt).not.toBe(
				context.series.referenceOccurrence.ruleStartsAt
			)
		const input = sample.request.proposal.input
		await pickDate(page, input.from, 'move-series-from')
		await dialog.locator('#move-series-day').click()
		await page
			.getByRole('option', {
				name: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][input.weekday - 1],
				exact: true,
			})
			.click()
		await pickTime(page, input.startTime, 'move-series-time')
		if (context.series.endsOn === null) {
			await expect(dialog.getByRole('button', { name: 'Check through: Choose date', exact: true })).toBeVisible()
			if (!sample.checkThrough) throw new Error('Explicit infinite-series range is required')
			await pickDate(page, sample.checkThrough, 'google-check-through')
		}
		return {
			dialog,
			view,
			context,
			event,
			startsAt,
			save: dialog.getByRole('button', { name: 'Move series', exact: true }),
		}
	}
	if (sample.request.proposal.operation !== 'move') throw new Error('Move proposal is required')
	await page.getByRole('button', { name: 'Move lesson', exact: true }).click()
	const dialog = page.getByRole('dialog')
	await pickDate(page, sample.request.proposal.input.date)
	await pickTime(page, sample.request.proposal.input.startTime)
	return {
		dialog,
		view,
		context: null,
		event,
		startsAt,
		save: dialog.getByRole('button', { name: 'Move lesson', exact: true }),
	}
}

export async function checkConflictUi(page: Page, dialog: Locator) {
	const pending = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/google/conflicts')
	await dialog.getByRole('button', { name: 'Check overlaps', exact: true }).click()
	const raw: unknown = await (await pending).json()
	const result = parseCalendarResponse(googleConflictResult, raw)
	expect(result.state).toBe('complete')
	return result
}

async function changedTarget(page: Page, sample: Sample, opened: NonNullable<Awaited<ReturnType<typeof openMove>>>) {
	const fault = armCalendarFault({
		method: 'GET',
		resource: 'events',
		page: 'first',
		action: 'delay_response',
		delayMs: 10000,
	})
	try {
		await opened.dialog.getByRole('button', { name: 'Check overlaps', exact: true }).click()
		await expect
			.poll(() => calendarFaultEvidence(fault).some((item) => item.phase === 'response_held'), { timeout: 20000 })
			.toBe(true)
		await expect
			.poll(
				async () => {
					const current = parseCalendarResponse(
						googleScheduleWindow,
						await api(page.request, 'GET', `/schedule/week?start=${sample.weekStart}`)
					)
					if (sample.name === 'stale_context')
						return (
							JSON.stringify(current.series.find((item) => item.series.id === opened.context?.series.id)?.series) !==
							JSON.stringify(opened.context?.series)
						)
					const event = current.events.find((item) => item.eventKey === sample.eventKey)
					return (
						event?.when.kind !== 'timed' ||
						event.when.startsAt !== opened.startsAt ||
						event.status !== opened.event.status
					)
				},
				{ timeout: 90000 }
			)
			.toBe(true)
		await expect(opened.save).toBeDisabled()
		await opened.dialog.getByRole('button', { name: 'Check overlaps', exact: true }).click()
		await expect(opened.save).toBeDisabled()
		await expect(
			opened.dialog.getByText('Could not check the full calendar range. Check again before saving.', { exact: true })
		).toBeVisible()
		await expect(opened.dialog).toBeVisible()
	} finally {
		disarmCalendarFault(fault)
	}
}

async function reconnect(page: Page, sample: Sample, dialog: Locator) {
	if (!sample.reconnectGeneration) throw new Error('Actual operator reconnect generation is required')
	if (sample.request.proposal.operation !== 'move') throw new Error('Single move reconnect draft is required')
	const time = sample.request.proposal.input.startTime
	const generation = sample.reconnectGeneration
	let writes = 0
	page.on('request', (request) => {
		if (request.method() === 'POST' && new URL(request.url()).pathname.startsWith('/api/schedule/')) writes++
	})
	const before = parseCalendarResponse(googleConnectionSnapshot, await api(page.request, 'GET', '/google/connection'))
	const tab = page.context().waitForEvent('page')
	await dialog.getByRole('link', { name: 'Open calendar settings', exact: true }).click()
	const settings = await tab
	await expect
		.poll(
			async () => {
				const current = parseCalendarResponse(
					googleConnectionSnapshot,
					await api(page.request, 'GET', '/google/connection')
				)
				return (
					current.state === 'connected' &&
					current.generation >= generation &&
					current.generation > before.generation &&
					current.calendar?.id === before.calendar?.id
				)
			},
			{ timeout: 90000 }
		)
		.toBe(true)
	await page.bringToFront()
	await expect(dialog).toBeVisible()
	await expect(dialog.locator('#move-lesson-time')).toContainText(time)
	expect(writes).toBe(0)
	await expect(dialog.getByRole('button', { name: 'Move lesson', exact: true })).toBeDisabled()
	await checkConflictUi(page, dialog)
	expect(writes).toBe(0)
	await expect(dialog.getByRole('button', { name: 'Move lesson', exact: true })).toBeEnabled()
	await settings.close()
}

export async function conflictMoveUi(page: Page) {
	test.setTimeout(600000)
	const fixture = await conflictFixture(page.request)
	const samples = fixture.uiCases?.filter((item) => !item.name.startsWith('cut_'))
	if (!samples) throw new Error('Retained public move scenarios are required')
	expect(new Set(samples.map((item) => item.name))).toEqual(
		new Set([
			'single',
			'whole',
			'moved_reference',
			'stale_target',
			'stale_context',
			'missing_context',
			'default_zone',
			'gap',
			'fold',
			'reconnect',
		])
	)
	const settings = await readSettings(page.request)
	try {
		for (const sample of samples) {
			await setMain(page.request, sample.request.proposal.input.expectedDefaultTimeZone)
			const opened = await openMove(page, sample, fixture.studentId)
			if (!opened) continue
			await expect(opened.save).toBeDisabled()
			if (sample.name === 'gap') {
				await expect(opened.dialog.getByText(/This time does not exist/)).toBeVisible()
				await expect(opened.dialog.getByRole('button', { name: 'Check overlaps', exact: true })).toBeDisabled()
			} else if (sample.name === 'stale_target' || sample.name === 'stale_context')
				await changedTarget(page, sample, opened)
			else if (sample.name === 'default_zone') {
				if (!sample.newDefaultTimeZone) throw new Error('Changed actual account zone is required')
				await checkConflictUi(page, opened.dialog)
				await setMain(page.request, sample.newDefaultTimeZone)
				await page.dispatchEvent('body', 'focus')
				await page.evaluate(() => window.dispatchEvent(new Event('focus')))
				await expect(opened.save).toBeDisabled()
				await expect(opened.dialog).toBeVisible()
			} else if (sample.name === 'reconnect') await reconnect(page, sample, opened.dialog)
			else {
				if (sample.name === 'fold') await expect(opened.dialog.getByText(/This time occurs twice/)).toBeVisible()
				await checkConflictUi(page, opened.dialog)
				await expect(opened.save).toBeEnabled()
			}
		}
	} finally {
		await setMain(page.request, settings.defaultTimeZone)
	}
	expect((await readSettings(page.request)).defaultTimeZone).toBe(settings.defaultTimeZone)
}

function domain(id: string) {
	return sql(`select ends_on from lesson_series where id = ${quote(id)}::uuid`)
}

async function cutCase(page: Page, sample: Sample, studentId: string) {
	const opened = await openMove(page, sample, studentId)
	if (!opened?.context) throw new Error('Bound series UI cut context is required')
	const checkingWindow = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/schedule/week')
	await checkConflictUi(page, opened.dialog)
	const checkedRaw: unknown = await (await checkingWindow).json()
	const checkedWindow = parseCalendarResponse(googleScheduleWindow, checkedRaw)
	const checkedContext = checkedWindow.series.find((item) => item.series.id === opened.context?.series.id)
	if (!checkedContext) throw new Error('Fresh checked whole-series context is required')
	const before = domain(opened.context.series.id)
	const fault = armCalendarFault({
		method: sample.name === 'cut_pending' ? 'PATCH' : 'POST',
		resource: 'events',
		page: 'any',
		action: sample.name === 'cut_pending' ? 'delay_response' : 'drop_response',
		delayMs: sample.name === 'cut_pending' ? 10000 : 0,
	})
	const pending = page.waitForResponse(
		(response) =>
			response.request().method() === 'POST' &&
			new URL(response.url()).pathname === `/api/schedule/series/${opened.context?.series.id}/move`
	)
	try {
		await opened.save.click()
		const response = await pending
		expect(response.status()).toBe(202)
		const raw: unknown = await response.json()
		const receipt = parseCalendarResponse(calendarCommandReceipt, raw)
		const body: unknown = response.request().postDataJSON()
		const sent = parseCalendarResponse(moveCalendarSeriesRequest, body)
		expect(sent.expectedVersion).toBe(checkedContext.version)
		const status = async () =>
			parseCalendarResponse(
				calendarCommandSnapshot,
				await api(page.request, 'GET', `/google/commands/${receipt.commandId}`)
			)
		await expect
			.poll(
				() =>
					calendarFaultEvidence(fault).some(
						(item) => item.phase === (sample.name === 'cut_pending' ? 'response_held' : 'response_dropped')
					),
				{ timeout: 20000 }
			)
			.toBe(true)
		expect(domain(opened.context.series.id)).toEqual(before)
		await expect(opened.save).toBeDisabled()
		await expect(page.getByText('Series moved', { exact: true })).toHaveCount(0)
		disarmCalendarFault(fault)
		await expect
			.poll(async () => (await status()).state, { timeout: 90000 })
			.toMatch(/applied|partial_recovery|recovery_required/)
		if (sample.name === 'cut_recovery') {
			expect((await status()).effect).toBe('partial')
			await page.reload()
			const row = page.locator(`[data-command-id="${receipt.commandId}"]`)
			await expect(row).toBeVisible()
			await expect(row.getByRole('button', { name: 'Resume recovery', exact: true })).toBeVisible()
			await row.getByRole('button', { name: 'Resume recovery', exact: true }).click()
		}
		await expect.poll(async () => (await status()).state, { timeout: 90000 }).toBe('applied')
		const applied = await status()
		expect(applied.requestId).toBe(sent.requestId)
		expect(applied.confirmedRevision).not.toBeNull()
		const view = await openView(
			page,
			mondayOf(
				sample.request.proposal.operation === 'move_series' ? sample.request.proposal.input.from : sample.weekStart
			)
		)
		expect(view.read.state).toBe('fresh')
		expect(view.write.state).toBe('ready')
		expect(
			view.series.some(
				(item) =>
					item.series.id !== opened.context?.series.id &&
					item.series.weekday === sent.weekday &&
					item.series.startTime === sent.startTime &&
					item.series.timeZone === sent.expectedDefaultTimeZone
			)
		).toBe(true)
	} finally {
		disarmCalendarFault(fault)
	}
}

export async function completeSeriesUi(page: Page) {
	test.setTimeout(600000)
	const fixture = await conflictFixture(page.request)
	const samples = fixture.uiCases?.filter((item) => item.name.startsWith('cut_'))
	if (!samples) throw new Error('Retained pending and recovery cut UI cases are required')
	expect(samples.map((item) => item.name).sort()).toEqual(['cut_pending', 'cut_recovery'])
	const settings = await readSettings(page.request)
	try {
		for (const sample of samples) {
			await setMain(page.request, sample.request.proposal.input.expectedDefaultTimeZone)
			await cutCase(page, sample, fixture.studentId)
		}
	} finally {
		await setMain(page.request, settings.defaultTimeZone)
	}
}
