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
	const day = await page.locator('[data-slot="week-grid-day"]').first().boundingBox()
	check(`${tag}: the day header is 64px`, Math.abs(day.height - 64) < 0.6, String(day.height))
	const circle = await page.locator('[data-slot="week-grid-date"]').first().boundingBox()
	check(`${tag}: the date circle is 36px`, Math.abs(circle.width - 36) < 0.6 && Math.abs(circle.height - 36) < 0.6)
	const lines = await page.evaluate(() => {
		const top = (hour) =>
			document.querySelector(`[data-slot="week-grid-line"][data-hour="${hour}"]`).getBoundingClientRect().top
		return top(9) - top(8)
	})
	check(`${tag}: an hour is 48px`, Math.abs(lines - 48) < 0.6, String(lines))
	const gutter = await page.locator('[data-slot="week-grid-gutter"]').boundingBox()
	check(`${tag}: the gutter is 36px`, Math.abs(gutter.width - 36) < 0.6, String(gutter.width))
	const long = page.locator('[data-event-key="phone-long"]')
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
		.locator('[data-event-key="phone-half"]')
		.evaluate((element) => element.firstElementChild?.getBoundingClientRect().height ?? 0)
	check(`${tag}: a half-hour block shows one line`, Math.abs(half - 14) < 0.6, String(half))
	const quickText = await page.locator('[data-event-key="phone-quick"]').evaluate((element) => element.textContent)
	check(`${tag}: a block under 30 minutes is colour only`, quickText === '', JSON.stringify(quickText))
	const pairs = await page.evaluate(() =>
		['a', 'b', 'c'].map((id) => {
			const block = document.querySelector(`[data-event-key="phone-pair-${id}"]`)
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
	await page.locator(`[data-event-key="phone-long"]`).click()
	check(`${tag}: a tap on a block opens its dialog`, await dialogOpens(page))
	const column = await page.locator('[data-slot="week-grid-column"]').nth(3).boundingBox()
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
	const errors = problems.filter((entry) => entry.startsWith('pageerror') || /hydrat/i.test(entry))
	check('no page errors or hydration warnings', errors.length === 0, errors.slice(0, 2).join(' | '))
} finally {
	await context.unrouteAll({ behavior: 'ignoreErrors' })
	await browser.close()
}
if (failures() > 0) process.exit(1)
console.log('SCHEDULE_PHONE_WEB_OK')
