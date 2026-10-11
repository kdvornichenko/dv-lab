import type { Route } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { ScheduleOccurrenceResponse, ErrorResponse } from '../../../packages/contracts/src/index.ts'
import * as core from '../../../packages/core/src/index.ts'
import { api, check, failures, shot, signIn, sql } from '../browser-context.ts'
import { withBrowser } from '../browser-journey.ts'
import {
	cleanupFixtures,
	setTheme,
	goToWeek,
	createCard,
	setOpening,
	createOnce,
	markApi,
	blockFacts,
	tooltipText,
	HELP_UNMARKED,
	HELP_DEDUCTS,
	HELP_NO_SHOW_OFF,
	HELP_NOT_STARTED,
	HELP_CANCELLED,
	openBlockDialog,
	closeDialog,
	dialogMark,
	waitHelp,
	markRow,
	pill,
} from './common.mjs'
import { marksFixtures, marksPart1 } from './marks-view.mjs'

async function markChoices(page: Page, fx: Awaited<ReturnType<typeof marksFixtures>>, nav: { monday: string | null }) {
	const slow = async (route: Route) => {
		await new Promise((resolve) => setTimeout(resolve, 900))
		await route.continue()
	}

	await goToWeek(page, nav, core.mondayOf(fx.yesterday))
	await openBlockDialog(page, fx.names.none, fx.yesterday)
	let facts = await dialogMark(page)
	check('C dialog: the Mark row is a radiogroup named Mark', facts?.groupName === 'Mark', String(facts?.groupName))
	check(
		'C dialog: three pills in the order Scheduled, Done, No-show, 32px',
		JSON.stringify(facts?.labels) === JSON.stringify(['Scheduled', 'Done', 'No-show']) && facts!.height === 32,
		JSON.stringify(facts?.labels)
	)
	check(
		'C dialog: pills are enabled and Scheduled is chosen',
		facts!.checked === 'Scheduled' && facts!.disabled.every((value) => !value)
	)
	check('C dialog: the helper says Not marked yet', facts!.help === HELP_UNMARKED, facts!.help)
	check('C dialog: the status word is Needs a mark', facts!.status.includes('Needs a mark'), facts!.status)
	check(
		'C dialog: Move lesson and Cancel lesson are there for a started lesson',
		facts!.buttons.includes('Move lesson') && facts!.buttons.includes('Cancel lesson'),
		facts!.buttons.join('|')
	)
	check(
		'C dialog: no line that the lesson cannot be changed',
		!/cannot be changed|already taken place/.test(facts!.text)
	)
	await shot(page, 'ledger-marks', 'dialog-unmarked')

	await page.route('**/api/schedule/lessons/*/mark', (route) => route.fulfill({ status: 500, body: '{}' }))
	await (await pill(page, 'Done')).click()
	await page.waitForTimeout(700)
	facts = await dialogMark(page)
	check(
		'C dialog: a failed save shows the banner',
		facts!.failed?.includes('Could not save the mark. Try again.'),
		String(facts!.failed)
	)
	check(
		'C dialog: a failed save returns the choice to Scheduled',
		facts!.checked === 'Scheduled' && facts!.help === HELP_UNMARKED
	)
	check('C dialog: a failed save wrote nothing', markRow(fx.lessons.none).length === 0)
	await shot(page, 'ledger-marks', 'dialog-failed')
	await page.unroute('**/api/schedule/lessons/*/mark')

	await page.route('**/api/schedule/lessons/*/mark', (route) => route.fulfill({ status: 409, body: '{}' }))
	await (await pill(page, 'Done')).click()
	await page.waitForTimeout(900)
	facts = await dialogMark(page)
	check(
		'C dialog: a stale 409 shows the changed-elsewhere banner',
		facts!.stale?.includes('This lesson was changed elsewhere') && facts!.failed === null,
		String(facts!.stale)
	)
	await page.unroute('**/api/schedule/lessons/*/mark')

	await page.route('**/api/schedule/lessons/*/mark', slow)
	await (await pill(page, 'Done')).click()
	await page.waitForTimeout(250)
	facts = await dialogMark(page)
	check('C dialog: while saving the helper reads Saving…', facts!.help === 'Saving…', facts!.help)
	check(
		'C dialog: while saving every pill is disabled',
		facts!.disabled.every(Boolean),
		JSON.stringify(facts!.disabled)
	)
	await shot(page, 'ledger-marks', 'dialog-saving')
	check('C dialog: Done is saved and explained', await waitHelp(page, HELP_DEDUCTS))
	await page.unroute('**/api/schedule/lessons/*/mark', slow)
	facts = await dialogMark(page)
	check(
		'C dialog: Done is chosen',
		facts!.checked === 'Done' && facts!.status.includes('Done'),
		`${facts!.checked} ${facts!.status}`
	)
	check(
		'C: the lesson_marks row is done',
		JSON.stringify(markRow(fx.lessons.none)) === JSON.stringify([{ kind: 'done' }])
	)
	const blockC = await blockFacts(page, fx.names.none, fx.yesterday)
	check(
		'C: the block behind the dialog got the check',
		blockC.signKind === 'check' && blockC.opacity === '0.6',
		JSON.stringify(blockC)
	)
	await shot(page, 'ledger-marks', 'dialog-done')

	await (await pill(page, 'Scheduled')).click()
	check('C dialog: Scheduled clears the mark', await waitHelp(page, HELP_UNMARKED))
	check(
		'C: the lesson_marks row is none',
		JSON.stringify(markRow(fx.lessons.none)) === JSON.stringify([{ kind: 'none' }])
	)

	await (await pill(page, 'Done')).focus()
	await page.keyboard.press('ArrowRight')
	check('C dialog: ArrowRight moves the choice to No-show', await waitHelp(page, HELP_DEDUCTS))
	facts = await dialogMark(page)
	check('C dialog: No-show is chosen after the arrow', facts!.checked === 'No-show', String(facts!.checked))
	check(
		'C: the lesson_marks row is no_show',
		JSON.stringify(markRow(fx.lessons.none)) === JSON.stringify([{ kind: 'no_show' }])
	)
	await closeDialog(page)
}

async function noShowSetting(
	page: Page,
	fx: Awaited<ReturnType<typeof marksFixtures>>,
	nav: { monday: string | null }
) {
	let facts: Awaited<ReturnType<typeof dialogMark>>
	sql(`update students set no_show_deducts = false where id = '${fx.ids.none}'`)
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	nav.monday = core.mondayOf(fx.today)
	await goToWeek(page, nav, core.mondayOf(fx.yesterday))
	await openBlockDialog(page, fx.names.none, fx.yesterday)
	facts = await dialogMark(page)
	check(
		'C dialog: No-show with the flag off says Deducts nothing',
		facts!.checked === 'No-show' && facts!.help === HELP_NO_SHOW_OFF,
		facts!.help
	)
	await shot(page, 'ledger-marks', 'dialog-no-show-off')
	await closeDialog(page)
	const tipOff = await tooltipText(page, fx.names.none, fx.yesterday)
	check(
		'C tooltip: No-show with the flag off says Deducts nothing',
		tipOff?.includes('No-show') && tipOff.includes('Deducts nothing'),
		tipOff ?? 'none'
	)
	sql(`update students set no_show_deducts = true where id = '${fx.ids.none}'`)
}

async function cancelMarked(page: Page, fx: Awaited<ReturnType<typeof marksFixtures>>) {
	const dialog = page.getByRole('dialog')
	let facts: Awaited<ReturnType<typeof dialogMark>>
	await openBlockDialog(page, fx.names.done, fx.yesterday)
	facts = await dialogMark(page)
	check(
		'A dialog: Done is chosen with the helper',
		facts!.checked === 'Done' && facts!.help === HELP_DEDUCTS,
		facts!.help
	)
	check(
		'A dialog: a started marked lesson has Move lesson and Cancel lesson',
		facts!.buttons.includes('Move lesson') && facts!.buttons.includes('Cancel lesson'),
		facts!.buttons.join('|')
	)
	await dialog.getByRole('button', { name: 'Cancel lesson' }).click()
	await dialog.getByRole('button', { name: 'Yes, cancel' }).click()
	check('A dialog: the lesson is cancelled', await waitHelp(page, HELP_CANCELLED))
	facts = await dialogMark(page)
	check(
		'A dialog: cancelled keeps Done chosen and every pill disabled',
		facts!.checked === 'Done' && facts!.disabled.every(Boolean) && facts!.opacity === '0.5',
		`${facts!.checked} ${JSON.stringify(facts!.disabled)} ${facts!.opacity}`
	)
	check('A dialog: the status word is Cancelled', facts!.status.includes('Cancelled'), facts!.status)
	check(
		'A: the mark row is still done',
		JSON.stringify(markRow(fx.lessons.done)) === JSON.stringify([{ kind: 'done' }])
	)
	check(
		'A dialog: Return to schedule is offered',
		facts!.buttons.includes('Return to schedule'),
		facts!.buttons.join('|')
	)
	await shot(page, 'ledger-marks', 'dialog-cancelled')
	await dialog.getByRole('button', { name: 'Return to schedule' }).click()
	check('A dialog: returned and Done is deducting again', await waitHelp(page, HELP_DEDUCTS))
	facts = await dialogMark(page)
	check(
		'A dialog: Done is chosen and pills are enabled again',
		facts!.checked === 'Done' && facts!.disabled.every((value) => !value)
	)
	await closeDialog(page)
}

async function cancelledUnmarked(
	page: Page,
	fx: Awaited<ReturnType<typeof marksFixtures>>,
	nav: { monday: string | null }
) {
	let facts: Awaited<ReturnType<typeof dialogMark>>
	const neverMarked = await createCard(page, 'Alex Example 2183 B')
	await setOpening(page, neverMarked, fx.opening)
	const cancelledPlain = await createOnce(page, neverMarked, fx.yesterday, '19:00')
	const cancelPlain = await api<ScheduleOccurrenceResponse & Partial<ErrorResponse>>(
		page,
		'POST',
		`/schedule/lessons/${cancelledPlain}/cancel`,
		{}
	)
	check('api cancel of a lesson that never had a mark', cancelPlain.status === 200, String(cancelPlain.status))
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	nav.monday = core.mondayOf(fx.today)
	await goToWeek(page, nav, core.mondayOf(fx.yesterday))
	await openBlockDialog(page, 'Alex Example 2183 B', fx.yesterday)
	facts = await dialogMark(page)
	check(
		'B2 dialog: a cancelled lesson without a mark shows Scheduled chosen and disabled pills',
		facts!.checked === 'Scheduled' && facts!.disabled.every(Boolean) && facts!.help === HELP_CANCELLED,
		`${facts!.checked} ${facts!.help}`
	)
	await closeDialog(page)
}

async function futureUnmarked(
	page: Page,
	fx: Awaited<ReturnType<typeof marksFixtures>>,
	nav: { monday: string | null }
) {
	let facts: Awaited<ReturnType<typeof dialogMark>>
	const future = await createCard(page, 'Alex Example 2183 F')
	await setOpening(page, future, fx.opening)
	await createOnce(page, future, fx.tomorrow, '10:00')
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	nav.monday = core.mondayOf(fx.today)
	await goToWeek(page, nav, core.mondayOf(fx.tomorrow))
	await openBlockDialog(page, 'Alex Example 2183 F', fx.tomorrow)
	facts = await dialogMark(page)
	check(
		'F dialog: a future unmarked lesson has three disabled pills, Scheduled chosen and the reason',
		facts!.checked === 'Scheduled' &&
			facts!.disabled.every(Boolean) &&
			facts!.opacity === '0.5' &&
			facts!.help === HELP_NOT_STARTED,
		`${facts!.checked} ${facts!.help}`
	)
	check(
		'F dialog: the footer still offers Move lesson and Cancel lesson',
		facts!.buttons.includes('Move lesson') && facts!.buttons.includes('Cancel lesson')
	)
	await shot(page, 'ledger-marks', 'dialog-not-started')
	await closeDialog(page)
	const tipFuture = await tooltipText(page, 'Alex Example 2183 F', fx.tomorrow)
	check(
		'F tooltip: a future lesson says Planned and no deduction line',
		tipFuture?.includes('Planned') && !tipFuture.includes('Deducts') && !tipFuture.includes('Click to mark'),
		tipFuture ?? 'none'
	)
}

async function futureMarked(page: Page, fx: Awaited<ReturnType<typeof marksFixtures>>, nav: { monday: string | null }) {
	let facts: Awaited<ReturnType<typeof dialogMark>>
	const carried = await createCard(page, 'Alex Example 2183 G')
	await setOpening(page, carried, fx.opening)
	const carriedLesson = await createOnce(page, carried, fx.yesterday, '07:00')
	await markApi(page, carriedLesson, 'done')
	const moved = await api<ScheduleOccurrenceResponse & Partial<ErrorResponse>>(
		page,
		'POST',
		`/schedule/lessons/${carriedLesson}/move`,
		{
			date: fx.tomorrow,
			startTime: '12:00',
		}
	)
	check('api move of the marked lesson to tomorrow', moved.status === 200, String(moved.status))
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	nav.monday = core.mondayOf(fx.today)
	await goToWeek(page, nav, core.mondayOf(fx.tomorrow))
	const blockG = await blockFacts(page, 'Alex Example 2183 G', fx.tomorrow)
	check(
		'G: a marked lesson moved to the future keeps the check and the 60% dim',
		blockG.signKind === 'check' && blockG.opacity === '0.6',
		JSON.stringify(blockG)
	)
	const tipG = await tooltipText(page, 'Alex Example 2183 G', fx.tomorrow)
	check(
		'G tooltip: Done and Deducts 1 lesson ahead of time',
		tipG?.includes('Done') && tipG.includes('Deducts 1 lesson'),
		tipG ?? 'none'
	)
	await openBlockDialog(page, 'Alex Example 2183 G', fx.tomorrow)
	facts = await dialogMark(page)
	check(
		'G dialog: pills are enabled, Done is chosen and the ordinary helper shows',
		facts!.checked === 'Done' &&
			facts!.disabled.every((value) => !value) &&
			facts!.help === HELP_DEDUCTS &&
			facts!.opacity === '1',
		`${facts!.checked} ${facts!.help} ${facts!.opacity}`
	)
	check('G dialog: the status word is Done', facts!.status.includes('Done'), facts!.status)
	await shot(page, 'ledger-marks', 'dialog-marked-future')
	await (await pill(page, 'Scheduled')).click()
	check('G dialog: the mark of a future lesson can be cleared', await waitHelp(page, HELP_NOT_STARTED))
	facts = await dialogMark(page)
	check(
		'G dialog: after clearing the pills lock again',
		facts!.disabled.every(Boolean) && facts!.checked === 'Scheduled'
	)
	await closeDialog(page)
}

async function marksPart2(page: Page, fx: Awaited<ReturnType<typeof marksFixtures>>, nav: { monday: string | null }) {
	await markChoices(page, fx, nav)
	await noShowSetting(page, fx, nav)
	await cancelMarked(page, fx)
	await cancelledUnmarked(page, fx, nav)
	await futureUnmarked(page, fx, nav)
	await futureMarked(page, fx, nav)
	console.log(failures() === 0 ? 'MARKS_WEB_PART2_OK' : 'MARKS_WEB_PART2_FAIL')
}

export async function marks() {
	cleanupFixtures('marks start')

	await withBrowser(
		{ width: 1440, height: 900 },
		async ({ page, problems }) => {
			await setTheme(page)
			await signIn(page)
			const fx = await marksFixtures(page)
			const nav = { monday: null }
			await marksPart1(page, fx, nav!)
			await marksPart2(page, fx, nav!)
			const real = problems.filter(
				(problem) => !problem.includes('net::ERR_FAILED') && !/status of (400|404|409|500)/.test(problem)
			)
			check('no console problems', real.length === 0, real.slice(0, 2).join(' | '))
		},
		() => cleanupFixtures('marks end')
	)
	if (failures() === 0) console.log('LEDGER_WEB_MARKS_OK')
}
