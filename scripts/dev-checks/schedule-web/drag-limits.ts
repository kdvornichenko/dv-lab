import type { Page } from '@playwright/test'

import { check, shot } from '../browser-context.ts'
import { blockLocator } from './block-probes.ts'
import { dialogFacts, pickOption } from './dialogs.ts'
import type { dragFixtures } from './drag.ts'
import { DRAG_A, dragScrollFor, frameFacts, dragSteps, dragColumn } from './drag.ts'

export async function dragPart2(page: Page, fx: Awaited<ReturnType<typeof dragFixtures>>) {
	const date = fx.wednesday
	const dialog = page.getByRole('dialog')
	const block = blockLocator(page, DRAG_A, date)
	await dragScrollFor(page, 1080, 1080)
	const box = await block.boundingBox()
	await page.mouse.move(box!.x + box!.width / 2, box!.y + 8)
	await page.mouse.down()
	await page.mouse.move(box!.x + box!.width / 2, box!.y + 60, { steps: 6 })
	await page.waitForTimeout(150)
	check('a press on a lesson block starts no drag', (await frameFacts(page)) === null)
	await page.mouse.up()
	await page.waitForTimeout(500)
	if ((await dialog.count()) > 0) {
		await page.keyboard.press('Escape')
		await dialog.waitFor({ state: 'detached', timeout: 10000 })
	}

	await dragSteps(page, date, 1020, 1110)
	let frame = await frameFacts(page)
	check('overlap: the frame passes over the lesson block', frame?.range === '17:00–18:45', frame?.range)
	await shot(page, 'sched-drag', 'overlap-frame')
	await page.mouse.up()
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	let facts = await dialogFacts(page)
	check(
		'overlap: the dialog warns with the lesson and still allows saving',
		facts.overlap !== null && facts.overlap.includes(`${DRAG_A} 18:00–19:00 VN`) && facts.submit?.disabled === false,
		facts.overlap ?? 'no banner'
	)
	await pickOption(page, 'new-lesson-student', DRAG_A)
	facts = await dialogFacts(page)
	check('choosing a student keeps the length taken from the frame', facts.length === '105', facts.length)
	await dialog.getByRole('button', { name: 'Add lesson' }).click()
	await page.getByText('Lesson added', { exact: true }).last().waitFor({ timeout: 15000 })
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(800)
	frame = await frameFacts(page)
	const made = await dragColumn(page, date)
		.locator(`button[aria-label^="${DRAG_A}, "]`)
		.evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-label')))
	check(
		'saving replaces the frame with the real block',
		frame === null && made.some((label) => label!.includes('17:00–18:45 VN')),
		made.join(' | ')
	)
}

export async function dragPart3(page: Page, fx: Awaited<ReturnType<typeof dragFixtures>>) {
	const date = fx.wednesday
	await page.evaluate(() => {
		const body = document.querySelector<HTMLElement>('[data-slot="week-grid-body"]')
		body!.scrollTop = 250
	})
	await page.waitForTimeout(100)
	const bodyBox = await page.locator('[data-slot="week-grid-body"]').boundingBox()
	const columnBox = await dragColumn(page, date).boundingBox()
	const x = columnBox!.x + 10
	await page.mouse.move(x, bodyBox!.y + bodyBox!.height - 90)
	await page.mouse.down()
	await page.mouse.move(x, bodyBox!.y + bodyBox!.height - 8, { steps: 6 })
	await page.waitForTimeout(80)
	const before = await page.evaluate(
		() => document.querySelector<HTMLElement>('[data-slot="week-grid-body"]')!.scrollTop
	)
	const framed = await frameFacts(page)
	await page.waitForTimeout(700)
	const after = await page.evaluate(
		() => document.querySelector<HTMLElement>('[data-slot="week-grid-body"]')!.scrollTop
	)
	const grown = await frameFacts(page)
	check('near the bottom edge the grid scrolls by itself', after > before + 40, `${before} -> ${after}`)
	check(
		'while scrolling the frame keeps following',
		grown !== null && grown.minutes >= 180,
		`${framed?.minutes} -> ${grown?.minutes}`
	)
	await page.keyboard.press('Escape')
	await page.mouse.up()
	await page.waitForTimeout(200)

	await page.evaluate(() => {
		document.querySelector<HTMLElement>('[data-slot="week-grid-body"]')!.scrollTop = 450
	})
	await page.waitForTimeout(100)
	await page.mouse.move(x, bodyBox!.y + 90)
	await page.mouse.down()
	await page.mouse.move(x, bodyBox!.y + 8, { steps: 6 })
	await page.waitForTimeout(80)
	const topBefore = await page.evaluate(
		() => document.querySelector<HTMLElement>('[data-slot="week-grid-body"]')!.scrollTop
	)
	const topFramed = await frameFacts(page)
	await page.waitForTimeout(700)
	const topAfter = await page.evaluate(
		() => document.querySelector<HTMLElement>('[data-slot="week-grid-body"]')!.scrollTop
	)
	const topGrown = await frameFacts(page)
	check('near the top edge the grid scrolls up by itself', topAfter < topBefore - 40, `${topBefore} -> ${topAfter}`)
	check(
		'near the top edge the frame keeps following',
		topGrown !== null && topGrown.minutes >= 180,
		`${topFramed?.minutes} -> ${topGrown?.minutes}`
	)
	await page.keyboard.press('Escape')
	await page.mouse.up()
	await page.waitForTimeout(200)
	check(
		'auto scroll: Esc leaves no frame and no dialog',
		(await frameFacts(page)) === null && (await page.getByRole('dialog').count()) === 0
	)
}
