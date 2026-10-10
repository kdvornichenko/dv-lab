import * as core from '../../packages/core/src/index.ts'
import { BASE, api, check, env, failures, launch, shot, signIn, sql } from './web.mjs'

const section = process.argv[2]
const dark = process.argv.includes('dark')
const VN = core.SCHEDULE_TIME_ZONE

const fixtureWhere = `(display_name like 'Alex Example 215%' or display_name like 'Alex Example 216%') and import_key is null`

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

async function students() {
	cleanupFixtures('students start')
	await withTeacherSettings(async () => {
		const { browser, page, problems } = await launch({ width: 1440, height: 900 })
		try {
			await setTheme(page)
			await signIn(page)
			await setThreshold(page, 2)
			await studentsFixtures(page)
			await studentsPart1(page)
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

const sections = { marks, students }

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
