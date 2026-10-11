import type { Page, Locator } from '@playwright/test'

import { BASE, check, failures, launch, shot, signIn } from '../browser-context.ts'
import { setTheme, openSchedule } from './navigation.ts'
import { clearZoneStorage, pageHasOffsetText, listSequence } from './preferences-context.ts'
import { readCorner } from './second-zone-popup.ts'

export async function zonesPopup(page: Page) {
	await setTheme(page)
	await signIn(page)
	await openSchedule(page)
	await clearZoneStorage(page)
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	await page.waitForTimeout(400)
	const button = page.locator('[aria-label="Second time zone"]')
	const search = page.getByPlaceholder('Search time zones')
	const options = page.getByRole('option')
	check('schedule: no offset text such as UTC+7 or GMT-3', !(await pageHasOffsetText(page)))
	let state = await readCorner(page)
	check('corner names MSK and VN', state.corner.join(' ') === 'MSK VN', state.corner.join(' '))
	check('toolbar button says MSK', (await button.textContent())?.trim() === 'MSK')
	await page.goto(`${BASE}/students`)
	await page.getByRole('heading', { name: 'Students', level: 1 }).waitFor({ timeout: 30000 })
	check('students: no offset text such as UTC+7 or GMT-3', !(await pageHasOffsetText(page)))
	await page.evaluate(() => localStorage.setItem('dv-lab.schedule.second-zone', 'Asia/Hovd'))
	await openSchedule(page)
	state = await readCorner(page)
	check('zone without a usual abbreviation shows four city letters', state.corner[0] === 'HOVD', state.corner.join(' '))
	const cornerFit = await page.evaluate(() => {
		const span = document.querySelector<HTMLElement>('[data-slot="week-grid-corner"] span')
		return span ? { scroll: span.scrollWidth, client: span.clientWidth } : null
	})
	check(
		'the four-letter label fits the 36px corner column',
		cornerFit !== null && cornerFit.scroll <= cornerFit.client,
		JSON.stringify(cornerFit)
	)
	check('toolbar button says HOVD', (await button.textContent())?.trim() === 'HOVD')
	await page.evaluate(() => localStorage.removeItem('dv-lab.schedule.second-zone'))
	await openSchedule(page)
	await button.click()
	await search.waitFor({ timeout: 10000 })
	await page.waitForTimeout(500)
	const sequence = await listSequence(page)
	check(
		'popup: None, Favorites with Moscow and Almaty, then All time zones',
		sequence[0] === 'NoneHide the second zone' &&
			sequence[1] === 'Favorites' &&
			sequence[2]?.startsWith('Europe/Moscow') &&
			sequence[3]?.startsWith('Asia/Almaty') &&
			sequence[4] === 'All time zones',
		sequence.slice(0, 6).join(' | ')
	)
	const headings = await page.evaluate(() => {
		const find = (text: string) =>
			Array.from(document.querySelectorAll<HTMLElement>('[role="presentation"]')).find(
				(element) => element.textContent === text
			)
		const favorites = find('Favorites')
		if (!favorites) return null
		const style = getComputedStyle(favorites)
		return { cls: favorites.className, size: style.fontSize, top: style.paddingTop, bottom: style.paddingBottom }
	})
	check(
		'popup: Favorites heading is micro, 8px above and 4px below',
		headings !== null &&
			headings.cls.includes('text-micro') &&
			headings.cls.includes('text-muted-foreground') &&
			headings.size === '11px' &&
			headings.top === '8px' &&
			headings.bottom === '4px',
		JSON.stringify(headings)
	)
	const noneStar = await options.first().locator('[data-slot="time-zone-star"]').count()
	check('popup: None has no star', noneStar === 0)
	const checkedRow = await options.filter({ hasText: 'Europe/Moscow' }).first().getAttribute('aria-selected')
	check('popup: the chosen zone is marked selected', checkedRow === 'true', String(checkedRow))
	const moscowStar = options.filter({ hasText: 'Europe/Moscow' }).first().locator('[data-slot="time-zone-star"]')
	check(
		'popup: a favorite has a pressed, labelled star',
		(await moscowStar.getAttribute('aria-pressed')) === 'true' &&
			(await moscowStar.getAttribute('aria-label')) === 'Remove Europe/Moscow from favorites'
	)
	await shot(page, 'sched-zones', 'popup')
	return { button, search, options, state }
}

export async function zonesScrolled(
	page: Page,
	button: Locator,
	search: Locator,
	options: Locator,
	state: { corner: string[]; gutter8: string[]; stored: string | null }
) {
	const berlinRow = options.filter({ hasText: 'Europe/Berlin' }).first()
	await berlinRow.scrollIntoViewIfNeeded()
	await berlinRow.hover()
	const berlinStar = berlinRow.locator('[data-slot="time-zone-star"]')
	check(
		'popup: Berlin star is named Add to favorites and not pressed',
		(await berlinStar.getAttribute('aria-label')) === 'Add Europe/Berlin to favorites' &&
			(await berlinStar.getAttribute('aria-pressed')) === 'false'
	)
	await berlinStar.click()
	await page.waitForTimeout(400)
	check('star: the popup stays open', (await search.count()) === 1)
	check('star: the chosen zone does not change', (await button.textContent())?.trim() === 'MSK')
	const afterStar = await listSequence(page)
	check(
		'star: Berlin moved into Favorites after Almaty',
		afterStar[1] === 'Favorites' && afterStar[4]?.startsWith('Europe/Berlin') && afterStar[5] === 'All time zones',
		afterStar.slice(0, 7).join(' | ')
	)
	const storedFavorites = await page.evaluate(() => localStorage.getItem('dv-lab.time-zones.favorites'))
	check(
		'star: favorites are kept in the browser in order',
		storedFavorites === JSON.stringify(['Europe/Moscow', 'Asia/Almaty', 'Europe/Berlin']),
		String(storedFavorites)
	)
	await search.fill('CET')
	await page.waitForTimeout(300)
	const cet = await options.allTextContents()
	check(
		'search CET finds Europe/Berlin',
		cet.some((text) => text.startsWith('Europe/Berlin')),
		cet.slice(0, 4).join(' | ')
	)
	const flat = await listSequence(page)
	check('search: groups and headings are gone', !flat.includes('Favorites') && !flat.includes('All time zones'))
	const berlinFirst = await options.first().textContent()
	check('search: favorites come first', berlinFirst?.startsWith('Europe/Berlin') === true, String(berlinFirst))
	await search.fill('zzzz')
	await page.waitForTimeout(300)
	check(
		'search zzzz: empty copy',
		(await page.getByText('No time zones found').isVisible()) &&
			(await page.getByText('Try a city, a country or an abbreviation like CET.').isVisible())
	)
	await search.fill('+5:30')
	await page.waitForTimeout(300)
	const half = await options.allTextContents()
	check(
		'search +5:30 finds Asia/Kolkata',
		half.some((text) => text.startsWith('Asia/Kolkata')),
		half.slice(0, 3).join(' | ')
	)
	await search.fill('kolk')
	await page.waitForTimeout(300)
	await search.press('Enter')
	await page.waitForTimeout(400)
	check('choosing Kolkata: toolbar says IST', (await button.textContent())?.trim() === 'IST')
	state = await readCorner(page)
	check('choosing Kolkata: corner says IST VN', state.corner.join(' ') === 'IST VN', state.corner.join(' '))
	check('choosing Kolkata: nothing but a zone is written', state.stored === 'Asia/Kolkata', String(state.stored))
	check(
		'the search field is empty on reopening',
		await (async () => {
			await button.click()
			await search.waitFor({ timeout: 10000 })
			const empty = (await search.inputValue()) === ''
			await page.keyboard.press('Escape')
			await page.waitForTimeout(400)
			return empty
		})()
	)
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	await page.waitForTimeout(400)
	check('after a reload the choice is kept', (await button.textContent())?.trim() === 'IST')
	check(
		'after a reload the favorites are kept',
		(await page.evaluate(() => localStorage.getItem('dv-lab.time-zones.favorites'))) ===
			JSON.stringify(['Europe/Moscow', 'Asia/Almaty', 'Europe/Berlin'])
	)
	await page.evaluate(() => localStorage.setItem('dv-lab.schedule.second-zone', 'Pacific/Auckland'))
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	await page.waitForTimeout(400)
	await button.click()
	await search.waitFor({ timeout: 10000 })
	await page.waitForTimeout(700)
	const visible = await page.evaluate(() => {
		const row = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find((element) =>
			element.textContent?.startsWith('Pacific/Auckland')
		)
		const viewport = row?.closest<HTMLElement>('[data-slot="scroll-area-viewport"]')
		if (!row || !viewport) return null
		const box = row.getBoundingClientRect()
		const view = viewport.getBoundingClientRect()
		return { top: box.top - view.top, bottom: view.bottom - box.bottom, selected: row.getAttribute('aria-selected') }
	})
	check(
		'opening scrolls the chosen zone into view',
		visible !== null && visible.top >= 0 && visible.bottom >= 0 && visible.selected === 'true',
		JSON.stringify(visible)
	)
	await shot(page, 'sched-zones', 'scrolled')
}

export async function zonesFinish(page: Page, problems: string[], button: Locator, search: Locator) {
	await page.keyboard.press('Escape')
	await page.waitForTimeout(400)
	await page.evaluate(() => localStorage.setItem('dv-lab.time-zones.favorites', '{"broken":'))
	await page.evaluate(() => localStorage.setItem('dv-lab.schedule.second-zone', 'not-a-zone'))
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	await page.waitForTimeout(400)
	await button.click()
	await search.waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	const fallback = await listSequence(page)
	check(
		'unreadable values fall back to the defaults',
		(await button.textContent())?.trim() === 'MSK' &&
			fallback[2]?.startsWith('Europe/Moscow') &&
			fallback[3]?.startsWith('Asia/Almaty'),
		fallback.slice(0, 4).join(' | ')
	)
	await page.keyboard.press('Escape')
	const real = problems.filter((problem) => !problem.includes('net::ERR_FAILED'))
	check('no console problems', real.length === 0, real.slice(0, 2).join(' | '))
}

export async function zones() {
	const { browser, page, problems } = await launch({ width: 1440, height: 900 })
	try {
		let { button, search, options, state } = await zonesPopup(page)
		await zonesScrolled(page, button, search, options, state)
		await zonesFinish(page, problems, button, search)
	} finally {
		await clearZoneStorage(page).catch(() => {})
		await browser.close()
	}
	if (failures() === 0) console.log('SCHEDULE_WEB_ZONES_OK')
}
