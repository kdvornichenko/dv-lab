import { randomUUID } from 'node:crypto'

import { BASE, check, failures, launch, shot, signIn } from './web.mjs'

const playwright = process.env.PLAYWRIGHT_CORE ?? '/Volumes/T7/personal/ielts/node_modules/playwright-core/index.mjs'
const { chromium } = await import(playwright)

const ZONE = 'Asia/Ho_Chi_Minh'
const BODY = '[data-slot="week-grid-body"]'
const COLUMN = '[data-slot="week-grid-column"][data-page="current"]'
const MINUTE = 48 / 60
const NO_COLOR = { id: null, background: null, foreground: null, custom: false }
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function addDays(isoDate, count) {
	const date = new Date(`${isoDate}T00:00:00Z`)
	date.setUTCDate(date.getUTCDate() + count)
	return date.toISOString().slice(0, 10)
}

function instantAt(isoDate, hour, minute) {
	const [year, month, day] = isoDate.split('-').map(Number)
	const guess = Date.UTC(year, month - 1, day, hour, minute)
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: ZONE,
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
	['touch-a', 'Touch alpha', 1, 10, 0, 60],
	['touch-b', 'Touch bravo', 3, 15, 0, 60],
	['touch-night', 'Touch night', 1, 0, 30, 60],
]

function events(monday) {
	return PLAN.map(([id, title, day, hour, minute, length]) => ({
		eventKey: `${id}-${monday}`,
		version: 'v1',
		title,
		when: {
			kind: 'timed',
			startsAt: instantAt(addDays(monday, day), hour, minute),
			endsAt: instantAt(addDays(monday, day), hour, minute + length),
			timeZone: ZONE,
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

async function stub(context) {
	const calls = []
	await context.route(/\/api\/schedule\/week(\?|$)/, async (route) => {
		const response = await route.fetch()
		const body = await response.json()
		const start = new URL(route.request().url()).searchParams.get('start')
		return route.fulfill({
			response,
			json: {
				...body,
				read: { state: 'fresh', fetchedAt: new Date().toISOString(), revision: '1' },
				write: { state: 'ready' },
				snapshotRange: body.requestedRange,
				events: start === null ? [] : events(start),
				series: [],
			},
		})
	})
	const commands = new Map()
	await context.route(/\/api\/(google\/events|schedule\/(lessons|series))/, async (route) => {
		const request = route.request()
		if (request.method() !== 'POST') return route.continue()
		let body = null
		try {
			body = request.postDataJSON()
		} catch {
			body = null
		}
		calls.push({ path: new URL(request.url()).pathname, body })
		const commandId = randomUUID()
		commands.set(commandId, body?.requestId)
		return route.fulfill({ status: 202, json: { commandId, statusUrl: `/api/google/commands/${commandId}` } })
	})
	await context.route(/\/api\/google\/commands\//, async (route) => {
		const key = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop())
		if (!commands.has(key) && ![...commands.values()].includes(key)) return route.continue()
		return route.fulfill({
			json: {
				commandId: key,
				requestId: commands.get(key) ?? key,
				generation: 1,
				expectedVersion: 'v1',
				operation: 'move',
				affectedRefs: [],
				state: 'failed',
				effect: 'none',
				issue: 'not_applied',
				confirmedRevision: null,
				nextAction: 'retry_new_command',
			},
		})
	})
	return calls
}

async function columnBox(page, index) {
	return page.locator(COLUMN).nth(index).boundingBox()
}

async function yAt(page, index, hour, minute = 0) {
	const box = await columnBox(page, index)
	return box.y + (hour * 60 + minute) * MINUTE
}

async function reveal(page, hour) {
	await page.locator(BODY).evaluate(
		(body, top) => {
			body.scrollTop = Math.max(0, top - body.clientHeight / 2)
		},
		hour * 60 * MINUTE
	)
	await wait(300)
}

async function touch(cdp, type, point) {
	await cdp.send('Input.dispatchTouchEvent', {
		type,
		touchPoints: point ? [{ x: Math.round(point.x), y: Math.round(point.y), id: 1 }] : [],
	})
}

async function slide(cdp, from, to, steps = 12) {
	for (let step = 1; step <= steps; step++) {
		await touch(cdp, 'touchMove', {
			x: from.x + ((to.x - from.x) * step) / steps,
			y: from.y + ((to.y - from.y) * step) / steps,
		})
		await wait(16)
	}
}

async function frameRange(page, slot) {
	return page
		.locator(`[data-slot="${slot}"][data-state="drag"]`)
		.first()
		.getAttribute('data-range', { timeout: 1000 })
		.catch(() => null)
}

async function moveOpened(page, title) {
	const dialog = page.getByRole('dialog').last()
	const shown = await dialog
		.waitFor({ timeout: 8000 })
		.then(() => true)
		.catch(() => false)
	const text = shown ? await dialog.innerText() : ''
	await page.keyboard.press('Escape')
	await dialog.waitFor({ state: 'detached', timeout: 8000 }).catch(() => undefined)
	return shown && text.startsWith(title)
}

async function weekLabel(page) {
	return page.locator('[data-slot="schedule-week-picker"]').first().innerText()
}

async function phoneChecks() {
	const browser = await chromium.launch()
	const context = await browser.newContext({
		viewport: { width: 390, height: 844 },
		hasTouch: true,
		isMobile: true,
		timezoneId: ZONE,
	})
	const page = await context.newPage()
	const problems = []
	page.on('pageerror', (error) => problems.push(String(error).slice(0, 200)))
	await stub(context)
	await signIn(page)
	await page.goto(`${BASE}/schedule`, { timeout: 120000 })
	await page.locator(`${COLUMN} [data-event-key^="touch-a"]`).first().waitFor({ timeout: 30000 })
	const opening = await page.locator(BODY).evaluate((body, minute) => {
		const parts = new Intl.DateTimeFormat('en-GB', {
			timeZone: 'Asia/Ho_Chi_Minh',
			hourCycle: 'h23',
			hour: '2-digit',
			minute: '2-digit',
		}).format(new Date())
		const minutes = Number(parts.slice(0, 2)) * 60 + Number(parts.slice(3, 5))
		const wanted = Math.min(
			Math.max(minutes * minute - body.clientHeight / 2, 0),
			body.scrollHeight - body.clientHeight
		)
		return { top: body.scrollTop, wanted }
	}, MINUTE)
	check(
		'phone: the current week opens with now in the middle of the grid',
		Math.abs(opening.top - opening.wanted) <= 2,
		JSON.stringify(opening)
	)
	const hours = await page.evaluate(() => ({
		lines: document.querySelectorAll('[data-slot="week-grid-line"]').length,
		labels: Array.from(document.querySelectorAll('[data-slot="week-grid-gutter"] > div')).map((node) =>
			node.textContent.trim()
		),
	}))
	check(
		'phone: the column runs 00:00 to 02:00 of the next day (26 rows)',
		hours.lines === 26 && hours.labels.length === 26 && hours.labels[0] !== hours.labels[2],
		`${hours.lines} ${hours.labels.slice(0, 3).join(',')}…${hours.labels.slice(-3).join(',')}`
	)
	const night = await page.locator(`${COLUMN} [data-event-key^="touch-night"]`).evaluateAll((nodes) =>
		nodes.map((node) => ({
			date: node.closest('[data-slot="week-grid-column"]').dataset.date,
			top: Math.round(parseFloat(node.style.top)),
		}))
	)
	check(
		'phone: a 00:30 event is drawn at the foot of the evening column and at the top of its own date',
		night.length === 2 &&
			night.some((item) => item.top === Math.round(1470 * MINUTE)) &&
			night.some((item) => item.top === 24),
		JSON.stringify(night)
	)

	const cdp = await context.newCDPSession(page)
	await reveal(page, 14)
	const before = await page.locator(BODY).evaluate((body) => body.scrollTop)
	const column = await columnBox(page, 2)
	const press = { x: column.x + column.width / 2, y: await yAt(page, 2, 14, 5) }
	await touch(cdp, 'touchStart', press)
	await wait(200)
	check(
		'phone: a short hold shows no frame yet',
		(await page.locator('[data-slot="week-grid-frame"][data-state="drag"]').count()) === 0
	)
	await wait(450)
	check('phone: a long press shows a 60-minute frame', (await frameRange(page, 'week-grid-frame')) === '14:00–15:00')
	await slide(cdp, press, { x: press.x, y: press.y + 48 })
	check('phone: dragging down stretches the end', (await frameRange(page, 'week-grid-frame')) === '14:00–16:00')
	await slide(cdp, { x: press.x, y: press.y + 48 }, { x: press.x, y: press.y - 96 })
	check(
		'phone: dragging up past the start flips the frame above it',
		(await frameRange(page, 'week-grid-frame')) === '13:00–14:00'
	)
	check(
		'phone: the grid does not scroll while the frame is dragged',
		Math.abs((await page.locator(BODY).evaluate((body) => body.scrollTop)) - before) < 1
	)
	await touch(cdp, 'touchEnd')
	const created = page.getByRole('dialog').last()
	const createdShown = await created
		.waitFor({ timeout: 8000 })
		.then(() => true)
		.catch(() => false)
	const createdText = createdShown ? await created.innerText() : ''
	check(
		'phone: release opens New lesson at 13:00',
		createdShown && createdText.includes('13:00'),
		createdText.slice(0, 160)
	)
	await shot(page, 'touch', 'phone-create')
	await page.keyboard.press('Escape')
	await created.waitFor({ state: 'detached', timeout: 8000 }).catch(() => undefined)

	await reveal(page, 16)
	const tapColumn = await columnBox(page, 4)
	const tap = { x: tapColumn.x + tapColumn.width / 2, y: await yAt(page, 4, 16, 5) }
	await touch(cdp, 'touchStart', tap)
	await wait(80)
	await touch(cdp, 'touchEnd')
	const tapped = page.getByRole('dialog').last()
	const tapShown = await tapped
		.waitFor({ timeout: 8000 })
		.then(() => true)
		.catch(() => false)
	check('phone: a tap on an empty cell still opens New lesson', tapShown)
	await page.keyboard.press('Escape')
	await tapped.waitFor({ state: 'detached', timeout: 8000 }).catch(() => undefined)

	await reveal(page, 10)
	const block = await page.locator(`${COLUMN} [data-event-key^="touch-a"]`).first().boundingBox()
	const grip = { x: block.x + block.width / 2, y: block.y + 10 }
	const next = await columnBox(page, 2)
	await touch(cdp, 'touchStart', grip)
	await wait(650)
	const target = { x: next.x + next.width / 2, y: grip.y + 48 }
	await slide(cdp, grip, target)
	check(
		'phone: a long press on a block carries it to another day and hour',
		(await frameRange(page, 'week-grid-move-frame')) === '11:00–12:00',
		String(await frameRange(page, 'week-grid-move-frame'))
	)
	await touch(cdp, 'touchEnd')
	await wait(800)
	check('phone: the drop starts the move of that block', await moveOpened(page, 'Touch alpha'))

	await reveal(page, 15)
	const week = await weekLabel(page)
	const bravo = await page.locator(`${COLUMN} [data-event-key^="touch-b"]`).first().boundingBox()
	const hold = { x: bravo.x + bravo.width / 2, y: bravo.y + 10 }
	await touch(cdp, 'touchStart', hold)
	await wait(650)
	const edge = { x: 386, y: hold.y }
	await slide(cdp, hold, edge)
	await wait(1100)
	const turned = await weekLabel(page)
	check('phone: holding a block at the right edge turns the week', turned !== week, `${week} -> ${turned}`)
	check('phone: the carried frame survives the turn', (await frameRange(page, 'week-grid-move-frame')) !== null)
	await slide(cdp, edge, { x: 200, y: hold.y })
	await wait(700)
	check('phone: leaving the edge stops the turning', (await weekLabel(page)) === turned)
	const dropAt = await frameRange(page, 'week-grid-move-frame')
	await touch(cdp, 'touchEnd')
	check('phone: the drop in the next week starts the move', await moveOpened(page, 'Touch bravo'), String(dropAt))

	const swipeFrom = { x: 300, y: 500 }
	const swipeLabel = await weekLabel(page)
	await touch(cdp, 'touchStart', swipeFrom)
	await slide(cdp, swipeFrom, { x: 60, y: 505 }, 8)
	await touch(cdp, 'touchEnd')
	await wait(900)
	check('phone: a swipe still turns the week after the gestures', (await weekLabel(page)) !== swipeLabel)
	check('phone: no page errors', problems.length === 0, problems.join(' | '))
	await browser.close()
}

async function laptopChecks() {
	const { browser, context, page, problems } = await launch({ width: 1280, height: 720, timezoneId: ZONE })
	await stub(context)
	await signIn(page)
	await page.goto(`${BASE}/schedule`, { timeout: 120000 })
	await page.locator(`${COLUMN} [data-event-key^="touch-b"]`).first().waitFor({ timeout: 30000 })
	const labels = await page.evaluate(
		() => Array.from(document.querySelectorAll('[data-slot="week-grid-gutter"] > div')).length
	)
	check('laptop: the gutter has 26 rows', labels === 26, String(labels))
	await reveal(page, 15)
	await page.locator(`${COLUMN} [data-event-key^="touch-b"]`).first().click()
	check('laptop: a click on a movable block opens it', await moveOpened(page, 'Touch bravo'))
	const free = await columnBox(page, 5)
	const top = await yAt(page, 5, 14, 5)
	await page.mouse.move(free.x + free.width / 2, top)
	await page.mouse.down()
	await page.mouse.move(free.x + free.width / 2, top + 6, { steps: 2 })
	await page.mouse.move(free.x + free.width / 2, top + 90, { steps: 8 })
	check(
		'laptop: a mouse drag draws the frame from the pressed slot',
		(await frameRange(page, 'week-grid-frame')) === '14:00–16:00'
	)
	await page.mouse.up()
	const created = page.getByRole('dialog').last()
	const createdText = await created
		.waitFor({ timeout: 8000 })
		.then(() => created.innerText())
		.catch(() => '')
	check(
		'laptop: release opens New lesson at 14:00',
		createdText.startsWith('New lesson') && createdText.includes('14:00')
	)
	await page.keyboard.press('Escape')
	await created.waitFor({ state: 'detached', timeout: 8000 }).catch(() => undefined)
	const title = await page.locator('[data-slot="schedule-toolbar"]').first().innerText()
	const bravo = await page.locator(`${COLUMN} [data-event-key^="touch-b"]`).first().boundingBox()
	const from = { x: bravo.x + bravo.width / 2, y: bravo.y + 10 }
	const last = await columnBox(page, 6)
	await page.mouse.move(from.x, from.y)
	await page.mouse.down()
	await page.mouse.move(from.x + 8, from.y + 4, { steps: 3 })
	await page.mouse.move(last.x + last.width - 6, from.y, { steps: 12 })
	await wait(1100)
	const turned = await page.locator('[data-slot="schedule-toolbar"]').first().innerText()
	check('laptop: holding a block at the right edge turns the week', turned !== title, `${title} -> ${turned}`)
	await page.mouse.move(last.x - 200, from.y, { steps: 6 })
	await wait(300)
	check('laptop: the frame follows into the new week', (await frameRange(page, 'week-grid-move-frame')) !== null)
	await page.mouse.up()
	check('laptop: the drop in the next week starts the move', await moveOpened(page, 'Touch bravo'))
	const real = problems.filter(
		(problem) => !problem.includes('server caches disabled') && !problem.includes('status of')
	)
	check('laptop: no page errors', real.length === 0, real.join(' | '))
	await browser.close()
}

await phoneChecks()
await laptopChecks()

const failed = failures()
if (failed > 0) {
	console.log(`SCHEDULE_TOUCH_FAILED ${failed}`)
	process.exit(1)
}
console.log('SCHEDULE_TOUCH_OK')
