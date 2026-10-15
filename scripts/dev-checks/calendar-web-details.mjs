import { spawn, spawnSync } from 'node:child_process'

import { ZOOM_LINK, ZOOM_PLACE, descriptionFixtures } from './event-description-fixtures.mjs'
import { BASE, ROOT, api, check, failures, launch, shot, signIn } from './web.mjs'

const NODE = process.execPath
const WAIT = `${ROOT}/scripts/dev-checks/wait-dev.mjs`
const EVENT = '[data-slot="calendar-event"]'
const ZOOM_LABEL = 'example-zoom.test/j/12345678901'
const STREET = 'Clinic room 4, 12 Example Street'
const FORMATTING_NOTE =
	'This description has formatting, so it can only be edited in Google Calendar. It stays as it is when you save.'

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const fixture = (id) => descriptionFixtures.find((entry) => entry.id === id)

const owned = []

function startStack() {
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

const { readDescription } = await import(`${ROOT}/apps/api/src/calendar/event-description.ts`)

const FIXTURE_EVENTS = [
	['dvseed01', fixture('zoom').raw, ZOOM_PLACE],
	['dvseed02', fixture('google-format').raw + fixture('hostile').raw, STREET],
	['dvseed03', fixture('plain').raw, null],
	['dvseed04', fixture('tags-only').raw, 'javascript:alert(1)'],
]

function weekdayOf(isoDate) {
	return new Date(`${isoDate}T00:00:00Z`).getUTCDay()
}

function addDays(isoDate, count) {
	const date = new Date(`${isoDate}T00:00:00Z`)
	date.setUTCDate(date.getUTCDate() + count)
	return date.toISOString().slice(0, 10)
}

function mondayOf(isoDate) {
	return addDays(isoDate, -((weekdayOf(isoDate) + 6) % 7))
}

function instantAt(isoDate, hour, timeZone) {
	const [year, month, day] = isoDate.split('-').map(Number)
	const guess = Date.UTC(year, month - 1, day, hour)
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

const NO_COLOR = { id: null, background: null, foreground: null, custom: false }

function syntheticEvents(monday, timeZone) {
	return FIXTURE_EVENTS.map(([id, , location], index) => {
		const day = addDays(monday, index)
		return {
			eventKey: id,
			version: 'v1',
			title: `Synthetic event ${String(index + 1).padStart(2, '0')}`,
			when: { kind: 'timed', startsAt: instantAt(day, 10, timeZone), endsAt: instantAt(day, 11, timeZone), timeZone },
			status: 'confirmed',
			blocksTime: true,
			color: NO_COLOR,
			location,
			seriesMember: false,
			binding: { kind: 'external' },
			suggestion: null,
			editBlock: null,
		}
	})
}

function syntheticDetails(eventKey) {
	const index = FIXTURE_EVENTS.findIndex(([id]) => id === eventKey)
	if (index < 0) return null
	const [, raw, location] = FIXTURE_EVENTS[index]
	const reading = readDescription(raw)
	return {
		eventKey,
		version: 'v1',
		title: `Synthetic event ${String(index + 1).padStart(2, '0')}`,
		description: raw,
		descriptionBlocks: reading.blocks,
		descriptionFormatted: reading.formatted,
		location,
		color: NO_COLOR,
		repeat: { kind: 'once' },
		scopes: { edit: ['one'], delete: ['one'], reason: null },
	}
}

const EVENT_URL = /\/api\/google\/events\/[^/?]+(\?.*)?$/

async function installMocks(context, state) {
	await context.route(/\/api\/schedule\/week(\?|$)/, async (route) => {
		const response = await route.fetch()
		const body = await response.json()
		const start = new URL(route.request().url()).searchParams.get('start')
		state.timeZone = body.requestedRange?.timeZone ?? state.timeZone
		return route.fulfill({
			response,
			json: {
				...body,
				connection: {
					...body.connection,
					calendar: body.connection.calendar && {
						...body.connection.calendar,
						id: 'synthetic-calendar',
						label: 'Synthetic calendar',
					},
				},
				read: { state: 'fresh', fetchedAt: new Date().toISOString(), revision: '1' },
				write: { state: 'ready' },
				snapshotRange: body.requestedRange,
				events: start === null ? [] : syntheticEvents(start, state.timeZone),
				series: [],
			},
		})
	})
	await context.route(EVENT_URL, async (route) => {
		const request = route.request()
		if (request.method() !== 'GET') {
			state.requests.push({ method: request.method(), body: request.postData() })
			return route.abort()
		}
		const eventKey = decodeURIComponent(new URL(request.url()).pathname.split('/').pop())
		const details = syntheticDetails(eventKey)
		if (details === null) return route.fulfill({ status: 404, json: { error: 'not_found' } })
		return route.fulfill({ status: 200, json: details })
	})
}

async function computeDays(page, state) {
	const settings = await api(page, 'GET', '/settings')
	state.timeZone = settings.json?.settings?.defaultTimeZone ?? state.timeZone
	const today = new Intl.DateTimeFormat('en-CA', { timeZone: state.timeZone }).format(new Date())
	const monday = mondayOf(today)
	return Object.fromEntries(FIXTURE_EVENTS.map(([id], index) => [id, addDays(monday, index)]))
}

async function routeFixtureHosts(context) {
	await context.route(/^https?:\/\/[^/]*\.test(\/|$)/, (route) =>
		route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>fixture</title>' })
	)
}

async function openEvent(page, days, id, title, phone) {
	const url = phone ? `${BASE}/schedule?week=${days[id]}&day=${days[id]}` : `${BASE}/schedule`
	await page.goto(url, { timeout: 120000 })
	const block = page.locator('[data-event-key="' + id + '"]:visible').first()
	await block.waitFor({ timeout: 25000 }).catch(async (error) => {
		console.log('DEBUG', page.url(), (await page.locator('body').innerText()).replace(/\n/g, ' | ').slice(0, 600))
		throw error
	})
	await page.waitForTimeout(1200)
	await block.click()
	const dialog = page.getByRole('dialog').last()
	await dialog.waitFor({ timeout: 15000 })
	await page.waitForTimeout(900)
	return dialog
}

const styleOf = (locator, names) =>
	locator.first().evaluate((element, list) => {
		const style = getComputedStyle(element)
		return Object.fromEntries(list.map((name) => [name, style.getPropertyValue(name)]))
	}, names)

async function zoomChecks(page, context, days, tag, full) {
	const dialog = await openEvent(page, days, 'dvseed01', 'Synthetic event 01', !full)
	const text = await dialog.innerText()
	for (const marker of ['<p', '<br', '&nbsp;', '&amp;'])
		check(`${tag} zoom: the dialog text has no ${marker}`, !text.includes(marker))
	const description = dialog.locator('[data-slot="event-description"]')
	check(`${tag} zoom: the description row is drawn`, (await description.count()) === 1)
	const place = dialog.locator('[data-slot="event-place"]')
	check(`${tag} zoom: the place is a link labelled with host and path`, (await place.innerText()) === ZOOM_LABEL)
	check(
		`${tag} zoom: the place target is the whole address and the label has no passcode`,
		(await place.getAttribute('href')) === ZOOM_PLACE && !(await place.innerText()).includes('pwd')
	)
	const placeStyle = await styleOf(place, ['white-space', 'text-overflow', 'overflow', 'display'])
	const placeBox = await place.boundingBox()
	check(
		`${tag} zoom: the place is one nowrap ellipsis line of 20px`,
		placeStyle['white-space'] === 'nowrap' &&
			placeStyle['text-overflow'] === 'ellipsis' &&
			placeStyle.overflow === 'hidden' &&
			placeBox !== null &&
			Math.abs(placeBox.height - 20) < 0.6,
		JSON.stringify({ ...placeStyle, height: placeBox?.height })
	)
	check(
		`${tag} zoom: no title or aria-label holds the passcode`,
		(await dialog
			.locator('[title*="pwd"], [aria-label*="pwd"], [title*="FixtureCode"], [aria-label*="FixtureCode"]')
			.count()) === 0 && (await place.getAttribute('title')) === null
	)
	const outside = await dialog.evaluate((element) => {
		const copy = element.cloneNode(true)
		copy.querySelector('[data-slot="event-description"]')?.remove()
		return copy.textContent ?? ''
	})
	check(
		`${tag} zoom: no passcode outside the description text`,
		!outside.includes('pwd') && !outside.includes('FixtureCode')
	)
	check(
		`${tag} zoom: the dialog does not scroll sideways`,
		await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)
	)
	if (full) {
		const separators = description.locator('[role="separator"]')
		const first = await separators.first().boundingBox()
		check(
			`${tag} zoom: the rule line is a separator of 1px`,
			(await separators.count()) >= 2 && first !== null && Math.abs(first.height - 1) < 0.2,
			String(first?.height)
		)
		const container = await styleOf(description, ['max-height', 'row-gap', 'overflow-y'])
		check(
			`${tag} zoom: the description is 160px high with 8px between blocks and scrolls inside`,
			container['max-height'] === '160px' && container['row-gap'] === '8px' && container['overflow-y'] === 'auto',
			JSON.stringify(container)
		)
		check(
			`${tag} zoom: a Zoom invitation is taller than the box`,
			await description.evaluate((element) => element.scrollHeight > element.clientHeight)
		)
		const links = await description.locator('a').evaluateAll((list) =>
			list.map((link) => ({
				href: link.getAttribute('href'),
				target: link.target,
				rel: link.rel,
				text: link.textContent,
			}))
		)
		const meeting = links.find((link) => link.href === ZOOM_LINK)
		check(
			`${tag} zoom: the meeting link keeps the whole query and opens in a new tab safely`,
			meeting !== undefined &&
				meeting.target === '_blank' &&
				meeting.rel.includes('noopener') &&
				meeting.rel.includes('noreferrer')
		)
		check(
			`${tag} zoom: the single number is a tel link`,
			links.some((link) => link.href === 'tel:+15550100123')
		)
		check(
			`${tag} zoom: a spaced number and a dial-in extension stay text`,
			!links.some((link) => (link.text ?? '').includes('+84') || (link.text ?? '').includes(',,')) &&
				(await description.innerText()).includes('+84 24 0000 0000,,12345678901# Vietnam')
		)
		check(
			`${tag} zoom: every link has noopener and noreferrer`,
			links.every((link) => link.rel.includes('noopener') && link.rel.includes('noreferrer'))
		)
		const proseStyle = await styleOf(description.locator('p').first(), ['overflow-wrap'])
		check(`${tag} zoom: text wraps anywhere`, proseStyle['overflow-wrap'] === 'anywhere', JSON.stringify(proseStyle))
		const link = description.locator('a').first()
		const resting = await styleOf(link, ['text-decoration-thickness', 'text-underline-offset', 'text-decoration-color'])
		await link.hover()
		await page.waitForTimeout(250)
		const hovered = await styleOf(link, ['text-decoration-color'])
		check(
			`${tag} zoom: links are underlined 1px at offset 2px and the line gets stronger on hover`,
			resting['text-decoration-thickness'] === '1px' &&
				resting['text-underline-offset'] === '2px' &&
				resting['text-decoration-color'] !== hovered['text-decoration-color'],
			JSON.stringify({ resting, hovered })
		)
		await page.mouse.move(5, 5)
		await dialog
			.getByRole('heading')
			.first()
			.focus()
			.catch(() => undefined)
		let focused = false
		for (let press = 0; press < 14 && !focused; press += 1) {
			await page.keyboard.press('Tab')
			focused = await page.evaluate(
				() =>
					document.activeElement?.closest('[data-slot="event-description"]') !== null &&
					document.activeElement?.tagName === 'A'
			)
		}
		const ring = focused ? await page.evaluate(() => getComputedStyle(document.activeElement).boxShadow) : ''
		check(`${tag} zoom: Tab reaches a link of the description with a ring`, focused && ring.includes('4px'), ring)
		await shot(page, `calendar-details-${tag}`, 'zoom-focus')
	}
	const [popup] = await Promise.all([context.waitForEvent('page'), place.click()])
	check(
		`${tag} zoom: the place link opens a new tab`,
		popup.url().startsWith('https://example-zoom.test/j/12345678901')
	)
	await popup.close()
	check(`${tag} zoom: the dialog stays open after the link`, await dialog.isVisible())
	await shot(page, `calendar-details-${tag}`, 'zoom')
	return dialog
}

async function tooltipChecks(page, days, tag) {
	await page.keyboard.press('Escape')
	await page.waitForTimeout(500)
	await page.goto(`${BASE}/schedule`, { timeout: 120000 })
	const block = page.locator(EVENT).filter({ hasText: 'Synthetic event 01' }).first()
	await block.waitFor({ timeout: 120000 })
	await page.waitForTimeout(1200)
	await block.hover()
	const tooltip = page.locator('[data-slot="event-tooltip"]').first()
	await tooltip.waitFor({ timeout: 8000 })
	const text = await tooltip.innerText()
	check(`${tag} tooltip: the place is the label of the address`, text.includes(ZOOM_LABEL), text.replace(/\n/g, ' | '))
	check(
		`${tag} tooltip: no passcode, no link and no raw address`,
		!text.includes('pwd') &&
			!text.includes('FixtureCode') &&
			!text.includes('https://') &&
			(await tooltip.locator('a').count()) === 0
	)
	await shot(page, `calendar-details-${tag}`, 'tooltip')
}

async function formattingChecks(page, days, tag, phone) {
	const dialog = await openEvent(page, days, 'dvseed02', 'Synthetic event 02', phone)
	const description = dialog.locator('[data-slot="event-description"]')
	check(
		`${tag} format: bold, italic and underline are real elements`,
		(await description.locator('strong').count()) >= 3 &&
			(await description.locator('em').count()) >= 2 &&
			(await description.locator('u').count()) >= 1
	)
	check(
		`${tag} format: both kinds of list are drawn and a nested item is flat`,
		(await description.locator('ul').count()) === 1 &&
			(await description.locator('ol').count()) === 1 &&
			(await description.locator('ul li').count()) === 3 &&
			(await description.locator('ul ul, ol ul, ul ol').count()) === 0
	)
	const markers = await styleOf(description.locator('ul'), ['list-style-type', 'padding-inline-start', 'row-gap'])
	const ordered = await styleOf(description.locator('ol'), ['list-style-type'])
	check(
		`${tag} format: lists have 20px indent, disc and decimal markers and 2px between items`,
		markers['list-style-type'] === 'disc' &&
			ordered['list-style-type'] === 'decimal' &&
			markers['padding-inline-start'] === '20px' &&
			markers['row-gap'] === '2px',
		JSON.stringify({ markers, ordered })
	)
	check(
		`${tag} format: list items keep their markers`,
		(await styleOf(description.locator('li'), ['display'])).display === 'list-item'
	)
	check(
		`${tag} format: no script, style, frame or image in the dialog`,
		(await dialog.locator('script, style, iframe, img').count()) === 0
	)
	const text = await dialog.innerText()
	const lost = [
		'FIXTURE_SCRIPT',
		'FIXTURE_STYLE',
		'FIXTURE_FRAME',
		'FIXTURE_IMG',
		'FIXTURE_COMMENT',
		'FIXTURE_DATA',
		'onerror',
	]
	check(
		`${tag} format: removed content leaves no trace`,
		lost.every((marker) => !text.includes(marker)),
		lost.filter((marker) => text.includes(marker)).join(',')
	)
	const hrefs = await dialog
		.locator('a[href]')
		.evaluateAll((list) => list.map((link) => link.getAttribute('href') ?? ''))
	check(
		`${tag} format: no link points to javascript:, data: or a relative path`,
		hrefs.every((href) => /^(https?:|mailto:|tel:)/.test(href)),
		hrefs.join(' ')
	)
	check(
		`${tag} format: unsafe links are plain visible text`,
		['js', 'data', 'named tab', 'relative'].every((word) => text.includes(word))
	)
	check(`${tag} format: a mailto link is kept`, hrefs.includes('mailto:teacher@example.test'))
	const place = dialog.locator('[data-slot="event-place-text"]')
	const placeStyle = await styleOf(place, ['white-space'])
	check(
		`${tag} format: a place that is not an address is text that wraps`,
		(await place.innerText()) === STREET &&
			(await dialog.locator('a', { hasText: 'Clinic' }).count()) === 0 &&
			placeStyle['white-space'] === 'normal'
	)
	await shot(page, `calendar-details-${tag}`, 'formatted')
}

async function plainChecks(page, days, tag, phone) {
	const dialog = await openEvent(page, days, 'dvseed03', 'Synthetic event 03', phone)
	const description = dialog.locator('[data-slot="event-description"]')
	check(
		`${tag} plain: two paragraphs and one line break`,
		(await description.locator('p').count()) === 2 && (await description.locator('br').count()) === 1
	)
	const links = await description
		.locator('a')
		.evaluateAll((list) => list.map((link) => ({ href: link.getAttribute('href'), text: link.textContent })))
	check(
		`${tag} plain: the closing dot is not part of the link`,
		links.length === 1 &&
			links[0].href === 'https://example.test/reading' &&
			links[0].text === 'https://example.test/reading',
		JSON.stringify(links)
	)
	check(
		`${tag} plain: no place row is drawn`,
		(await dialog.locator('[data-slot="event-place"], [data-slot="event-place-text"]').count()) === 0
	)
}

async function tagsChecks(page, days, tag, phone) {
	const dialog = await openEvent(page, days, 'dvseed04', 'Synthetic event 04', phone)
	check(
		`${tag} tags: a description of only tags draws no row`,
		(await dialog.locator('[data-slot="event-description"]').count()) === 0
	)
	check(
		`${tag} tags: a javascript place is plain text without a link`,
		(await dialog.locator('[data-slot="event-place-text"]').innerText()) === 'javascript:alert(1)' &&
			(await dialog.locator('a[href^="javascript"]').count()) === 0
	)
}

async function formChecks(page, context, state, days, tag) {
	const requests = state.requests
	const plain = await openEvent(page, days, 'dvseed03', 'Synthetic event 03', false)
	await plain.getByRole('button', { name: 'Edit event' }).click()
	const field = page.locator('#event-edit-description')
	await field.waitFor({ timeout: 15000 })
	await field.fill('Edited plain description')
	check(
		`${tag} form: a plain description keeps its text area`,
		(await field.inputValue()) === 'Edited plain description' && (await plain.getByText(FORMATTING_NOTE).count()) === 0
	)
	await page.close()
	const next = await context.newPage()
	const dialog = await openEvent(next, days, 'dvseed01', 'Synthetic event 01', false)
	await dialog.getByRole('button', { name: 'Edit event' }).click()
	await next.locator('#event-edit-title').waitFor({ timeout: 15000 })
	check(
		`${tag} form: a formatted description is a read-only note`,
		(await dialog.getByText(FORMATTING_NOTE).count()) === 1 &&
			(await next.locator('#event-edit-description').count()) === 0
	)
	const note = dialog.locator('[data-slot="event-description-note"]')
	const noteStyle = await styleOf(note, ['border-radius', 'box-shadow'])
	check(
		`${tag} form: the note is a bordered surface box and takes no focus`,
		(await note.locator('input, textarea, button').count()) === 0 && noteStyle['box-shadow'] !== 'none',
		JSON.stringify(noteStyle)
	)
	await shot(next, `calendar-details-${tag}`, 'form-note')
	await next.locator('#event-edit-title').fill('Synthetic event 01 renamed')
	await dialog.getByRole('button', { name: 'Save changes' }).click()
	const started = Date.now()
	while (requests.length === 0 && Date.now() - started < 15000) await wait(200)
	const changes = requests.length > 0 ? (JSON.parse(requests[0].body ?? '{}').changes ?? {}) : null
	check(
		`${tag} form: saving sends the title and leaves the description out`,
		changes !== null && changes.title === 'Synthetic event 01 renamed' && !('description' in changes),
		JSON.stringify(changes)
	)
}

async function suite(viewport, tag, { full }) {
	const { browser, context, page, problems } = await launch(viewport)
	try {
		const state = { timeZone: 'Asia/Ho_Chi_Minh', requests: [] }
		await routeFixtureHosts(context)
		await installMocks(context, state)
		await signIn(page)
		const days = await computeDays(page, state)
		await zoomChecks(page, context, days, tag, full)
		if (full) await tooltipChecks(page, days, tag)
		await formattingChecks(page, days, tag, !full)
		await plainChecks(page, days, tag, !full)
		await tagsChecks(page, days, tag, !full)
		if (full) await formChecks(page, context, state, days, tag)
		const unexpected = problems.filter(
			(problem) =>
				!problem.includes('server caches disabled') &&
				!problem.includes('status of 404') &&
				!problem.includes('Failed to load resource')
		)
		check(`${tag} no unexpected console problems`, unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
	} finally {
		await browser.close()
	}
}

try {
	startStack()
	await suite({ width: 1280, height: 800 }, '1280', { full: true })
	await suite({ width: 768, height: 1024 }, '768', { full: false })
	await suite({ width: 390, height: 844 }, '390', { full: false })
} catch (error) {
	check('checks completed', false, String(error).slice(0, 1500))
} finally {
	await stopStack()
}
if (failures() === 0) console.log('CALENDAR_WEB_DETAILS_OK')
process.exit(failures())
