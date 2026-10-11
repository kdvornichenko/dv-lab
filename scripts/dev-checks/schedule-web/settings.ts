import type { Page, Locator } from 'playwright-core'

import { BASE, check, failures, launch, shot, signIn } from '../browser-context.ts'
import { setTheme, openSchedule } from './navigation.ts'
import { clearZoneStorage, surfaceProbe } from './preferences-context.ts'
import { readCorner } from './second-zone-popup.ts'

export async function settingsPopup(page: Page) {
	await setTheme(page)
	await signIn(page)
	await openSchedule(page)
	await clearZoneStorage(page)
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	const links = await page.locator('[aria-label="Sections"] a').allTextContents()
	check(
		'sidebar: Settings is the last row',
		links.at(-1)?.trim().startsWith('Settings') === true &&
			links.filter((link) => link.includes('Settings')).length === 1,
		links.join(' | ')
	)
	await page.locator('[aria-label="Sections"] a', { hasText: 'Settings' }).click()
	await page.getByRole('heading', { name: 'Settings', level: 1 }).waitFor({ timeout: 30000 })
	check('settings: the address is /settings', new URL(page.url()).pathname === '/settings', page.url())
	const tabs = await page.getByRole('tab').allTextContents()
	check('settings: one tab, General', tabs.length === 1 && tabs[0].trim().startsWith('General'), tabs.join(' | '))
	check(
		'settings: General is selected',
		(await page.getByRole('tab', { name: 'General' }).getAttribute('aria-selected')) === 'true'
	)
	await page.goto(`${BASE}/settings?tab=general`)
	await page.getByRole('heading', { name: 'Settings', level: 1 }).waitFor({ timeout: 30000 })
	check(
		'settings: the tab in the address selects General',
		(await page.getByRole('tab', { name: 'General' }).getAttribute('aria-selected')) === 'true' &&
			page.url().endsWith('/settings?tab=general')
	)
	await page.goto(`${BASE}/settings?tab=nonsense`)
	await page.getByRole('heading', { name: 'Settings', level: 1 }).waitFor({ timeout: 30000 })
	check(
		'settings: an unknown tab falls back to General',
		(await page.getByRole('tab', { name: 'General' }).getAttribute('aria-selected')) === 'true'
	)
	const text = await page
		.locator('main')
		.innerText()
		.catch(() => '')
	const body = text || (await page.locator('body').innerText())
	check(
		'settings: the Time zones card text',
		body.includes('Time zones') &&
			body.includes('Lesson times are shown in Vietnam time (VN), with a second zone (MSK) beside it.') &&
			body.includes('Second zone') &&
			body.includes('Shown next to the main zone') &&
			body.includes('Saved in this browser.')
	)
	check(
		'settings: no Main zone, Account, Appearance or other tabs',
		!/Main zone|Appearance|Google Calendar|Assistant/.test(body) && !body.includes('Account')
	)
	const field = page.locator('#settings-second-zone')
	const facts = await field.evaluate((element) => {
		const style = getComputedStyle(element)
		return {
			height: element.getBoundingClientRect().height,
			background: style.backgroundColor,
			text: element.textContent,
		}
	})
	check(
		'settings: the field trigger is 36px, unfilled, with the zone and its label',
		Math.abs(facts.height - 36) <= 0.6 && facts.background === 'rgba(0, 0, 0, 0)' && facts.text === 'Europe/MoscowMSK',
		JSON.stringify(facts)
	)
	await field.click()
	const search = page.getByPlaceholder('Search time zones')
	await search.waitFor({ timeout: 10000 })
	await page.waitForTimeout(500)
	const popup = await page.evaluate(() => {
		const input = document.querySelector<HTMLInputElement>('input[placeholder="Search time zones"]')
		let node: HTMLElement | null = input
		while (node && !String(node.className).includes('rounded-xl')) node = node.parentElement
		const rows = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'))
			.slice(0, 3)
			.map((row) => row.getBoundingClientRect().height)
		const trigger = document.querySelector<HTMLElement>('#settings-second-zone')!.getBoundingClientRect()
		const box = node?.getBoundingClientRect()
		return node
			? {
					background: getComputedStyle(node).backgroundColor,
					rows,
					widthOk: box!.width >= trigger.width - 1,
					gap: box!.top - trigger.bottom,
				}
			: null
	})
	check(
		'settings popup: rows are 36px',
		popup !== null && popup.rows.every((height) => Math.abs(height - 36) <= 0.6),
		JSON.stringify(popup)
	)
	check(
		'settings popup: not narrower than the field, 4px under it',
		popup !== null && popup.widthOk && Math.abs(popup.gap - 4) <= 2,
		JSON.stringify(popup)
	)
	check(
		'settings popup: two surface steps above the card (surface-5)',
		popup !== null && popup.background === (await surfaceProbe(page, 5)),
		`${popup?.background} / ${await surfaceProbe(page, 5)}`
	)
	const first = await page.getByRole('option').first().textContent()
	check('settings popup: None is offered first', first?.startsWith('None') === true, String(first))
	await shot(page, 'sched-settings', 'popup')
	return { field, search }
}

export async function settingsSaved(page: Page, field: Locator, search: Locator) {
	await search.fill('kolk')
	await page.waitForTimeout(300)
	await search.press('Enter')
	await page.waitForTimeout(500)
	check(
		'settings: choosing Kolkata shows it in the field',
		(await field.textContent()) === 'Asia/KolkataIST',
		String(await field.textContent())
	)
	const toast = await page.locator('[role="alert"], [data-slot="banner"]').allTextContents()
	check(
		'settings: the toast says Saved and names the setting',
		toast.some((item) => item.includes('Saved') && item.includes('Second zone: Asia/Kolkata.')),
		toast.join(' | ')
	)
	await shot(page, 'sched-settings', 'saved')
}

export async function settingsCardForm(page: Page, search: Locator) {
	await page.locator('[aria-label="Sections"] a', { hasText: 'Schedule' }).click()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	await page.waitForTimeout(400)
	let state = await readCorner(page)
	check(
		'schedule: the corner follows Settings without a reload (IST)',
		state.corner.join(' ') === 'IST VN',
		state.corner.join(' ')
	)
	const button = page.locator('[aria-label="Second time zone"]')
	check('schedule: the toolbar button follows Settings', (await button.textContent())?.trim() === 'IST')
	await button.click()
	await page.getByPlaceholder('Search time zones').waitFor({ timeout: 10000 })
	await page.getByPlaceholder('Search time zones').fill('almaty')
	await page.waitForTimeout(300)
	await page.getByPlaceholder('Search time zones').press('Enter')
	await page.waitForTimeout(500)
	await page.locator('[aria-label="Sections"] a', { hasText: 'Settings' }).click()
	await page.getByRole('heading', { name: 'Settings', level: 1 }).waitFor({ timeout: 30000 })
	check(
		'settings: the field follows the toolbar without a reload',
		(await page.locator('#settings-second-zone').textContent()) === 'Asia/AlmatyALMT',
		String(await page.locator('#settings-second-zone').textContent())
	)
	await page.locator('#settings-second-zone').click()
	await page.getByPlaceholder('Search time zones').waitFor({ timeout: 10000 })
	await page.getByRole('option').first().click()
	await page.waitForTimeout(400)
	check('settings: None shows in muted text', (await page.locator('#settings-second-zone').textContent()) === 'None')
	await page.locator('[aria-label="Sections"] a', { hasText: 'Schedule' }).click()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	state = await readCorner(page)
	check('schedule: None leaves only VN in the corner', state.corner.join(' ') === 'VN', state.corner.join(' '))
	await clearZoneStorage(page)
	await page.locator('[aria-label="Sections"] a', { hasText: 'Students' }).click()
	await page.getByRole('heading', { name: 'Students', level: 1 }).waitFor({ timeout: 30000 })
	await page.getByRole('button', { name: 'New student' }).click()
	const dialog = page.getByRole('dialog')
	await dialog.waitFor({ timeout: 10000 })
	const zoneField = dialog.locator('#student-form-time-zone')
	check(
		'card form: the zone field starts with Same as teacher',
		(await zoneField.textContent())?.trim() === 'Same as teacher',
		String(await zoneField.textContent())
	)
	await zoneField.click()
	await search.waitFor({ timeout: 10000 })
	await page.waitForTimeout(500)
	const rows = await page.getByRole('option').allTextContents()
	check(
		'card form: the first row is Same as teacher and there is no None',
		rows[0]?.trim() === 'Same as teacher' && !rows.some((row) => row.startsWith('None')),
		rows.slice(0, 3).join(' | ')
	)
	const dialogPopup = await page.evaluate(() => {
		const probe = (level: number) => {
			const element = document.createElement('div')
			element.style.backgroundColor = `var(--surface-${level})`
			document.body.append(element)
			const color = getComputedStyle(element).backgroundColor
			element.remove()
			return color
		}
		const surfaces = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(probe)
		const input = document.querySelector<HTMLInputElement>('input[placeholder="Search time zones"]')
		let node: HTMLElement | null = input
		while (node && !String(node.className).includes('rounded-xl')) node = node.parentElement
		const dialog = getComputedStyle(document.querySelector<HTMLElement>('[role="dialog"]')!).backgroundColor
		return { surfaces, popup: node ? getComputedStyle(node).backgroundColor : null, dialog }
	})
	const dialogLevel = dialogPopup.surfaces.indexOf(dialogPopup.dialog)
	check(
		'card form: the popup is two surface steps above the dialog',
		dialogLevel >= 0 && dialogPopup.popup === dialogPopup.surfaces[dialogLevel + 2],
		`dialog surface-${dialogLevel + 1}, popup ${dialogPopup.popup}`
	)
	await shot(page, 'sched-settings', 'card-form')
	return { dialog }
}

export async function settingsNarrow(page: Page, search: Locator, dialog: Locator) {
	await page.keyboard.press('Escape')
	await page.waitForTimeout(500)
	check(
		'card form: Esc closes the popup first, the dialog stays',
		(await search.count()) === 0 && (await dialog.count()) === 1
	)
	await page.getByRole('button', { name: 'Discard changes' }).click()
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await page.setViewportSize({ width: 320, height: 700 })
	await page.goto(`${BASE}/settings`)
	await page.getByRole('heading', { name: 'Settings', level: 1 }).waitFor({ timeout: 30000 })
	await page.waitForTimeout(400)
	const overflow = await page.evaluate(() => ({
		page: document.documentElement.scrollWidth > window.innerWidth,
		card: Array.from(document.querySelectorAll<HTMLElement>('section')).some(
			(section) => section.scrollWidth > section.clientWidth + 1
		),
	}))
	check('320px: no sideways scroll on Settings', !overflow.page && !overflow.card, JSON.stringify(overflow))
	await shot(page, 'sched-settings', 'narrow')
}

export async function settingsFinish(problems: string[]) {
	const real = problems.filter((problem) => !problem.includes('net::ERR_FAILED'))
	check('no console problems', real.length === 0, real.slice(0, 2).join(' | '))
}

export async function settings() {
	const { browser, page, problems } = await launch({ width: 1440, height: 900 })
	try {
		let { field, search } = await settingsPopup(page)
		await settingsSaved(page, field, search)
		let { dialog } = await settingsCardForm(page, search)
		await settingsNarrow(page, search, dialog)
		await settingsFinish(problems)
	} finally {
		await clearZoneStorage(page).catch(() => {})
		await browser.close()
	}
	if (failures() === 0) console.log('SCHEDULE_WEB_SETTINGS_OK')
}
