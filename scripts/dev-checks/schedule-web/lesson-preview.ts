import type { Page, Locator } from '@playwright/test'

import * as core from '../../../packages/core/src/index.ts'
import { check, shot } from '../browser-context.ts'
import { blockLocator, tooltipFacts, checkPair, pairOf } from './block-probes.ts'
import { fullDate, dayNum, monthName, dayMonth, whenText, WEEKDAYS, expectedSecond } from './format.ts'
import { goToWeek, VN } from './navigation.ts'
import type { readFixtures } from './read-fixtures.ts'
import { NAME_A, NAME_B } from './read-fixtures.ts'
import { setSecondZone } from './students.ts'

export async function lessonPreviewTooltip(
	page: Page,
	fx: Awaited<ReturnType<typeof readFixtures>>,
	nav: { monday: string }
) {
	await goToWeek(page, nav, fx.week0)
	const block = blockLocator(page, NAME_A, fx.wednesday)
	await block.scrollIntoViewIfNeeded()
	await block.hover()
	await page.waitForTimeout(90)
	check('tooltip: closed before the 200 ms delay', (await tooltipFacts(page)) === null)
	await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-slot="event-tooltip"]') !== null, null, {
		timeout: 700,
	})
	await page.waitForTimeout(250)
	const tip = await tooltipFacts(page)
	check('tooltip: opens on mouse hover', tip !== null)
	check(
		'tooltip: name, full date, both zones and the status',
		tip !== null &&
			tip.text.includes(NAME_A) &&
			tip.text.includes(fullDate(fx.wednesday)) &&
			tip.text.includes('18:00–19:00 VN14:00–15:00 MSK') &&
			tip.text.endsWith('Planned'),
		tip?.text
	)
	check('tooltip: the name is semibold', tip !== null && tip.nameWeight === '600', tip?.nameWeight)
	checkPair('tooltip', await pairOf(page.locator('[data-slot="event-tooltip"]')), '18:00–19:00 VN', '14:00–15:00 MSK')
	check(
		'tooltip: surface-4, rounded-xl, p-3, up to 280px, shadow',
		tip !== null &&
			tip.background === tip.expected &&
			tip.radius === tip.expectedRadius &&
			tip.padding === '12px' &&
			tip.width <= 280.5 &&
			tip.shadow !== 'none',
		tip ? `${tip.background}/${tip.radius}/${tip.padding}/${tip.width}` : ''
	)
	check('tooltip: not interactive and not focusable', tip !== null && tip.focusable === false)
	await shot(page, 'sched-read', 'tooltip')
	return { block }
}

export async function lessonPreviewDialog(page: Page, fx: Awaited<ReturnType<typeof readFixtures>>, block: Locator) {
	await page.mouse.move(4, 4)
	await page.waitForTimeout(500)
	check('tooltip: closes when the pointer leaves', (await tooltipFacts(page)) === null)
	await block.hover()
	await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-slot="event-tooltip"]') !== null, null, {
		timeout: 700,
	})
	await page.locator('[data-slot="week-grid-body"]').evaluate((element) => {
		element.scrollTop += 80
	})
	await page.waitForTimeout(500)
	check('tooltip: closes on grid scroll', (await tooltipFacts(page)) === null)
	await page.locator('[data-slot="week-grid-body"]').evaluate((element) => {
		element.scrollTop -= 80
	})
	await page.mouse.move(4, 4)
	await block.focus()
	await page.waitForTimeout(600)
	check('tooltip: focus does not open it', (await tooltipFacts(page)) === null)
	await block.blur()
	await block.click()
	const dialog = page.getByRole('dialog')
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(500)
	check('dialog: opening it keeps the tooltip closed', (await tooltipFacts(page)) === null)
	const facts = await dialog.evaluate((element) => {
		const link = element.querySelector<HTMLElement>('a')
		return {
			text: element.textContent,
			href: link?.getAttribute('href'),
			linkText: link?.textContent,
			buttons: Array.from(element.querySelectorAll<HTMLButtonElement>('button')).map((button) =>
				button.textContent?.trim()
			),
			fade: element.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')?.classList.contains('scroll-fade'),
		}
	})
	check(
		'dialog: name is a link to the card',
		facts.href === `/students/${fx.a}` && facts.linkText === NAME_A,
		`${facts.href} ${facts.linkText}`
	)
	check(
		'dialog: description has the date and the Vietnam range',
		facts.text.includes(`${fullDate(fx.wednesday)} · 18:00–19:00 VN`),
		facts.text.slice(0, 160)
	)
	checkPair(
		'dialog header',
		await pairOf(dialog.locator('[data-slot="time-pair"]').first()),
		`${fullDate(fx.wednesday)} · 18:00–19:00 VN`,
		'14:00–15:00 MSK'
	)
	check(
		'dialog: status row says Planned with the card goal',
		facts.text.includes('Planned') && facts.text.includes('· Prepare for a speaking test')
	)
	check(
		'dialog: Length, Repeats and Series rows',
		facts.text.includes('Length60 min') &&
			facts.text.includes('RepeatsEvery Wednesday') &&
			facts.text.includes(`SeriesFrom Wed ${dayNum(fx.wednesday)} ${monthName(fx.wednesday)}`),
		facts.text.slice(0, 260)
	)
	check('dialog: body scrolls with the fade', facts.fade === true)
	check(
		'dialog: a future planned lesson offers Move lesson and Cancel lesson',
		facts.buttons.includes('Move lesson') && facts.buttons.includes('Cancel lesson')
	)
	await shot(page, 'sched-read', 'dialog')
	return { dialog }
}

export async function lessonPreviewDialogPast(
	page: Page,
	fx: Awaited<ReturnType<typeof readFixtures>>,
	nav: { monday: string },
	block: Locator,
	dialog: Locator
) {
	await page.keyboard.press('Escape')
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(300)
	const focused = await page.evaluate(() => ({
		key: document.activeElement?.getAttribute('data-key'),
		slot: document.activeElement?.getAttribute('data-slot'),
	}))
	const expectedKey = await block.getAttribute('data-key')
	check(
		'dialog: Esc closes it and focus returns to the block',
		focused.key === expectedKey && focused.slot === 'to',
		JSON.stringify(focused)
	)
	await goToWeek(page, nav, fx.week1)
	const from = blockLocator(page, NAME_A, fx.movedFrom)
	await from.click()
	await dialog.waitFor({ timeout: 10000 })
	const movedText = await dialog.textContent()
	check(
		'dialog: moved original says Moved and where to',
		/Moved/.test(movedText!) && movedText!.includes(`moved to ${dayMonth(fx.movedTo)}, 10:00 VN (06:00 MSK)`),
		movedText!.slice(0, 200)
	)
	check(
		'dialog: moved original has no Series row confusion (series still shown)',
		movedText!.includes('Every Wednesday')
	)
	await dialog.getByRole('button', { name: `moved to ${dayMonth(fx.movedTo)}, 10:00 VN` }).click()
	await page.waitForTimeout(600)
	const toText = await page.getByRole('dialog').textContent()
	check(
		'dialog: the button opens the destination lesson',
		toText!.includes('Planned') &&
			toText!.includes('10:00–11:00 VN') &&
			toText!.includes(`moved from ${dayMonth(fx.movedFrom)}, 18:00 VN (14:00 MSK)`),
		toText!.slice(0, 200)
	)
	await page
		.getByRole('dialog')
		.getByRole('button', { name: `moved from ${dayMonth(fx.movedFrom)}, 18:00` })
		.click()
	await page.waitForTimeout(600)
	const backText = await page.getByRole('dialog').textContent()
	check(
		'dialog: and back to the original',
		backText!.includes(`moved to ${dayMonth(fx.movedTo)}, 10:00 VN (06:00 MSK)`),
		backText!.slice(0, 160)
	)
	await page.keyboard.press('Escape')
	await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 10000 })
	await goToWeek(page, nav, core.mondayOf(fx.farFrom))
	await blockLocator(page, NAME_A, fx.farFrom).click()
	await dialog.waitFor({ timeout: 10000 })
	await dialog.getByRole('button', { name: `moved to ${dayMonth(fx.farTo)}, 11:00 VN` }).click()
	await page.waitForFunction(
		(expected) => document.querySelector<HTMLElement>('[data-slot="week-grid-day"]')?.dataset.date === expected,
		core.mondayOf(fx.farTo),
		{ timeout: 20000 }
	)
	nav.monday = core.mondayOf(fx.farTo)
	await page.getByRole('dialog').waitFor({ timeout: 15000 })
	const crossText = await page.getByRole('dialog').textContent()
	check(
		'dialog: the pair in another week opens after that week loads',
		crossText!.includes(`moved from ${dayMonth(fx.farFrom)}, 18:00 VN (14:00 MSK)`) &&
			crossText!.includes('11:00–12:00 VN'),
		crossText!.slice(0, 200)
	)
	await page.keyboard.press('Escape')
	await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 10000 })
	await goToWeek(page, nav, core.mondayOf(fx.pastDate))
	await blockLocator(page, NAME_B, fx.pastDate).click()
	await dialog.waitFor({ timeout: 10000 })
	const pastFacts = await dialog.evaluate((element) => ({
		text: element.textContent,
		buttons: Array.from(element.querySelectorAll<HTMLButtonElement>('button')).map((button) =>
			button.textContent?.trim()
		),
	}))
	check('dialog: a past lesson has no line that it cannot be changed', !pastFacts.text.includes('cannot be changed'))
	check(
		'dialog: a past lesson has Move lesson and Cancel lesson',
		pastFacts.buttons.includes('Move lesson') && pastFacts.buttons.includes('Cancel lesson'),
		pastFacts.buttons.join('|')
	)
	check(
		'dialog: a past lesson has the Mark row',
		(await dialog.getByRole('radiogroup', { name: 'Mark' }).count()) === 1 &&
			(await dialog.getByRole('radio').count()) === 3
	)
	check(
		'dialog: a single lesson has no Series row',
		!pastFacts.text.includes('Series') && pastFacts.text.includes('RepeatsOnce')
	)
	await shot(page, 'sched-read', 'dialog-past')
}

export async function lessonPreviewFinish(
	page: Page,
	fx: Awaited<ReturnType<typeof readFixtures>>,
	nav: { monday: string },
	dialog: Locator
) {
	await page.keyboard.press('Escape')
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	const reopenWeek = async (zone: string | null) => {
		await setSecondZone(page, zone)
		await page.reload()
		await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
		nav.monday = core.mondayOf(fx.today)
		await goToWeek(page, nav, fx.week0)
	}
	await reopenWeek('Pacific/Auckland')
	const lessonStart = new Date(whenText(fx.wednesday, '18:00'))
	const startParts = core.zonedParts(lessonStart, 'Pacific/Auckland')
	const endParts = core.zonedParts(new Date(lessonStart.getTime() + 3600000), 'Pacific/Auckland')
	const dayPrefix =
		startParts.date === core.zonedParts(lessonStart, VN).date ? '' : `${WEEKDAYS[startParts.weekday - 1]} `
	const offsetCaption = expectedSecond(lessonStart.toISOString(), 'Pacific/Auckland').split(' ').pop()
	await blockLocator(page, NAME_A, fx.wednesday).click()
	await dialog.waitFor({ timeout: 10000 })
	check(
		'dialog: another date in the second zone puts the weekday before the whole range',
		(await pairOf(dialog.locator('[data-slot="time-pair"]').first())).second ===
			`${dayPrefix}${startParts.time}–${endParts.time} ${offsetCaption}`,
		`${dayPrefix}${startParts.time}–${endParts.time} ${offsetCaption}`
	)
	check('dialog: that weekday is really shown', dayPrefix !== '', dayPrefix)
	await page.keyboard.press('Escape')
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await reopenWeek('none')
	const plain = blockLocator(page, NAME_A, fx.wednesday)
	await plain.scrollIntoViewIfNeeded()
	await plain.hover()
	await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-slot="event-tooltip"]') !== null, null, {
		timeout: 2000,
	})
	await page.waitForTimeout(250)
	checkPair(
		'tooltip without a second zone',
		await pairOf(page.locator('[data-slot="event-tooltip"]')),
		'18:00–19:00 VN',
		null
	)
	const plainLabel = (await plain.getAttribute('aria-label')) ?? ''
	check(
		'block label without a second zone has no brackets',
		plainLabel.includes('18:00–19:00 VN, planned') && !plainLabel.includes('('),
		plainLabel
	)
	await page.mouse.move(4, 4)
	await plain.click()
	await dialog.waitFor({ timeout: 10000 })
	checkPair(
		'dialog header without a second zone',
		await pairOf(dialog.locator('[data-slot="time-pair"]').first()),
		`${fullDate(fx.wednesday)} · 18:00–19:00 VN`,
		null
	)
	await page.keyboard.press('Escape')
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await setSecondZone(page, null)
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	nav.monday = core.mondayOf(fx.today)
}

export async function lessonPreview(page: Page, fx: Awaited<ReturnType<typeof readFixtures>>, nav: { monday: string }) {
	let { block } = await lessonPreviewTooltip(page, fx, nav)
	let { dialog } = await lessonPreviewDialog(page, fx, block)
	await lessonPreviewDialogPast(page, fx, nav, block, dialog)
	await lessonPreviewFinish(page, fx, nav, dialog)
}
