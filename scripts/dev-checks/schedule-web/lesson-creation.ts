import type { Page, Locator } from '@playwright/test'

import * as core from '../../../packages/core/src/index.ts'
import { check, shot } from '../browser-context.ts'
import { blockLocator } from './block-probes.ts'
import { newButton, dialogFacts, pickOption, pickTime, pickDate } from './dialogs.ts'
import { WEEKDAYS, dayMonth, monthName, dayNum } from './format.ts'
import { goToWeek, VN } from './navigation.ts'
import type { readFixtures } from './read-fixtures.ts'
import { NAME_B, NAME_A } from './read-fixtures.ts'

export async function lessonCreationNewLesson(
	page: Page,
	fx: Awaited<ReturnType<typeof readFixtures>>,
	nav: { monday: string }
) {
	const dialog = page.getByRole('dialog')
	await goToWeek(page, nav, fx.week0)
	check('new lesson: the button is in the page header and enabled', await newButton(page).isEnabled())
	check(
		'new lesson: the button sits in the header actions, not in the toolbar',
		await page.evaluate(() => {
			const button = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
				(node) => node.textContent?.trim() === 'New lesson'
			)
			return (
				Boolean(button?.closest<HTMLElement>('header')) &&
				!button?.closest<HTMLElement>('[data-slot="schedule-toolbar"]')
			)
		})
	)
	await newButton(page).click()
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(500)
	const nowVn = core.zonedParts(new Date(), VN)
	const nextHour = Math.floor(nowVn.minutes / 60) + 1
	const expectedDate = nextHour >= 24 ? core.addDays(nowVn.date, 1) : nowVn.date
	const expectedTime = nextHour >= 24 ? '00:00' : `${String(nextHour).padStart(2, '0')}:00`
	let facts = await dialogFacts(page)
	check(
		'new lesson: title and description',
		facts.text.includes('New lesson') && facts.text.includes('Add a lesson to the schedule. Times are in Vietnam time.')
	)
	check('new lesson: focus starts on Student', facts.focusId === 'new-lesson-student', facts.focusId)
	check('new lesson: Student is empty', facts.student === 'Choose a student', facts.student)
	check(
		'new lesson: defaults are the next whole hour in Vietnam time',
		facts.dateLabel ===
			`Date: ${new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${expectedDate}T12:00:00Z`))}` &&
			facts.time === expectedTime,
		`${facts.dateLabel} ${facts.time}`
	)
	check(
		'new lesson: Length starts at 60 with the card hint',
		facts.length === '60' && facts.text.includes("Taken from the student's usual lesson length. 15 to 240 minutes.")
	)
	check(
		'new lesson: Repeats defaults to Once and the button reads Add lesson',
		facts.repeats === 'Once' && facts.submit?.text === 'Add lesson',
		`${facts.repeats} ${facts.submit?.text}`
	)
	check('new lesson: the dialog body has the scroll fade', facts.bodyFade === true)
	await shot(page, 'sched-read', 'new-lesson')
	return { dialog, expectedDate, facts }
}

export async function lessonCreationTimePicker(
	page: Page,
	dialog: Locator,
	expectedDate: string,
	facts: Awaited<ReturnType<typeof dialogFacts>>
) {
	await dialog.getByRole('button', { name: 'Add lesson' }).click()
	await page.waitForTimeout(300)
	facts = await dialogFacts(page)
	check(
		'new lesson: empty Student gives an error and keeps focus there',
		facts.text.includes('Choose a student.') && facts.focusId === 'new-lesson-student',
		facts.focusId
	)
	await pickOption(page, 'new-lesson-student', NAME_B)
	facts = await dialogFacts(page)
	check('new lesson: choosing a student fills Length from the card', facts.length === '30', facts.length)
	await pickOption(page, 'new-lesson-student', NAME_A)
	facts = await dialogFacts(page)
	check('new lesson: choosing another student replaces an untouched Length', facts.length === '60', facts.length)
	await page.locator('#new-lesson-length').fill('45')
	await pickOption(page, 'new-lesson-student', NAME_B)
	facts = await dialogFacts(page)
	check(
		'new lesson: an edited Length is never overwritten',
		facts.length === '45' && !facts.text.includes('Taken from'),
		facts.length
	)
	await page.locator('#new-lesson-length').fill('5')
	await dialog.getByRole('button', { name: 'Add lesson' }).click()
	await page.waitForTimeout(300)
	facts = await dialogFacts(page)
	check(
		'new lesson: Length outside 15 to 240 is refused',
		facts.text.includes('Use 15 to 240 minutes.') && facts.focusId === 'new-lesson-length',
		facts.focusId
	)
	await page.locator('#new-lesson-length').fill('60')
	await pickTime(page, '02:00')
	facts = await dialogFacts(page)
	check(
		'new lesson: the second zone is shown under Start time, with the weekday when the date differs',
		facts.zone === `${WEEKDAYS[core.weekdayOf(core.addDays(expectedDate, -1)) - 1]} 22:00 MSK`,
		facts.zone
	)
	await pickTime(page, '14:00')
	facts = await dialogFacts(page)
	check('new lesson: and without a day shift', facts.zone === '10:00 MSK', facts.zone)
	await page.locator('#new-lesson-time').click()
	const listFade = await page.evaluate(() => {
		const list = document.querySelector<HTMLElement>('[data-slot="time-picker-column-list"]')
		return list
			? {
					fade: list.classList.contains('scroll-fade'),
					size: getComputedStyle(list).getPropertyValue('--scroll-fade-size').trim(),
				}
			: null
	})
	check(
		'new lesson: Start time columns fade at 24px',
		listFade?.fade === true && listFade.size === '24px',
		JSON.stringify(listFade)
	)
	await shot(page, 'sched-read', 'time-picker')
	return { facts }
}

export async function lessonCreationAfterAdd(
	page: Page,
	fx: Awaited<ReturnType<typeof readFixtures>>,
	dialog: Locator
) {
	await page.getByRole('button', { name: 'Done' }).click()
	await page.waitForTimeout(250)
	await page.getByRole('button', { name: 'Close', exact: true }).click()
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(300)
	check(
		'new lesson: closing returns focus to the New lesson button',
		await page.evaluate(() => document.activeElement?.textContent?.trim() === 'New lesson')
	)
	await newButton(page).click()
	await dialog.waitFor({ timeout: 10000 })
	await pickOption(page, 'new-lesson-student', NAME_A)
	await pickDate(page, fx.thursday)
	await pickTime(page, '14:00')
	await dialog.getByRole('button', { name: 'Add lesson' }).click()
	await page.getByText('Lesson added', { exact: true }).waitFor({ timeout: 15000 })
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	const toast = await page.getByText('Lesson added', { exact: true }).locator('xpath=..').textContent()
	check(
		'new lesson: toast names the card and the time',
		toast!.includes(
			`${NAME_A}, ${new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${fx.thursday}T12:00:00Z`))} ${dayMonth(fx.thursday)}, 14:00 VN.`
		),
		toast
	)
	await page.waitForTimeout(500)
	const created = await blockLocator(page, NAME_A, fx.thursday).evaluate((element) => ({
		top:
			element.getBoundingClientRect().top -
			element.closest<HTMLElement>('[data-slot="week-grid-column"]')!.getBoundingClientRect().top,
		label: element.getAttribute('aria-label'),
	}))
	check(
		'new lesson: the new block stands in Thursday at 14:00 after the reload',
		Math.abs(created.top - 14 * 48) <= 1.5,
		JSON.stringify(created)
	)
	check(
		'new lesson: closing after success returns focus to the button',
		await page.evaluate(() => document.activeElement?.textContent?.trim() === 'New lesson')
	)
	await shot(page, 'sched-read', 'after-add')
}

export async function lessonCreationNewSeries(
	page: Page,
	fx: Awaited<ReturnType<typeof readFixtures>>,
	dialog: Locator,
	facts: Awaited<ReturnType<typeof dialogFacts>>
) {
	await newButton(page).click()
	await dialog.waitFor({ timeout: 10000 })
	await pickOption(page, 'new-lesson-student', NAME_A)
	await pickOption(page, 'new-lesson-repeats', 'Every week')
	await pickDate(page, fx.week1)
	await pickTime(page, '09:00')
	facts = await dialogFacts(page)
	check(
		'new lesson: Every week shows the series note and Add series',
		facts.repeatNote === 'Every Monday at 09:00 VN until you end the series.' && facts.submit?.text === 'Add series',
		`${facts.repeatNote} ${facts.submit?.text}`
	)
	await shot(page, 'sched-read', 'new-series')
	return { facts }
}

export async function lessonCreationOverlap(
	page: Page,
	fx: Awaited<ReturnType<typeof readFixtures>>,
	nav: { monday: string },
	dialog: Locator,
	facts: Awaited<ReturnType<typeof dialogFacts>>
) {
	await pickDate(page, fx.pastDate)
	await dialog.getByRole('button', { name: 'Add series' }).click()
	await page.waitForTimeout(300)
	facts = await dialogFacts(page)
	check(
		'new lesson: a repeating lesson in the past is refused under Date',
		facts.text.includes('Choose today or a later date for a repeating lesson.') && facts.focusId === 'new-lesson-date',
		facts.focusId
	)
	await pickDate(page, fx.week1)
	await dialog.getByRole('button', { name: 'Add series' }).click()
	await page.getByText('Series added', { exact: true }).waitFor({ timeout: 15000 })
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	const seriesToast = await page.getByText('Series added', { exact: true }).locator('xpath=..').textContent()
	check(
		'new lesson: series toast names the weekday and time',
		seriesToast!.includes(`${NAME_A} every Monday at 09:00 VN.`),
		seriesToast
	)
	for (const monday of [fx.week1, fx.week2]) {
		await goToWeek(page, nav, monday)
		const found = await blockLocator(page, NAME_A, monday).count()
		check(`new lesson: the series shows on Monday of week ${monday}`, found === 1, String(found))
	}
	await goToWeek(page, nav, fx.week0)
	const column = page.locator(`[data-slot="week-grid-column"][data-date="${fx.wednesday}"]`)
	await column.click({ position: { x: 12, y: 15 * 48 + 6 } })
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	facts = await dialogFacts(page)
	check(
		'new lesson: a click on empty space opens the dialog on that day and time',
		facts.dateLabel?.includes(`${monthName(fx.wednesday)} ${dayNum(fx.wednesday)}, `) &&
			facts.time === '15:00' &&
			facts.student === 'Choose a student',
		`${facts.dateLabel} ${facts.time}`
	)
	await pickOption(page, 'new-lesson-student', NAME_A)
	await pickTime(page, '18:00')
	facts = await dialogFacts(page)
	check(
		'new lesson: overlapping lessons give a warning with both names',
		facts.overlap !== null &&
			facts.overlap.includes('This overlaps another lesson') &&
			facts.overlap.includes(`${NAME_A} 18:00–19:00 VN`) &&
			facts.overlap.includes(`${NAME_B} 18:30–19:30 VN`) &&
			facts.overlap.includes('You can still save.'),
		facts.overlap ?? 'no banner'
	)
	check('new lesson: the warning never disables saving', facts.submit?.disabled === false)
	await shot(page, 'sched-read', 'overlap')
	return { facts }
}

export async function lessonCreationStudentsError(
	page: Page,
	fx: Awaited<ReturnType<typeof readFixtures>>,
	dialog: Locator,
	facts: Awaited<ReturnType<typeof dialogFacts>>
) {
	await pickTime(page, '16:00')
	facts = await dialogFacts(page)
	check('new lesson: the warning goes away with the overlap', facts.overlap === null)
	await pickTime(page, '18:00')
	await dialog.getByRole('button', { name: 'Add lesson' }).click()
	await page.getByText('Lesson added', { exact: true }).last().waitFor({ timeout: 15000 })
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(500)
	const stacked = await page
		.locator(`[data-slot="week-grid-column"][data-date="${fx.wednesday}"] button[aria-label^="${NAME_A}, "]`)
		.count()
	check('new lesson: the overlapping lesson was saved', stacked >= 2, String(stacked))
	await page.route('**/api/schedule/lessons', (route) =>
		route.request().method() === 'POST' ? route.abort() : route.continue()
	)
	await newButton(page).click()
	await dialog.waitFor({ timeout: 10000 })
	await pickOption(page, 'new-lesson-student', NAME_B)
	await dialog.getByRole('button', { name: 'Add lesson' }).click()
	await page.getByText('Could not add the lesson. Try again.').waitFor({ timeout: 15000 })
	facts = await dialogFacts(page)
	check(
		'new lesson: a server failure keeps the dialog and the values',
		facts.student === NAME_B && facts.submit?.disabled === false,
		facts.student
	)
	await page.unroute('**/api/schedule/lessons')
	await page.getByRole('button', { name: 'Close', exact: true }).click()
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await page.route('**/api/students', async (route) => {
		await new Promise((resolve) => setTimeout(resolve, 2500))
		await route.continue()
	})
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	await page.waitForTimeout(300)
	check('new lesson: the button is disabled while students load', await newButton(page).isDisabled())
	await page.waitForFunction(
		() => {
			const button = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
				(node) => node.textContent?.trim() === 'New lesson'
			)
			return button && !button.disabled
		},
		null,
		{ timeout: 15000 }
	)
	check('new lesson: and enabled once they are loaded', await newButton(page).isEnabled())
	await page.unroute('**/api/students')
	await page.route('**/api/students', (route) => route.abort())
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	await page.waitForTimeout(800)
	await newButton(page).click()
	await dialog.waitFor({ timeout: 10000 })
	facts = await dialogFacts(page)
	check(
		'new lesson: students that fail to load give a banner and no Add',
		facts.text.includes('Could not load students. Close this window and try again.') && facts.submit?.disabled === true
	)
	await shot(page, 'sched-read', 'students-error')
}

export async function lessonCreationFinish(
	page: Page,
	fx: Awaited<ReturnType<typeof readFixtures>>,
	nav: { monday: string },
	dialog: Locator
) {
	await page.keyboard.press('Escape')
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await page.unroute('**/api/students')
	nav.monday = core.mondayOf(fx.today)
}

export async function lessonCreation(
	page: Page,
	fx: Awaited<ReturnType<typeof readFixtures>>,
	nav: { monday: string }
) {
	let { dialog, expectedDate, facts } = await lessonCreationNewLesson(page, fx, nav)
	const lessonCreationTimePickerResult = await lessonCreationTimePicker(page, dialog, expectedDate, facts)
	facts = lessonCreationTimePickerResult.facts
	await lessonCreationAfterAdd(page, fx, dialog)
	const lessonCreationNewSeriesResult = await lessonCreationNewSeries(page, fx, dialog, facts)
	facts = lessonCreationNewSeriesResult.facts
	const lessonCreationOverlapResult = await lessonCreationOverlap(page, fx, nav, dialog, facts)
	facts = lessonCreationOverlapResult.facts
	await lessonCreationStudentsError(page, fx, dialog, facts)
	await lessonCreationFinish(page, fx, nav, dialog)
}
