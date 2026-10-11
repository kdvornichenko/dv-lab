import * as core from '../../../packages/core/src/index.ts'
import { BASE, api, check, failures, shot, sql } from '../web.mjs'
import {
	VN,
	createCard,
	setOpening,
	createOnce,
	markApi,
	hhmm,
	openToday,
	expectedTitle,
	minuteNow,
	readTodayApi,
	countsOf,
	plural,
	expectedTiles,
	tileFacts,
	titleOf,
} from './common.mjs'

const TODAY_NAMES = {
	past: 'Alex Example 2184 A',
	done: 'Alex Example 2184 B',
	cancelled: 'Alex Example 2184 E',
	moved: 'Alex Example 2184 F',
	future: 'Alex Example 2184 C',
	earlier: 'Alex Example 2184 D',
}

export async function todayFixtures(page) {
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

export async function todayPart1(page, context, fx) {
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
