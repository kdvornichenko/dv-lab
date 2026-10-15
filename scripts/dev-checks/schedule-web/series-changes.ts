import type { Page, Locator } from '@playwright/test'

import type { ScheduleSeriesResponse, ErrorResponse } from '../../../packages/contracts/src/index.ts'
import * as core from '../../../packages/core/src/index.ts'
import { api, check, shot, sql } from '../browser-context.ts'
import { readBlocks, ofCard } from './block-probes.ts'
import type { changesFixtures } from './changes.ts'
import { CH_A, CH_B, pastSnapshot, CH_D, CH_C } from './changes.ts'
import {
	openBlockDialog,
	seriesBox,
	dialogButtons,
	closeDialog,
	seriesDialogFacts,
	pickOption,
	pickTime,
	toastText,
	waitBlock,
	focusedBlock,
	pickDate,
} from './dialogs.ts'
import { appDate, mediumDate, quote } from './format.ts'
import { goToWeek } from './navigation.ts'
import { createCard } from './read-fixtures.ts'

export async function seriesChangesWholeSeries(
	page: Page,
	fx: Awaited<ReturnType<typeof changesFixtures>>,
	nav: { monday: string }
) {
	const dialog = page.getByRole('dialog')
	await goToWeek(page, nav, core.mondayOf(fx.laterWed))
	await openBlockDialog(page, CH_A, fx.laterWed)
	let box = await seriesBox(page)
	check(
		'series: a future lesson of the series has the Whole series box',
		box !== null &&
			box.text.includes('Whole series') &&
			box.text.includes(`Every Wednesday at 18:00 VN · from ${appDate(fx.startsOn, fx.today)}`),
		box?.text
	)
	check(
		'series: the box offers Move series and End series',
		box !== null && box.buttons.includes('Move series') && box.buttons.includes('End series'),
		box?.buttons.join('|')
	)
	const lessonButtons = await dialogButtons(page)
	check(
		'series: the footer keeps the buttons for one lesson',
		lessonButtons.includes('Move lesson') && lessonButtons.includes('Cancel lesson'),
		lessonButtons.join('|')
	)
	await shot(page, 'sched-changes', 'whole-series')
	return { dialog, box }
}

export async function seriesChangesMoveSeries(
	page: Page,
	fx: Awaited<ReturnType<typeof changesFixtures>>,
	nav: { monday: string },
	posts: { url: string; body: string | null }[],
	dialog: Locator
) {
	await closeDialog(page)
	await goToWeek(page, nav, core.mondayOf(fx.pastWed))
	await openBlockDialog(page, CH_A, fx.pastWed)
	check('series: a past lesson has no Whole series box', (await seriesBox(page)) === null)
	await closeDialog(page)
	await goToWeek(page, nav, core.mondayOf(fx.thursday))
	await openBlockDialog(page, CH_B, fx.thursday)
	check('series: a single lesson has no Whole series box', (await seriesBox(page)) === null)
	await closeDialog(page)
	await goToWeek(page, nav, core.mondayOf(fx.laterWed))
	await openBlockDialog(page, CH_A, fx.laterWed)
	await dialog.getByRole('button', { name: 'Move series' }).click()
	await page.getByRole('dialog').filter({ hasText: 'Lessons before this date stay' }).waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	check('move series: the lesson dialog is replaced by Move series', (await dialog.count()) === 1)
	let facts = await seriesDialogFacts(page)
	check(
		'move series: title and description',
		facts.text.includes('Move series') && facts.text.includes(`${CH_A}. Now every Wednesday at 18:00 VN (14:00 MSK).`),
		facts.text.slice(0, 120)
	)
	check(
		'move series: From defaults to the nearest future Wednesday',
		facts.from === `From: ${mediumDate(fx.wed)}`,
		facts.from
	)
	check('move series: focus is inside the dialog', facts.focusInside === true, facts.focus)
	check(
		'move series: the note about earlier, moved and cancelled lessons is shown',
		facts.note ===
			'Lessons before this date stay as they are. Lessons you already moved keep their new time. Cancelled lessons from this date on are reset.',
		facts.note
	)
	let sent = posts.length
	await page.getByRole('dialog').getByRole('button', { name: 'Move series' }).click()
	await page.waitForTimeout(400)
	facts = await seriesDialogFacts(page)
	check(
		'move series: the same day and time give an error under the row',
		facts.error === 'Choose a different day, time or length.' && facts.dayInvalid === 'true',
		`${facts.error} ${facts.dayInvalid}`
	)
	check(
		'move series: and nothing is sent',
		posts.slice(sent).every((post) => !post.url.includes(`/series/${fx.seriesId}/move`))
	)
	await pickOption(page, 'move-series-day', 'Thursday')
	await pickTime(page, '17:00', 'move-series-time')
	facts = await seriesDialogFacts(page)
	check(
		'move series: preview of the first lesson',
		facts.preview === `First lesson${appDate(fx.thursday, fx.today)}, 17:00–18:00` && facts.error === null,
		`${facts.preview} ${facts.error}`
	)
	await shot(page, 'sched-changes', 'move-series')
	return { facts, sent }
}

export async function seriesChangesMoveSeriesEnds(
	page: Page,
	fx: Awaited<ReturnType<typeof changesFixtures>>,
	nav: { monday: string },
	posts: { url: string; body: string | null }[],
	before: string[],
	dialog: Locator,
	facts: Awaited<ReturnType<typeof seriesDialogFacts>>,
	sent: number
) {
	await page.getByRole('dialog').getByRole('button', { name: 'Move series' }).click()
	const movedToast = await toastText(page, 'Series moved', CH_A)
	check(
		'move series: toast names the new day and the first date',
		movedToast.includes(`${CH_A} now meets on Thursdays at 17:00 VN from ${appDate(fx.thursday, fx.today)}.`),
		movedToast
	)
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	check(
		'move series: the week shows Thursday 17:00 instead of Wednesday',
		await waitBlock(page, CH_A, core.addDays(fx.laterWed, 1), 'to', '17:00–18:00 VN')
	)
	await page.waitForTimeout(400)
	const focus = await focusedBlock(page)
	check('move series: the gone block hands focus to the page heading', focus.tag === 'H1', JSON.stringify(focus))
	let week = await readBlocks(page)
	check(
		'move series: no Wednesday of A in that week',
		!ofCard(week, CH_A).some((block) => block.date === fx.laterWed),
		ofCard(week, CH_A)
			.map((block) => block.date)
			.join(',')
	)
	await goToWeek(page, nav, core.mondayOf(fx.wed))
	week = await readBlocks(page)
	const friday = ofCard(week, CH_A).find((block) => block.date === fx.friday)
	const thursday = ofCard(week, CH_A).find((block) => block.date === fx.thursday)
	check(
		'move series: the lesson moved in part 2 stays on Friday 10:00',
		friday !== undefined && Math.abs(friday.top - 10 * 48) <= 1.5 && friday.label!.endsWith(', planned'),
		friday?.label ?? 'no block'
	)
	check(
		'move series: the first Thursday 17:00 is drawn',
		thursday !== undefined && Math.abs(thursday.top - 17 * 48) <= 1.5,
		thursday?.label ?? 'no block'
	)
	check('move series: past weeks did not change', (await pastSnapshot(page, fx)).join('\n') === before.join('\n'))
	const d = await createCard(page, CH_D, 60, null)
	const inserted = sql<{ id: string }>(
		`insert into lesson_series (student_id, weekday, start_time, duration_minutes, starts_on, ends_on) values (${quote(d)}, 3, '18:00', 60, ${quote(core.addDays(fx.wed, -7))}, ${quote(fx.wed)}) returning id`
	)
	check('series D ending on the nearest Wednesday created through sql', inserted.rowCount === 1)
	const seriesD = inserted.rows?.[0]?.id
	await page.keyboard.press('k')
	await page.waitForTimeout(300)
	await page.keyboard.press('j')
	await page.waitForFunction(
		(expected) => document.querySelector<HTMLElement>('[data-slot="week-grid-day"]')?.dataset.date === expected,
		core.mondayOf(fx.wed),
		{ timeout: 30000 }
	)
	await page.waitForTimeout(500)
	await openBlockDialog(page, CH_D, fx.wed)
	await dialog.getByRole('button', { name: 'Move series' }).click()
	await page.getByRole('dialog').filter({ hasText: 'Lessons before this date stay' }).waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	facts = await seriesDialogFacts(page)
	check('move series D: From is the last Wednesday of D', facts.from === `From: ${mediumDate(fx.wed)}`, facts.from)
	await pickOption(page, 'move-series-day', 'Thursday')
	facts = await seriesDialogFacts(page)
	const endsText = `This series ends on ${appDate(fx.wed, fx.today)}; no Thursday falls between From and that date.`
	check('move series D: the end before the new day is explained', facts.error === endsText, facts.error)
	check('move series D: no preview without a first lesson', facts.preview === null, facts.preview)
	sent = posts.length
	await page.getByRole('dialog').getByRole('button', { name: 'Move series' }).click()
	await page.waitForTimeout(500)
	check(
		'move series D: and the request does not go out',
		posts.slice(sent).every((post) => !post.url.includes(`/series/${seriesD}/move`))
	)
	await shot(page, 'sched-changes', 'move-series-ends')
	return { week, seriesD, facts }
}

export async function seriesChangesEndSeries(
	page: Page,
	fx: Awaited<ReturnType<typeof changesFixtures>>,
	dialog: Locator,
	box: Awaited<ReturnType<typeof seriesBox>>,
	facts: Awaited<ReturnType<typeof seriesDialogFacts>>,
	seriesD: string
) {
	await pickOption(page, 'move-series-day', 'Wednesday')
	await pickTime(page, '19:00', 'move-series-time')
	await page.route('**/api/schedule/series/*/move', (route) =>
		route.fulfill({
			status: 400,
			contentType: 'application/json',
			body: JSON.stringify({ error: { code: 'series_ends_before_new_day', message: 'Invalid request' } }),
		})
	)
	await page.getByRole('dialog').getByRole('button', { name: 'Move series' }).click()
	await page.waitForTimeout(800)
	facts = await seriesDialogFacts(page)
	check(
		'move series D: the api code series_ends_before_new_day shows the same error',
		facts.error === `This series ends on ${appDate(fx.wed, fx.today)}; no Wednesday falls between From and that date.`,
		facts.error
	)
	await page.unroute('**/api/schedule/series/*/move')
	await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(400)
	const focusD = await focusedBlock(page)
	check(
		'move series D: closing returns focus to the block',
		focusD.date === fx.wed && focusD.slot === 'to' && focusD.key?.includes(seriesD),
		JSON.stringify(focusD)
	)
	await openBlockDialog(page, CH_A, fx.thursday)
	box = await seriesBox(page)
	check(
		'end series: the new series has its own Whole series box',
		box !== null && box.text.includes(`Every Thursday at 17:00 VN · from ${appDate(fx.thursday, fx.today)}`),
		box?.text
	)
	await dialog.getByRole('button', { name: 'End series' }).click()
	await page.getByRole('dialog').filter({ hasText: 'End this series?' }).waitFor({ timeout: 10000 })
	await page.waitForTimeout(500)
	facts = await seriesDialogFacts(page)
	check(
		'end series: title, description and the open lesson date',
		facts.text.includes(`${CH_A}, every Thursday at 17:00 VN (13:00 MSK).`) &&
			facts.last === `Last lesson on: ${mediumDate(fx.thursday)}`,
		`${facts.text.slice(0, 120)} ${facts.last}`
	)
	check('end series: Keep series has the initial focus', facts.focus === 'Keep series', facts.focus)
	const second = core.addDays(fx.thursday, 7)
	await pickDate(page, second, 'end-series-last')
	facts = await seriesDialogFacts(page)
	check(
		'end series: the hint names the last lesson',
		facts.hint ===
			`The last lesson will be on ${appDate(second, fx.today)}. Later lessons are removed from the schedule. Earlier lessons and any lessons you moved stay where they are.` &&
			facts.hintClass.includes('text-muted-foreground'),
		facts.hint
	)
	const buttonStyle = await page
		.getByRole('dialog')
		.getByRole('button', { name: 'End series' })
		.evaluate((element) => {
			const probe = document.createElement('div')
			probe.className = 'text-destructive'
			document.body.append(probe)
			const destructive = getComputedStyle(probe).color
			probe.remove()
			return { color: getComputedStyle(element).color, destructive }
		})
	check(
		'end series: End series is an outline button with a red label',
		buttonStyle.color === buttonStyle.destructive,
		JSON.stringify(buttonStyle)
	)
	await shot(page, 'sched-changes', 'end-series')
	return { second, facts }
}

export async function seriesChangesEndSeriesEmpty(
	page: Page,
	fx: Awaited<ReturnType<typeof changesFixtures>>,
	nav: { monday: string },
	dialog: Locator,
	facts: Awaited<ReturnType<typeof seriesDialogFacts>>,
	week: {
		selected: string
		transparent: string
		columnWidth: number
		blocks: {
			key: string | undefined
			slot: string | null
			label: string | null
			text: string
			lines: string[]
			title: string | null
			date: string | undefined
			left: number
			width: number
			top: number
			height: number
			background: string
			color: string
			outlineStyle: string
			outlineWidth: string
			decoration: string
		}[]
		description: string
		live: string
		h1: string | undefined
	},
	second: string
) {
	await page.getByRole('dialog').getByRole('button', { name: 'End series' }).click()
	const endedToast = await toastText(page, 'Series ended', CH_A)
	check(
		'end series: toast names the last lesson',
		endedToast.includes(`${CH_A}'s last lesson is on ${appDate(second, fx.today)}.`),
		endedToast
	)
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await goToWeek(page, nav, core.mondayOf(second))
	week = await readBlocks(page)
	check(
		'end series: the last Thursday stays',
		ofCard(week, CH_A).some((block) => block.date === second),
		ofCard(week, CH_A)
			.map((block) => block.date)
			.join(',')
	)
	await goToWeek(page, nav, core.mondayOf(core.addDays(second, 7)))
	week = await readBlocks(page)
	check(
		'end series: no Thursday after it',
		!ofCard(week, CH_A).some((block) => block.date === core.addDays(second, 7)),
		ofCard(week, CH_A)
			.map((block) => block.date)
			.join(',')
	)
	const c = await createCard(page, CH_C, 60, null)
	const cDate = core.addDays(fx.today, 14)
	const seriesC = await api<ScheduleSeriesResponse & Partial<ErrorResponse>>(page, 'POST', '/schedule/lessons', {
		studentId: c,
		date: cDate,
		startTime: '15:00',
		durationMinutes: 60,
		repeats: 'weekly',
	})
	check('series C starting in two weeks created through the api', seriesC.status === 201, String(seriesC.status))
	await goToWeek(page, nav, core.mondayOf(core.addDays(cDate, -7)))
	await goToWeek(page, nav, core.mondayOf(cDate))
	await openBlockDialog(page, CH_C, cDate)
	await dialog.getByRole('button', { name: 'End series' }).click()
	await page.getByRole('dialog').filter({ hasText: 'End this series?' }).waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	await pickDate(page, fx.today, 'end-series-last')
	facts = await seriesDialogFacts(page)
	check(
		'end series C: no lesson remains',
		facts.hint === 'No lessons of this series will remain. Any lessons you moved stay where they are.' &&
			facts.hintClass.includes('text-foreground'),
		`${facts.hint} ${facts.hintClass}`
	)
	await shot(page, 'sched-changes', 'end-series-empty')
	return { week }
}

export async function seriesChangesFinish(
	page: Page,
	dialog: Locator,
	week: {
		selected: string
		transparent: string
		columnWidth: number
		blocks: {
			key: string | undefined
			slot: string | null
			label: string | null
			text: string
			lines: string[]
			title: string | null
			date: string | undefined
			left: number
			width: number
			top: number
			height: number
			background: string
			color: string
			outlineStyle: string
			outlineWidth: string
			decoration: string
		}[]
		description: string
		live: string
		h1: string | undefined
	}
) {
	await page.getByRole('dialog').getByRole('button', { name: 'End series' }).click()
	const removedToast = await toastText(page, 'Series ended', CH_C)
	check(
		'end series C: toast says the series was removed',
		removedToast.includes(`${CH_C}'s series was removed from the schedule.`),
		removedToast
	)
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(500)
	week = await readBlocks(page)
	check('end series C: no blocks of C remain', ofCard(week, CH_C).length === 0, String(ofCard(week, CH_C).length))
}

export async function seriesChanges(
	page: Page,
	fx: Awaited<ReturnType<typeof changesFixtures>>,
	nav: { monday: string },
	posts: { url: string; body: string | null }[],
	before: string[]
) {
	let { dialog, box } = await seriesChangesWholeSeries(page, fx, nav)
	let { facts, sent } = await seriesChangesMoveSeries(page, fx, nav, posts, dialog)
	const seriesChangesMoveSeriesEndsResult = await seriesChangesMoveSeriesEnds(
		page,
		fx,
		nav,
		posts,
		before,
		dialog,
		facts,
		sent
	)
	let week = seriesChangesMoveSeriesEndsResult.week
	let seriesD = seriesChangesMoveSeriesEndsResult.seriesD
	facts = seriesChangesMoveSeriesEndsResult.facts
	const seriesChangesEndSeriesResult = await seriesChangesEndSeries(page, fx, dialog, box, facts, seriesD)
	let second = seriesChangesEndSeriesResult.second
	facts = seriesChangesEndSeriesResult.facts
	const seriesChangesEndSeriesEmptyResult = await seriesChangesEndSeriesEmpty(
		page,
		fx,
		nav,
		dialog,
		facts,
		week,
		second
	)
	week = seriesChangesEndSeriesEmptyResult.week
	await seriesChangesFinish(page, dialog, week)
}
