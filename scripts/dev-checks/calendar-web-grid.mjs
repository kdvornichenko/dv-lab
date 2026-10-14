import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

import { BASE, ROOT, STATE_DIR, check, failures, launch, shot, signIn, theme } from './web.mjs'

const NODE = process.execPath
const SEED = `${ROOT}/scripts/dev-checks/calendar-seed.mjs`
const WAIT = `${ROOT}/scripts/dev-checks/wait-dev.mjs`
const VIEWPORTS = [
	{ width: 1440, height: 820 },
	{ width: 1280, height: 720 },
]
const PALETTE = {
	1: '#a4bdfc',
	2: '#7ae7bf',
	3: '#dbadff',
	4: '#ff887c',
	5: '#fbd75b',
	6: '#ffb878',
	9: '#5484ed',
	10: '#51b749',
	11: '#dc2127',
}
const CALENDAR_COLOR = '#5484ed'
const INK = '#1d1d1d'
const BODY = '[data-slot="week-grid-body"] [data-slot="calendar-event"]'
const BAND = '[data-slot="calendar-all-day"] [data-slot="calendar-event"]'
const POLL_WINDOW_MS = 25000

const real = (problems) => problems.filter((problem) => !problem.includes('server caches disabled'))
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function seed(...args) {
	const result = spawnSync(NODE, [SEED, ...args], { encoding: 'utf8' })
	if (result.status !== 0)
		throw new Error(`seed ${args.join(' ')} failed: ${(result.stdout + result.stderr).slice(-200)}`)
	return result.stdout
}

function rgbOf(hex) {
	const value = hex.replace('#', '')
	return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16))
}

function css(hex) {
	const [red, green, blue] = rgbOf(hex)
	return `rgb(${red}, ${green}, ${blue})`
}

function luminance(channels) {
	const [red, green, blue] = channels.map((value) => {
		const unit = value / 255
		return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
	})
	return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrast(first, second) {
	const one = luminance(first)
	const two = luminance(second)
	return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05)
}

function parseRgb(text) {
	return (text.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number)
}

function expectedInk(hex) {
	return contrast(rgbOf(hex), [255, 255, 255]) > contrast(rgbOf(hex), rgbOf(INK)) ? 'rgb(255, 255, 255)' : css(INK)
}

const owned = []

async function startStack() {
	const down = spawnSync(NODE, [WAIT, 'down'], { encoding: 'utf8' })
	if (down.status !== 0) {
		console.log('stack already running, reusing it')
		return
	}
	owned.push(
		spawn(NODE, [`${ROOT}/scripts/dev-checks/calendar-dev-api.mjs`], { cwd: ROOT, detached: true, stdio: 'ignore' })
	)
	owned.push(spawn('yarn', ['workspace', '@dv-lab/web', 'dev'], { cwd: ROOT, detached: true, stdio: 'ignore' }))
	const up = spawnSync(NODE, [WAIT, 'up'], { encoding: 'utf8' })
	if (up.status !== 0) throw new Error('dev stack did not come up')
}

async function stopStack() {
	for (const child of owned) {
		try {
			process.kill(-child.pid, 'SIGTERM')
		} catch {
			continue
		}
	}
	if (owned.length === 0) return
	for (let attempt = 0; attempt < 30; attempt += 1) {
		const down = spawnSync(NODE, [WAIT, 'down'], { encoding: 'utf8' })
		if (down.status === 0) return
		await wait(1000)
	}
	for (const child of owned) {
		try {
			process.kill(-child.pid, 'SIGKILL')
		} catch {
			continue
		}
	}
}

async function info(locator) {
	return locator.evaluate((element) => {
		const style = getComputedStyle(element)
		const title = element.querySelector('span')
		return {
			background: style.backgroundColor,
			image: style.backgroundImage,
			color: style.color,
			weight: title ? getComputedStyle(title).fontWeight : '',
			top: element.style.top,
			height: element.getBoundingClientRect().height,
			binding: element.dataset.binding,
			status: element.dataset.status,
		}
	})
}

async function openSchedule(page) {
	await page.goto(`${BASE}/schedule`, { timeout: 120000 })
	await page.locator(BODY).first().waitFor({ timeout: 120000 })
	await page.waitForTimeout(1200)
}

async function grid(viewport) {
	const label = `${viewport.width}x${viewport.height}`
	const { browser, page, problems } = await launch(viewport)
	try {
		await signIn(page)
		await openSchedule(page)
		const block = (title) => page.locator(BODY, { hasText: title })
		const chips = page.locator(BAND)

		for (const [title, id] of [
			['Synthetic event 01', 1],
			['Synthetic event 02', 2],
			['Synthetic event 03', 3],
			['Synthetic event 04', 4],
			['Synthetic event 05', 5],
			['Synthetic event 15', 6],
			['Synthetic event 12', 9],
		]) {
			const data = await info(block(title).first())
			const hex = PALETTE[id]
			check(`${label} ${title} fill is palette colour ${id}`, data.background === css(hex), data.background)
			check(`${label} ${title} ink follows contrast`, data.color === expectedInk(hex), data.color)
			check(
				`${label} ${title} contrast at least 4.5`,
				contrast(parseRgb(data.background), parseRgb(data.color)) >= 4.5,
				contrast(parseRgb(data.background), parseRgb(data.color)).toFixed(2)
			)
		}
		for (const title of ['Synthetic event 06', 'Synthetic event 07']) {
			const data = await info(block(title).first())
			check(`${label} ${title} uses the calendar colour`, data.background === css(CALENDAR_COLOR), data.background)
		}

		const tentative = await info(block('Synthetic event 08').first())
		check(
			`${label} tentative block has the hatch`,
			tentative.image.includes('repeating-linear-gradient'),
			tentative.image.slice(0, 40)
		)
		check(
			`${label} tentative block has no solid fill`,
			tentative.background === 'rgba(0, 0, 0, 0)',
			tentative.background
		)
		check(`${label} tentative title is regular weight`, tentative.weight === '400', tentative.weight)
		check(`${label} cancelled plain event is absent`, (await page.getByText('Synthetic event 09').count()) === 0)

		const titles = new Set(await chips.evaluateAll((nodes) => nodes.map((node) => node.textContent.trim())))
		check(`${label} all-day band holds two events`, titles.size === 2, [...titles].join(' | '))
		const geometry = await page.evaluate(() => {
			const band = document.querySelector('[data-slot="calendar-all-day"]').getBoundingClientRect()
			const body = document.querySelector('[data-slot="week-grid-body"]').getBoundingClientRect()
			const heights = [...document.querySelectorAll('[data-slot="calendar-all-day"] [data-slot="calendar-event"]')].map(
				(node) => node.getBoundingClientRect().height
			)
			return { bandBottom: band.bottom, bodyTop: body.top, heights }
		})
		check(`${label} band sits above the grid`, geometry.bandBottom <= geometry.bodyTop + 0.5)
		check(
			`${label} chips are 24px high`,
			geometry.heights.every((height) => Math.abs(height - 24) < 0.6),
			geometry.heights.join(',')
		)
		const green = await info(chips.filter({ hasText: 'Synthetic event 10' }).first())
		check(`${label} all-day chip uses its colour`, green.background === css(PALETTE[10]), green.background)

		const chip = chips.filter({ hasText: 'Synthetic event 10' }).first()
		const box = await chip.boundingBox()
		await page.mouse.move(box.x + 20, box.y + 12)
		await page.mouse.down()
		await page.mouse.move(box.x + 60, box.y + 80, { steps: 6 })
		const during = await page.locator('[data-slot="week-grid-move-frame"], [data-slot="week-grid-frame"]').count()
		await page.mouse.move(box.x + 260, box.y + 160, { steps: 6 })
		await page.mouse.up()
		await page.waitForTimeout(300)
		const moved = await chip.boundingBox()
		check(
			`${label} all-day chip does not start a drag`,
			during === 0 &&
				Math.abs(moved.x - box.x) < 1 &&
				Math.abs(moved.y - box.y) < 1 &&
				(await page.getByRole('dialog').count()) === 0
		)

		await block('Synthetic event 15').first().hover()
		const place = page.locator('[data-slot="event-tooltip"][data-variant="plain"]')
		await place.waitFor({ timeout: 5000 })
		const tip = await place.innerText()
		check(
			`${label} tooltip shows the place line`,
			tip.includes('Synthetic room 1') && tip.includes('Synthetic event 15'),
			tip.replace(/\n/g, ' | ')
		)
		await page.mouse.move(2, 400)
		await place.waitFor({ state: 'detached', timeout: 5000 })
		await block('Synthetic event 14').first().hover()
		await page.locator('[data-slot="event-tooltip"][data-variant="plain"]').waitFor({ timeout: 5000 })
		const readOnly = await page.locator('[data-slot="event-tooltip"][data-variant="plain"]').innerText()
		check(
			`${label} read-only event tooltip names Google Calendar`,
			readOnly.includes('Read-only. Change it in Google Calendar.'),
			readOnly.replace(/\n/g, ' | ')
		)
		await page.mouse.move(2, 400)
		await place.waitFor({ state: 'detached', timeout: 5000 })
		await block('Synthetic event 08').first().hover()
		await page.locator('[data-slot="event-tooltip"][data-variant="plain"]').waitFor({ timeout: 5000 })
		check(
			`${label} tentative tooltip says Tentative`,
			(await page.locator('[data-slot="event-tooltip"][data-variant="plain"]').innerText()).includes('Tentative')
		)
		await page.mouse.move(2, 400)
		await shot(page, 'calendar-grid', label)
		check(`${label} no console problems`, real(problems).length === 0, real(problems).slice(0, 2).join(' || '))
	} finally {
		await browser.close()
	}
}

async function transforms() {
	const { browser, page, problems } = await launch(VIEWPORTS[0])
	try {
		await page.route('**/api/schedule/week**', async (route) => {
			const response = await route.fetch()
			const json = await response.json()
			for (const event of json.events) {
				if (event.title === 'Synthetic event 06')
					event.binding = {
						kind: 'lesson',
						ref: { kind: 'single', lessonId: randomUUID() },
						studentId: randomUUID(),
						version: event.version,
						mark: null,
					}
				if (event.title === 'Synthetic event 07')
					event.color = { id: '11', background: PALETTE[11], foreground: INK, custom: false }
				if (event.title === 'Synthetic event 03') event.binding = { kind: 'transition', commandId: randomUUID() }
			}
			await route.fulfill({ response, json })
		})
		await signIn(page)
		await openSchedule(page)
		const lesson = await info(page.locator(BODY, { hasText: 'Synthetic event 06' }).first())
		const probe = await page.evaluate(() => {
			const element = document.createElement('div')
			element.style.background = 'var(--selected)'
			document.body.appendChild(element)
			const value = getComputedStyle(element).backgroundColor
			element.remove()
			return value
		})
		check(
			'lesson block keeps selected',
			lesson.binding === 'lesson' && lesson.background === probe,
			`${lesson.background} vs ${probe}`
		)
		const tomato = await info(page.locator(BODY, { hasText: 'Synthetic event 07' }).first())
		check(
			'dark fill gets white ink',
			tomato.background === css(PALETTE[11]) && tomato.color === 'rgb(255, 255, 255)',
			`${tomato.background} ${tomato.color}`
		)
		check(
			'white ink contrast at least 4.5',
			contrast(parseRgb(tomato.background), parseRgb(tomato.color)) >= 4.5,
			contrast(parseRgb(tomato.background), parseRgb(tomato.color)).toFixed(2)
		)
		await shot(page, 'calendar-grid', 'lesson-and-white-ink')
		const unconfirmed = page.locator(BODY, { hasText: 'Synthetic event 03' }).first()
		const marked = await unconfirmed.evaluate((element) => ({
			binding: element.dataset.binding,
			mark: element.dataset.mark ?? null,
			opacity: getComputedStyle(element).opacity,
			label: element.getAttribute('aria-label') ?? '',
		}))
		check(
			'a transition block is dimmed and named not confirmed',
			marked.binding === 'transition' &&
				marked.mark === 'unconfirmed' &&
				Number(marked.opacity) < 1 &&
				marked.label.includes('not confirmed'),
			JSON.stringify(marked)
		)
		check(
			'only the transition block carries the triangle and nothing spins',
			(await page.locator('[data-slot="calendar-event-unconfirmed"]').count()) === 1 &&
				(await unconfirmed.locator('[data-slot="calendar-event-unconfirmed"]').count()) === 1 &&
				(await page.locator('[data-slot="calendar-event-pending"]').count()) === 0 &&
				(await page.locator(BODY, { hasText: 'Synthetic event 06' }).first().getAttribute('data-mark')) === null
		)
		await shot(page, 'calendar-grid', 'transition-triangle')
		await unconfirmed.click()
		const notConfirmed = page.getByRole('dialog').last()
		await notConfirmed.getByText('This change has not been confirmed.').waitFor({ timeout: 15000 })
		check(
			'the dialog of a transition block says it is not confirmed, links Check status and offers no Edit event',
			(await notConfirmed.getByRole('link', { name: 'Check status' }).count()) === 1 &&
				(await notConfirmed.getByRole('button', { name: 'Edit event' }).count()) === 0 &&
				(await notConfirmed.getByRole('button', { name: 'Delete event' }).count()) === 0
		)
		await page.keyboard.press('Escape')
		await page.waitForTimeout(500)
		check(
			'transform page has no console problems',
			real(problems).length === 0,
			real(problems).slice(0, 2).join(' || ')
		)
	} finally {
		await browser.close()
	}
}

async function live() {
	const { browser, context, page } = await launch(VIEWPORTS[0])
	try {
		await page.addInitScript(() => {
			window.__events = 0
			window.addEventListener('focus', () => (window.__events += 1))
			window.addEventListener('blur', () => (window.__events += 1))
			document.addEventListener('visibilitychange', () => (window.__events += 1))
		})
		await signIn(page)
		await openSchedule(page)
		const block = page.locator(BODY, { hasText: 'Synthetic event 06' }).first()
		const before = (await info(block)).top
		await page.evaluate(() => (window.__events = 0))
		const scrollBefore = await page.locator('[data-slot="week-grid-body"]').evaluate((node) => node.scrollTop)
		seed('bump', 'dev', 'dvseed06')
		const started = Date.now()
		let after = before
		while (Date.now() - started < POLL_WINDOW_MS && after === before) {
			await wait(500)
			after = (await info(page.locator(BODY, { hasText: 'Synthetic event 06' }).first())).top
		}
		check(
			'moved block appears without reload or focus',
			after !== before,
			`${before} -> ${after} in ${Date.now() - started} ms`
		)
		check('no focus or visibility event fired', (await page.evaluate(() => window.__events)) === 0)
		const scroll = await page.locator('[data-slot="week-grid-body"]').evaluate((node) => node.scrollTop)
		check('scroll position was kept', scroll > 0 && scroll === scrollBefore, `${scrollBefore} -> ${scroll}`)

		const today = await context.newPage()
		const seen = { today: false, week: false }
		today.on('request', (request) => {
			const url = request.url()
			if (url.includes('/api/today')) seen.today = true
			if (url.includes('/api/schedule/week')) seen.week = true
		})
		await today.goto(`${BASE}/`, { timeout: 120000 })
		await today.waitForLoadState('networkidle')
		await today.waitForTimeout(1500)
		seen.today = false
		seen.week = false
		seed('bump', 'dev', 'dvseed06')
		const todayStart = Date.now()
		while (Date.now() - todayStart < POLL_WINDOW_MS && !(seen.today && seen.week)) await wait(500)
		check('Today refetches by itself after a revision change', seen.today && seen.week, `${Date.now() - todayStart} ms`)
		await today.close()
	} finally {
		await browser.close()
	}
}

async function readStatus() {
	const { browser, page } = await launch(VIEWPORTS[0])
	try {
		await signIn(page)
		seed('state', 'dev', 'running')
		await openSchedule(page)
		const button = page.locator('[data-slot="calendar-read-status-button"][data-tone="running"]')
		await button.waitFor({ timeout: 30000 })
		const spinning = await button.locator('svg.animate-spin').count()
		check('status icon spins while a full check runs', spinning === 1)
		check(
			'status icon names the check',
			(await button.getByRole('button').getAttribute('aria-label')) === 'Checking Google Calendar…'
		)
		await button.getByRole('button').click()
		const popup = page.getByText('A full check is running.')
		await popup.waitFor({ timeout: 5000 })
		const popover = await page.locator('[data-slot="calendar-read-status"]').innerText()
		check(
			'popover holds two facts and no button',
			popover.includes('A full check is running.') &&
				popover.includes('Last checked') &&
				(await page.locator('[data-slot="calendar-read-status"] button').count()) === 0,
			popover.replace(/\n/g, ' | ')
		)
		await shot(page, 'calendar-status', 'running-popover')
		await page.keyboard.press('Escape')

		seed('state', 'dev', 'failed')
		await openSchedule(page)
		const failed = page.locator('[data-slot="calendar-read-status-button"]')
		await failed.waitFor({ timeout: 30000 })
		check('failed check shows the warning tone', (await failed.getAttribute('data-tone')) === 'warning')

		seed('state', 'dev', 'running')
		const phone = await launch({ width: 390, height: 844 })
		try {
			await signIn(phone.page)
			await phone.page.goto(`${BASE}/schedule`, { timeout: 120000 })
			const notice = phone.page.locator('[data-slot="calendar-read-status"]').first()
			await notice.waitFor({ timeout: 60000 })
			await phone.page.getByText('A full check is running.').waitFor({ timeout: 30000 })
			const text = await notice.innerText()
			check(
				'phone notice keeps Last checked and adds the running line',
				text.includes('Last checked') && text.includes('A full check is running.'),
				text.replace(/\n/g, ' | ')
			)
			check('phone Refresh is pending', await phone.page.getByRole('button', { name: 'Refresh' }).first().isDisabled())
			await shot(phone.page, 'calendar-status', 'phone-running')
		} finally {
			await phone.browser.close()
		}
		seed('state', 'dev', 'idle')
	} finally {
		await browser.close()
	}
}

async function settings() {
	const { browser, page, problems } = await launch(VIEWPORTS[0])
	await page.route('**/api/google/calendars', (route) =>
		route.fulfill({
			json: {
				calendars: [
					{
						id: 'synthetic-calendar',
						label: 'Synthetic calendar',
						timeZone: 'Asia/Ho_Chi_Minh',
						primary: true,
						current: true,
						color: null,
					},
				],
			},
		})
	)
	const open = async (state) => {
		seed('state', 'dev', state)
		await page.goto(`${BASE}/settings?tab=calendar`, { timeout: 120000 })
		await page.locator(`[data-slot="calendar-sync-state"][data-sync="${state}"]`).waitFor({ timeout: 60000 })
	}
	const slot = page.locator('[data-slot="calendar-sync-state"]')
	const positions = []
	const measure = async () => {
		const box = await slot.boundingBox()
		const next = await page.getByText(/^Unconfirmed changes:/).boundingBox()
		positions.push(Math.round(next.y))
		return box.height
	}
	try {
		await signIn(page)
		await open('idle')
		const idleText = (await slot.innerText()).trim()
		check(
			'idle shows the last check in the main zone',
			/^Last checked \w{3} \d{1,2} \w{3}, \d{2}:\d{2} \(\w+\)$/.test(idleText),
			idleText
		)
		check('idle slot is reserved at 112px', (await measure()) >= 112)
		await shot(page, 'calendar-settings', 'idle')

		await open('running')
		const runningText = (await slot.innerText()).replace(/\n/g, ' | ')
		check(
			'running shows the spinner line and the previous check',
			runningText.startsWith('A full check is running.') && runningText.includes('Last checked'),
			runningText
		)
		check('running has a 16px spinner', (await slot.locator('svg.animate-spin').count()) === 1)
		check('running slot is reserved at 112px', (await measure()) >= 112)
		await shot(page, 'calendar-settings', 'running')

		await open('failed')
		const failedText = (await slot.innerText()).replace(/\n/g, ' | ')
		check(
			'failed shows the banner and Refresh status',
			failedText.includes('Could not finish the last calendar check. The schedule shows the last checked view.') &&
				(await slot.getByRole('button', { name: 'Refresh status' }).count()) === 1,
			failedText
		)
		check('failed has no time line', !failedText.includes('Last checked'))
		check('failed slot is reserved at 112px', (await measure()) >= 112)
		await shot(page, 'calendar-settings', 'failed')
		check('nothing shifts between states', new Set(positions).size === 1, positions.join(','))

		seed('state', 'dev', 'idle')
		const started = Date.now()
		await slot.and(page.locator('[data-sync="idle"]')).waitFor({ timeout: POLL_WINDOW_MS })
		check('Settings follows the server without reload', true, `${Date.now() - started} ms`)

		const off = await launch(VIEWPORTS[0])
		try {
			await off.page.route('**/api/google/sync', (route) =>
				route.fulfill({
					json: { state: 'off', revision: '0', lastCheckedAt: null, windowStart: null, windowEnd: null },
				})
			)
			await signIn(off.page)
			await off.page.goto(`${BASE}/settings?tab=calendar`, { timeout: 120000 })
			await off.page.locator('[data-slot="calendar-sync-state"][data-sync="off"]').waitFor({ timeout: 60000 })
			check(
				'off says sync is off',
				(await off.page.locator('[data-slot="calendar-sync-state"]').innerText()).includes(
					'Sync is off. Connect Google Calendar to resume.'
				)
			)
		} finally {
			await off.browser.close()
		}

		const loading = await launch(VIEWPORTS[0])
		try {
			await loading.page.route('**/api/google/sync', async (route) => {
				await wait(4000)
				await route.continue()
			})
			await signIn(loading.page)
			await loading.page.goto(`${BASE}/settings?tab=calendar`, { timeout: 120000 })
			await loading.page.locator('[data-slot="calendar-sync-state"][data-sync="loading"]').waitFor({ timeout: 60000 })
			check(
				'loading shows a skeleton line',
				(await loading.page.locator('[data-slot="calendar-sync-state"] [data-slot="skeleton"]').count()) === 1
			)
			check(
				'loading slot is reserved at 112px',
				(await loading.page.locator('[data-slot="calendar-sync-state"]').boundingBox()).height >= 112
			)
		} finally {
			await loading.browser.close()
		}
		check('settings page has no console problems', real(problems).length === 0, real(problems).slice(0, 2).join(' || '))
	} finally {
		await browser.close()
	}
}

let completed = false
try {
	seed('up', 'dev', 'week')
	await startStack()
	for (const viewport of VIEWPORTS) await grid(viewport)
	await transforms()
	await live()
	await readStatus()
	await settings()
	completed = true
} catch (error) {
	check('script completed', false, String(error).slice(0, 300))
} finally {
	try {
		seed('down', 'dev')
	} catch (error) {
		check('synthetic calendar removed', false, String(error).slice(0, 200))
	}
	await stopStack()
	const down = spawnSync(NODE, [WAIT, 'down'], { encoding: 'utf8' })
	if (owned.length > 0) check('ports 3000 and 4000 are free', down.status === 0, down.stdout.trim())
}
console.log(`screenshots in ${STATE_DIR}`)
if (completed && failures() === 0) console.log('CALENDAR_WEB_GRID_OK')
process.exit(failures() === 0 && completed ? 0 : 1)
