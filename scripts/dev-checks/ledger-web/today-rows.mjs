import * as core from '../../../packages/core/src/index.ts'
import { check, failures, shot } from '../web.mjs'
import {
	VN,
	markApi,
	openToday,
	minuteNow,
	readTodayApi,
	countsOf,
	tileFacts,
	shortDay,
	rowLocator,
	rowFacts,
	panelKeys,
} from './common.mjs'

async function quietDay(page) {
	await page.route('**/api/today', async (route) => {
		const response = await route.fetch()
		const json = await response.json()
		await route.fulfill({ response, json: { ...json, lessons: [], earlier: [], paysSoon: [] } })
	})
	await openToday(page)
	const tiles = await tileFacts(page)
	const by = Object.fromEntries(tiles.map((tile) => [tile.label, tile]))
	check(
		'quiet day: Today, Done and To mark are 0 without a hint',
		['Today', 'Done', 'To mark'].every((label) => by[label].value === '0' && by[label].hint === null)
	)
	check('quiet day: Pays soon is 0 and keeps its hint', by['Pays soon'].value === '0' && by['Pays soon'].hint !== null)
	const body = await page.locator('main').first().textContent()
	check(
		'quiet day: the summary says No lessons today',
		(await page.locator('header div.text-body').first().textContent()) === 'No lessons today'
	)
	check('quiet day: the Lessons today panel holds the empty state', body.includes('Add a lesson in the schedule.'))
	const open = page.getByRole('link', { name: 'Open schedule' })
	check('quiet day: Open schedule links to /schedule', (await open.getAttribute('href')) === '/schedule')
	check(
		'quiet day: Earlier, not marked is not drawn',
		(await page.getByText('Earlier, not marked', { exact: true }).count()) === 0
	)
	const week = page.getByRole('link', { name: 'Week' })
	check('the Week action links to /schedule', (await week.getAttribute('href')) === '/schedule')
	await shot(page, 'ledger-today', 'quiet')
	await page.unroute('**/api/today')
}

export async function todayPart2(page, fx) {
	await openToday(page)
	const data = await readTodayApi(page)
	const now = minuteNow()
	const counts = countsOf(data, now)
	const year = Number(fx.today.slice(0, 4))
	const lessonsPanel = 'today-lessons'
	const lessonsSorted = [...data.lessons].sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))
	const blockOf = (studentId) => lessonsSorted.find((block) => block.studentId === studentId)

	const keys = await panelKeys(page, lessonsPanel)
	check('Lessons today lists every block of the answer', keys.length === lessonsSorted.length)
	check(
		'Lessons today is in time order',
		JSON.stringify(keys) === JSON.stringify(lessonsSorted.map((block) => block.key))
	)

	const past = await rowStates(page, fx, year, lessonsPanel)

	const order = ['past', 'done', 'cancelled', 'moved'].map((key) => keys.indexOf(blockOf(fx.ids[key])?.key))
	if (fx.distinct) {
		check(
			'fixture rows follow the time order',
			order.every((index, position) => index >= 0 && (position === 0 || index > order[position - 1]))
		)
	} else {
		console.log('SKIP fixture order: too early after Vietnam midnight to give four different started times')
	}

	const rows = await page.evaluate(() =>
		Array.from(document.querySelectorAll('section[aria-labelledby="today-lessons"] [data-slot="today-row"]')).map(
			(element) => ({
				key: element.dataset.key,
				next: element.dataset.next,
				height: element.getBoundingClientRect().height,
				weight: getComputedStyle(element.querySelector('[data-slot="today-row-name"]')).fontWeight,
				background: getComputedStyle(element).backgroundColor,
			})
		)
	)
	check(
		'rows are 40px high',
		rows.every((row) => row.height === 40)
	)
	const nextRows = rows.filter((row) => row.next === 'true')
	check(
		'exactly the todayCounts next lesson is highlighted',
		counts.nextKey === null ? nextRows.length === 0 : nextRows.length === 1 && nextRows[0].key === counts.nextKey
	)
	check(
		'the next row has weight 600 and the active background, others do not',
		nextRows.every((row) => row.weight === '600' && row.background !== 'rgba(0, 0, 0, 0)') &&
			rows.filter((row) => row.next === 'false').every((row) => row.weight !== '600')
	)
	if (fx.futureAt !== null && counts.nextKey === `l:${fx.lessons.future}`) {
		check('the future fixture is the next lesson', (await rowFacts(page, lessonsPanel, fx.ids.future))?.next === 'true')
	} else {
		console.log('the next lesson belongs to other rows, the future fixture is checked by status')
		const future = fx.futureAt === null ? null : await rowFacts(page, lessonsPanel, fx.ids.future)
		check(
			'the future fixture is a planned row without a note',
			fx.futureAt === null || (future?.status === 'planned' && future.note === null)
		)
	}
	check(
		'time column is at least 88px wide with tabular numerals',
		past.timeWidth >= 88 && past.tabular,
		String(past.timeWidth)
	)
	const pastBlock = blockOf(fx.ids.past)
	check(
		'the time is the Vietnam time of the lesson',
		past.time === core.zonedParts(new Date(pastBlock.startsAt), VN).time
	)
	const secondWant = core.zonedParts(new Date(pastBlock.startsAt), 'Europe/Moscow').time
	check(
		'the second zone sits beneath in MSK',
		past.second !== null && past.second.endsWith(`${secondWant} MSK`),
		'second line checked'
	)
	await shot(page, 'ledger-today', 'part2')

	await earlierRows(page, fx, data, year)
	await narrowToday(page)
	console.log(failures() === 0 ? 'TODAY_WEB_PART2_OK' : 'TODAY_WEB_PART2_FAIL')
}

async function earlierRows(page, fx, data, year) {
	const earlierSorted = [...data.earlier].sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))
	const earlierIndex = earlierSorted.findIndex((block) => block.studentId === fx.ids.earlier)
	const earlierKeys = await panelKeys(page, 'today-earlier')
	check(
		'Earlier, not marked is drawn while the answer has earlier lessons',
		earlierSorted.length > 0 === earlierKeys.length > 0
	)
	check(
		'Earlier rows are the oldest first and at most 8',
		JSON.stringify(earlierKeys) === JSON.stringify(earlierSorted.slice(0, 8).map((block) => block.key))
	)
	const caption = await page
		.locator('section[aria-labelledby="today-earlier"] p')
		.first()
		.textContent()
		.catch(() => null)
	check('Earlier carries its caption', caption === 'Lessons that took place and still need a mark.')
	const more = page.locator('section[aria-labelledby="today-earlier"] [data-slot="more-row"]')
	if (earlierSorted.length > 8) {
		check(
			'Earlier ends with +N more to /schedule',
			(await more.textContent()) === `+${earlierSorted.length - 8} more` &&
				(await more.getAttribute('href')) === '/schedule'
		)
	} else {
		check('Earlier has no +N more with 8 rows or fewer', (await more.count()) === 0)
	}
	if (earlierIndex >= 0 && earlierIndex < 8) {
		const facts = await rowFacts(page, 'today-earlier', fx.ids.earlier)
		check(
			'earlier fixture: date column Wed 8 Oct style and 72px',
			facts?.date === shortDay(fx.yesterday, true, year) && facts.dateWidth >= 72,
			facts?.date ?? 'none'
		)
		check('earlier fixture: full colour with quick marks', facts && !facts.muted && facts.note === 'DoneNo-show')
		await shot(page, 'ledger-today', 'earlier')
	} else {
		console.log('SKIP earlier fixture row: it sits behind +N more in the real data')
	}

	await markApi(page, fx.lessons.earlier, 'done')
	await openToday(page)
	const fresh = await readTodayApi(page)
	check(
		'after the mark the earlier fixture left the answer',
		!fresh.earlier.some((block) => block.studentId === fx.ids.earlier)
	)
	check(
		'after the mark its row is gone from the page',
		(await rowLocator(page, 'today-earlier', fx.ids.earlier).count()) === 0
	)
	check(
		'the panel is gone exactly when no earlier lesson is left',
		(await page.locator('section[aria-labelledby="today-earlier"]').count()) > 0 === fresh.earlier.length > 0
	)
}

async function narrowToday(page) {
	await quietDay(page)

	await page.setViewportSize({ width: 320, height: 700 })
	await openToday(page)
	const fit = await page.evaluate(() => ({
		page: document.documentElement.scrollWidth <= window.innerWidth,
		panels: Array.from(document.querySelectorAll('main section, [data-slot="today-counters"]')).every(
			(element) => element.scrollWidth <= element.clientWidth + 1
		),
	}))
	check('320px: no sideways scroll of the page', fit.page)
	check('320px: no panel or counter row overflows', fit.panels)
	await shot(page, 'ledger-today', 'narrow-320')
	await page.setViewportSize({ width: 1280, height: 800 })
	console.log(failures() === 0 ? 'TODAY_WEB_PART2_OK' : 'TODAY_WEB_PART2_FAIL')
}

async function rowStates(page, fx, year, lessonsPanel) {
	const past = await rowFacts(page, lessonsPanel, fx.ids.past)
	check(
		'past unmarked: full colour, not struck, quick marks',
		past && !past.muted && !past.struck && past.note === 'DoneNo-show'
	)
	check('past unmarked: status needs_mark', past?.status === 'needs_mark')
	const done = await rowFacts(page, lessonsPanel, fx.ids.done)
	check('done: muted, not struck, note Done', done && done.muted && !done.struck && done.note === 'Done')
	const cancelled = await rowFacts(page, lessonsPanel, fx.ids.cancelled)
	check(
		'cancelled: muted, struck, note Cancelled',
		cancelled && cancelled.muted && cancelled.struck && cancelled.note === 'Cancelled'
	)
	const moved = await rowFacts(page, lessonsPanel, fx.ids.moved)
	const movedWant = `Moved to ${shortDay(fx.tomorrow, false, year)}`
	check(
		'moved: muted, not struck, note says where it went',
		moved && moved.muted && !moved.struck && moved.note === movedWant,
		moved?.note ?? 'none'
	)
	check(
		'only the cancelled row is struck',
		[past, done, moved].every((facts) => facts && !facts.struck)
	)

	return past
}
