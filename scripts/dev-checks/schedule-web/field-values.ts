import type { Page } from 'playwright-core'

import * as core from '../../../packages/core/src/index.ts'
import { check, shot } from '../browser-context.ts'
import { newButton, pickOption, pickTime, openBlockDialog, moveFormFacts, closeDialog } from './dialogs.ts'
import { shortDay } from './format.ts'
import type { formsFixtures } from './forms.ts'
import { FORMS_D, valueFacts, valueClear, listFade, FORMS_A } from './forms.ts'
import { openSchedule, goToWeek } from './navigation.ts'

export async function fieldValues(page: Page, fx: Awaited<ReturnType<typeof formsFixtures>>, nav: { monday: string }) {
	const dialog = page.getByRole('dialog')
	await openSchedule(page)
	nav.monday = core.mondayOf(fx.today)

	await newButton(page).click()
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	await pickOption(page, 'new-lesson-student', FORMS_D)
	await pickTime(page, '09:15')
	const time = await valueFacts(page, '#new-lesson-time', '[data-slot="time-picker-value"]')
	check(
		'new lesson: the "09:15" value is whole, 20px line, not clipped',
		time.text === '09:15' && valueClear(time),
		JSON.stringify(time)
	)
	const date = await valueFacts(page, '#new-lesson-date', '[data-slot="date-field-value"]')
	check('new lesson: the date value is whole, 20px line, not clipped', valueClear(date), JSON.stringify(date))
	const student = await valueFacts(page, '#new-lesson-student', 'span[class*="truncate"]')
	check(
		'new lesson: the Select value is whole, 20px line, not clipped',
		student.text === FORMS_D && valueClear(student),
		JSON.stringify(student)
	)
	await shot(page, 'sched-forms', 'values')

	await page.mouse.move(4, 4)
	await page.waitForTimeout(300)
	const rest = await page.evaluate(() => {
		const trigger: HTMLElement | null = document.querySelector<HTMLInputElement>('#new-lesson-time')
		return {
			triggerHeight: trigger!.getBoundingClientRect().height,
			triggerFill: getComputedStyle(trigger!.querySelector<HTMLElement>('span[aria-hidden]')!).backgroundColor,
		}
	})
	await page.locator('#new-lesson-time').click()
	await page.getByRole('listbox', { name: 'Hours' }).waitFor({ timeout: 5000 })
	await page.waitForTimeout(300)
	const open = await page.evaluate(() => {
		const footer = document.querySelector<HTMLElement>('[data-slot="time-picker-footer"]')
		const label = document.querySelector<HTMLElement>('[data-slot="time-picker-column-label"]')
		return {
			footer: getComputedStyle(footer!).padding,
			label: getComputedStyle(label!).paddingBottom,
		}
	})
	const panel = { ...rest, ...open }
	check(
		'time picker: 36px trigger without a fill, footer p-2, column label pb-1',
		panel.triggerHeight === 36 &&
			panel.footer === '8px' &&
			panel.label === '4px' &&
			panel.triggerFill === 'rgba(0, 0, 0, 0)',
		JSON.stringify(panel)
	)
	await shot(page, 'sched-forms', 'time-picker')
	await page.keyboard.press('Escape')
	await page.waitForTimeout(300)

	await page.locator('#new-lesson-repeats').click()
	await page.getByRole('listbox').waitFor({ timeout: 5000 })
	await page.waitForTimeout(500)
	const shortList = await listFade(page)
	check(
		'select: a short list (Repeats) gets the compact 24px fade',
		shortList.height < 200 && shortList.size === '24px',
		JSON.stringify(shortList)
	)
	await page.keyboard.press('Escape')
	await page.waitForTimeout(400)
	await page.locator('#new-lesson-student').click()
	await page.getByRole('listbox').waitFor({ timeout: 5000 })
	await page.waitForTimeout(500)
	const longList = await listFade(page)
	check(
		'select: a long list (Student) keeps the 48px fade',
		longList.height >= 200 && longList.size === '48px' && longList.fade,
		JSON.stringify(longList)
	)
	await shot(page, 'sched-forms', 'select-long')
	await page.keyboard.press('Escape')
	await page.waitForTimeout(400)
	await page.getByRole('dialog').getByRole('button', { name: 'Discard changes' }).click()
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(300)

	await page.locator('[aria-label="Second time zone"]').click()
	await page
		.getByRole('searchbox', { name: 'Search time zones' })
		.or(page.getByLabel('Search time zones'))
		.first()
		.waitFor({ timeout: 5000 })
	await page.waitForTimeout(500)
	const zoneInput = await valueFacts(page, 'input[aria-label="Search time zones"]')
	check(
		'combobox: the search value is whole and not clipped',
		zoneInput.height >= 20 && zoneInput.scrollHeight <= zoneInput.clientHeight,
		JSON.stringify(zoneInput)
	)
	const zoneList = await listFade(page)
	check(
		'combobox: the time zone popup uses the compact 24px fade it is drawn with',
		zoneList.size === '24px' && zoneList.fade,
		JSON.stringify(zoneList)
	)
	await page.keyboard.press('Escape')
	await page.waitForTimeout(400)

	await openSchedule(page)
	nav.monday = core.mondayOf(fx.today)
	await goToWeek(page, nav, core.mondayOf(fx.wednesday))
	await openBlockDialog(page, FORMS_A, fx.wednesday)
	await dialog.getByRole('button', { name: 'Move series' }).click()
	await page.getByRole('dialog').filter({ hasText: 'Lessons before this date stay' }).waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	await page.getByRole('dialog').getByRole('button', { name: 'Move series' }).click()
	await page.waitForTimeout(400)
	const invalid = await page.evaluate(() => {
		const probe = document.createElement('div')
		probe.style.color = 'var(--destructive)'
		document.body.append(probe)
		const destructive = getComputedStyle(probe).color
		probe.remove()
		const time = document.querySelector<HTMLElement>('#move-series-time')
		const day = document.querySelector<HTMLElement>('#move-series-day')
		return {
			timeInvalid: time!.getAttribute('aria-invalid'),
			dayInvalid: day!.getAttribute('aria-invalid'),
			ring: getComputedStyle(time!.querySelector<HTMLElement>('span[aria-hidden]')!).boxShadow,
			destructive,
		}
	})
	check(
		'move series: an invalid time has aria-invalid and a destructive ring, like the day',
		invalid.timeInvalid === 'true' && invalid.dayInvalid === 'true' && invalid.ring.includes(invalid.destructive),
		JSON.stringify(invalid)
	)
	await shot(page, 'sched-forms', 'move-series-invalid')
	await page.getByRole('dialog').getByRole('button', { name: 'Discard changes' }).click()
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(300)

	await openBlockDialog(page, FORMS_A, fx.wednesday)
	await dialog.getByRole('button', { name: 'Move lesson' }).click()
	await page.getByRole('group', { name: 'Move lesson' }).waitFor({ timeout: 5000 })
	await page.waitForTimeout(400)
	await pickTime(page, '19:15', 'move-lesson-time')
	const moveForm = await moveFormFacts(page)
	check(
		'move lesson: was and now in VN on one line, the second zone on a micro line under it',
		moveForm !== null &&
			moveForm.vn === `${shortDay(fx.wednesday)}, 18:00${shortDay(fx.wednesday)}, 19:15–20:15 VN` &&
			moveForm.second === `${shortDay(fx.wednesday)}, 14:00${shortDay(fx.wednesday)}, 15:15–16:15 MSK` &&
			moveForm.secondClass.includes('text-micro'),
		`${moveForm?.vn} | ${moveForm?.second}`
	)
	await shot(page, 'sched-forms', 'move-lesson')
	await dialog.getByRole('button', { name: 'Discard changes' }).click()
	await page.waitForTimeout(300)
	await closeDialog(page)
	console.log('FORMS_PART2_OK')
}
