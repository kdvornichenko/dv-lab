import type { Page } from 'playwright-core'

import * as core from '../../../packages/core/src/index.ts'
import { check } from '../browser-context.ts'
import { expectedNow, expectedRange, expectedTitle } from './format.ts'

export async function weekNavigation(page: Page, label: string, at?: Date | undefined) {
	const nowVn = expectedNow(at)
	const monday = core.mondayOf(nowVn.date)
	const today = page.getByRole('button', { name: 'Today', exact: true })
	const settle = async () => {
		await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 15000 })
		await page.waitForTimeout(250)
	}
	const expectWeek = async (name: string, offset: number, eyebrow: string, todayDisabled: boolean) => {
		const week = core.addDays(monday, offset * 7)
		const header = await readHeader(page)
		check(`${label} ${name}: h1`, header.h1 === expectedRange(week), header.h1)
		check(`${label} ${name}: period title`, header.title === expectedTitle(week), header.title)
		check(`${label} ${name}: eyebrow ${eyebrow}`, header.eyebrow === eyebrow, header.eyebrow)
		check(`${label} ${name}: columns start on Monday`, header.first === week, header.first)
		check(
			`${label} ${name}: Today ${todayDisabled ? 'disabled' : 'enabled'}`,
			(await today.isDisabled()) === todayDisabled
		)
		check(
			`${label} ${name}: now line ${offset === 0 ? 'shown' : 'hidden'}`,
			header.nowLines === (offset === 0 ? 1 : 0),
			String(header.nowLines)
		)
		check(`${label} ${name}: scroll offset kept`, Math.abs(header.scrollTop! - 336) <= 2, String(header.scrollTop))
	}
	await expectWeek('current', 0, 'This week', true)
	const view = await page.getByRole('combobox', { name: 'Calendar view' }).textContent()
	check(`${label} view select shows Week`, view?.trim() === 'Week', view)
	await page.getByRole('button', { name: 'Next week' }).click()
	await settle()
	await expectWeek('next by button', 1, 'Coming weeks', false)
	await page.keyboard.press('k')
	await settle()
	await expectWeek('k once', 0, 'This week', true)
	await page.keyboard.press('k')
	await settle()
	await expectWeek('k twice', -1, 'Past week', false)
	await page.keyboard.press('t')
	await settle()
	await expectWeek('t', 0, 'This week', true)
	await page.keyboard.press('ArrowRight')
	await settle()
	await expectWeek('ArrowRight', 1, 'Coming weeks', false)
	await page.keyboard.press('j')
	await settle()
	await expectWeek('j', 2, 'Coming weeks', false)
	await page.keyboard.press('ArrowLeft')
	await settle()
	await expectWeek('ArrowLeft', 1, 'Coming weeks', false)
	await page.evaluate(() => {
		const input = document.createElement('input')
		input.id = 'probe-input'
		document.body.append(input)
		input.focus()
	})
	await page.keyboard.press('t')
	await page.keyboard.press('j')
	await settle()
	await expectWeek('keys inside an input do nothing', 1, 'Coming weeks', false)
	await page.evaluate(() => document.getElementById('probe-input')?.remove())
	await page.evaluate(() => {
		const dialog = document.createElement('div')
		dialog.setAttribute('role', 'dialog')
		dialog.id = 'probe-dialog'
		document.body.append(dialog)
	})
	await page.keyboard.press('t')
	await settle()
	await expectWeek('keys with a dialog open do nothing', 1, 'Coming weeks', false)
	await page.evaluate(() => document.getElementById('probe-dialog')?.remove())
	await page.keyboard.press('t')
	await settle()
	await expectWeek('t after the probes', 0, 'This week', true)
	await page.keyboard.press('Control+t')
	await settle()
	await expectWeek('modifier ignored', 0, 'This week', true)
}

export async function readHeader(page: Page) {
	return page.evaluate(() => {
		const h1 = document.querySelector<HTMLElement>('h1')
		return {
			h1: h1?.textContent,
			eyebrow: h1?.parentElement?.querySelector<HTMLElement>('p')?.textContent,
			title: document.querySelector<HTMLElement>('[data-slot="schedule-period"]')?.textContent,
			first: document.querySelector<HTMLElement>('[data-slot="week-grid-day"]')?.dataset.date,
			scrollTop: document.querySelector<HTMLElement>('[data-slot="week-grid-body"]')?.scrollTop,
			nowLines: document.querySelectorAll<HTMLElement>('[data-slot="week-grid-now"]').length,
		}
	})
}
