import * as core from '../../packages/core/src/index.ts'
import { BASE, api, check, env, failures, launch, shot, signIn, sql } from './web.mjs'

const section = process.argv[2]
const dark = process.argv.includes('dark')
const VN = core.SCHEDULE_TIME_ZONE

const fixtureWhere = `(display_name like 'Alex Example 215%' or display_name like 'Alex Example 216%' or display_name like 'Alex Example 217%') and import_key is null`

const cleanupText = `do $$ begin
if to_regclass('lesson_marks') is not null then
delete from lesson_marks where lesson_id in (select id from lessons where student_id in (select id from students where ${fixtureWhere}))
or series_id in (select id from lesson_series where student_id in (select id from students where ${fixtureWhere}));
end if;
if to_regclass('lesson_exceptions') is not null then
delete from lesson_exceptions where series_id in (select id from lesson_series where student_id in (select id from students where ${fixtureWhere}));
end if;
if to_regclass('lessons') is not null then
delete from lessons where student_id in (select id from students where ${fixtureWhere});
end if;
if to_regclass('lesson_series') is not null then
delete from lesson_series where student_id in (select id from students where ${fixtureWhere});
end if;
delete from students where ${fixtureWhere};
end $$`

function cleanupFixtures(label) {
	const before = sql(`select count(*)::int as n from students where ${fixtureWhere}`)
	const found = before.rows?.[0]?.n ?? 0
	const result = sql(cleanupText)
	console.log(`${label}: fixture cards removed ${found}${result.error || result.raw ? ' (cleanup failed)' : ''}`)
	return found
}

function setTheme(page) {
	return page.addInitScript(
		(value) => {
			try {
				localStorage.setItem('theme', value)
			} catch {}
		},
		dark ? 'dark' : 'light'
	)
}

function weeksFrom(from, to) {
	return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / (7 * 86400000))
}

async function openSchedule(page) {
	await page.goto(`${BASE}/schedule`)
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	await page.waitForTimeout(400)
}

async function goToWeek(page, nav, target) {
	const diff = weeksFrom(nav.monday, target)
	for (let step = 0; step < Math.abs(diff); step += 1) await page.keyboard.press(diff > 0 ? 'j' : 'k')
	nav.monday = target
	await page.waitForFunction(
		(expected) => document.querySelector('[data-slot="week-grid-day"]')?.dataset.date === expected,
		target,
		{ timeout: 30000 }
	)
	await page.waitForTimeout(250)
}

async function createCard(page, name, minutes = 60) {
	const result = await api(page, 'POST', '/students', {
		displayName: name,
		rateMinor: null,
		currency: null,
		defaultLessonMinutes: minutes,
		parent: null,
		level: null,
		goals: null,
		timeZone: null,
	})
	check(`${name} card created`, result.status === 201, String(result.status))
	return result.json.student.id
}

async function setOpening(page, studentId, on, hundredths = 0) {
	const result = await api(page, 'PUT', `/students/${studentId}/opening-balance`, { lessonsHundredths: hundredths, on })
	check(`opening balance set for ${studentId.slice(0, 4)}`, result.status === 200, String(result.status))
}

async function createOnce(page, studentId, date, startTime, durationMinutes = 60) {
	const result = await api(page, 'POST', '/schedule/lessons', {
		studentId,
		date,
		startTime,
		durationMinutes,
		repeats: 'once',
	})
	check(`lesson created ${date} ${startTime}`, result.status === 201, String(result.status))
	return result.json.lesson.id
}

async function markApi(page, lessonId, kind) {
	const result = await api(page, 'POST', `/schedule/lessons/${lessonId}/mark`, { kind })
	check(`api mark ${kind}`, result.status === 200, String(result.status))
}

function blockLocator(page, name, date) {
	return page.locator(`[data-slot="week-grid-column"][data-date="${date}"] button[data-key][aria-label^="${name}, "]`)
}

async function blockFacts(page, name, date) {
	const locator = blockLocator(page, name, date).first()
	await locator.waitFor({ timeout: 15000 })
	return locator.evaluate((element) => {
		const title = element.querySelector('span')
		const sign = element.querySelector('[data-slot="block-sign"]')
		const signStyle = sign ? getComputedStyle(sign) : null
		return {
			label: element.getAttribute('aria-label') ?? '',
			opacity: getComputedStyle(element).opacity,
			decoration: title ? getComputedStyle(title).textDecorationLine : '',
			outline: getComputedStyle(element).outlineStyle,
			signKind: sign ? (sign.getAttribute('data-sign') ?? 'dot') : null,
			signWidth: signStyle ? signStyle.width : null,
			signAria: sign ? sign.getAttribute('aria-hidden') : null,
			titlePadding: title ? getComputedStyle(title).paddingRight : null,
			titleRight: title ? title.getBoundingClientRect().right : null,
			signLeft: sign ? sign.getBoundingClientRect().left : null,
		}
	})
}

async function tooltipText(page, name, date) {
	await page.mouse.move(2, 2)
	await page.waitForTimeout(500)
	await blockLocator(page, name, date).first().hover()
	await page
		.locator('[data-slot="event-tooltip"]')
		.waitFor({ timeout: 8000 })
		.catch(() => {})
	await page.waitForTimeout(300)
	const text = await page
		.locator('[data-slot="event-tooltip"]')
		.first()
		.textContent()
		.catch(() => null)
	return text
}

async function marksFixtures(page) {
	const today = core.zonedParts(new Date(), VN).date
	const yesterday = core.addDays(today, -1)
	const opening = core.addDays(today, -2)
	const names = {
		done: 'Alex Example 2150 A',
		noShow: 'Alex Example 2150 B',
		none: 'Alex Example 2150 C',
		cancelled: 'Alex Example 2150 D',
	}
	const ids = {}
	const lessons = {}
	let hour = 9
	for (const [key, name] of Object.entries(names)) {
		ids[key] = await createCard(page, name)
		await setOpening(page, ids[key], opening)
		lessons[key] = await createOnce(page, ids[key], yesterday, `${String(hour).padStart(2, '0')}:00`)
		hour += 2
	}
	await markApi(page, lessons.done, 'done')
	await markApi(page, lessons.noShow, 'no_show')
	await markApi(page, lessons.cancelled, 'done')
	const cancel = await api(page, 'POST', `/schedule/lessons/${lessons.cancelled}/cancel`, {})
	check('api cancel of the marked lesson', cancel.status === 200, String(cancel.status))
	return { today, yesterday, tomorrow: core.addDays(today, 1), opening, names, ids, lessons }
}

async function marksPart1(page, fx, nav) {
	await openSchedule(page)
	nav.monday = core.mondayOf(fx.today)
	await goToWeek(page, nav, core.mondayOf(fx.yesterday))

	const done = await blockFacts(page, fx.names.done, fx.yesterday)
	const noShow = await blockFacts(page, fx.names.noShow, fx.yesterday)
	const none = await blockFacts(page, fx.names.none, fx.yesterday)
	const cancelled = await blockFacts(page, fx.names.cancelled, fx.yesterday)
	await shot(page, 'ledger-marks', 'grid')

	check('C has the warning dot', none.signKind === 'dot' && none.signWidth === '8px', JSON.stringify(none))
	check('C aria-label says needs a mark', none.label.endsWith(', needs a mark'), none.label)
	check('C keeps full opacity', none.opacity === '1', none.opacity)
	check('A is dimmed to 0.6 with a check', done.opacity === '0.6' && done.signKind === 'check', JSON.stringify(done))
	check('A sign is 12px and hidden from assistive tech', done.signWidth === '12px' && done.signAria === 'true')
	check('A aria-label says done', done.label.endsWith(', done'), done.label)
	check(
		'B is dimmed to 0.6 with user-x',
		noShow.opacity === '0.6' && noShow.signKind === 'user-x',
		JSON.stringify(noShow)
	)
	check('B aria-label says no-show', noShow.label.endsWith(', no-show'), noShow.label)
	check(
		'D has a struck name and no sign although a mark is kept',
		cancelled.decoration.includes('line-through') && cancelled.signKind === null,
		JSON.stringify(cancelled)
	)
	check('D aria-label says cancelled', cancelled.label.endsWith(', cancelled'), cancelled.label)
	check('D is not dimmed', cancelled.opacity === '1', cancelled.opacity)
	check(
		'the title keeps 16px at the right of a sign',
		done.titlePadding === '16px' && none.titlePadding === '16px' && done.titleRight - 16 <= done.signLeft + 0.5,
		`${done.titlePadding} ${done.titleRight} ${done.signLeft}`
	)

	const tipA = await tooltipText(page, fx.names.done, fx.yesterday)
	check(
		'tooltip A says Done and Deducts 1 lesson',
		tipA?.includes('Done') && tipA.includes('Deducts 1 lesson'),
		tipA ?? 'none'
	)
	await shot(page, 'ledger-marks', 'tooltip-done')
	const tipB = await tooltipText(page, fx.names.noShow, fx.yesterday)
	check(
		'tooltip B says No-show and Deducts 1 lesson',
		tipB?.includes('No-show') && tipB.includes('Deducts 1 lesson'),
		tipB ?? 'none'
	)
	const tipC = await tooltipText(page, fx.names.none, fx.yesterday)
	check(
		'tooltip C says Needs a mark and Click to mark it.',
		tipC?.includes('Needs a mark') && tipC.includes('Click to mark it.'),
		tipC ?? 'none'
	)
	await shot(page, 'ledger-marks', 'tooltip-needs-mark')
	const tipD = await tooltipText(page, fx.names.cancelled, fx.yesterday)
	check(
		'tooltip D says Cancelled and no deduction line',
		tipD?.includes('Cancelled') && !tipD.includes('Deducts') && !tipD.includes('Click to mark'),
		tipD ?? 'none'
	)
	const focusable = await page.evaluate(
		() =>
			document
				.querySelector('[data-slot="event-tooltip"]')
				?.parentElement?.querySelector('button, a, input, [tabindex]') !== null
	)
	check('tooltip stays not focusable', focusable === false)
	await page.mouse.move(2, 2)
	console.log(failures() === 0 ? 'MARKS_WEB_PART1_OK' : 'MARKS_WEB_PART1_FAIL')
}

const HELP_UNMARKED = 'Not marked yet. Nothing is deducted until you mark it.'
const HELP_DEDUCTS = 'Deducts 1 lesson (60 min).'
const HELP_NO_SHOW_OFF = 'Deducts nothing: No-show deducts a lesson is off for this student.'
const HELP_NOT_STARTED = 'You can mark a lesson once it has started.'
const HELP_CANCELLED =
	'Cancelled lessons deduct nothing. The mark is kept and counts again if you return the lesson to the schedule.'

async function openBlockDialog(page, name, date) {
	await blockLocator(page, name, date).first().click()
	await page.getByRole('dialog').waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
}

async function closeDialog(page) {
	await page.keyboard.press('Escape')
	await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(300)
}

async function dialogMark(page) {
	return page.getByRole('dialog').evaluate((dialog) => {
		const row = dialog.querySelector('[data-slot="lesson-mark-row"]')
		if (!row) return null
		const group = row.querySelector('[role="radiogroup"]')
		const radios = Array.from(row.querySelectorAll('[role="radio"]'))
		return {
			groupName: group?.getAttribute('aria-labelledby')
				? document.getElementById(group.getAttribute('aria-labelledby'))?.textContent
				: null,
			labels: radios.map((radio) => radio.textContent?.trim()),
			checked: radios.find((radio) => radio.getAttribute('aria-checked') === 'true')?.textContent?.trim() ?? null,
			disabled: radios.map((radio) => radio.hasAttribute('data-disabled')),
			height: radios[0]?.getBoundingClientRect().height ?? 0,
			opacity: group ? getComputedStyle(group).opacity : null,
			help: row.querySelector('[data-slot="lesson-mark-help"]')?.textContent ?? '',
			failed: dialog.querySelector('[data-slot="lesson-mark-failed"]')?.textContent ?? null,
			stale: dialog.querySelector('[data-slot="lesson-stale"]')?.textContent ?? null,
			status: dialog.querySelector('[data-slot="lesson-mark-row"]')?.previousElementSibling?.textContent ?? '',
			text: dialog.textContent ?? '',
			buttons: Array.from(dialog.querySelectorAll('button')).map((button) => button.textContent?.trim()),
		}
	})
}

async function waitHelp(page, text) {
	return page
		.waitForFunction(
			(expected) => document.querySelector('[data-slot="lesson-mark-help"]')?.textContent === expected,
			text,
			{ timeout: 15000 }
		)
		.then(() => true)
		.catch(() => false)
}

function markRow(id) {
	return sql(`select kind from lesson_marks where lesson_id = '${id}'`).rows ?? []
}

async function pill(page, label) {
	return page.getByRole('dialog').getByRole('radio', { name: label, exact: true })
}

async function marksPart2(page, fx, nav) {
	const dialog = page.getByRole('dialog')
	const slow = async (route) => {
		await new Promise((resolve) => setTimeout(resolve, 900))
		await route.continue()
	}

	await goToWeek(page, nav, core.mondayOf(fx.yesterday))
	await openBlockDialog(page, fx.names.none, fx.yesterday)
	let facts = await dialogMark(page)
	check('C dialog: the Mark row is a radiogroup named Mark', facts?.groupName === 'Mark', String(facts?.groupName))
	check(
		'C dialog: three pills in the order Scheduled, Done, No-show, 32px',
		JSON.stringify(facts?.labels) === JSON.stringify(['Scheduled', 'Done', 'No-show']) && facts.height === 32,
		JSON.stringify(facts?.labels)
	)
	check(
		'C dialog: pills are enabled and Scheduled is chosen',
		facts.checked === 'Scheduled' && facts.disabled.every((value) => !value)
	)
	check('C dialog: the helper says Not marked yet', facts.help === HELP_UNMARKED, facts.help)
	check('C dialog: the status word is Needs a mark', facts.status.includes('Needs a mark'), facts.status)
	check(
		'C dialog: Move lesson and Cancel lesson are there for a started lesson',
		facts.buttons.includes('Move lesson') && facts.buttons.includes('Cancel lesson'),
		facts.buttons.join('|')
	)
	check(
		'C dialog: no line that the lesson cannot be changed',
		!/cannot be changed|already taken place/.test(facts.text)
	)
	await shot(page, 'ledger-marks', 'dialog-unmarked')

	await page.route('**/api/schedule/lessons/*/mark', (route) => route.fulfill({ status: 500, body: '{}' }))
	await (await pill(page, 'Done')).click()
	await page.waitForTimeout(700)
	facts = await dialogMark(page)
	check(
		'C dialog: a failed save shows the banner',
		facts.failed?.includes('Could not save the mark. Try again.'),
		String(facts.failed)
	)
	check(
		'C dialog: a failed save returns the choice to Scheduled',
		facts.checked === 'Scheduled' && facts.help === HELP_UNMARKED
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
		facts.stale?.includes('This lesson was changed elsewhere') && facts.failed === null,
		String(facts.stale)
	)
	await page.unroute('**/api/schedule/lessons/*/mark')

	await page.route('**/api/schedule/lessons/*/mark', slow)
	await (await pill(page, 'Done')).click()
	await page.waitForTimeout(250)
	facts = await dialogMark(page)
	check('C dialog: while saving the helper reads Saving…', facts.help === 'Saving…', facts.help)
	check('C dialog: while saving every pill is disabled', facts.disabled.every(Boolean), JSON.stringify(facts.disabled))
	await shot(page, 'ledger-marks', 'dialog-saving')
	check('C dialog: Done is saved and explained', await waitHelp(page, HELP_DEDUCTS))
	await page.unroute('**/api/schedule/lessons/*/mark', slow)
	facts = await dialogMark(page)
	check(
		'C dialog: Done is chosen',
		facts.checked === 'Done' && facts.status.includes('Done'),
		`${facts.checked} ${facts.status}`
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
	check('C dialog: No-show is chosen after the arrow', facts.checked === 'No-show', String(facts.checked))
	check(
		'C: the lesson_marks row is no_show',
		JSON.stringify(markRow(fx.lessons.none)) === JSON.stringify([{ kind: 'no_show' }])
	)
	await closeDialog(page)

	sql(`update students set no_show_deducts = false where id = '${fx.ids.none}'`)
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	nav.monday = core.mondayOf(fx.today)
	await goToWeek(page, nav, core.mondayOf(fx.yesterday))
	await openBlockDialog(page, fx.names.none, fx.yesterday)
	facts = await dialogMark(page)
	check(
		'C dialog: No-show with the flag off says Deducts nothing',
		facts.checked === 'No-show' && facts.help === HELP_NO_SHOW_OFF,
		facts.help
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

	await openBlockDialog(page, fx.names.done, fx.yesterday)
	facts = await dialogMark(page)
	check('A dialog: Done is chosen with the helper', facts.checked === 'Done' && facts.help === HELP_DEDUCTS, facts.help)
	check(
		'A dialog: a started marked lesson has Move lesson and Cancel lesson',
		facts.buttons.includes('Move lesson') && facts.buttons.includes('Cancel lesson'),
		facts.buttons.join('|')
	)
	await dialog.getByRole('button', { name: 'Cancel lesson' }).click()
	await dialog.getByRole('button', { name: 'Yes, cancel' }).click()
	check('A dialog: the lesson is cancelled', await waitHelp(page, HELP_CANCELLED))
	facts = await dialogMark(page)
	check(
		'A dialog: cancelled keeps Done chosen and every pill disabled',
		facts.checked === 'Done' && facts.disabled.every(Boolean) && facts.opacity === '0.5',
		`${facts.checked} ${JSON.stringify(facts.disabled)} ${facts.opacity}`
	)
	check('A dialog: the status word is Cancelled', facts.status.includes('Cancelled'), facts.status)
	check(
		'A: the mark row is still done',
		JSON.stringify(markRow(fx.lessons.done)) === JSON.stringify([{ kind: 'done' }])
	)
	check(
		'A dialog: Return to schedule is offered',
		facts.buttons.includes('Return to schedule'),
		facts.buttons.join('|')
	)
	await shot(page, 'ledger-marks', 'dialog-cancelled')
	await dialog.getByRole('button', { name: 'Return to schedule' }).click()
	check('A dialog: returned and Done is deducting again', await waitHelp(page, HELP_DEDUCTS))
	facts = await dialogMark(page)
	check(
		'A dialog: Done is chosen and pills are enabled again',
		facts.checked === 'Done' && facts.disabled.every((value) => !value)
	)
	await closeDialog(page)
	const neverMarked = await createCard(page, 'Alex Example 2151 B')
	await setOpening(page, neverMarked, fx.opening)
	const cancelledPlain = await createOnce(page, neverMarked, fx.yesterday, '19:00')
	const cancelPlain = await api(page, 'POST', `/schedule/lessons/${cancelledPlain}/cancel`, {})
	check('api cancel of a lesson that never had a mark', cancelPlain.status === 200, String(cancelPlain.status))
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	nav.monday = core.mondayOf(fx.today)
	await goToWeek(page, nav, core.mondayOf(fx.yesterday))
	await openBlockDialog(page, 'Alex Example 2151 B', fx.yesterday)
	facts = await dialogMark(page)
	check(
		'B2 dialog: a cancelled lesson without a mark shows Scheduled chosen and disabled pills',
		facts.checked === 'Scheduled' && facts.disabled.every(Boolean) && facts.help === HELP_CANCELLED,
		`${facts.checked} ${facts.help}`
	)
	await closeDialog(page)

	const future = await createCard(page, 'Alex Example 2151 F')
	await setOpening(page, future, fx.opening)
	await createOnce(page, future, fx.tomorrow, '10:00')
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	nav.monday = core.mondayOf(fx.today)
	await goToWeek(page, nav, core.mondayOf(fx.tomorrow))
	await openBlockDialog(page, 'Alex Example 2151 F', fx.tomorrow)
	facts = await dialogMark(page)
	check(
		'F dialog: a future unmarked lesson has three disabled pills, Scheduled chosen and the reason',
		facts.checked === 'Scheduled' &&
			facts.disabled.every(Boolean) &&
			facts.opacity === '0.5' &&
			facts.help === HELP_NOT_STARTED,
		`${facts.checked} ${facts.help}`
	)
	check(
		'F dialog: the footer still offers Move lesson and Cancel lesson',
		facts.buttons.includes('Move lesson') && facts.buttons.includes('Cancel lesson')
	)
	await shot(page, 'ledger-marks', 'dialog-not-started')
	await closeDialog(page)
	const tipFuture = await tooltipText(page, 'Alex Example 2151 F', fx.tomorrow)
	check(
		'F tooltip: a future lesson says Planned and no deduction line',
		tipFuture?.includes('Planned') && !tipFuture.includes('Deducts') && !tipFuture.includes('Click to mark'),
		tipFuture ?? 'none'
	)

	const carried = await createCard(page, 'Alex Example 2151 G')
	await setOpening(page, carried, fx.opening)
	const carriedLesson = await createOnce(page, carried, fx.yesterday, '07:00')
	await markApi(page, carriedLesson, 'done')
	const moved = await api(page, 'POST', `/schedule/lessons/${carriedLesson}/move`, {
		date: fx.tomorrow,
		startTime: '12:00',
	})
	check('api move of the marked lesson to tomorrow', moved.status === 200, String(moved.status))
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	nav.monday = core.mondayOf(fx.today)
	await goToWeek(page, nav, core.mondayOf(fx.tomorrow))
	const blockG = await blockFacts(page, 'Alex Example 2151 G', fx.tomorrow)
	check(
		'G: a marked lesson moved to the future keeps the check and the 60% dim',
		blockG.signKind === 'check' && blockG.opacity === '0.6',
		JSON.stringify(blockG)
	)
	const tipG = await tooltipText(page, 'Alex Example 2151 G', fx.tomorrow)
	check(
		'G tooltip: Done and Deducts 1 lesson ahead of time',
		tipG?.includes('Done') && tipG.includes('Deducts 1 lesson'),
		tipG ?? 'none'
	)
	await openBlockDialog(page, 'Alex Example 2151 G', fx.tomorrow)
	facts = await dialogMark(page)
	check(
		'G dialog: pills are enabled, Done is chosen and the ordinary helper shows',
		facts.checked === 'Done' &&
			facts.disabled.every((value) => !value) &&
			facts.help === HELP_DEDUCTS &&
			facts.opacity === '1',
		`${facts.checked} ${facts.help} ${facts.opacity}`
	)
	check('G dialog: the status word is Done', facts.status.includes('Done'), facts.status)
	await shot(page, 'ledger-marks', 'dialog-marked-future')
	await (await pill(page, 'Scheduled')).click()
	check('G dialog: the mark of a future lesson can be cleared', await waitHelp(page, HELP_NOT_STARTED))
	facts = await dialogMark(page)
	check('G dialog: after clearing the pills lock again', facts.disabled.every(Boolean) && facts.checked === 'Scheduled')
	await closeDialog(page)
	console.log(failures() === 0 ? 'MARKS_WEB_PART2_OK' : 'MARKS_WEB_PART2_FAIL')
}

async function marks() {
	cleanupFixtures('marks start')
	const { browser, page, problems } = await launch({ width: 1440, height: 900 })
	try {
		await setTheme(page)
		await signIn(page)
		const fx = await marksFixtures(page)
		const nav = { monday: null }
		await marksPart1(page, fx, nav)
		await marksPart2(page, fx, nav)
		const real = problems.filter(
			(problem) => !problem.includes('net::ERR_FAILED') && !/status of (400|404|409|500)/.test(problem)
		)
		check('no console problems', real.length === 0, real.slice(0, 2).join(' | '))
	} finally {
		await browser.close()
		cleanupFixtures('marks end')
	}
	if (failures() === 0) console.log('LEDGER_WEB_MARKS_OK')
}

const loginLiteral = `'${String(env.DEV_TEACHER_LOGIN).replaceAll("'", "''")}'`
const teacherAccount = `select id from accounts where login = ${loginLiteral} and role = 'teacher'`

function readSettingsRow() {
	const result = sql(`select pays_soon_lessons as value from teacher_settings where account_id in (${teacherAccount})`)
	const rows = result.rows ?? []
	return rows.length === 0 ? { existed: false, value: null } : { existed: true, value: rows[0].value }
}

function restoreSettingsRow(original) {
	const where = `account_id in (${teacherAccount})`
	const result = original.existed
		? sql(`update teacher_settings set pays_soon_lessons = ${Number(original.value)} where ${where}`)
		: sql(`delete from teacher_settings where ${where}`)
	const now = readSettingsRow()
	const same = now.existed === original.existed && now.value === original.value
	check(
		'teacher settings are back to the state before the run',
		same && !result.error,
		`existed ${original.existed} value ${original.value} -> existed ${now.existed} value ${now.value}`
	)
}

async function setThreshold(page, value) {
	const result = await api(page, 'PATCH', '/settings', { paysSoonLessons: value })
	check(`api threshold set to ${value}`, result.status === 200, String(result.status))
}

async function withTeacherSettings(run) {
	const original = readSettingsRow()
	console.log(`teacher settings before: row ${original.existed ? 'present' : 'absent'}`)
	try {
		await run()
	} finally {
		restoreSettingsRow(original)
	}
}

async function openStudentsList(page) {
	await page.goto(`${BASE}/students`)
	await page.getByRole('heading', { name: 'Students', level: 1 }).waitFor({ timeout: 30000 })
	await page.getByRole('tab', { name: 'Active', exact: true }).waitFor({ timeout: 15000 })
	await page.locator('tbody tr').first().waitFor({ timeout: 15000 })
}

function balanceFacts(page, name) {
	return page
		.locator('tbody tr', { hasText: name })
		.first()
		.evaluate((row) => {
			const heads = Array.from(row.closest('table').querySelectorAll('thead th'))
			const head = heads[3]
			const cell = row.querySelectorAll('td')[3]
			const line = cell.firstElementChild
			const text = line.lastElementChild
			const dot = cell.querySelector('[role="img"]')
			const mark = dot?.querySelector('i')
			const link = row.querySelector('a')
			return {
				heading: head.textContent?.trim() ?? '',
				headingAlign: getComputedStyle(head).textAlign,
				headLeft: head.getBoundingClientRect().left + parseFloat(getComputedStyle(head).paddingLeft),
				text: text.textContent ?? '',
				textClass: text.className,
				textColor: getComputedStyle(text).color,
				nameColor: link ? getComputedStyle(link).color : '',
				dotLabel: dot?.getAttribute('aria-label') ?? null,
				dotTone: mark ? Array.from(mark.classList).find((item) => item.startsWith('bg-')) : null,
				dotSlot: dot ? dot.getBoundingClientRect().width : null,
				dotLeft: mark ? mark.getBoundingClientRect().left : null,
				textLeft: text.getBoundingClientRect().left,
				cellText: cell.textContent?.trim() ?? '',
			}
		})
}

const BALANCE_FIXTURES = [
	{ name: 'Alex Example 2160 A', text: '10 lessons left', label: 'Plenty left', tone: 'bg-success' },
	{ name: 'Alex Example 2160 B', text: '1 lesson left', label: 'Pays soon', tone: 'bg-info' },
	{ name: 'Alex Example 2160 C', text: '0 lessons left', label: 'No lessons left', tone: 'bg-warning' },
	{ name: 'Alex Example 2160 E', text: 'owes 1.5 lessons', label: 'Owes lessons', tone: 'bg-destructive' },
	{ name: 'Alex Example 2160 D', text: 'Not set', label: null, tone: null },
]

async function studentsFixtures(page) {
	const today = core.zonedParts(new Date(), VN).date
	const yesterday = core.addDays(today, -1)
	const opening = core.addDays(today, -3)
	const ids = {}
	for (const item of BALANCE_FIXTURES) ids[item.name] = await createCard(page, item.name)
	await setOpening(page, ids['Alex Example 2160 A'], opening, 1000)
	await setOpening(page, ids['Alex Example 2160 B'], opening, 100)
	await setOpening(page, ids['Alex Example 2160 C'], opening, 0)
	await setOpening(page, ids['Alex Example 2160 E'], opening, 0)
	const debt = await createOnce(page, ids['Alex Example 2160 E'], yesterday, '09:00', 90)
	await markApi(page, debt, 'done')
	const flagged = await createCard(page, 'Alex Example 2161 A')
	await setOpening(page, flagged, opening, 0)
	const absence = await createOnce(page, flagged, yesterday, '08:00')
	await markApi(page, absence, 'no_show')
	ids['Alex Example 2161 A'] = flagged
	return { today, yesterday, opening, ids }
}

async function studentsPart1(page) {
	await openStudentsList(page)
	let leftOfText = null
	for (const item of BALANCE_FIXTURES) {
		const facts = await balanceFacts(page, item.name)
		check(`${item.name}: cell says ${item.text}`, facts.text === item.text, facts.text)
		check(`${item.name}: dot label is ${item.label ?? 'absent'}`, facts.dotLabel === item.label, String(facts.dotLabel))
		check(`${item.name}: dot tone is ${item.tone ?? 'absent'}`, facts.dotTone === item.tone, String(facts.dotTone))
		check(`${item.name}: no minus sign in the cell`, !/[-\u2212]/.test(facts.cellText), facts.cellText)
		if (item.label === null) {
			check(`${item.name}: Not set is muted`, facts.textClass.includes('text-muted-foreground'), facts.textClass)
		} else {
			check(
				`${item.name}: the text is not coloured by the state`,
				!facts.textClass.includes('destructive') && facts.textColor === facts.nameColor,
				`${facts.textColor} / ${facts.nameColor}`
			)
			check(`${item.name}: the dot has a 24px hit area`, facts.dotSlot === 24, String(facts.dotSlot))
			check(
				`${item.name}: the dot starts where the heading text starts`,
				Math.abs(facts.dotLeft - facts.headLeft) < 0.6,
				`${facts.dotLeft} / ${facts.headLeft}`
			)
		}
		check(`${item.name}: the text follows the dot slot by 16px`, Math.abs(facts.textLeft - facts.headLeft - 16) < 0.6)
		leftOfText ??= facts.textLeft
		check(`${item.name}: text column is aligned`, Math.abs(facts.textLeft - leftOfText) < 0.6)
		check(
			`${item.name}: heading is Balance and left aligned`,
			facts.heading === 'Balance' && /left|start/.test(facts.headingAlign)
		)
	}
	await shot(page, 'ledger-students', 'balance-column')
	const dot = page
		.locator('tbody tr', { hasText: 'Alex Example 2160 E' })
		.first()
		.locator('[role="img"][aria-label="Owes lessons"]')
	await dot.hover()
	await page.waitForTimeout(400)
	const tip = await page
		.getByText('Owes lessons', { exact: true })
		.first()
		.isVisible()
		.catch(() => false)
	check('the dot tooltip names the state', tip)
	await page.mouse.move(2, 2)
	console.log(failures() === 0 ? 'STUDENTS_WEB_PART1_OK' : 'STUDENTS_WEB_PART1_FAIL')
}

async function openProfile(page, id) {
	await page.goto(`${BASE}/students/${id}`)
	await page.locator('#student-opening-balance').waitFor({ timeout: 30000 })
	await page.waitForTimeout(300)
}

function profileFacts(page) {
	return page.evaluate(() => {
		const panel = document.querySelector('#student-opening-balance').closest('section')
		const row = Array.from(panel.querySelectorAll('div')).find(
			(item) => item.firstElementChild?.textContent === 'Balance now'
		)
		const value = row?.lastElementChild
		const dots = Array.from(document.querySelectorAll('main [role="img"]')).filter((item) => !panel.contains(item))
		const summaryDot = dots.find(
			(item) => !['Active', 'Archived', 'Deactivated'].includes(item.getAttribute('aria-label'))
		)
		const summary = summaryDot?.parentElement
		const noShow = Array.from(document.querySelectorAll('dt')).find((item) => item.textContent === 'No-show')
		const noShowValue = noShow?.nextElementSibling
		const parts = noShowValue?.firstElementChild
		return {
			summaryText: summary?.lastElementChild?.textContent ?? null,
			summaryLabel: summaryDot?.getAttribute('aria-label') ?? null,
			summaryColor: summary?.lastElementChild ? getComputedStyle(summary.lastElementChild).color : null,
			nowText: value?.textContent ?? null,
			nowDots: panel.querySelectorAll('[role="img"]').length,
			noShowText: noShowValue?.textContent ?? null,
			noShowMuted: parts ? parts.className.includes('text-muted-foreground') : false,
			noShowLabelWidth: noShow ? noShow.getBoundingClientRect().width : null,
			noShowOrder: Array.from(document.querySelectorAll('dt')).map((item) => item.textContent),
			setButton: Array.from(document.querySelectorAll('button')).some(
				(item) => item.textContent?.trim() === 'Set opening balance'
			),
		}
	})
}

async function openEdit(page) {
	await page.getByRole('button', { name: 'Edit details' }).click()
	const dialog = page.getByRole('dialog')
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	return dialog
}

function noShowSwitch(dialog) {
	return dialog.getByRole('switch', { name: 'No-show deducts a lesson' })
}

async function saveEdit(page, dialog) {
	const [request] = await Promise.all([
		page.waitForRequest((item) => item.method() === 'PATCH' && /\/api\/students\/[^/]+$/.test(item.url())),
		dialog.getByRole('button', { name: 'Save changes' }).click(),
	])
	await dialog.waitFor({ state: 'detached', timeout: 15000 })
	await page.waitForTimeout(600)
	return request.postData() ?? ''
}

async function studentsPart2(page, fx) {
	const debtId = fx.ids['Alex Example 2160 E']
	await openProfile(page, debtId)
	let facts = await profileFacts(page)
	check(
		'profile E: the summary says owes 1.5 lessons',
		facts.summaryText === 'owes 1.5 lessons',
		String(facts.summaryText)
	)
	check(
		'profile E: the summary dot says Owes lessons',
		facts.summaryLabel === 'Owes lessons',
		String(facts.summaryLabel)
	)
	check(
		'profile E: Balance now says owes 1.5 lessons without a dot',
		facts.nowText === 'owes 1.5 lessons' && facts.nowDots === 0,
		`${facts.nowText} ${facts.nowDots}`
	)
	check('profile E: no Set opening balance button for a set balance', facts.setButton === false)
	check(
		'profile E: Details has No-show between Lesson length and Parent',
		JSON.stringify(facts.noShowOrder.slice(0, 4)) === JSON.stringify(['Rate', 'Lesson length', 'No-show', 'Parent']),
		facts.noShowOrder.join('|')
	)
	check(
		'profile E: Details says Deducts a lesson in foreground',
		facts.noShowText === 'Deducts a lesson' && facts.noShowMuted === false,
		String(facts.noShowText)
	)
	check('profile E: the No-show label is 128px', facts.noShowLabelWidth === 128, String(facts.noShowLabelWidth))
	await shot(page, 'ledger-students', 'profile-debt')

	await openProfile(page, fx.ids['Alex Example 2160 D'])
	facts = await profileFacts(page)
	check(
		'profile D: Balance now says Not set and the button stays',
		facts.nowText === 'Not set' && facts.setButton === true && facts.summaryText === null,
		`${facts.nowText} ${facts.setButton}`
	)

	const flagged = fx.ids['Alex Example 2161 A']
	await openProfile(page, flagged)
	facts = await profileFacts(page)
	check(
		'profile F: owes 1 lesson while the no-show deducts',
		facts.summaryText === 'owes 1 lesson' && facts.summaryLabel === 'Owes lessons',
		String(facts.summaryText)
	)
	let dialog = await openEdit(page)
	const toggle = noShowSwitch(dialog)
	check('form: the switch is on', (await toggle.getAttribute('aria-checked')) === 'true')
	const geometry = await dialog.evaluate((element) => {
		const lesson = element.querySelector('#student-form-lesson').getBoundingClientRect()
		const control = element.querySelector('[role="switch"]').getBoundingClientRect()
		const helper = element.querySelector('#student-form-no-show-helper')
		const row = control.top
		return {
			lessonBottom: lesson.bottom,
			switchTop: row,
			helperTop: helper.getBoundingClientRect().top,
			helperText: helper.textContent,
			switchRight: control.right,
			dialogRight: element.getBoundingClientRect().right,
		}
	})
	check(
		'form: the switch row sits under Lesson length',
		geometry.switchTop > geometry.lessonBottom - 1,
		`${geometry.lessonBottom} / ${geometry.switchTop}`
	)
	check(
		'form: the helper is under the label',
		geometry.helperTop > geometry.switchTop,
		`${geometry.switchTop} / ${geometry.helperTop}`
	)
	check(
		'form: the helper text is the spec text',
		geometry.helperText ===
			"A no-show takes the lesson's length from the balance. Turn this off to deduct nothing for any no-show of this student, past ones too; the balance is recalculated.",
		String(geometry.helperText)
	)
	check(
		'form: the switch is at the right edge',
		geometry.dialogRight - geometry.switchRight < 60,
		`${geometry.dialogRight - geometry.switchRight}`
	)
	await shot(page, 'ledger-students', 'form-on')
	await dialog.getByText('No-show deducts a lesson', { exact: true }).click()
	check('form: a click on the label turns the switch off', (await toggle.getAttribute('aria-checked')) === 'false')
	check('form: the dialog stays open after the toggle', await dialog.isVisible())
	const before = await api(page, 'GET', `/students/${flagged}`)
	check(
		'form: nothing is saved by the switch itself',
		before.json?.student?.noShowDeducts === true,
		String(before.json?.student?.noShowDeducts)
	)
	await shot(page, 'ledger-students', 'form-off')
	let body = await saveEdit(page, dialog)
	check('form: Save changes sends noShowDeducts false', body.includes('"noShowDeducts":false'), body.slice(0, 200))
	facts = await profileFacts(page)
	check(
		'profile F: Details says Deducts nothing in muted',
		facts.noShowText === 'Deducts nothing' && facts.noShowMuted === true,
		String(facts.noShowText)
	)
	check(
		'profile F: the balance is recalculated to 0 lessons left',
		facts.summaryText === '0 lessons left' &&
			facts.summaryLabel === 'No lessons left' &&
			facts.nowText === '0 lessons left',
		`${facts.summaryText} ${facts.nowText}`
	)
	await shot(page, 'ledger-students', 'profile-flag-off')
	await openStudentsList(page)
	let table = await balanceFacts(page, 'Alex Example 2161 A')
	check(
		'table F: the balance grew to 0 lessons left',
		table.text === '0 lessons left' && table.dotLabel === 'No lessons left',
		table.text
	)

	await openProfile(page, flagged)
	dialog = await openEdit(page)
	const again = noShowSwitch(dialog)
	check(
		'form: the switch is off for a student with the flag off',
		(await again.getAttribute('aria-checked')) === 'false'
	)
	await again.focus()
	await page.keyboard.press('Space')
	check('form: Space turns the switch on', (await again.getAttribute('aria-checked')) === 'true')
	body = await saveEdit(page, dialog)
	check('form: Save changes sends noShowDeducts true', body.includes('"noShowDeducts":true'), body.slice(0, 200))
	facts = await profileFacts(page)
	check(
		'profile F: Deducts a lesson and owes 1 lesson again',
		facts.noShowText === 'Deducts a lesson' && facts.summaryText === 'owes 1 lesson',
		`${facts.noShowText} ${facts.summaryText}`
	)

	await openStudentsList(page)
	await page.getByRole('button', { name: 'New student' }).click()
	dialog = page.getByRole('dialog')
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	check(
		'new student: the switch is on by default',
		(await noShowSwitch(dialog).getAttribute('aria-checked')) === 'true'
	)
	await shot(page, 'ledger-students', 'form-new')
	await dialog.getByRole('button', { name: 'Discard changes' }).click()
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	console.log(failures() === 0 ? 'STUDENTS_WEB_PART2_OK' : 'STUDENTS_WEB_PART2_FAIL')
}

async function students() {
	cleanupFixtures('students start')
	await withTeacherSettings(async () => {
		const { browser, page, problems } = await launch({ width: 1440, height: 900 })
		try {
			await setTheme(page)
			await signIn(page)
			await setThreshold(page, 2)
			const fx = await studentsFixtures(page)
			await studentsPart1(page)
			await studentsPart2(page, fx)
			const real = problems.filter(
				(problem) => !problem.includes('net::ERR_FAILED') && !/status of (400|404|409|500)/.test(problem)
			)
			check('no console problems', real.length === 0, real.slice(0, 2).join(' | '))
		} finally {
			await browser.close()
			cleanupFixtures('students end')
		}
	})
	if (failures() === 0) console.log('LEDGER_WEB_STUDENTS_OK')
}

async function paysSoonThreshold(page) {
	const result = await api(page, 'GET', '/settings')
	return result.json?.settings?.paysSoonLessons ?? null
}

async function waitThreshold(page, expected) {
	for (let attempt = 0; attempt < 40; attempt += 1) {
		if ((await paysSoonThreshold(page)) === expected) return true
		await page.waitForTimeout(250)
	}
	return false
}

async function settingsSection() {
	cleanupFixtures('settings start')
	await withTeacherSettings(async () => {
		const { browser, page, problems } = await launch({ width: 1440, height: 900 })
		const patches = []
		try {
			await setTheme(page)
			await signIn(page)
			page.on('request', (request) => {
				if (request.method() === 'PATCH' && request.url().endsWith('/api/settings')) patches.push(request.postData())
			})
			await setThreshold(page, 2)
			const holder = await createCard(page, 'Alex Example 2166 A')
			await setOpening(page, holder, core.addDays(core.zonedParts(new Date(), VN).date, -3), 300)

			await openStudentsList(page)
			let facts = await balanceFacts(page, 'Alex Example 2166 A')
			check(
				'threshold 2: three lessons left is Plenty left',
				facts.text === '3 lessons left' && facts.dotLabel === 'Plenty left',
				`${facts.text} ${facts.dotLabel}`
			)

			await page.goto(`${BASE}/settings`)
			const input = page.getByLabel('Pays soon threshold (lessons)')
			await page.locator('#settings-payments').waitFor({ timeout: 30000 })
			await page.waitForFunction(() => document.querySelector('#settings-pays-soon')?.value === '2', null, {
				timeout: 15000,
			})
			const card = await page.evaluate(() => {
				const titles = Array.from(document.querySelectorAll('h2')).map((item) => item.textContent)
				const field = document.querySelector('#settings-pays-soon')
				const panel = document.querySelector('#settings-payments').closest('section')
				return {
					titles,
					width: field.getBoundingClientRect().width,
					align: getComputedStyle(field).textAlign,
					numeric: getComputedStyle(field).fontVariantNumeric,
					text: panel.textContent,
				}
			})
			check(
				'settings: Payments follows Time zones',
				JSON.stringify(card.titles.slice(-2)) === JSON.stringify(['Time zones', 'Payments']),
				card.titles.join('|')
			)
			check(
				'settings: the field is 96px, right aligned and tabular',
				card.width === 96 && /right|end/.test(card.align) && card.numeric.includes('tabular-nums'),
				`${card.width} ${card.align} ${card.numeric}`
			)
			check(
				'settings: description, hint and caption are there',
				card.text.includes('Decide when a student counts as paying soon.') &&
					card.text.includes('Students with this many lessons left or fewer appear in Pays soon on Today.') &&
					card.text.includes('Saved to your account.')
			)
			await shot(page, 'ledger-settings', 'payments')

			await input.fill('3')
			await input.blur()
			await page.getByText('Pays soon threshold: 3 lessons.').waitFor({ timeout: 10000 })
			check('save by blur: the toast says Saved', await page.getByText('Saved', { exact: true }).first().isVisible())
			check('save by blur: GET /settings is 3', (await paysSoonThreshold(page)) === 3)
			check('save by blur: one request left', patches.length === 1, String(patches.length))
			await shot(page, 'ledger-settings', 'saved')
			await openStudentsList(page)
			facts = await balanceFacts(page, 'Alex Example 2166 A')
			check(
				'threshold 3: three lessons left is Pays soon',
				facts.dotLabel === 'Pays soon' && facts.dotTone === 'bg-info',
				String(facts.dotLabel)
			)

			await page.goto(`${BASE}/settings`)
			await page.waitForFunction(() => document.querySelector('#settings-pays-soon')?.value === '3', null, {
				timeout: 15000,
			})
			const error = page.getByText('Use a whole number from 0 to 20.', { exact: true })
			const rejected = async (label, text, keepCaption) => {
				const sent = patches.length
				await input.fill(text)
				await input.blur()
				await page.waitForTimeout(500)
				check(`${label}: the error shows`, await error.isVisible())
				check(`${label}: the field is marked invalid`, (await input.getAttribute('aria-invalid')) === 'true')
				check(`${label}: no request left`, patches.length === sent, `${patches.length} / ${sent}`)
				check(`${label}: the value is still shown for a moment`, (await input.inputValue()) === text)
				if (keepCaption) await shot(page, 'ledger-settings', 'invalid')
				await page.waitForTimeout(2300)
				check(
					`${label}: the saved value returns`,
					(await input.inputValue()) === '3' && !(await error.isVisible()),
					await input.inputValue()
				)
				check(`${label}: the server value is unchanged`, (await paysSoonThreshold(page)) === 3)
			}
			await rejected('2.5', '2.5', true)
			await rejected('21', '21', false)
			await rejected('empty', '', false)
			await rejected('spaces', '   ', false)
			await rejected('minus one', '-1', false)

			const sent = patches.length
			await input.fill('2')
			await input.press('Enter')
			await page.getByText('Pays soon threshold: 2 lessons.').waitFor({ timeout: 10000 })
			check('Enter saves 2', (await paysSoonThreshold(page)) === 2)
			await input.blur()
			await page.waitForTimeout(500)
			check('Enter then blur sends one request', patches.length === sent + 1, `${patches.length} / ${sent}`)
			await input.fill('1')
			await input.blur()
			await page.getByText('Pays soon threshold: 1 lesson.').waitFor({ timeout: 10000 })
			await input.fill('2')
			await input.press('Enter')
			check('Enter saves 2 again', await waitThreshold(page, 2))
			await page.waitForTimeout(500)

			await page.route('**/api/settings', (route) =>
				route.request().method() === 'PATCH' ? route.fulfill({ status: 500, body: '{}' }) : route.continue()
			)
			await input.fill('5')
			await input.blur()
			await page.getByText('Could not save the setting. Try again.').waitFor({ timeout: 10000 })
			check('a failed save returns the saved value', (await input.inputValue()) === '2', await input.inputValue())
			check('a failed save changes nothing on the server', (await paysSoonThreshold(page)) === 2)
			await shot(page, 'ledger-settings', 'failed')
			await page.unroute('**/api/settings')

			const real = problems.filter(
				(problem) => !problem.includes('net::ERR_FAILED') && !/status of (400|404|409|500)/.test(problem)
			)
			check('no console problems', real.length === 0, real.slice(0, 2).join(' | '))
		} finally {
			await browser.close()
			cleanupFixtures('settings end')
		}
	})
	if (failures() === 0) console.log('LEDGER_WEB_SETTINGS_OK')
}

const hhmm = (minutes) =>
	`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

const TODAY_NAMES = {
	past: 'Alex Example 2170 A',
	done: 'Alex Example 2170 B',
	cancelled: 'Alex Example 2170 E',
	moved: 'Alex Example 2170 F',
	future: 'Alex Example 2170 C',
	earlier: 'Alex Example 2170 D',
}

async function todayFixtures(page) {
	const parts = core.zonedParts(new Date(), VN)
	const today = parts.date
	const opening = core.addDays(today, -3)
	const distinct = parts.minutes >= 40
	const at = (back) => hhmm(Math.max(0, parts.minutes - back))
	const futureMinutes = Math.min(parts.minutes + 120, 23 * 60 + 59)
	const fx = {
		today,
		yesterday: core.addDays(today, -1),
		tomorrow: core.addDays(today, 1),
		distinct,
		futureAt: futureMinutes > parts.minutes ? hhmm(futureMinutes) : null,
		ids: {},
		lessons: {},
		series: null,
	}
	for (const [key, name] of Object.entries(TODAY_NAMES)) {
		fx.ids[key] = await createCard(page, name)
		await setOpening(page, fx.ids[key], opening)
	}
	fx.lessons.past = await createOnce(page, fx.ids.past, today, at(40))
	fx.lessons.done = await createOnce(page, fx.ids.done, today, at(30))
	await markApi(page, fx.lessons.done, 'done')
	fx.lessons.cancelled = await createOnce(page, fx.ids.cancelled, today, at(20))
	const cancel = await api(page, 'POST', `/schedule/lessons/${fx.lessons.cancelled}/cancel`, {})
	check('api cancel of the started lesson', cancel.status === 200, String(cancel.status))
	fx.series = sql(
		`insert into lesson_series (student_id, weekday, start_time, duration_minutes, starts_on, ends_on) values ('${fx.ids.moved}', ${core.weekdayOf(today)}, '${at(10)}', 60, '${core.addDays(today, -14)}', null) returning id`
	).rows[0].id
	const moved = await api(page, 'POST', `/schedule/series/${fx.series}/occurrences/${today}/move`, {
		date: fx.tomorrow,
		startTime: '10:00',
	})
	check('api move of the series occurrence to tomorrow', moved.status === 200, String(moved.status))
	if (fx.futureAt !== null) fx.lessons.future = await createOnce(page, fx.ids.future, today, fx.futureAt)
	fx.lessons.earlier = await createOnce(page, fx.ids.earlier, fx.yesterday, '09:00')
	return fx
}

async function openToday(page) {
	await page.goto(`${BASE}/`)
	await page.locator('[data-slot="stat"]').first().waitFor({ timeout: 30000 })
	await page.waitForTimeout(400)
}

function expectedTitle(date) {
	const at = new Date(`${date}T12:00:00Z`)
	const part = (options) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(at)
	return `${part({ weekday: 'long' })}, ${Number(date.slice(8, 10))} ${part({ month: 'long' })}`
}

function minuteNow() {
	return new Date(Math.floor(Date.now() / 60000) * 60000)
}

async function readTodayApi(page) {
	const result = await api(page, 'GET', '/today')
	return result.json
}

function countsOf(data, now) {
	return core.todayCounts(
		{
			lessons: data.lessons.map((block) => ({
				key: block.key,
				startsAt: new Date(block.startsAt),
				outcome: block.outcome,
				studentStatus: block.studentStatus,
				openingOn: block.ledger.openingOn,
			})),
			earlier: data.earlier.length,
			paysSoon: data.paysSoon.length,
		},
		now
	)
}

function plural(count) {
	return count === 1 ? '1 lesson' : `${count} lessons`
}

function expectedTiles(counts, threshold) {
	const quiet = counts.lessons === 0
	return {
		Today: {
			value: String(counts.lessons),
			hint: quiet ? null : counts.toCome === 0 ? 'All started' : `${counts.toCome} still to come`,
		},
		Done: { value: String(counts.done), hint: quiet ? null : `of ${counts.started} started` },
		'To mark': {
			value: String(counts.toMark),
			hint: counts.toMark === 0 ? null : `${counts.toMarkToday} today, ${counts.toMarkEarlier} earlier`,
		},
		'Pays soon': { value: String(counts.paysSoon), hint: `${plural(threshold)} or fewer left` },
	}
}

function tileFacts(page) {
	return page.evaluate(() =>
		Array.from(document.querySelectorAll('[data-slot="stat"]')).map((tile) => {
			const box = tile.getBoundingClientRect()
			return {
				label: tile.querySelector('[data-slot="stat-label"]')?.textContent ?? '',
				value: tile.querySelector('[data-slot="stat-value"]')?.textContent ?? '',
				hint: tile.querySelector('[data-slot="stat-hint"]')?.textContent ?? null,
				top: Math.round(box.top),
				left: Math.round(box.left),
				width: Math.round(box.width),
			}
		})
	)
}

async function titleOf(page) {
	return page.getByRole('heading', { level: 1 }).first().textContent()
}

async function todayPart1(page, context, fx) {
	await openToday(page)
	const browserZone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
	check('the browser zone is America/New_York', browserZone === 'America/New_York', browserZone)
	const date = core.zonedParts(new Date(), VN).date
	check('the h1 is the full date in Vietnam, not in the browser zone', (await titleOf(page)) === expectedTitle(date))
	const summary = await page.locator('header div.text-body').first().textContent()
	await shot(page, 'ledger-today', 'part1')

	const data = await readTodayApi(page)
	const counts = countsOf(data, minuteNow())
	const tiles = await tileFacts(page)
	const expected = expectedTiles(counts, data.paysSoonLessons)
	check(
		'four tiles Today, Done, To mark, Pays soon in this order',
		tiles.map((tile) => tile.label).join('|') === 'Today|Done|To mark|Pays soon'
	)
	const wrong = tiles.filter((tile) => {
		const want = expected[tile.label]
		return !want || tile.value !== want.value || tile.hint !== want.hint
	})
	check(
		'the four tiles equal todayCounts of GET /today',
		wrong.length === 0,
		wrong.map((tile) => tile.label).join(', ')
	)
	const quiet = counts.lessons === 0
	const summaryOk = quiet
		? summary === 'No lessons today'
		: new RegExp(
				`^${plural(counts.lessons)}( · next: .+ at \\d\\d:\\d\\d VN( \\(.*\\d\\d:\\d\\d [A-Z]{2,5}\\))?)?$`
			).test(summary ?? '')
	check('the summary line has the v40 shape and the right count', summaryOk)
	const hasNext = (summary ?? '').includes(' · next: ')
	check('the summary names a next lesson exactly when todayCounts has one', hasNext === (counts.nextKey !== null))
	console.log(
		`today shows ${data.lessons.length} lesson blocks, ${data.earlier.length} earlier, ${data.paysSoon.length} pays soon rows`
	)

	check(
		'1280px: the four tiles stand in one row',
		new Set(tiles.map((tile) => tile.top)).size === 1 && tiles.length === 4
	)
	await page.setViewportSize({ width: 600, height: 800 })
	await page.waitForTimeout(500)
	const narrow = await tileFacts(page)
	check(
		'600px: the tiles are two by two',
		new Set(narrow.map((tile) => tile.top)).size === 2 && new Set(narrow.map((tile) => tile.left)).size === 2
	)
	check(
		'the grid gap is 12px',
		(await page.evaluate(() => getComputedStyle(document.querySelector('[data-slot="today-counters"]')).columnGap)) ===
			'12px'
	)
	await shot(page, 'ledger-today', 'narrow')
	await page.setViewportSize({ width: 1280, height: 800 })
	await page.waitForTimeout(400)

	await page.route('**/api/today', (route) => route.fulfill({ status: 500, body: '{}' }))
	await page.goto(`${BASE}/`)
	await page.getByText('Could not load Today', { exact: true }).waitFor({ timeout: 30000 })
	check(
		'a failed read shows one ReadError',
		(await page.getByText('Could not load Today', { exact: true }).count()) === 1
	)
	check(
		'a failed read shows no tile and the h1 stays',
		(await page.locator('[data-slot="stat"]').count()) === 0 && (await titleOf(page)) === expectedTitle(date)
	)
	check('a failed read names the next step', await page.getByRole('button', { name: 'Refresh' }).isVisible())
	await shot(page, 'ledger-today', 'error')
	await page.unroute('**/api/today')
	await page.getByRole('button', { name: 'Refresh' }).click()
	await page.locator('[data-slot="stat"]').first().waitFor({ timeout: 15000 })
	check('Refresh reads Today again', (await page.locator('[data-slot="stat"]').count()) === 4)

	await dayChange(page, context, fx)
	console.log(failures() === 0 ? 'TODAY_WEB_PART1_OK' : 'TODAY_WEB_PART1_FAIL')
}

async function dayChange(page, context, fx) {
	if (!page.clock?.install) {
		console.log('SKIP day change: page.clock is not available in this playwright, not checked')
		return
	}
	const today = core.zonedParts(new Date(), VN).date
	const stale = core.addDays(today, -1)
	const hits = { count: 0 }
	const state = { answered: 0 }
	const fakeUntilFirstAnswer = async (route) => {
		hits.count += 1
		const response = await route.fetch()
		const json = await response.json()
		if (state.answered === 0) json.date = stale
		await route.fulfill({ response, json })
		state.answered += 1
	}
	const fakeAlways = async (route) => {
		hits.count += 1
		const response = await route.fetch()
		const json = await response.json()
		json.date = stale
		await route.fulfill({ response, json })
	}
	await page.clock.install()
	await page.route('**/api/today', fakeUntilFirstAnswer)
	await page.goto(`${BASE}/`)
	await page.locator('[data-slot="stat"]').first().waitFor({ timeout: 30000 })
	await page
		.waitForFunction((expected) => document.querySelector('h1')?.textContent === expected, expectedTitle(today), {
			timeout: 15000,
		})
		.catch(() => {})
	check('day change: a stale answer date makes the page read /api/today again', hits.count >= 2, String(hits.count))
	check('day change: the h1 shows today after the new answer', (await titleOf(page)) === expectedTitle(today))
	await page.unroute('**/api/today', fakeUntilFirstAnswer)

	hits.count = 0
	await page.route('**/api/today', fakeAlways)
	await page.goto(`${BASE}/`)
	await page.locator('[data-slot="stat"]').first().waitFor({ timeout: 30000 })
	await page.waitForTimeout(1500)
	const settled = hits.count
	await page.waitForTimeout(1500)
	check(
		'day change: with a wrong date the page rests after its own re-read',
		hits.count === settled && settled >= 2,
		String(settled)
	)
	await page.clock.runFor(61000)
	await page.waitForTimeout(1500)
	const extra = hits.count - settled
	check(
		'day change: one minute of a wrong date gives at most two more requests',
		extra >= 1 && extra <= 2,
		String(extra)
	)
	await page.unrouteAll({ behavior: 'ignoreErrors' })
}

async function todaySection() {
	cleanupFixtures('today start')
	await withTeacherSettings(async () => {
		const { browser, context, page, problems } = await launch({
			width: 1280,
			height: 800,
			timezoneId: 'America/New_York',
		})
		try {
			await setTheme(page)
			await signIn(page)
			await setThreshold(page, 2)
			const fx = await todayFixtures(page)
			await todayPart1(page, context, fx)
			const real = problems.filter(
				(problem) => !problem.includes('net::ERR_FAILED') && !/status of (400|404|409|500)/.test(problem)
			)
			check('no console problems', real.length === 0, real.slice(0, 2).join(' | '))
		} finally {
			await browser.close()
			cleanupFixtures('today end')
		}
	})
	if (failures() === 0) console.log('LEDGER_WEB_TODAY_OK')
}

const sections = { marks, students, settings: settingsSection, today: todaySection }

if (!sections[section]) {
	console.log(`usage: ledger-web.mjs ${Object.keys(sections).join('|')} [dark]`)
	process.exit(2)
}

try {
	await sections[section]()
} catch (error) {
	check('section completed', false, String(error).slice(0, 300))
}
process.exit(failures())
