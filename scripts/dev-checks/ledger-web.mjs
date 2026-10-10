import * as core from '../../packages/core/src/index.ts'
import { BASE, api, check, failures, launch, shot, signIn, sql } from './web.mjs'

const section = process.argv[2]
const dark = process.argv.includes('dark')
const VN = core.SCHEDULE_TIME_ZONE

const LIKE = 'Alex Example 215%'
const fixtureWhere = `display_name like '${LIKE}' and import_key is null`

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

async function setOpening(page, studentId, on) {
	const result = await api(page, 'PUT', `/students/${studentId}/opening-balance`, { lessonsHundredths: 0, on })
	check(`opening balance set for ${studentId.slice(0, 4)}`, result.status === 200, String(result.status))
}

async function createOnce(page, studentId, date, startTime) {
	const result = await api(page, 'POST', '/schedule/lessons', {
		studentId,
		date,
		startTime,
		durationMinutes: 60,
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
	return { today, yesterday, opening, names, ids, lessons }
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

async function marks() {
	cleanupFixtures('marks start')
	const { browser, page, problems } = await launch({ width: 1440, height: 900 })
	try {
		await setTheme(page)
		await signIn(page)
		const fx = await marksFixtures(page)
		const nav = { monday: null }
		await marksPart1(page, fx, nav)
		const real = problems.filter(
			(problem) => !problem.includes('net::ERR_FAILED') && !/status of (400|404|409)/.test(problem)
		)
		check('no console problems', real.length === 0, real.slice(0, 2).join(' | '))
	} finally {
		await browser.close()
		cleanupFixtures('marks end')
	}
}

const sections = { marks }

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
