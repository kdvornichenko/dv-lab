import type { Page, Locator } from 'playwright-core'

import * as core from '../../../packages/core/src/index.ts'
import { check, shot } from '../browser-context.ts'
import { readBlocks, ofCard } from './block-probes.ts'
import type { changesFixtures } from './changes.ts'
import { CH_A, CH_B } from './changes.ts'
import {
	slotLocator,
	moveFormFacts,
	dialogButtons,
	calendarDayState,
	dayAttr,
	pickDate,
	pickTime,
	toastText,
	waitBlock,
	blockFacts,
	closeDialog,
	focusedBlock,
} from './dialogs.ts'
import { shortDay, dayMonth } from './format.ts'
import { goToWeek } from './navigation.ts'

export async function occurrenceMoveMoveForm(
	page: Page,
	fx: Awaited<ReturnType<typeof changesFixtures>>,
	nav: { monday: string }
) {
	const dialog = page.getByRole('dialog')
	await goToWeek(page, nav, core.mondayOf(fx.wed))
	await slotLocator(page, CH_A, fx.wed).click()
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(300)
	await dialog.getByRole('button', { name: 'Move lesson' }).click()
	await page.waitForTimeout(400)
	let form = await moveFormFacts(page)
	const buttons = await dialogButtons(page)
	check(
		'move: Move lesson opens the form in the dialog body and hides the footer',
		form !== null && !buttons.includes('Cancel lesson'),
		buttons.join('|')
	)
	check(
		'move: the form has New date and Time, VN',
		form !== null && form.text.includes('New date') && form.text.includes('Time, VN')
	)
	check(
		'move: the change line shows was and now in VN, and the same two moments in the second zone',
		form !== null &&
			form.vn === `${shortDay(fx.wed)}, 18:00${shortDay(fx.wed)}, 18:00–19:00 VN` &&
			form.second === `${shortDay(fx.wed)}, 14:00${shortDay(fx.wed)}, 14:00–15:00 MSK`,
		`${form?.vn} | ${form?.second}`
	)
	check(
		'move: the second-zone line is micro and muted',
		form !== null && form.secondClass.includes('text-micro') && form.secondClass.includes('text-muted-foreground'),
		form?.secondClass
	)
	check(
		'move: focus moves into the form',
		await page.evaluate(() => document.activeElement?.id === 'move-lesson-date'),
		await page.evaluate(
			() =>
				`${document.activeElement?.tagName}/${document.activeElement?.getAttribute('role')}/${document.activeElement?.id}`
		)
	)
	await shot(page, 'sched-changes', 'move-form')
	return { dialog, form }
}

export async function occurrenceMoveMoveCalendar(
	page: Page,
	fx: Awaited<ReturnType<typeof changesFixtures>>,
	dialog: Locator
) {
	await dialog.getByRole('button', { name: 'Discard changes' }).click()
	await page.waitForTimeout(300)
	const discarded = await dialogButtons(page)
	check(
		'move: Discard changes brings the footer back with focus on Move lesson',
		discarded.includes('Cancel lesson') &&
			(await moveFormFacts(page)) === null &&
			(await page.evaluate(() => document.activeElement?.textContent?.trim() === 'Move lesson')),
		discarded.join('|')
	)
	await dialog.getByRole('button', { name: 'Move lesson' }).click()
	await page.waitForTimeout(400)
	await page.locator('#move-lesson-date').click()
	await page.waitForTimeout(300)
	const yesterday = core.addDays(fx.today, -1)
	const yesterdayOff = await calendarDayState(page, yesterday)
	check('move: days before today can be picked', yesterdayOff === false, String(yesterdayOff))
	const todayCell = page.locator(`button[data-day="${dayAttr(fx.today)}"]`).first()
	const todayOff =
		(await todayCell.count()) === 0
			? null
			: await todayCell.evaluate((element) => (element as HTMLButtonElement).disabled)
	check('move: today can be picked', todayOff === false || todayOff === null, String(todayOff))
	await shot(page, 'sched-changes', 'move-calendar')
}

export async function occurrenceMoveMoveClash(
	page: Page,
	posts: { url: string; body: string | null }[],
	dialog: Locator,
	form: Awaited<ReturnType<typeof moveFormFacts>>
) {
	await page.locator('#move-lesson-date').click()
	await page.waitForTimeout(300)
	const sent = posts.length
	await dialog.getByRole('group', { name: 'Move lesson' }).getByRole('button', { name: 'Move lesson' }).click()
	await page.waitForTimeout(400)
	form = await moveFormFacts(page)
	check(
		'move: the same time asks for a different date or time',
		form !== null && form.text.includes('Choose a different date or time.'),
		form?.text.slice(0, 200)
	)
	check(
		'move: and sends nothing',
		posts.slice(sent).every((post) => !post.url.includes('/move')),
		String(posts.length - sent)
	)
	await page.locator('#move-lesson-time').click()
	await page.waitForTimeout(250)
	const hour12 = await page
		.getByRole('listbox', { name: 'Hours' })
		.getByRole('option', { name: '12', exact: true })
		.getAttribute('aria-disabled')
	check('move: a taken hour is not disabled in the time list', hour12 !== 'true', String(hour12))
	await page.getByRole('listbox', { name: 'Hours' }).getByRole('option', { name: '12', exact: true }).click()
	await page.getByRole('listbox', { name: 'Minutes' }).getByRole('option', { name: '00', exact: true }).click()
	await page.getByRole('button', { name: 'Done' }).click()
	await page.waitForTimeout(400)
	form = await moveFormFacts(page)
	check(
		'move: a clash shows the lesson already at this time',
		form?.clash === `A lesson is already at this time: ${CH_B} 12:00–13:00 VN`,
		form?.clash ?? 'no clash line'
	)
	check('move: the clash does not disable Move lesson', form?.submit === false, String(form?.submit))
	await shot(page, 'sched-changes', 'move-clash')
	return { form }
}

export async function occurrenceMoveMoved(
	page: Page,
	fx: Awaited<ReturnType<typeof changesFixtures>>,
	dialog: Locator,
	form: Awaited<ReturnType<typeof moveFormFacts>>
) {
	await pickDate(page, fx.friday, 'move-lesson-date')
	await pickTime(page, '10:00', 'move-lesson-time')
	form = await moveFormFacts(page)
	check(
		'move: the change line follows the new date',
		form !== null && form.vn.endsWith(`${shortDay(fx.friday)}, 10:00–11:00 VN`) && form.clash === null,
		form?.change
	)
	await dialog.getByRole('group', { name: 'Move lesson' }).getByRole('button', { name: 'Move lesson' }).click()
	const movedToast = await toastText(page, 'Lesson moved', CH_A)
	check(
		'move: toast names the old and the new time',
		movedToast.includes(`${CH_A}: ${shortDay(fx.wed)}, 18:00 VN to ${shortDay(fx.friday)}, 10:00 VN.`),
		movedToast
	)
	check('move: the destination stands on Friday', await waitBlock(page, CH_A, fx.friday, 'to', ', planned'))
	check('move: the original place is marked moved', await waitBlock(page, CH_A, fx.wed, 'from', 'moved to'))
	await page.waitForTimeout(400)
	const movedText = await dialog.textContent()
	check(
		'move: the dialog shows the lesson at its new place',
		movedText!.includes(`moved from ${dayMonth(fx.wed)}, 18:00`) && movedText!.includes('10:00–11:00 VN'),
		movedText!.slice(0, 200)
	)
	let facts = await blockFacts(page, CH_A, fx.wed, 'from')
	check(
		'move: the original place is dashed and names the new day',
		facts.block !== null &&
			facts.block.outlineStyle === 'dashed' &&
			facts.block.lines[1] === `→ ${dayMonth(fx.friday)}`,
		facts.block ? `${facts.block.outlineStyle}/${facts.block.lines.join('|')}` : 'no block'
	)
	const destination = await blockFacts(page, CH_A, fx.friday, 'to')
	check(
		'move: the destination is at 10:00',
		destination.block !== null && Math.abs(destination.block.top - 10 * 48) <= 1.5,
		destination.block ? String(destination.block.top) : 'no block'
	)
	await shot(page, 'sched-changes', 'moved')
	return { facts }
}

export async function occurrenceMoveFinish(
	page: Page,
	fx: Awaited<ReturnType<typeof changesFixtures>>,
	nav: { monday: string },
	dialog: Locator,
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
	await closeDialog(page)
	const focus = await focusedBlock(page)
	check(
		'move: after Esc focus is on the destination block',
		focus.slot === 'to' && focus.date === fx.friday && focus.key === facts.block?.key,
		JSON.stringify(focus)
	)
	await slotLocator(page, CH_B, fx.wed).click()
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(300)
	await dialog.getByRole('button', { name: 'Move lesson' }).click()
	await page.waitForTimeout(300)
	await pickDate(page, fx.thursday, 'move-lesson-date')
	await dialog.getByRole('group', { name: 'Move lesson' }).getByRole('button', { name: 'Move lesson' }).click()
	await toastText(page, 'Lesson moved', CH_B)
	check('single move: B stands on Thursday', await waitBlock(page, CH_B, fx.thursday, 'to', ', planned'))
	await page.waitForTimeout(300)
	const singleFacts = await readBlocks(page)
	const leftB = ofCard(singleFacts, CH_B)
	check(
		'single move: no dashed original and nothing left on Wednesday',
		leftB.every((block) => block.slot === 'to' && block.date !== fx.wed),
		leftB.map((block) => `${block.date}/${block.slot}`).join(',')
	)
	await closeDialog(page)
	await goToWeek(page, nav, core.mondayOf(fx.laterWed))
	facts = await blockFacts(page, CH_A, fx.laterWed)
	check(
		'move: a later Wednesday is untouched',
		facts.block !== null && Math.abs(facts.block.top - 18 * 48) <= 1.5 && facts.block.label!.endsWith(', planned'),
		facts.block?.label ?? 'no block'
	)
}

export async function occurrenceMove(
	page: Page,
	fx: Awaited<ReturnType<typeof changesFixtures>>,
	nav: { monday: string },
	posts: { url: string; body: string | null }[]
) {
	let { dialog, form } = await occurrenceMoveMoveForm(page, fx, nav)
	await occurrenceMoveMoveCalendar(page, fx, dialog)
	const occurrenceMoveMoveClashResult = await occurrenceMoveMoveClash(page, posts, dialog, form)
	form = occurrenceMoveMoveClashResult.form
	let { facts } = await occurrenceMoveMoved(page, fx, dialog, form!)
	await occurrenceMoveFinish(page, fx, nav, dialog, facts)
}
