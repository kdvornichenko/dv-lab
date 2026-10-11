import type { Page, Locator } from '@playwright/test'

import * as core from '../../../packages/core/src/index.ts'
import { check, shot } from '../browser-context.ts'
import { dialogFacts } from './dialogs.ts'
import type { dragFixtures } from './drag.ts'
import { dragColumn, frameFacts, dragSteps, MINUTE_PX, discardNew, dragPoint, dragScrollFor } from './drag.ts'
import { monthName, dayNum } from './format.ts'

export async function dragDraftFrame(page: Page, fx: Awaited<ReturnType<typeof dragFixtures>>) {
	const date = fx.wednesday
	const dialog = page.getByRole('dialog')
	const column = dragColumn(page, date)
	check('before a press the cursor is the default and the grid has no frame', (await frameFacts(page)) === null)
	check(
		'before a press empty cells show the default cursor',
		(await column.evaluate((element) => getComputedStyle(element).cursor)) !== 'ns-resize'
	)
	await dragSteps(page, date, 540, 605)
	let frame = await frameFacts(page)
	check(
		'drag 09:00 to 10:05: the frame reads 09:00–10:15',
		frame?.range === '09:00–10:15' && frame.caption === '09:00–10:15',
		JSON.stringify(frame?.range)
	)
	checkDragGeometry(frame)

	check(
		'frame look: selected 85%, 40% foreground ring, text caption 12px on one line, above blocks, no pointer events',
		frame !== null &&
			frame.cls.includes('bg-selected/85') &&
			frame.cls.includes('ring-foreground/40') &&
			frame.captionSize === '12px' &&
			frame.captionWrap === 'nowrap' &&
			frame.pointerEvents === 'none' &&
			Number(frame.zIndex) >= 20 &&
			frame.chip === null,
		JSON.stringify({ cls: frame?.cls, size: frame?.captionSize, z: frame?.zIndex })
	)
	check('frame text has no title, length or zone label', frame?.text === '09:00–10:15', frame?.text)
	check('while the frame exists the cursor is ns-resize', frame?.cursor === 'ns-resize', frame?.cursor)
	await shot(page, 'sched-drag', 'frame')
	return { date, dialog, column, frame }
}

export async function dragDraftDialog(
	page: Page,
	date: string,
	dialog: Locator,
	column: Locator,
	frame: {
		range: string | null
		minutes: number
		state: string | null
		top: number
		height: number
		left: number
		width: number
		columnWidth: number
		radius: string
		pointerEvents: string
		zIndex: string
		cls: string
		text: string
		caption: string | null
		captionSize: string | null
		captionWrap: string | null
		chip: string | null
		chipSize: string | null
		chipLeft: number | null
		count: number
		cursor: string
	} | null
) {
	await page.mouse.up()
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	let facts = await dialogFacts(page)
	check(
		'release: New lesson opens on the column date with start 09:00 and length 75',
		facts.dateLabel?.includes(`${monthName(date)} ${dayNum(date)}, `) &&
			facts.time === '09:00' &&
			facts.length === '75',
		`${facts.dateLabel} ${facts.time} ${facts.length}`
	)
	frame = await frameFacts(page)
	check(
		'release: the frame stays under the dialog, still 09:00–10:15 and static',
		frame?.state === 'draft' && frame.range === '09:00–10:15' && frame.count === 1,
		JSON.stringify(frame?.range)
	)
	check(
		'release: the cursor over the grid is back to normal',
		(await column.evaluate((element) => getComputedStyle(element).cursor)) !== 'ns-resize'
	)
	check(
		'release: the length helper keeps 15 to 240 minutes',
		facts.text.includes('15 to 240 minutes.') && !facts.text.includes("Taken from the student's")
	)
	await shot(page, 'sched-drag', 'dialog')
	return { facts, frame }
}

export async function dragDraftChip(
	page: Page,
	date: string,
	dialog: Locator,
	frame: {
		range: string | null
		minutes: number
		state: string | null
		top: number
		height: number
		left: number
		width: number
		columnWidth: number
		radius: string
		pointerEvents: string
		zIndex: string
		cls: string
		text: string
		caption: string | null
		captionSize: string | null
		captionWrap: string | null
		chip: string | null
		chipSize: string | null
		chipLeft: number | null
		count: number
		cursor: string
	} | null,
	facts: Awaited<ReturnType<typeof dialogFacts>>
) {
	await discardNew(page)
	check('Discard changes removes the frame', (await frameFacts(page)) === null)
	await dragSteps(page, date, 600, 665)
	frame = await frameFacts(page)
	check('flip: 10:00 down to 11:05 reads 10:00–11:15', frame?.range === '10:00–11:15', frame?.range)
	const up = await dragPoint(page, date, 545, 2)
	await page.mouse.move(up.x, up.y, { steps: 8 })
	await page.waitForTimeout(120)
	frame = await frameFacts(page)
	check(
		'flip: dragging up through the anchor reads 09:00–10:15',
		frame?.range === '09:00–10:15' && frame.minutes === 75,
		frame?.range
	)
	await page.mouse.up()
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(300)
	facts = await dialogFacts(page)
	check(
		'flip: release gives start 09:00 and length 75',
		facts.time === '09:00' && facts.length === '75',
		`${facts.time} ${facts.length}`
	)
	await discardNew(page)
	await dragSteps(page, date, 660, 700)
	check('Esc test: a frame exists before Esc', (await frameFacts(page)) !== null)
	await page.keyboard.press('Escape')
	await page.waitForTimeout(200)
	await page.mouse.up()
	await page.waitForTimeout(300)
	check(
		'Esc: the frame is gone and no dialog opened',
		(await frameFacts(page)) === null && (await dialog.count()) === 0
	)
	await dragSteps(page, date, 660, 700)
	await page.evaluate(() => window.dispatchEvent(new Event('blur')))
	await page.waitForTimeout(200)
	await page.mouse.up()
	await page.waitForTimeout(300)
	check(
		'window blur: the frame is gone and no dialog opened',
		(await frameFacts(page)) === null && (await dialog.count()) === 0
	)
	await dragScrollFor(page, 840, 840)
	const click = await dragPoint(page, date, 840, 3)
	await page.mouse.click(click.x, click.y)
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	facts = await dialogFacts(page)
	frame = await frameFacts(page)
	check(
		'plain click: the dialog opens at 14:00 with length 60',
		facts.time === '14:00' && facts.length === '60',
		`${facts.time} ${facts.length}`
	)
	check(
		'plain click: a 60 minute frame stays at 14:00–15:00',
		frame?.state === 'draft' && frame.minutes === 60 && frame.range === '14:00–15:00',
		JSON.stringify(frame?.range)
	)
	await discardNew(page)
	check('plain click: Discard changes removes the frame', (await frameFacts(page)) === null)
	await dragScrollFor(page, 660, 660)
	const pressPoint = await dragPoint(page, date, 660, 1)
	await page.mouse.move(pressPoint.x, pressPoint.y)
	await page.mouse.down()
	const nudge = await dragPoint(page, date, 660, 7)
	await page.mouse.move(nudge.x, nudge.y, { steps: 4 })
	await page.waitForTimeout(120)
	frame = await frameFacts(page)
	checkDragChip(frame)
	await shot(page, 'sched-drag', 'chip')
	return { frame, facts }
}

export async function dragDraftFinish(
	page: Page,
	date: string,
	dialog: Locator,
	frame: {
		range: string | null
		minutes: number
		state: string | null
		top: number
		height: number
		left: number
		width: number
		columnWidth: number
		radius: string
		pointerEvents: string
		zIndex: string
		cls: string
		text: string
		caption: string | null
		captionSize: string | null
		captionWrap: string | null
		chip: string | null
		chipSize: string | null
		chipLeft: number | null
		count: number
		cursor: string
	} | null,
	facts: Awaited<ReturnType<typeof dialogFacts>>
) {
	await page.mouse.up()
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(300)
	facts = await dialogFacts(page)
	check(
		'one slot: release gives length 15',
		facts.length === '15' && facts.time === '11:00',
		`${facts.time} ${facts.length}`
	)
	await discardNew(page)
	await dragSteps(page, date, 300, 720)
	frame = await frameFacts(page)
	check(
		'longest frame: stops at 240 minutes, 05:00–09:00',
		frame?.minutes === 240 && frame.range === '05:00–09:00',
		`${frame?.minutes} ${frame?.range}`
	)
	await page.mouse.up()
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(300)
	facts = await dialogFacts(page)
	check(
		'longest frame: release gives length 240',
		facts.length === '240' && facts.time === '05:00',
		`${facts.time} ${facts.length}`
	)
	await discardNew(page)
	await dragSteps(page, date, 1410, 1432)
	frame = await frameFacts(page)
	check(
		'day end: the frame stops at 24:00 and reads 23:30–24:00',
		frame?.range === '23:30–24:00' && frame.minutes === 30,
		`${frame?.range} ${frame?.minutes}`
	)
	const beyond = await dragPoint(page, date, 1439, 40)
	await page.mouse.move(beyond.x, beyond.y, { steps: 4 })
	await page.waitForTimeout(120)
	frame = await frameFacts(page)
	check('day end: moving below the column changes nothing', frame?.range === '23:30–24:00', frame?.range)
	await page.mouse.up()
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(300)
	facts = await dialogFacts(page)
	check(
		'day end: release gives 23:30 with length 30',
		facts.time === '23:30' && facts.length === '30',
		`${facts.time} ${facts.length}`
	)
	await discardNew(page)
	await dragSteps(page, date, 15, 2)
	frame = await frameFacts(page)
	check(
		'day start: the frame stops at 00:00 and reads 00:00–00:30',
		frame?.range === '00:00–00:30' && frame.minutes === 30,
		`${frame?.range} ${frame?.minutes}`
	)
	await page.mouse.up()
	await dialog.waitFor({ timeout: 10000 })
	await discardNew(page)
	const sideways = await dragSteps(page, date, 600, 640)
	const next = core.addDays(date, 1)
	const other = await dragColumn(page, next).boundingBox()
	await page.mouse.move(other!.x + 30, sideways.end.y, { steps: 5 })
	await page.waitForTimeout(120)
	frame = await frameFacts(page)
	check(
		'sideways: leaving the column does not move the frame to another day',
		frame !== null && frame.range === '10:00–10:45',
		JSON.stringify(frame?.range)
	)
	await page.mouse.up()
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(300)
	facts = await dialogFacts(page)
	check(
		'sideways: release keeps the day of the press',
		facts.dateLabel?.includes(`${monthName(date)} ${dayNum(date)}, `) === true,
		String(facts.dateLabel)
	)
	await page.keyboard.press('Escape')
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(250)
	check('Esc on the open dialog closes it and takes the frame with it', (await frameFacts(page)) === null)
}

export async function dragDraft(page: Page, fx: Awaited<ReturnType<typeof dragFixtures>>) {
	let { date, dialog, column, frame } = await dragDraftFrame(page, fx)
	const dragDraftDialogResult = await dragDraftDialog(page, date, dialog, column, frame)
	let facts = dragDraftDialogResult.facts
	frame = dragDraftDialogResult.frame
	const dragDraftChipResult = await dragDraftChip(page, date, dialog, frame, facts)
	frame = dragDraftChipResult.frame
	facts = dragDraftChipResult.facts
	await dragDraftFinish(page, date, dialog, frame, facts)
}

function checkDragGeometry(frame: Awaited<ReturnType<typeof frameFacts>>) {
	check('drag: the frame is 75 minutes', frame?.minutes === 75, String(frame?.minutes))
	check(
		'frame geometry: slot-aligned top and height, block inset, block radius',
		frame !== null &&
			Math.abs(frame.top - 540 * MINUTE_PX) <= 1.5 &&
			Math.abs(frame.height - 75 * MINUTE_PX) <= 1.5 &&
			Math.abs(frame.left - 2) <= 1 &&
			Math.abs(frame.width - (frame.columnWidth - 6)) <= 1.5 &&
			frame.radius === '8px',
		JSON.stringify(frame)
	)
}

function checkDragChip(frame: Awaited<ReturnType<typeof frameFacts>>) {
	check(
		'one slot: the 15 minute frame puts its range in a chip, not inside',
		frame?.minutes === 15 && frame.chip === '11:00–11:15' && frame.caption === null,
		JSON.stringify({ minutes: frame?.minutes, chip: frame?.chip })
	)
	check(
		'one slot: the chip is micro and sits right of the frame',
		frame?.chipSize === '11px' && frame.chipLeft !== null && frame.chipLeft > 0,
		JSON.stringify({ size: frame?.chipSize, left: frame?.chipLeft })
	)
}
