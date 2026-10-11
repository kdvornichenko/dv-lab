import type { Page } from 'playwright-core'

import { readBlocks, ofCard } from './block-probes.ts'

export const newButton = (page: Page) => page.getByRole('button', { name: 'New lesson', exact: true })

export function dayAttr(date: string) {
	return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}/${date.slice(0, 4)}`
}

export async function pickDate(page: Page, date: string, id: string = 'new-lesson-date') {
	await page.locator(`#${id}`).click()
	const cell = page.locator(`button[data-day="${dayAttr(date)}"]`).first()
	for (let step = 0; step < 4 && (await cell.count()) === 0; step += 1) {
		await page.getByRole('button', { name: /next month/i }).click()
		await page.waitForTimeout(150)
	}
	for (let step = 0; step < 8 && (await cell.count()) === 0; step += 1) {
		await page.getByRole('button', { name: /previous month/i }).click()
		await page.waitForTimeout(150)
	}
	await cell.click()
	await page.waitForTimeout(250)
}

export async function pickTime(page: Page, time: string, id: string = 'new-lesson-time') {
	await page.locator(`#${id}`).click()
	await page
		.getByRole('listbox', { name: 'Hours' })
		.getByRole('option', { name: time.slice(0, 2), exact: true })
		.click()
	await page
		.getByRole('listbox', { name: 'Minutes' })
		.getByRole('option', { name: time.slice(3), exact: true })
		.click()
	await page.getByRole('button', { name: 'Done' }).click()
	await page.waitForTimeout(250)
}

export async function pickOption(page: Page, triggerId: string, name: string) {
	const option = page.getByRole('option', { name, exact: true })
	for (let attempt = 0; attempt < 3; attempt += 1) {
		await page
			.getByRole('listbox')
			.waitFor({ state: 'detached', timeout: 4000 })
			.catch(() => {})
		await page.locator(`#${triggerId}`).click()
		const shown = await option
			.waitFor({ state: 'visible', timeout: 3000 })
			.then(() => true)
			.catch(() => false)
		if (shown) break
		await page.waitForTimeout(500)
	}
	await option.click()
	await page.waitForTimeout(250)
}

export async function dialogFacts(page: Page) {
	return page.getByRole('dialog').evaluate((element) => {
		const read = (id: string) => element.querySelector<HTMLElement>(`#${id}`)
		return {
			text: element.textContent,
			dateLabel: read('new-lesson-date')?.getAttribute('aria-label'),
			time: read('new-lesson-time')?.textContent?.trim(),
			length: (element.querySelector<HTMLElement>('#new-lesson-length') as HTMLInputElement | null)?.value,
			student: read('new-lesson-student')?.textContent?.trim(),
			repeats: read('new-lesson-repeats')?.textContent?.trim(),
			zone: element.querySelector<HTMLElement>('[data-slot="new-lesson-zone"]')?.textContent,
			repeatNote: element.querySelector<HTMLElement>('[data-slot="new-lesson-repeat-note"]')?.textContent,
			overlap: element.querySelector<HTMLElement>('[data-slot="new-lesson-overlap"]')?.textContent ?? null,
			submit: Array.from(element.querySelectorAll<HTMLButtonElement>('button[type="submit"]')).map((button) => ({
				text: button.textContent?.trim(),
				disabled: button.disabled,
			}))[0],
			focusId: document.activeElement?.id,
			bodyFade: element
				.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')
				?.classList.contains('scroll-fade'),
		}
	})
}

export const slotLocator = (page: Page, name: string, date: string, slot: string = 'to') =>
	page
		.locator(`[data-slot="week-grid-column"][data-date="${date}"] button[data-slot="${slot}"][aria-label^="${name}, "]`)
		.first()

export async function dialogButtons(page: Page) {
	return page
		.getByRole('dialog')
		.evaluate((element) =>
			Array.from(element.querySelectorAll<HTMLButtonElement>('button')).map((button) => button.textContent?.trim())
		)
}

export async function toastText(page: Page, title: string, expected: string = '') {
	const found = await page
		.waitForFunction(
			({ title, expected }) =>
				Array.from(document.querySelectorAll<HTMLElement>('*'))
					.filter((node) => node.childElementCount === 0 && node.textContent === title)
					.map((node) => node.parentElement?.textContent ?? '')
					.find((text) => text.includes(expected)) ?? false,
			{ title, expected },
			{ timeout: 15000 }
		)
		.then((handle) => handle.jsonValue())
		.catch(() => null)
	if (found !== null) return found as string
	return (
		(await page
			.getByText(title, { exact: true })
			.last()
			.locator('xpath=..')
			.textContent()
			.catch(() => '')) ?? ''
	)
}

export async function waitBlock(page: Page, name: string, date: string, slot: string, fragment: string) {
	return page
		.waitForFunction(
			({ name, date, slot, fragment }) => {
				const element = document.querySelector<HTMLButtonElement>(
					`[data-slot="week-grid-column"][data-date="${date}"] button[data-slot="${slot}"][aria-label^="${name}, "]`
				)
				return (element?.getAttribute('aria-label') ?? '').includes(fragment)
			},
			{ name, date, slot, fragment },
			{ timeout: 15000 }
		)
		.then(() => true)
		.catch(() => false)
}

export async function blockFacts(page: Page, name: string, date: string, slot: string = 'to') {
	const data = await readBlocks(page)
	return { data, block: ofCard(data, name).find((block) => block.date === date && block.slot === slot) ?? null }
}

export async function closeDialog(page: Page) {
	await page.keyboard.press('Escape')
	await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(300)
}

export async function focusedBlock(page: Page) {
	return page.evaluate(() => ({
		key: document.activeElement?.getAttribute('data-key') ?? null,
		slot: document.activeElement?.getAttribute('data-slot') ?? null,
		date:
			document.activeElement?.closest<HTMLElement>('[data-slot="week-grid-column"]')?.getAttribute('data-date') ?? null,
		tag: document.activeElement?.tagName ?? null,
	}))
}

export async function calendarDayState(page: Page, date: string) {
	const cell = page.locator(`button[data-day="${dayAttr(date)}"]`).first()
	for (let step = 0; step < 3 && (await cell.count()) === 0; step += 1) {
		await page.getByRole('button', { name: /previous month/i }).click()
		await page.waitForTimeout(150)
	}
	if ((await cell.count()) === 0) return null
	return cell.evaluate(
		(element) =>
			(element as HTMLButtonElement).disabled ||
			element.getAttribute('aria-disabled') === 'true' ||
			element.closest<HTMLElement>('[aria-disabled="true"], [data-disabled="true"]') !== null
	)
}

export async function moveFormFacts(page: Page) {
	const group = page.getByRole('dialog').getByRole('group', { name: 'Move lesson' })
	if ((await group.count()) === 0) return null
	return group
		.evaluate((element) => ({
			text: element.textContent,
			change: element.querySelector<HTMLElement>('[data-slot="move-lesson-change"]')?.textContent ?? '',
			vn: element.querySelector<HTMLElement>('[data-slot="move-lesson-vn"]')?.textContent ?? '',
			second: element.querySelector<HTMLElement>('[data-slot="move-lesson-second"]')?.textContent ?? null,
			secondClass: element.querySelector<HTMLElement>('[data-slot="move-lesson-second"]')?.className ?? '',
			clash: element.querySelector<HTMLElement>('[data-slot="move-lesson-clash"]')?.textContent ?? null,
			submit: Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(
				(button) => button.textContent?.trim() === 'Move lesson'
			)?.disabled,
		}))
		.catch(() => null)
}

export async function seriesBox(page: Page) {
	const box = page.getByRole('dialog').locator('[data-slot="lesson-series"]')
	if ((await box.count()) === 0) return null
	return box.evaluate((element) => ({
		text: element.textContent,
		buttons: Array.from(element.querySelectorAll<HTMLButtonElement>('button')).map((button) =>
			button.textContent?.trim()
		),
	}))
}

export async function seriesDialogFacts(page: Page) {
	return page.getByRole('dialog').evaluate((element) => ({
		text: element.textContent,
		error: element.querySelector<HTMLElement>('[data-slot="move-series-error"]')?.textContent ?? null,
		preview: element.querySelector<HTMLElement>('[data-slot="move-series-preview"]')?.textContent ?? null,
		note: element.querySelector<HTMLElement>('[data-slot="move-series-note"]')?.textContent ?? null,
		hint: element.querySelector<HTMLElement>('[data-slot="end-series-hint"]')?.textContent ?? null,
		hintClass: element.querySelector<HTMLElement>('[data-slot="end-series-hint"]')?.className ?? '',
		from: element.querySelector<HTMLElement>('#move-series-from')?.getAttribute('aria-label') ?? null,
		last: element.querySelector<HTMLElement>('#end-series-last')?.getAttribute('aria-label') ?? null,
		dayInvalid: element.querySelector<HTMLElement>('#move-series-day')?.getAttribute('aria-invalid') ?? null,
		focus: document.activeElement?.textContent?.trim() ?? '',
		focusInside: element.contains(document.activeElement),
	}))
}

export async function openBlockDialog(page: Page, name: string, date: string, slot: string = 'to') {
	await slotLocator(page, name, date, slot).click()
	await page.getByRole('dialog').waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
}
