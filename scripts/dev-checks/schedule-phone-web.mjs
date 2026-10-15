import { BASE, api, check, failures, launch, shot, signIn, theme } from './web.mjs'

const GRID = '[data-slot="week-grid"]'
const BLOCK = '[data-slot="calendar-event"]'
const NO_COLOR = { id: null, background: null, foreground: null, custom: false }
const SIZES = [
	{ name: 'phone', width: 390, height: 844 },
	{ name: 'tablet', width: 768, height: 1024 },
]

function addDays(isoDate, count) {
	const date = new Date(`${isoDate}T00:00:00Z`)
	date.setUTCDate(date.getUTCDate() + count)
	return date.toISOString().slice(0, 10)
}

function instantAt(isoDate, hour, minute, timeZone) {
	const [year, month, day] = isoDate.split('-').map(Number)
	const guess = Date.UTC(year, month - 1, day, hour, minute)
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
	}).formatToParts(new Date(guess))
	const part = (type) => Number(parts.find((entry) => entry.type === type).value)
	const shown = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'))
	return new Date(guess - (shown - guess)).toISOString()
}

const PLAN = [
	['long', 'Synthetic long title that wraps over lines', 9, 0, 60],
	['half', 'Half hour title', 10, 30, 30],
	['quick', 'Quick', 11, 30, 20],
	['pair-a', 'Pair alpha', 13, 0, 60],
	['pair-b', 'Pair bravo', 13, 0, 60],
	['pair-c', 'Pair charlie', 13, 0, 60],
]

function syntheticEvents(monday, timeZone) {
	return PLAN.map(([id, title, hour, minute, length]) => ({
		eventKey: `phone-${id}`,
		version: 'v1',
		title,
		when: {
			kind: 'timed',
			startsAt: instantAt(monday, hour, minute, timeZone),
			endsAt: instantAt(monday, hour, minute + length, timeZone),
			timeZone,
		},
		status: 'confirmed',
		blocksTime: true,
		color: NO_COLOR,
		location: null,
		seriesMember: false,
		binding: { kind: 'external' },
		suggestion: null,
		editBlock: null,
	}))
}

async function stubWeek(context) {
	await context.route(/\/api\/schedule\/week(\?|$)/, async (route) => {
		const response = await route.fetch()
		const body = await response.json()
		const start = new URL(route.request().url()).searchParams.get('start')
		const timeZone = body.requestedRange?.timeZone ?? 'Asia/Ho_Chi_Minh'
		return route.fulfill({
			response,
			json: {
				...body,
				read: { state: 'fresh', fetchedAt: new Date().toISOString(), revision: '1' },
				write: { state: 'ready' },
				snapshotRange: body.requestedRange,
				events: start === null ? [] : syntheticEvents(start, timeZone),
				series: [],
			},
		})
	})
}

async function openSchedule(page) {
	await page.goto(`${BASE}/schedule`, { timeout: 120000 })
	await page.locator(`${GRID} ${BLOCK}`).first().waitFor({ timeout: 30000 })
	await page.waitForTimeout(800)
}

async function dialogOpens(page) {
	const dialog = page.getByRole('dialog').last()
	const shown = await dialog
		.waitFor({ timeout: 8000 })
		.then(() => true)
		.catch(() => false)
	if (shown) {
		await page.keyboard.press('Escape')
		await dialog.waitFor({ state: 'detached', timeout: 8000 }).catch(() => undefined)
	}
	return shown
}

async function scheduleChecks(page, size) {
	const tag = size.name
	await openSchedule(page)
	check(
		`${tag}: the page has no horizontal scroll`,
		await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
	)
	check(`${tag}: the grid is the phone grid`, (await page.locator(`${GRID}[data-phone]`).count()) === 1)
	check(
		`${tag}: the reserved notice slot is gone`,
		(await page.locator('[data-slot="calendar-read-slot"]').count()) === 0
	)
	check(`${tag}: no agenda list is drawn`, (await page.locator('[data-slot="calendar-agenda"]').count()) === 0)
	const grid = await page.locator(GRID).boundingBox()
	const toolbar = await page.locator('[data-slot="schedule-toolbar"]').boundingBox()
	if (size.width < 768) {
		check(`${tag}: no page title`, (await page.locator('h1').count()) === 0)
		check(`${tag}: no New event button anywhere`, (await page.getByRole('button', { name: 'New event' }).count()) === 0)
		const row = await page.locator('[data-slot="schedule-toolbar"]').evaluate((element) => {
			const rect = element.parentElement.getBoundingClientRect()
			return { top: rect.top, bottom: rect.bottom, height: rect.height }
		})
		check(`${tag}: the toolbar row is 36px`, Math.abs(row.height - 36) < 0.6, String(row.height))
		check(
			`${tag}: the grid starts right under the toolbar row`,
			Math.abs(grid.y - row.bottom) < 1.5,
			`${grid.y} vs ${row.bottom}`
		)
		const week = await page.locator('[data-slot="schedule-week-picker"]').boundingBox()
		check(`${tag}: the week button is as wide as its text`, week.width > 60 && week.width < 110, String(week.width))
		const geometry = await page.locator('[data-slot="schedule-toolbar"]').evaluate((element) => {
			const row = element.parentElement
			const rect = (node) => node.getBoundingClientRect()
			const buttons = Array.from(row.querySelectorAll('button'))
			const prev = buttons.find((button) => button.getAttribute('aria-label') === 'Previous week')
			const next = buttons.find((button) => button.getAttribute('aria-label') === 'Next week')
			const picker = row.querySelector('[data-slot="schedule-week-picker"]')
			return {
				prevGap: rect(picker).left - rect(prev).right,
				nextGap: rect(next).left - rect(picker).right,
				first: rect(buttons[0]).left,
				last: rect(buttons[buttons.length - 1]).right,
				top: rect(buttons[0]).top - rect(row).top,
				bottom: rect(row).bottom - rect(buttons[0]).bottom,
				fontSize: getComputedStyle(picker).fontSize,
				weight: getComputedStyle(picker).fontWeight,
				today: buttons[0].getAttribute('aria-label'),
			}
		})
		check(
			`${tag}: Today comes first, the week group has 2px gaps and the row has 12px sides and 2px/6px padding`,
			geometry.today === 'Today' &&
				Math.abs(geometry.prevGap - 2) < 0.6 &&
				Math.abs(geometry.nextGap - 2) < 0.6 &&
				Math.abs(geometry.first - 12) < 0.6 &&
				Math.abs(page.viewportSize().width - 12 - geometry.last) < 0.6 &&
				Math.abs(geometry.top - 2) < 0.6 &&
				Math.abs(geometry.bottom - 6) < 0.6,
			JSON.stringify(geometry)
		)
		check(`${tag}: the week button text is 13px weight 600`, geometry.fontSize === '13px' && geometry.weight === '600')
		const tools = await page.locator('[data-slot="schedule-toolbar"]').evaluate((element) => {
			const row = element.parentElement
			return Array.from(row.querySelectorAll('button'))
				.filter((button) => button.dataset.slot !== 'schedule-week-picker')
				.map((button) => button.getBoundingClientRect().height)
		})
		check(
			`${tag}: every tool button is 28px`,
			tools.length >= 6 && tools.every((height) => Math.abs(height - 28) < 0.6),
			tools.join(',')
		)
	} else {
		const bar = await page.locator('[data-slot="schedule-toolbar"]').evaluate((element) => {
			const rect = element.closest('header, [id="topbar-slot"]')?.getBoundingClientRect()
			return rect ? rect.bottom : null
		})
		check(`${tag}: the toolbar is in the top bar`, toolbar !== null && toolbar.y + toolbar.height <= (bar ?? 60) + 1)
		check(`${tag}: the grid starts right under the top bar`, grid.y <= 58, String(grid.y))
	}
	const day = await page.locator('[data-page="current"] [data-slot="week-grid-day"]').first().boundingBox()
	check(`${tag}: the day header is 64px`, Math.abs(day.height - 64) < 0.6, String(day.height))
	const circle = await page.locator('[data-page="current"] [data-slot="week-grid-date"]').first().boundingBox()
	check(`${tag}: the date circle is 36px`, Math.abs(circle.width - 36) < 0.6 && Math.abs(circle.height - 36) < 0.6)
	const lines = await page.evaluate(() => {
		const top = (hour) =>
			document.querySelector(`[data-slot="week-grid-line"][data-hour="${hour}"]`).getBoundingClientRect().top
		return top(9) - top(8)
	})
	check(`${tag}: an hour is 48px`, Math.abs(lines - 48) < 0.6, String(lines))
	const gutter = await page.locator('[data-slot="week-grid-gutter"]').boundingBox()
	check(`${tag}: the gutter is 36px`, Math.abs(gutter.width - 36) < 0.6, String(gutter.width))
	const long = page.locator('[data-page="current"] [data-event-key="phone-long"]')
	const longStyle = await long.evaluate((element) => {
		const text = element.firstElementChild
		const style = getComputedStyle(text)
		return {
			size: style.fontSize,
			line: style.lineHeight,
			weight: style.fontWeight,
			wrap: style.overflowWrap,
			height: text.getBoundingClientRect().height,
		}
	})
	check(
		`${tag}: a one-hour block shows the title in up to three 11/14 lines`,
		longStyle.size === '11px' &&
			longStyle.line === '14px' &&
			longStyle.wrap === 'anywhere' &&
			longStyle.height <= 42.6 &&
			longStyle.height >= 28,
		JSON.stringify(longStyle)
	)
	const half = await page
		.locator('[data-page="current"] [data-event-key="phone-half"]')
		.evaluate((element) => element.firstElementChild?.getBoundingClientRect().height ?? 0)
	check(`${tag}: a half-hour block shows one line`, Math.abs(half - 14) < 0.6, String(half))
	const quickText = await page
		.locator('[data-page="current"] [data-event-key="phone-quick"]')
		.evaluate((element) => element.textContent)
	check(`${tag}: a block under 30 minutes is colour only`, quickText === '', JSON.stringify(quickText))
	const pairs = await page.evaluate(() =>
		['a', 'b', 'c'].map((id) => {
			const block = document.querySelector(`[data-page="current"] [data-event-key="phone-pair-${id}"]`)
			return { width: block.getBoundingClientRect().width, text: block.textContent }
		})
	)
	check(
		`${tag}: overlapping blocks share the column and narrow lanes show a letter or colour`,
		pairs.every((entry) => entry.width < 40) && pairs.some((entry) => entry.text.length <= 1),
		JSON.stringify(pairs)
	)
	const body = page.locator('[data-slot="week-grid-body"]')
	check(
		`${tag}: the grid scrolls inside itself and leaves 16px under the last hour`,
		await body.evaluate(
			(element) => Math.abs(element.scrollHeight - 48 * 24 - 16) < 1 && element.scrollHeight > element.clientHeight
		)
	)
	check(`${tag}: no floating new-event button`, (await page.locator('[data-slot="new-event-fab"]').count()) === 0)
	await page.locator(`[data-page="current"] [data-event-key="phone-long"]`).click()
	check(`${tag}: a tap on a block opens its dialog`, await dialogOpens(page))
	const column = await page.locator('[data-page="current"] [data-slot="week-grid-column"]').nth(3).boundingBox()
	await page.mouse.click(column.x + column.width / 2, grid.y + 64 + 120)
	check(`${tag}: a tap on an empty cell opens the new lesson dialog`, await dialogOpens(page))
	if (size.width < 768) await shot(page, 'schedule-phone', size.name)
}

async function desktopSmoke(page) {
	await page.setViewportSize({ width: 1280, height: 800 })
	await openSchedule(page)
	check('desktop: the laptop grid is kept', (await page.locator(`${GRID}[data-phone]`).count()) === 0)
	const gutter = await page.locator('[data-slot="week-grid-gutter"]').boundingBox()
	check('desktop: the gutter stays 100px', Math.abs(gutter.width - 100) < 0.6, String(gutter.width))
	check('desktop: no phone new-event button', (await page.locator('[data-slot="new-event-fab"]').count()) === 0)
	check(
		'desktop: the block still shows title and range',
		/\d{1,2}:\d{2}/.test(
			await page.locator('[data-event-key="phone-long"]').evaluate((element) => element.textContent)
		),
		await page.locator('[data-event-key="phone-long"]').evaluate((element) => element.textContent)
	)
}

async function tabStrips(page, size) {
	const tag = size.name
	await page.goto(`${BASE}/students`)
	await page.getByRole('heading', { name: 'Students', level: 1 }).waitFor({ timeout: 30000 })
	await page.waitForTimeout(600)
	const strips = async () =>
		page.evaluate(() =>
			Array.from(document.querySelectorAll('.scroll-fade-x'))
				.filter(
					(element) => element.closest('table') === null && element.getAttribute('data-slot') !== 'table-container'
				)
				.map((element) => ({
					slot: element.getAttribute('data-slot'),
					width: getComputedStyle(element).scrollbarWidth,
				}))
		)
	const students = await strips()
	check(
		`${tag}: the Students tab strip has no scrollbar`,
		students.length > 0 && students.every((entry) => entry.width === 'none'),
		JSON.stringify(students)
	)
	const list = await api(page, 'GET', '/students')
	const first = list.json?.students?.[0]?.id ?? list.json?.items?.[0]?.id ?? null
	if (first === null) return console.log('SKIP profile tab strip: no student in the list')
	await page.goto(`${BASE}/students/${first}`)
	await page.waitForTimeout(1500)
	const profile = await strips()
	check(
		`${tag}: the profile tab strip has no scrollbar`,
		profile.length > 0 && profile.every((entry) => entry.width === 'none'),
		JSON.stringify(profile)
	)
}

const CURRENT = '[data-page="current"]'
const STRIP = '[data-slot="week-grid-body"] [data-page="current"]'

const weekText = (page) => page.locator('[data-slot="schedule-week-picker"]').innerText()
const firstDate = (page) => page.locator(`${CURRENT} [data-slot="week-grid-day"]`).first().getAttribute('data-date')
const beforeDate = (page) =>
	page.locator('[data-page="before"] [data-slot="week-grid-day"]').first().getAttribute('data-date')
const shiftDate = (date, days) => {
	const value = new Date(`${date}T00:00:00Z`)
	value.setUTCDate(value.getUTCDate() + days)
	return value.toISOString().slice(0, 10)
}
const translateX = (transform) => {
	if (!transform || transform === 'none') return 0
	const parts = transform
		.match(/matrix\(([^)]+)\)/)?.[1]
		.split(',')
		.map(Number)
	return parts ? parts[4] : 0
}
const stripNow = (page) =>
	page.evaluate((selector) => {
		const style = getComputedStyle(document.querySelector(selector).parentElement)
		return { transform: style.transform, opacity: style.opacity }
	}, STRIP)

function sampleStrip(page, duration) {
	return page.evaluate(
		([selector, span]) =>
			new Promise((resolve) => {
				const strip = document.querySelector(selector).parentElement
				const out = []
				const start = performance.now()
				const tick = () => {
					const style = getComputedStyle(strip)
					out.push({ at: performance.now() - start, transform: style.transform, opacity: Number(style.opacity) })
					if (performance.now() - start < span) requestAnimationFrame(tick)
					else resolve(out)
				}
				tick()
			}),
		[STRIP, duration]
	)
}

const line = (from, to, y, steps) =>
	Array.from({ length: steps + 1 }, (_, index) => ({ x: from + ((to - from) * index) / steps, y }))

async function swipe(page, cdp, points, stepMs, { release = true } = {}) {
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [points[0]] })
	for (const point of points.slice(1)) {
		await page.waitForTimeout(stepMs)
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] })
	}
	if (release) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

async function settle(page) {
	await page.waitForTimeout(650)
}

async function openStubbed(page, context) {
	await signIn(page)
	await stubWeek(context)
	await page.goto(`${BASE}/schedule`, { timeout: 120000 })
	await page.locator(`${CURRENT} ${BLOCK}`).first().waitFor({ timeout: 30000 })
	await page.waitForTimeout(1200)
}

async function swipeChecks(browser) {
	const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
	const page = await context.newPage()
	try {
		await openStubbed(page, context)
		const cdp = await context.newCDPSession(page)
		const y = 500
		const origin = await firstDate(page)
		check(
			'swipe: the weeks before and after are laid out beside the shown one',
			(await beforeDate(page)) === shiftDate(origin, -7)
		)
		const heading = await weekText(page)

		await swipe(page, cdp, line(300, 200, y, 10), 30, { release: false })
		await page.waitForTimeout(80)
		const dragged = translateX((await stripNow(page)).transform)
		check('swipe: the strip follows the finger 1:1 while it is down', Math.abs(dragged + 100) < 3, String(dragged))
		check('swipe: the bar keeps the shown week during the drag', (await weekText(page)) === heading)
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
		await settle(page)
		check('swipe: a slow drag of 25% or more turns to the next week', (await firstDate(page)) === shiftDate(origin, 7))
		check('swipe: the week button shows the new week', (await weekText(page)) !== heading)
		check('swipe: the strip is at rest after the settle', Math.abs(translateX((await stripNow(page)).transform)) < 0.5)
		check('swipe: the previous week is now the old one', (await beforeDate(page)) === origin)

		const week2 = await firstDate(page)
		await swipe(page, cdp, line(300, 260, y, 8), 60)
		await settle(page)
		check('swipe: a short slow drag springs back', (await firstDate(page)) === week2)
		check('swipe: the spring back ends at rest', Math.abs(translateX((await stripNow(page)).transform)) < 0.5)

		await swipe(page, cdp, line(300, 250, y, 5), 10)
		await settle(page)
		check('swipe: a fast flick under 25% still turns the week', (await firstDate(page)) === shiftDate(week2, 7))

		const week3 = await firstDate(page)
		await swipe(page, cdp, line(10, -150, y, 10), 30)
		await settle(page)
		check('swipe: a swipe from the 24px screen edge does not page', (await firstDate(page)) === week3)

		await swipe(page, cdp, line(200, 300, y, 10), 30)
		await settle(page)
		check('swipe: a right swipe turns to the previous week', (await firstDate(page)) === shiftDate(week3, -7))

		const body = page.locator('[data-slot="week-grid-body"]')
		const before = await body.evaluate((element) => element.scrollTop)
		const turned = await firstDate(page)
		await swipe(page, cdp, [{ x: 200, y: 600 }, ...line(200, 205, 560, 3), ...line(205, 210, 400, 6)], 25)
		await page.waitForTimeout(400)
		const after = await body.evaluate((element) => element.scrollTop)
		check(
			'swipe: a vertical swipe scrolls the grid and does not page',
			after !== before && (await firstDate(page)) === turned,
			`${before} -> ${after}`
		)

		await body.evaluate((element) => {
			element.scrollTop = 0
		})
		await page.waitForTimeout(150)
		const block = page.locator(`${CURRENT} [data-event-key="phone-long"]`)
		const box = await block.boundingBox()
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
		await page.mouse.down()
		await page.mouse.move(box.x + box.width / 2 + 24, box.y + box.height / 2, { steps: 4 })
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 })
		await page.mouse.up()
		await page.waitForTimeout(700)
		check('swipe: the click after a captured swipe is dropped', (await page.getByRole('dialog').count()) === 0)
		const tapBox = await page.locator(`${CURRENT} [data-event-key="phone-long"]`).boundingBox()
		await page.touchscreen.tap(tapBox.x + tapBox.width / 2, tapBox.y + tapBox.height / 2)
		check('swipe: a tap on a block after the swipe opens it', await dialogOpens(page))

		const here = await firstDate(page)
		const sampling = sampleStrip(page, 500)
		await page.getByRole('button', { name: 'Previous week' }).click()
		const samples = await sampling
		const offsets = samples.map((sample) => translateX(sample.transform))
		const moving = offsets.filter((offset) => Math.abs(offset) > 1 && Math.abs(offset) < 350)
		const running = samples.filter((sample) => Math.abs(translateX(sample.transform)) > 0.5)
		check(
			'arrow: Previous week animates the strip',
			moving.length >= 2 && new Set(offsets.map(Math.round)).size > 3,
			offsets.map(Math.round).join(',')
		)
		const length = running.length > 0 ? running[running.length - 1].at - running[0].at : 0
		check('arrow: the turn takes about 0.24s', length > 100 && length < 450, String(Math.round(length)))
		check('arrow: Previous week lands on the previous week', (await firstDate(page)) === shiftDate(here, -7))
		check('arrow: the strip is at rest after the turn', Math.abs(translateX((await stripNow(page)).transform)) < 0.5)
		const announced = await page.locator('[data-slot="week-grid-announce"]').innerText()
		check('arrow: the screen reader line holds the new range', announced === (await weekText(page)), announced)

		await page.getByRole('button', { name: 'Next week' }).click()
		await settle(page)
		await page.getByRole('button', { name: 'Next week' }).click()
		await settle(page)
		const farther = await firstDate(page)
		await page.getByRole('button', { name: 'Today' }).click()
		await settle(page)
		check(
			'arrow: Today from two weeks away crossfades to the current week',
			(await firstDate(page)) === origin && farther === shiftDate(origin, 14)
		)
		await page.touchscreen.tap(200, 700)
		check('swipe: the grid still takes taps on empty cells after the turns', await dialogOpens(page))
	} finally {
		await context.unrouteAll({ behavior: 'ignoreErrors' })
		await context.close()
	}
}

async function reducedMotionChecks(browser) {
	const context = await browser.newContext({
		viewport: { width: 390, height: 844 },
		hasTouch: true,
		reducedMotion: 'reduce',
	})
	const page = await context.newPage()
	try {
		await openStubbed(page, context)
		const here = await firstDate(page)
		const sampling = sampleStrip(page, 500)
		await page.getByRole('button', { name: 'Next week' }).click()
		const samples = await sampling
		const slid = samples.some((sample) => Math.abs(translateX(sample.transform)) > 1)
		const faded = samples.some((sample) => sample.opacity < 0.9)
		check('reduced motion: the arrow crossfades and does not slide', faded && !slid, JSON.stringify({ faded, slid }))
		await settle(page)
		check('reduced motion: the crossfade lands on the next week', (await firstDate(page)) === shiftDate(here, 7))
	} finally {
		await context.unrouteAll({ behavior: 'ignoreErrors' })
		await context.close()
	}
}

async function tabletChecks(browser) {
	const context = await browser.newContext({ viewport: { width: 768, height: 1024 } })
	const page = await context.newPage()
	try {
		await openStubbed(page, context)
		check('tablet: no pager at 768px', (await page.locator('[data-paged]').count()) === 0)
		const here = await firstDate(page)
		await page.getByRole('button', { name: 'Next week' }).click()
		await page.waitForFunction(
			(date) =>
				document.querySelector('[data-page="current"] [data-slot="week-grid-day"]')?.getAttribute('data-date') !== date,
			here,
			{ timeout: 400 }
		)
		check('tablet: the week switches at once', (await firstDate(page)) === shiftDate(here, 7))
	} finally {
		await context.unrouteAll({ behavior: 'ignoreErrors' })
		await context.close()
	}
}

async function designMetrics(browser) {
	const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
	const page = await context.newPage()
	try {
		await openStubbed(page, context)
		const read = (selector, props) =>
			page
				.locator(selector)
				.first()
				.evaluate((element, names) => {
					const style = getComputedStyle(element)
					return Object.fromEntries(names.map((name) => [name, style[name]]))
				}, props)
		const today = await read('button[aria-label="Today"]', ['opacity'])
		check('metrics: Today is drawn at full strength like Previous and Next', today.opacity === '1', today.opacity)
		const frames = await page.evaluate(() =>
			['Today', 'Previous week', 'Next week'].map(
				(label) =>
					getComputedStyle(document.querySelector(`button[aria-label="${label}"] > span[aria-hidden]`)).boxShadow
			)
		)
		check(
			'metrics: Today, Previous and Next share the same frame',
			frames[0] === frames[1] && frames[1] === frames[2] && frames[0] !== 'none',
			frames[0]
		)
		const radius = await read('button[aria-label="Next week"]', ['borderRadius'])
		check(
			'metrics: toolbar buttons are rounded squares with an 8px radius',
			radius.borderRadius === '8px',
			radius.borderRadius
		)
		const heads = await page.evaluate(() =>
			[...document.querySelectorAll('[data-page="current"] [data-slot="week-grid-day"]')].map(
				(element) => getComputedStyle(element).borderLeftWidth
			)
		)
		check(
			'metrics: the day header has no vertical separators',
			heads.every((width) => width === '0px'),
			heads.join()
		)
		const weekday = await read(`${CURRENT} [data-slot="week-grid-day"] > span:first-child`, [
			'fontSize',
			'lineHeight',
			'fontWeight',
			'letterSpacing',
		])
		check(
			'metrics: the weekday is 11/16 weight 500 with no tracking',
			weekday.fontSize === '11px' &&
				weekday.lineHeight === '16px' &&
				weekday.fontWeight === '500' &&
				weekday.letterSpacing === 'normal',
			JSON.stringify(weekday)
		)
		const place = await page.evaluate(() => {
			const day = document.querySelector('[data-page="current"] [data-slot="week-grid-day"]').getBoundingClientRect()
			const circle = document
				.querySelector('[data-page="current"] [data-slot="week-grid-date"]')
				.getBoundingClientRect()
			const word = document
				.querySelector('[data-page="current"] [data-slot="week-grid-day"] > span:first-child')
				.getBoundingClientRect()
			return { word: word.top - day.top, circle: circle.top - day.top }
		})
		check(
			'metrics: the weekday sits 4px from the top and the circle follows it',
			place.word === 4 && place.circle === 20,
			JSON.stringify(place)
		)
		const block = page.locator(`${CURRENT} [data-event-key="phone-long"]`)
		const blockBox = await block.boundingBox()
		const textBox = await block.locator('> span').first().boundingBox()
		const blockStyle = await read(`${CURRENT} [data-event-key="phone-long"]`, [
			'borderRadius',
			'paddingLeft',
			'paddingTop',
		])
		check(
			'metrics: the block title starts 3px from the left and 2px from the top',
			Math.abs(textBox.x - blockBox.x - 3) < 0.6 && Math.abs(textBox.y - blockBox.y - 2) < 0.6,
			`${textBox.x - blockBox.x},${textBox.y - blockBox.y}`
		)
		check('metrics: the block has a 6px radius', blockStyle.borderRadius === '6px', blockStyle.borderRadius)
		const column = await page.locator(`${CURRENT} [data-slot="week-grid-column"]`).first().boundingBox()
		check(
			'metrics: the block is 1px in from the hairline and 3px short of the next column',
			Math.abs(blockBox.x - column.x - 1) < 0.6 && Math.abs(column.width - blockBox.width - 3) < 0.6,
			`${blockBox.x - column.x},${column.width - blockBox.width}`
		)
		const now = await page.evaluate(() => {
			const dot = document.querySelector('[data-slot="week-grid-now"] > span[aria-hidden]')
			const line = document.querySelector('[data-slot="week-grid-now"]')
			if (dot === null || line === null) return null
			const box = dot.getBoundingClientRect()
			return { size: box.width, offset: box.left - line.getBoundingClientRect().left }
		})
		check(
			'metrics: the now dot is 8px, centred on the line start',
			now?.size === 8 && now.offset === -4,
			JSON.stringify(now)
		)
		const tint = await page.evaluate(() => {
			const column = document.querySelector('[data-page="current"] [data-slot="week-grid-column"].bg-hover')
			return column === null
		})
		check('metrics: today column has no tint on a phone', tint)
	} finally {
		await context.unrouteAll({ behavior: 'ignoreErrors' })
		await context.close()
	}
}

const { browser, context, page, problems } = await launch({ width: SIZES[0].width, height: SIZES[0].height })
try {
	await signIn(page)
	await stubWeek(context)
	for (const size of SIZES) {
		await page.setViewportSize({ width: size.width, height: size.height })
		await scheduleChecks(page, size)
		await tabStrips(page, size)
	}
	await desktopSmoke(page)
	await designMetrics(browser)
	await swipeChecks(browser)
	await reducedMotionChecks(browser)
	await tabletChecks(browser)
	const errors = problems.filter((entry) => entry.startsWith('pageerror') || /hydrat/i.test(entry))
	check('no page errors or hydration warnings', errors.length === 0, errors.slice(0, 2).join(' | '))
} finally {
	await context.unrouteAll({ behavior: 'ignoreErrors' })
	await browser.close()
}
if (failures() > 0) process.exit(1)
console.log('SCHEDULE_PHONE_WEB_OK')
