import type { Page, Locator } from 'playwright-core'

import * as core from '../../../packages/core/src/index.ts'
import { check, shot } from '../browser-context.ts'
import { expectedNow, berlinFacts } from './format.ts'

export async function secondZonePopupZonePopup(page: Page, label: string) {
	const button = page.locator('[aria-label="Second time zone"]')
	const search = page.getByPlaceholder('Search time zones')
	const options = page.getByRole('option')
	const nowVn = expectedNow()
	const monday = core.mondayOf(nowVn.date)
	check(
		`${label} zone button caption is MSK`,
		(await button.textContent())?.trim() === 'MSK',
		await button.textContent()
	)
	await button.click()
	await search.waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	const first = await options.first().textContent()
	check(`${label} popup first row is None`, first?.startsWith('None') && first.includes('Hide the second zone'), first)
	const count = await options.count()
	check(`${label} popup lists many zones`, count > 100, String(count))
	const geometry = await page.evaluate(() => {
		const input = document.querySelector<HTMLInputElement>('input[placeholder="Search time zones"]')
		let node: HTMLElement | null = input
		while (node && Math.abs(node.getBoundingClientRect().width - 280) > 1.5) node = node.parentElement
		const button = document.querySelector<HTMLElement>('[aria-label="Second time zone"]')
		if (!node || !button) return null
		const popup = node.getBoundingClientRect()
		const trigger = button.getBoundingClientRect()
		const fade = document
			.querySelector<HTMLElement>('[role="listbox"]')
			?.closest<HTMLElement>('[data-slot="scroll-area-viewport"]')
		const style = fade ? getComputedStyle(fade) : null
		const rows = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'))
			.slice(0, 3)
			.map((row) => row.getBoundingClientRect().height)
		return {
			width: popup.width,
			gap: popup.top - trigger.bottom,
			right: popup.right - trigger.right,
			fadeClass: fade?.classList.contains('scroll-fade'),
			fadeSize: style?.getPropertyValue('--scroll-fade-size').trim(),
			rows,
			background: getComputedStyle(node).backgroundColor,
		}
	})
	check(
		`${label} popup is 280px wide`,
		geometry !== null && Math.abs(geometry.width - 280) <= 1.5,
		JSON.stringify(geometry)
	)
	check(
		`${label} popup sits 4px under the button`,
		geometry !== null && Math.abs(geometry.gap - 4) <= 2,
		String(geometry?.gap)
	)
	check(
		`${label} popup is right-aligned to the button`,
		geometry !== null && Math.abs(geometry.right) <= 2,
		String(geometry?.right)
	)
	check(
		`${label} popup rows are 28px`,
		geometry !== null && geometry.rows.every((height) => Math.abs(height - 28) <= 0.6),
		String(geometry?.rows)
	)
	check(
		`${label} popup list fades at 24px`,
		geometry?.fadeClass === true && geometry.fadeSize === '24px',
		`${geometry?.fadeClass}/${geometry?.fadeSize}`
	)
	await shot(page, 'sched-frame', 'zone-popup')
	return { button, search, options, monday }
}

export async function secondZonePopupZoneEmpty(page: Page, label: string, search: Locator, options: Locator) {
	const texts = await options.allTextContents()
	check(
		`${label} list has no Vietnam zone`,
		!texts.some((text) => text.includes('Asia/Ho_Chi_Minh') || text.includes('Asia/Saigon'))
	)
	check(
		`${label} list has Europe/Berlin and Asia/Kolkata`,
		texts.some((text) => text.startsWith('Europe/Berlin')) && texts.some((text) => text.startsWith('Asia/Kolkata'))
	)
	await search.fill('zzz')
	await page.waitForTimeout(300)
	const empty = await page.getByText('No time zones found').isVisible()
	const hint = await page.getByText('Try a city, a country or an abbreviation like CET.').isVisible()
	check(`${label} empty result copy`, empty && hint)
	await shot(page, 'sched-frame', 'zone-empty')
}

export async function secondZonePopupZoneNone(
	page: Page,
	label: string,
	button: Locator,
	search: Locator,
	options: Locator,
	monday: string
) {
	await search.fill('saigon')
	await page.waitForTimeout(300)
	check(`${label} Saigon is not offered`, (await options.count()) === 0)
	await page.keyboard.press('Escape')
	await page.waitForTimeout(500)
	check(
		`${label} Esc closes the popup only`,
		(await search.count()) === 0 && page.url().endsWith('/schedule') && (await page.locator('h1').count()) === 1
	)
	await button.click()
	await search.fill('berl')
	await page.waitForTimeout(300)
	const berlin = await options.allTextContents()
	check(`${label} search berl finds Berlin first`, berlin[0]?.startsWith('Europe/Berlin'), berlin[0])
	await search.press('Enter')
	await page.waitForTimeout(400)
	const facts = berlinFacts(monday)
	check(
		`${label} button shows the Berlin label`,
		(await button.textContent())?.trim() === facts.label,
		await button.textContent()
	)
	let state = await readCorner(page)
	check(`${label} corner shows the short label`, state.corner.join(' ') === `${facts.label} VN`, state.corner.join(' '))
	check(
		`${label} 08:00 VN is ${facts.hour} in Berlin`,
		state.gutter8.join(' ') === `${facts.hour} 08:00`,
		state.gutter8.join(' ')
	)
	check(`${label} choice is stored`, state.stored === 'Europe/Berlin', state.stored)
	for (let step = 0; step < 3; step += 1) await page.getByRole('button', { name: 'Next week' }).click()
	await page.waitForTimeout(300)
	const later = core.addDays(monday, 21)
	const laterFacts = berlinFacts(later)
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 15000 })
	state = await readCorner(page)
	check(
		`${label} label follows the Monday of the week`,
		(await button.textContent())?.trim() === laterFacts.label && state.corner[0] === laterFacts.label,
		`${await button.textContent()} ${state.corner.join(' ')}`
	)
	check(
		`${label} gutter follows the Monday of the week`,
		state.gutter8.join(' ') === `${laterFacts.hour} 08:00`,
		state.gutter8.join(' ')
	)
	for (let step = 0; step < 3; step += 1) await page.getByRole('button', { name: 'Previous week' }).click()
	await button.click()
	await search.waitFor({ timeout: 10000 })
	await options.first().click()
	await page.waitForTimeout(400)
	state = await readCorner(page)
	check(
		`${label} None: button says No second zone`,
		(await button.textContent())?.trim() === 'No second zone',
		await button.textContent()
	)
	check(`${label} None: corner has only VN`, state.corner.join(' ') === 'VN', state.corner.join(' '))
	check(`${label} None: one label per hour`, state.gutter8.join(' ') === '08:00', state.gutter8.join(' '))
	check(`${label} None: stored as none`, state.stored === 'none', state.stored)
	await shot(page, 'sched-frame', 'zone-none')
	return { state }
}

export async function secondZonePopupFinish(
	page: Page,
	label: string,
	requests: { method: string; url: string }[],
	button: Locator,
	state: { corner: string[]; gutter8: string[]; stored: string | null }
) {
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	await page.waitForTimeout(300)
	state = await readCorner(page)
	check(
		`${label} None survives a reload`,
		(await button.textContent())?.trim() === 'No second zone' && state.corner.join(' ') === 'VN',
		`${await button.textContent()} ${state.corner.join(' ')}`
	)
	for (const bad of ['not-a-zone', 'Asia/Saigon', 'Asia/Ho_Chi_Minh', '']) {
		await page.evaluate((value) => localStorage.setItem('dv-lab.schedule.second-zone', value), bad)
		await page.reload()
		await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
		await page.waitForTimeout(300)
		state = await readCorner(page)
		check(
			`${label} stored "${bad}" falls back to MSK`,
			(await button.textContent())?.trim() === 'MSK' && state.corner.join(' ') === 'MSK VN',
			`${await button.textContent()} ${state.corner.join(' ')}`
		)
	}
	await page.evaluate(() => localStorage.removeItem('dv-lab.schedule.second-zone'))
	const writes = requests.filter((request) => request.method !== 'GET')
	check(
		`${label} the choice reaches no api (no write requests)`,
		writes.length === 0,
		writes
			.map((request) => `${request.method} ${request.url}`)
			.slice(0, 2)
			.join(' | ')
	)
}

export async function secondZonePopup(page: Page, label: string, requests: { method: string; url: string }[]) {
	let { button, search, options, monday } = await secondZonePopupZonePopup(page, label)
	await secondZonePopupZoneEmpty(page, label, search, options)
	let { state } = await secondZonePopupZoneNone(page, label, button, search, options, monday)
	await secondZonePopupFinish(page, label, requests, button, state)
}

export async function readCorner(page: Page) {
	return page.evaluate(() => ({
		corner: Array.from(document.querySelectorAll<HTMLElement>('[data-slot="week-grid-corner"] span')).map(
			(element) => element.textContent
		),
		gutter8: Array.from(
			document
				.querySelectorAll<HTMLElement>('[data-slot="week-grid-gutter"] > div')[8]
				?.querySelectorAll<HTMLElement>('span') ?? []
		).map((element) => element.textContent),
		stored: localStorage.getItem('dv-lab.schedule.second-zone'),
	}))
}
