import type { Page, Locator } from '@playwright/test'

import type { ScheduleSeriesResponse, ErrorResponse } from '../../../packages/contracts/src/index.ts'
import * as core from '../../../packages/core/src/index.ts'
import { api, check, shot } from '../browser-context.ts'
import type { changesFixtures } from './changes.ts'
import { CH_A, CH_B } from './changes.ts'
import { slotLocator, dialogButtons, toastText, waitBlock, blockFacts, closeDialog, focusedBlock } from './dialogs.ts'
import { dayMonth, shortDay, whenText } from './format.ts'
import { goToWeek } from './navigation.ts'

export async function occurrenceStateCancelQuestion(
	page: Page,
	fx: Awaited<ReturnType<typeof changesFixtures>>,
	nav: { monday: string }
) {
	const dialog = page.getByRole('dialog')
	await goToWeek(page, nav, core.mondayOf(fx.wed))
	await slotLocator(page, CH_A, fx.wed).click()
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	let buttons: (string | undefined)[] = await dialogButtons(page)
	check(
		'cancel: a future planned lesson has Move lesson and Cancel lesson in the footer',
		buttons.includes('Move lesson') && buttons.includes('Cancel lesson'),
		buttons.join('|')
	)
	await dialog.getByRole('button', { name: 'Cancel lesson' }).click()
	await page.waitForTimeout(250)
	const question = dialog.locator('[data-slot="lesson-cancel-question"]')
	const asked = await question.evaluate((element) => ({
		text: element.textContent,
		role: element.getAttribute('role'),
	}))
	check(
		'cancel: the footer asks with the date and time in the main zone only',
		asked.text.includes(`Cancel the lesson on ${dayMonth(fx.wed)} at 18:00 VN?`) &&
			!asked.text.includes('MSK') &&
			asked.role === 'alert',
		asked.text
	)
	buttons = await dialogButtons(page)
	check(
		'cancel: the question offers Keep and Yes, cancel instead of the buttons',
		buttons.includes('Keep') && buttons.includes('Yes, cancel') && !buttons.includes('Move lesson'),
		buttons.join('|')
	)
	await shot(page, 'sched-changes', 'cancel-question')
	return { dialog, buttons }
}

export async function occurrenceStateCancelled(
	page: Page,
	fx: Awaited<ReturnType<typeof changesFixtures>>,
	dialog: Locator,
	buttons: (string | undefined)[]
) {
	await dialog.getByRole('button', { name: 'Keep', exact: true }).click()
	await page.waitForTimeout(250)
	buttons = await dialogButtons(page)
	check(
		'cancel: Keep brings the buttons back',
		buttons.includes('Move lesson') && buttons.includes('Cancel lesson') && !buttons.includes('Yes, cancel'),
		buttons.join('|')
	)
	await dialog.getByRole('button', { name: 'Cancel lesson' }).click()
	await dialog.getByRole('button', { name: 'Yes, cancel' }).click()
	const cancelledToast = await toastText(page, 'Lesson cancelled')
	check(
		'cancel: toast names the lesson in the main zone only',
		cancelledToast.includes(`${CH_A}, ${shortDay(fx.wed)}, 18:00 VN.`) && !cancelledToast.includes('MSK'),
		cancelledToast
	)
	check('cancel: the block turns cancelled on the grid', await waitBlock(page, CH_A, fx.wed, 'to', ', cancelled'))
	let facts = await blockFacts(page, CH_A, fx.wed)
	check(
		'cancel: the block stays, without fill and struck through',
		facts.block !== null &&
			facts.block.background === facts.data.transparent &&
			facts.block.decoration.includes('line-through'),
		facts.block ? `${facts.block.background}/${facts.block.decoration}` : 'no block'
	)
	await page.waitForTimeout(300)
	buttons = await dialogButtons(page)
	const cancelledText = await dialog.textContent()
	check(
		'cancel: the dialog shows the cancelled lesson with Return to schedule',
		cancelledText!.includes('Cancelled') &&
			buttons.includes('Return to schedule') &&
			!buttons.includes('Cancel lesson'),
		buttons.join('|')
	)
	await shot(page, 'sched-changes', 'cancelled')
	return { facts, buttons }
}

export async function occurrenceStateStale(
	page: Page,
	fx: Awaited<ReturnType<typeof changesFixtures>>,
	nav: { monday: string },
	posts: { url: string; body: string | null }[],
	dialog: Locator,
	buttons: (string | undefined)[],
	facts: {
		data: {
			selected: string
			transparent: string
			columnWidth: number
			blocks: {
				key: string | undefined
				slot: string | null
				label: string | null
				text: string
				lines: string[]
				title: string | null
				date: string | undefined
				left: number
				width: number
				top: number
				height: number
				background: string
				color: string
				outlineStyle: string
				outlineWidth: string
				decoration: string
			}[]
			description: string
			live: string
			h1: string | undefined
		}
		block: {
			key: string | undefined
			slot: string | null
			label: string | null
			text: string
			lines: string[]
			title: string | null
			date: string | undefined
			left: number
			width: number
			top: number
			height: number
			background: string
			color: string
			outlineStyle: string
			outlineWidth: string
			decoration: string
		} | null
	}
) {
	await dialog.getByRole('button', { name: 'Return to schedule' }).click()
	const restoredToast = await toastText(page, 'Lesson restored')
	check(
		'restore: toast names the lesson in the main zone only',
		restoredToast.includes(`${CH_A}, ${shortDay(fx.wed)}, 18:00 VN.`) && !restoredToast.includes('MSK'),
		restoredToast
	)
	check('restore: the block is planned again', await waitBlock(page, CH_A, fx.wed, 'to', ', planned'))
	facts = await blockFacts(page, CH_A, fx.wed)
	check(
		'restore: the block is filled again',
		facts.block !== null && facts.block.background === facts.data.selected,
		facts.block?.background
	)
	await page.waitForTimeout(300)
	buttons = await dialogButtons(page)
	check('restore: the dialog offers Move lesson again', buttons.includes('Move lesson'), buttons.join('|'))
	await closeDialog(page)
	const focusA = await focusedBlock(page)
	check(
		'restore: closing returns focus to the block',
		focusA.slot === 'to' && focusA.date === fx.wed && focusA.key === facts.block?.key,
		JSON.stringify(focusA)
	)
	await slotLocator(page, CH_B, fx.wed).click()
	await dialog.waitFor({ timeout: 10000 })
	await dialog.getByRole('button', { name: 'Cancel lesson' }).click()
	await dialog.getByRole('button', { name: 'Yes, cancel' }).click()
	const singleToast = await toastText(page, 'Lesson cancelled', CH_B)
	check(
		'single cancel: toast names B',
		singleToast.includes(`${CH_B}, ${shortDay(fx.wed)}, 12:00 VN.`) && !singleToast.includes('MSK'),
		singleToast
	)
	check('single cancel: B is cancelled on the grid', await waitBlock(page, CH_B, fx.wed, 'to', ', cancelled'))
	await page.waitForTimeout(300)
	await dialog.getByRole('button', { name: 'Return to schedule' }).click()
	await toastText(page, 'Lesson restored', CH_B)
	check('single restore: B is planned again', await waitBlock(page, CH_B, fx.wed, 'to', ', planned'))
	await closeDialog(page)
	await goToWeek(page, nav, core.mondayOf(fx.staleWed))
	await slotLocator(page, CH_A, fx.staleWed).click()
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(300)
	const moved = await api<ScheduleSeriesResponse & Partial<ErrorResponse>>(
		page,
		'POST',
		`/schedule/series/${fx.seriesId}/occurrences/${fx.staleWed}/move`,
		{
			date: fx.staleWed,
			startTime: '19:00',
		}
	)
	check('stale: the occurrence is moved an hour later behind the dialog', moved.status === 200, String(moved.status))
	const sent = posts.length
	await dialog.getByRole('button', { name: 'Cancel lesson' }).click()
	await dialog.getByRole('button', { name: 'Yes, cancel' }).click()
	const stale = await dialog
		.locator('[data-slot="lesson-stale"]')
		.waitFor({ timeout: 15000 })
		.then(() => dialog.locator('[data-slot="lesson-stale"]').textContent())
		.catch(() => null)
	check(
		'stale: a 409 shows the banner of changed data',
		stale !== null &&
			stale.includes('This lesson was changed elsewhere') &&
			stale.includes('The schedule has been refreshed.'),
		stale ?? 'no banner'
	)
	const request = posts.slice(sent).find((post) => post.url.includes(`/occurrences/${fx.staleWed}/cancel`))
	check(
		'stale: the request carried the start the teacher saw',
		request !== undefined &&
			(JSON.parse(request.body ?? '{}') as { expectedStartsAt?: string }).expectedStartsAt ===
				whenText(fx.staleWed, '18:00'),
		request?.body ?? 'no request'
	)
	check(
		'stale: the grid shows the new time after the refresh',
		await waitBlock(page, CH_A, fx.staleWed, 'from', 'moved to')
	)
	facts = await blockFacts(page, CH_A, fx.staleWed)
	check(
		'stale: the destination stands at 19:00',
		facts.block !== null && Math.abs(facts.block.top - 19 * 48) <= 1.5,
		facts.block ? String(facts.block.top) : 'no block'
	)
	const staleText = await dialog.textContent()
	check('stale: the dialog now shows 19:00', staleText!.includes('19:00–20:00 VN'), staleText!.slice(0, 200))
	await shot(page, 'sched-changes', 'stale')
	return { buttons }
}

export async function occurrenceStateFinish(
	page: Page,
	fx: Awaited<ReturnType<typeof changesFixtures>>,
	nav: { monday: string },
	dialog: Locator,
	buttons: (string | undefined)[]
) {
	await closeDialog(page)
	await goToWeek(page, nav, core.mondayOf(fx.pastWed))
	await slotLocator(page, CH_A, fx.pastWed).click()
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(300)
	buttons = await dialogButtons(page)
	check(
		'past: Move lesson and Cancel lesson in the footer',
		buttons.includes('Move lesson') && buttons.includes('Cancel lesson'),
		buttons.join('|')
	)
	await closeDialog(page)
}

export async function occurrenceState(
	page: Page,
	fx: Awaited<ReturnType<typeof changesFixtures>>,
	nav: { monday: string },
	posts: { url: string; body: string | null }[]
) {
	let { dialog, buttons } = await occurrenceStateCancelQuestion(page, fx, nav)
	const occurrenceStateCancelledResult = await occurrenceStateCancelled(page, fx, dialog, buttons)
	let facts = occurrenceStateCancelledResult.facts
	buttons = occurrenceStateCancelledResult.buttons
	const occurrenceStateStaleResult = await occurrenceStateStale(page, fx, nav, posts, dialog, buttons, facts)
	buttons = occurrenceStateStaleResult.buttons
	await occurrenceStateFinish(page, fx, nav, dialog, buttons)
}
