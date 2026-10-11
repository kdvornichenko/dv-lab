import type { Page } from '@playwright/test'

import * as core from '../../../packages/core/src/index.ts'
import { BASE, check, shot } from '../browser-context.ts'
import { openBlockDialog, pickDate, seriesDialogFacts, pickTime, pickOption, newButton } from './dialogs.ts'
import type { formsFixtures } from './forms.ts'
import { FORMS_A, formsSeriesDialogs, FORMS_B, FORMS_C, formsSeriesBox, FORMS_D } from './forms.ts'
import { openSchedule, goToWeek } from './navigation.ts'

export async function seriesForms(page: Page, fx: Awaited<ReturnType<typeof formsFixtures>>, nav: { monday: string }) {
	const dialog = page.getByRole('dialog')
	await openSchedule(page)
	await page.evaluate(() => localStorage.removeItem('dv-lab.schedule.second-zone'))
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	await page.waitForTimeout(400)
	nav.monday = core.mondayOf(fx.today)
	await goToWeek(page, nav, core.mondayOf(fx.wednesday))

	await openBlockDialog(page, FORMS_A, fx.wednesday)
	await formsSeriesDialogs(page, FORMS_A, {
		label: 'A',
		time: '18:00',
		when: 'Wednesday at 18:00 VN (14:00 MSK)',
		line: 'Every Wednesday at 14:00 MSK',
	})
	await pickDate(page, fx.today, 'end-series-last')
	let facts = await seriesDialogFacts(page)
	check(
		'A: End series with no lessons left says so, in caption and foreground',
		facts.hint === 'No lessons of this series will remain. Any lessons you moved stay where they are.' &&
			facts.hintClass.includes('text-caption') &&
			facts.hintClass.includes('text-foreground'),
		`${facts.hint} ${facts.hintClass}`
	)
	await shot(page, 'sched-forms', 'end-series-empty')
	await page.getByRole('dialog').getByRole('button', { name: 'Keep series' }).click()
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(400)

	await openBlockDialog(page, FORMS_A, fx.wednesday)
	await dialog.getByRole('button', { name: 'Move series' }).click()
	await page.getByRole('dialog').filter({ hasText: 'Lessons before this date stay' }).waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	facts = await seriesDialogFacts(page)
	check(
		'A: Move series description is "Now every Wednesday at 18:00 VN (14:00 MSK)."',
		facts.text.includes(`${FORMS_A}. Now every Wednesday at 18:00 VN (14:00 MSK).`),
		facts.text.slice(0, 140)
	)
	await pickTime(page, '17:00', 'move-series-time')
	await pickOption(page, 'move-series-day', 'Thursday')
	const move = await page.getByRole('dialog').evaluate((element) => {
		const label = element.querySelector<HTMLElement>('[data-slot="move-series-preview-label"]')
		const preview = element.querySelector<HTMLElement>('[data-slot="move-series-preview"]')
		const zone = element.querySelector<HTMLElement>('[data-slot="move-series-zone"]')
		const note = element.querySelector<HTMLElement>('[data-slot="move-series-note"]')
		const sizes = (node: Element | null | undefined) => (node ? getComputedStyle(node).fontSize : null)
		return {
			labelClass: label?.className ?? '',
			labelSize: sizes(label),
			valueSize: sizes(preview?.lastElementChild),
			zoneClass: zone?.className ?? '',
			zone: zone?.textContent ?? null,
			zoneSize: sizes(zone),
			noteClass: note?.className ?? '',
			noteSize: sizes(note),
		}
	})
	check(
		'A: "First lesson" is body, 13px',
		move.labelClass.includes('text-body') && move.labelSize === '13px' && move.valueSize === '13px',
		JSON.stringify(move)
	)
	check(
		'A: the second-zone line under New start time is caption, 12px',
		move.zoneClass.includes('text-caption') && move.zoneSize === '12px' && move.zone === '13:00 MSK',
		`${move.zone} ${move.zoneClass} ${move.zoneSize}`
	)
	check(
		'A: the rule under the preview is caption, 12px',
		move.noteClass.includes('text-caption') && move.noteSize === '12px',
		`${move.noteClass} ${move.noteSize}`
	)
	await shot(page, 'sched-forms', 'move-series')
	await page.getByRole('dialog').getByRole('button', { name: 'Discard changes' }).click()
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(400)

	await newButton(page).click()
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	await pickTime(page, '18:00')
	await pickOption(page, 'new-lesson-repeats', 'Every week')
	const created = await page.getByRole('dialog').evaluate((element) => {
		const zone = element.querySelector<HTMLElement>('[data-slot="new-lesson-zone"]')
		const repeat = element.querySelector<HTMLElement>('[data-slot="new-lesson-repeat-note"]')
		return {
			zone: zone?.textContent ?? null,
			zoneClass: zone?.className ?? '',
			zoneSize: zone ? getComputedStyle(zone).fontSize : null,
			repeat: repeat?.textContent ?? null,
			repeatClass: repeat?.className ?? '',
		}
	})
	check(
		'new lesson: the line under Start time is caption, 12px',
		created.zoneClass.includes('text-caption') && created.zoneSize === '12px' && created.zone === '14:00 MSK',
		`${created.zone} ${created.zoneClass} ${created.zoneSize}`
	)
	check(
		'new lesson: Repeats names the series in VN until it is ended',
		/^Every [A-Z][a-z]+day at 18:00 VN until you end the series\.$/.test(created.repeat ?? '') &&
			created.repeatClass.includes('text-caption'),
		`${created.repeat} ${created.repeatClass}`
	)
	await shot(page, 'sched-forms', 'new-lesson-repeats')
	await page.getByRole('dialog').getByRole('button', { name: 'Discard changes' }).click()
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(400)

	await openBlockDialog(page, FORMS_B, fx.wednesday)
	await formsSeriesDialogs(page, FORMS_B, {
		label: 'B (Moscow, previous day)',
		time: '02:00',
		when: 'Wednesday at 02:00 VN (Tue 22:00 MSK)',
		line: 'Every Tuesday at 22:00 MSK',
	})
	await shot(page, 'sched-forms', 'end-series-shifted')
	await page.getByRole('dialog').getByRole('button', { name: 'Keep series' }).click()
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(400)
	await openBlockDialog(page, FORMS_B, fx.wednesday)
	await dialog.getByRole('button', { name: 'Move series' }).click()
	await page.getByRole('dialog').filter({ hasText: 'Lessons before this date stay' }).waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	facts = await seriesDialogFacts(page)
	check(
		'B: Move series description carries the day of the second zone',
		facts.text.includes(`${FORMS_B}. Now every Wednesday at 02:00 VN (Tue 22:00 MSK).`),
		facts.text.slice(0, 140)
	)
	await page.getByRole('dialog').getByRole('button', { name: 'Discard changes' }).click()
	await dialog.waitFor({ state: 'detached', timeout: 10000 })

	await page.evaluate(() => localStorage.setItem('dv-lab.schedule.second-zone', 'Pacific/Auckland'))
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	await page.waitForTimeout(400)
	nav.monday = core.mondayOf(fx.today)
	await goToWeek(page, nav, core.mondayOf(fx.wednesday))
	await openBlockDialog(page, FORMS_C, fx.wednesday)
	const auckland = await formsSeriesBox(page)
	check(
		'C (Auckland): the second zone line starts with the other weekday',
		/^Every Thursday at \d\d:\d\d /.test(auckland.second ?? '') && auckland.secondClass.includes('text-micro'),
		auckland.second ?? 'none'
	)
	await dialog.getByRole('button', { name: 'End series' }).click()
	await page.getByRole('dialog').filter({ hasText: 'End this series?' }).waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	facts = await seriesDialogFacts(page)
	check(
		'C (Auckland): End series description carries the short weekday of the second zone',
		new RegExp(`${FORMS_C}, every Wednesday at 22:00 VN \\(Thu \\d\\d:\\d\\d [^)]+\\)\\.`).test(facts.text),
		facts.text.slice(0, 140)
	)
	await page.getByRole('dialog').getByRole('button', { name: 'Keep series' }).click()
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await page.evaluate(() => localStorage.removeItem('dv-lab.schedule.second-zone'))
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	nav.monday = core.mondayOf(fx.today)

	await page.goto(`${BASE}/students`)
	await page.getByRole('heading', { name: 'Students', level: 1 }).waitFor({ timeout: 30000 })
	const row = page.locator('tbody tr', { hasText: FORMS_D })
	await row.waitFor({ timeout: 15000 })
	const noneSpans = await row.evaluate((element) =>
		Array.from(element.querySelectorAll<HTMLElement>('span'))
			.filter((span) => span.textContent === 'None')
			.map((span) => span.className)
	)
	check(
		'students: Next lesson of a card without lessons reads "None", muted',
		noneSpans.length === 1 && noneSpans[0].includes('text-muted-foreground'),
		noneSpans.join('|')
	)
	check('students: no lowercase "none" anywhere', (await page.getByText('none', { exact: true }).count()) === 0)
	console.log('FORMS_PART1_OK')
}
