import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createConnection } from 'node:net'

import { BASE, ROOT, check, env, failures, shot, signIn, sql, theme } from './browser-context.ts'
import { withBrowser } from './browser-journey.ts'

let apiOrigin = BASE

const PALETTE = '[data-palette]'
const FIELD = '[data-slot="chat-composer-field"]'
const COMMANDS = '[data-slot="chat-commands"]'
const PLAIN = 'Alex Example 2330'
const ASKED = 'Alex Example 2331'
const TWIN = 'Alex Example 2332'
const ARCHIVED = 'Alex Example 2333'
const LESSONS_MINE = 'Alex Example 2370'
const LESSONS_OTHER = 'Alex Example 2371'
const NAMES = [PLAIN, ASKED, TWIN, ARCHIVED, LESSONS_MINE, LESSONS_OTHER]
const GONE = 'This student is no longer available. Choose a student again.'
const EXPECTED_NOISE =
	/status of 500|Failed to load resource|server caches disabled|Route "\/login": Next\.js encountered URL data/

function portFree(port) {
	return new Promise((resolve) => {
		const socket = createConnection({ port, host: '127.0.0.1' })
		socket.setTimeout(1500)
		socket.on('connect', () => {
			socket.destroy()
			resolve(false)
		})
		socket.on('timeout', () => {
			socket.destroy()
			resolve(true)
		})
		socket.on('error', () => resolve(true))
	})
}

async function detectApiOrigin() {
	const candidates = [...new Set([BASE, env.APP_ORIGIN].filter(Boolean))]
	for (const origin of candidates) {
		const response = await fetch(`${BASE}/api/auth/sign-in`, {
			method: 'POST',
			headers: { origin, 'content-type': 'application/json' },
			body: JSON.stringify({ login: 'origin-probe', password: 'origin-probe' }),
		}).catch(() => null)
		const body = response ? await response.json().catch(() => null) : null
		if (response && body?.error?.code !== 'forbidden_origin') return origin
	}
	throw new Error('the dev api accepts neither the web origin nor APP_ORIGIN from .env')
}

async function startApi() {
	if (!(await portFree(4000))) {
		const res = await fetch('http://127.0.0.1:4000/healthz')
		if (res.status !== 200) throw new Error('port 4000 is busy and is not a healthy dev api')
		console.log('using the dev api that already listens on 4000')
		apiOrigin = await detectApiOrigin()
		return null
	}
	const childEnv = {
		...process.env,
		PORT: '4000',
		APP_ORIGIN: BASE,
		ANTHROPIC_API_KEY: 'sk-ant-fake-check',
		LOG_LEVEL: 'info',
		CHAT_FAKE_DELAY_MS: '20',
	}
	delete childEnv.DATABASE_URL
	delete childEnv.MIGRATOR_DATABASE_URL
	const child = spawn(
		process.execPath,
		['--import', `${ROOT}/scripts/dev-checks/chat-fake-anthropic.mjs`, '--env-file=.env', 'apps/api/src/server.ts'],
		{ cwd: ROOT, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] }
	)
	child.stdout.resume()
	child.stderr.resume()
	const deadline = Date.now() + 30000
	while (Date.now() < deadline) {
		if (child.exitCode !== null) break
		try {
			const res = await fetch('http://127.0.0.1:4000/healthz')
			if (res.status === 200) return child
		} catch {}
		await new Promise((resolve) => setTimeout(resolve, 300))
	}
	child.kill('SIGTERM')
	throw new Error('the api did not answer /healthz in 30 s')
}

function stopApi(child) {
	if (!child || child.exitCode !== null) return Promise.resolve()
	return new Promise((resolve) => {
		const timer = setTimeout(() => {
			child.kill('SIGKILL')
			resolve()
		}, 15000)
		child.once('exit', () => {
			clearTimeout(timer)
			resolve()
		})
		child.kill('SIGTERM')
	})
}

function removeCards() {
	const list = NAMES.map((name) => `'${name}'`).join(', ')
	const where = `display_name in (${list}) and import_key is null`
	sql(`delete from payments where student_id in (select id from students where ${where})`)
	const result = sql(`delete from students where ${where}`)
	console.log(`fixture cards removed ${result.rowCount}`)
}

function removeConversations(ids) {
	if (ids.length === 0) return
	const list = ids.map((id) => `'${id}'`).join(', ')
	sql(`delete from chat_messages where conversation_id in (${list})`)
	const result = sql(`delete from chat_conversations where id in (${list})`)
	console.log(`fixture conversations removed ${result.rowCount}`)
}

const count = (table) => Number(sql(`select count(*)::int as n from ${table}`).rows[0]?.n ?? -1)

function setTheme(page) {
	return page.addInitScript((value) => {
		try {
			localStorage.setItem('theme', value)
		} catch {}
	}, theme)
}

async function prepare(page) {
	await setTheme(page)
	if (apiOrigin === BASE) return
	await page.route('**/api/**', async (route) => {
		const headers = { ...(await route.request().allHeaders()), origin: apiOrigin }
		try {
			const response = await route.fetch({ headers })
			await route.fulfill({ response })
		} catch {
			await route.abort().catch(() => undefined)
		}
	})
}

async function api(page, method, path, body) {
	const response = await page.request.fetch(`${BASE}/api${path}`, {
		method,
		headers: { origin: apiOrigin, 'content-type': 'application/json' },
		data: body === undefined ? undefined : JSON.stringify(body),
	})
	let json = null
	try {
		json = await response.json()
	} catch {
		json = null
	}
	return { status: response.status(), json }
}

async function createCard(page, displayName) {
	const created = await api(page, 'POST', '/students', {
		displayName,
		rateMinor: 400000,
		currency: 'RUB',
		defaultLessonMinutes: 60,
		parent: null,
		level: null,
		goals: null,
		timeZone: null,
	})
	check(`the fixture card ${displayName} is created`, created.status === 201, String(created.status))
	return created.json.student.id
}

function cardIds(name) {
	return sql(`select id from students where display_name = '${name}' and import_key is null`).rows.map((row) => row.id)
}

async function openPalette(page) {
	await page.keyboard.press('Control+K')
	await page.locator(PALETTE).waitFor({ timeout: 10000 })
}

function groupLabels(page) {
	return page.evaluate(() =>
		Array.from(document.querySelectorAll('[data-palette] [role="group"]'))
			.map((group) => document.getElementById(group.getAttribute('aria-labelledby') ?? '')?.textContent ?? '')
			.filter((label) => label !== '')
	)
}

async function type(page, text) {
	await page.getByRole('combobox').first().fill(text)
}

async function waitIdle(page) {
	await page.waitForFunction(() => document.querySelectorAll('[data-palette]').length === 0, null, { timeout: 10000 })
}

async function activeHeading(page) {
	return page.evaluate(() => {
		const active = document.activeElement
		return active?.tagName === 'H1' ? (active.textContent ?? '') : ''
	})
}

async function sectionPalette(page, problems, ids) {
	await prepare(page)
	await signIn(page)
	removeCards()
	await createCard(page, PLAIN)
	const twinFirst = await createCard(page, TWIN)
	const twinSecond = await createCard(page, TWIN)
	const plainId = cardIds(PLAIN)[0]
	const conversation = await api(page, 'POST', '/chat/conversations')
	check('the fixture conversation is created', conversation.status === 201 || conversation.status === 200)
	ids.push(conversation.json.conversation.id)

	await page.goto(`${BASE}/`)
	await page.getByRole('button', { name: 'Add payment' }).waitFor({ timeout: 30000 })
	await openPalette(page)
	await page.getByRole('option', { name: PLAIN }).waitFor({ timeout: 15000 })
	const labels = await groupLabels(page)
	check(
		'the groups come in the order Actions, Students, Screens',
		JSON.stringify(labels) === '["Actions","Students","Screens"]',
		JSON.stringify(labels)
	)
	const placeholder = await page.getByRole('combobox').first().getAttribute('placeholder')
	check(
		'the placeholder names students, screens and actions',
		placeholder === 'Student, screen or action · @ for students'
	)
	await shot(page, 'entry-palette', 'open')

	await type(page, `@${PLAIN}`)
	await page.getByRole('option', { name: PLAIN }).waitFor({ timeout: 5000 })
	const onlyStudents = await groupLabels(page)
	check(
		'a query with @ shows only students',
		JSON.stringify(onlyStudents) === '["Students"]' && (await page.getByRole('option').count()) === 1,
		JSON.stringify(onlyStudents)
	)

	await type(page, 'alex EXAMPLE 2332')
	await page.waitForFunction((name) => document.querySelectorAll(`[data-palette] [role="option"]`).length === 2, TWIN)
	check('two cards with one name are two rows', (await page.getByRole('option', { name: TWIN }).count()) === 2)
	const opened = []
	for (const index of [0, 1]) {
		const previousPath = new URL(page.url()).pathname
		await type(page, TWIN)
		await page.getByRole('option', { name: TWIN }).nth(index).click()
		await page.waitForFunction(
			(previous) => /^\/students\/[0-9a-f-]{36}$/.test(location.pathname) && location.pathname !== previous,
			previousPath,
			{ timeout: 15000 }
		)
		opened.push(new URL(page.url()).pathname.split('/').pop())
		await page.getByRole('heading', { name: TWIN, level: 1 }).waitFor({ timeout: 30000 })
		await openPalette(page)
	}
	check(
		'each twin row opens its own card by id',
		opened[0] !== opened[1] && [twinFirst, twinSecond].every((id) => opened.includes(id)),
		JSON.stringify(opened)
	)
	await page.keyboard.press('Escape')
	await waitIdle(page)

	await page.goto(`${BASE}/`)
	await page.getByRole('button', { name: 'Add payment' }).waitFor({ timeout: 30000 })
	await openPalette(page)
	await type(page, `@${PLAIN}`)
	await page.getByRole('option', { name: PLAIN }).waitFor({ timeout: 15000 })
	await page.keyboard.press('Enter')
	await page.waitForURL(`${BASE}/students/${plainId}`, { timeout: 15000 })
	await waitIdle(page)
	await page.waitForFunction(() => document.activeElement?.tagName === 'H1', null, { timeout: 15000 })
	const heading = await activeHeading(page)
	check(
		'Enter on a student opens the card, closes the palette and focuses the heading',
		heading.includes(PLAIN),
		heading
	)

	await page.goto(`${BASE}/chat?c=${ids[0]}`)
	await page.locator(FIELD).waitFor({ timeout: 30000 })
	const conversationsBefore = count('chat_conversations')
	const messagesBefore = count('chat_messages')
	await openPalette(page)
	await type(page, 'New chat')
	await page.getByRole('option', { name: 'New chat' }).waitFor({ timeout: 5000 })
	await page.keyboard.press('Enter')
	await waitIdle(page)
	await page.locator(COMMANDS).waitFor({ timeout: 15000 })
	await page.waitForFunction(() => !location.search.includes('new=') && !location.search.includes('c='), null, {
		timeout: 15000,
	})
	await page.waitForTimeout(800)
	const focusedField = await page.evaluate(() => document.activeElement?.getAttribute('data-slot') ?? '')
	check(
		'New chat opens an empty chat with the command list and the composer in focus',
		(await page.locator(COMMANDS).isVisible()) &&
			(await page.locator(FIELD).inputValue()) === '' &&
			focusedField === 'chat-composer-field',
		new URL(page.url()).search
	)
	check(
		'New chat creates no conversation and no message',
		count('chat_conversations') === conversationsBefore && count('chat_messages') === messagesBefore
	)
	await shot(page, 'entry-palette', 'new-chat')

	await page.goto(`${BASE}/`)
	await page.getByRole('button', { name: 'Add payment' }).waitFor({ timeout: 30000 })
	const paymentsBefore = count('payments')
	await openPalette(page)
	await type(page, 'Add payment')
	await page.getByRole('option', { name: 'Add payment' }).waitFor({ timeout: 5000 })
	await page.keyboard.press('Enter')
	await waitIdle(page)
	const dialog = page.getByRole('dialog', { name: 'Add payment' })
	await dialog.waitFor({ timeout: 15000 })
	await page.waitForFunction(() => !location.search.includes('dialog='), null, { timeout: 15000 })
	check(
		'Add payment opens the form once, without a student, with Save payment off and the address clean',
		(await dialog.getByRole('button', { name: 'Save payment' }).isDisabled()) && new URL(page.url()).search === '',
		new URL(page.url()).search
	)
	await shot(page, 'entry-palette', 'add-payment')
	await page.keyboard.press('Control+K')
	await page.waitForTimeout(500)
	check('Ctrl+K does nothing while another dialog is open', (await page.locator(PALETTE).count()) === 0)
	await page.keyboard.press('Escape')
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(300)
	const focusName = await page.evaluate(() => document.activeElement?.textContent ?? '')
	check(
		'closing the form returns focus to Add payment and writes nothing',
		focusName.includes('Add payment') && count('payments') === paymentsBefore,
		focusName
	)

	await page.route('**/api/students/options', async (route) => {
		await new Promise((resolve) => setTimeout(resolve, 1500))
		await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
	})
	await openPalette(page)
	await type(page, 'chat')
	await page.getByText('Loading students…').waitFor({ timeout: 5000 })
	const rest =
		(await page.getByRole('option', { name: 'Chat' }).count()) +
		(await page.getByRole('option', { name: 'New chat' }).count())
	check('while students load the actions and screens stay usable', rest >= 1)
	await page.getByText('Could not load students.').waitFor({ timeout: 10000 })
	const refresh = page.getByRole('button', { name: 'Refresh students' })
	check(
		'a failed read is not an empty list and keeps the query',
		(await refresh.isVisible()) &&
			(await page.getByText('No students found').count()) === 0 &&
			(await page.getByRole('combobox').first().inputValue()) === 'chat'
	)
	await shot(page, 'entry-palette', 'error')
	await page.unroute('**/api/students/options')
	await refresh.click()
	await page.getByText('No students found').waitFor({ timeout: 15000 })
	await type(page, '@alex example 2330')
	await page.getByRole('option', { name: PLAIN }).waitFor({ timeout: 15000 })
	check('Refresh students shows the students again', (await page.getByText('Could not load students.').count()) === 0)
	await type(page, 'zzzz nobody')
	await page.getByText('No students found').waitFor({ timeout: 5000 })
	check('a read without a match says No students found', (await groupLabels(page)).includes('Students'))
	await page.keyboard.press('Escape')
	await waitIdle(page)

	await page.setViewportSize({ width: 390, height: 844 })
	await page.goto(`${BASE}/`)
	await page.getByRole('button', { name: 'Search' }).first().waitFor({ timeout: 30000 })
	await page.getByRole('button', { name: 'Search' }).first().click()
	await page.locator(PALETTE).waitFor({ timeout: 10000 })
	await page.getByRole('option', { name: PLAIN }).waitFor({ timeout: 15000 })
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
	check('at 390 px the Search button opens the palette without sideways scroll', overflow <= 0, String(overflow))
	await shot(page, 'entry-palette', 'phone')
	const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
	check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
}

async function sectionAsk(page, problems, ids) {
	await prepare(page)
	await signIn(page)
	removeCards()
	const askedId = await createCard(page, ASKED)
	const archivedId = await createCard(page, ARCHIVED)
	const archived = sql(`update students set status = 'archived', archived_at = now() where id = '${archivedId}'`)
	check('the fixture card is archived', archived.rowCount === 1, String(archived.rowCount))

	const urls = []
	page.on('framenavigated', (frame) => {
		if (frame === page.mainFrame()) urls.push(frame.url())
	})
	await page.goto(`${BASE}/students/${askedId}`)
	await page.getByRole('heading', { name: ASKED, level: 1 }).waitFor({ timeout: 30000 })
	const conversationsBefore = count('chat_conversations')
	const messagesBefore = count('chat_messages')
	const ask = page.getByRole('button', { name: 'Ask in chat' })
	await ask.waitFor({ timeout: 15000 })
	await shot(page, 'entry-ask', 'profile')
	await ask.click()
	await page.waitForURL(/\/chat/, { timeout: 15000 })
	const field = page.locator(FIELD)
	await field.waitFor({ timeout: 30000 })
	await page.waitForFunction(
		(value) => document.querySelector('[data-slot="chat-composer-field"]')?.value === value,
		`@${ASKED} `,
		{
			timeout: 15000,
		}
	)
	await page.waitForTimeout(800)
	const chatUrl = urls.find((url) => url.includes('/chat')) ?? ''
	const params = new URL(chatUrl || BASE).searchParams
	check(
		'the address of Ask in chat holds only new=1 and the student id',
		params.get('new') === '1' && params.get('student') === askedId && [...params.keys()].length === 2,
		chatUrl.replace(BASE, '')
	)
	check(
		'Ask in chat puts the mention draft in the composer and focuses it',
		(await field.inputValue()) === `@${ASKED} ` &&
			(await page.evaluate(() => document.activeElement?.getAttribute('data-slot') ?? '')) === 'chat-composer-field',
		await field.inputValue()
	)
	check('the page shows the facts of the student', (await page.locator('#content').innerText()).includes(ASKED))
	check(
		'Ask in chat sends no message and creates no conversation',
		count('chat_messages') === messagesBefore && count('chat_conversations') === conversationsBefore
	)
	check('the arrival marker is removed from the address', !new URL(page.url()).searchParams.has('new'))
	await shot(page, 'entry-ask', 'chat')

	await page.goBack()
	await page.getByRole('heading', { name: ASKED, level: 1 }).waitFor({ timeout: 30000 })
	await page.getByRole('button', { name: 'Ask in chat' }).click()
	await page.waitForURL(/\/chat/, { timeout: 15000 })
	await page.waitForFunction(
		(value) => document.querySelector('[data-slot="chat-composer-field"]')?.value === value,
		`@${ASKED} `,
		{
			timeout: 15000,
		}
	)
	await page.waitForTimeout(500)
	check(
		'a second Ask in chat gives the same draft and still sends nothing',
		(await field.inputValue()) === `@${ASKED} ` && count('chat_messages') === messagesBefore
	)

	await page.goto(`${BASE}/students/${archivedId}`)
	await page.getByRole('heading', { name: ARCHIVED, level: 1 }).waitFor({ timeout: 30000 })
	await page.getByRole('button', { name: 'Restore' }).waitFor({ timeout: 15000 })
	check('an archived card has no Ask in chat', (await page.getByRole('button', { name: 'Ask in chat' }).count()) === 0)
	await page.goto(`${BASE}/chat?new=1&student=${archivedId}`)
	await page.getByText(GONE).waitFor({ timeout: 30000 })
	await page.waitForTimeout(500)
	check(
		'an archived student in the address gives the unavailable line and an empty field',
		(await page.locator(FIELD).inputValue()) === '',
		await page.locator(FIELD).inputValue()
	)
	await shot(page, 'entry-ask', 'unavailable')
	const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
	check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
	void ids
}

const HOUR = 3600000
const DAY = 24 * HOUR
const WEEK_REQUEST = /\/api\/schedule\/week\?/
const PLAIN_COLOR = { id: null, background: null, foreground: null, custom: false }

function zoneOffsetMs(zone, instant) {
	const name =
		new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' })
			.formatToParts(instant)
			.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT'
	const match = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name)
	if (!match) return 0
	return (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] ?? 0)) * 60000
}

function zoneDate(instant, zone) {
	return new Date(instant.getTime() + zoneOffsetMs(zone, instant)).toISOString().slice(0, 10)
}

function mondayOfDate(date) {
	const day = new Date(`${date}T00:00:00Z`)
	const weekday = (day.getUTCDay() + 6) % 7
	return new Date(day.getTime() - weekday * DAY).toISOString().slice(0, 10)
}

function addDaysTo(date, days) {
	return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10)
}

function weekRange(monday, zone) {
	const guess = Date.parse(`${monday}T00:00:00Z`)
	const start = guess - zoneOffsetMs(zone, new Date(guess))
	return { start: new Date(start).toISOString(), end: new Date(start + 7 * DAY).toISOString(), timeZone: zone }
}

function lessonEvent(key, studentId, startMs, zone, options = {}) {
	return {
		eventKey: key,
		version: 'v1',
		title: null,
		when: {
			kind: 'timed',
			startsAt: new Date(startMs).toISOString(),
			endsAt: new Date(startMs + HOUR).toISOString(),
			timeZone: zone,
		},
		status: options.status ?? 'confirmed',
		blocksTime: true,
		color: PLAIN_COLOR,
		location: null,
		seriesMember: false,
		binding: {
			kind: 'lesson',
			ref: { kind: 'single', lessonId: randomUUID() },
			studentId,
			version: 'v1',
			mark: options.mark ?? null,
		},
		suggestion: null,
		editBlock: null,
	}
}

function externalEvent(key, startMs, zone) {
	return {
		...lessonEvent(key, randomUUID(), startMs, zone),
		binding: { kind: 'external' },
		title: 'External booking',
	}
}

function weekWindow(kind, monday, zone, events) {
	const range = weekRange(monday, zone)
	if (kind === 'unavailable')
		return {
			requestedRange: range,
			snapshotRange: null,
			connection: {
				state: 'not_connected',
				calendar: null,
				generation: 0,
				issue: null,
				pendingCommandCount: 0,
				disconnectResolution: 'none',
				allowedActions: ['connect'],
			},
			read: { state: 'unavailable', reason: 'connection_required' },
			events: [],
			series: [],
			write: { state: 'blocked', reason: 'connection_required' },
		}
	const fetchedAt = new Date().toISOString()
	return {
		requestedRange: range,
		snapshotRange: range,
		connection: {
			state: 'connected',
			calendar: { id: 'check-calendar', label: 'Check calendar', timeZone: zone },
			generation: 1,
			issue: null,
			pendingCommandCount: 0,
			disconnectResolution: 'none',
			allowedActions: ['disconnect', 'switch'],
		},
		read:
			kind === 'fresh'
				? { state: 'fresh', fetchedAt, revision: '1' }
				: { state: 'last_known', fetchedAt, revision: '1', reason: 'provider_unavailable' },
		events,
		series: [],
		write: kind === 'fresh' ? { state: 'ready' } : { state: 'blocked', reason: 'provider_unavailable' },
	}
}

const TAB = '[data-slot="lessons-tab"]'
const ROW = '[data-slot="lessons-row"]'

async function sectionLessons(page, problems) {
	await prepare(page)
	await signIn(page)
	removeCards()
	const mineId = await createCard(page, LESSONS_MINE)
	const otherId = await createCard(page, LESSONS_OTHER)
	const detail = await api(page, 'GET', `/students/${mineId}`)
	const zone = detail.json.defaultTimeZone
	const currentMonday = mondayOfDate(zoneDate(new Date(), zone))
	const href = `${BASE}/students/${mineId}?tab=lessons`

	let mode = 'real'
	const starts = []
	const urls = []
	page.on('framenavigated', (frame) => {
		if (frame === page.mainFrame()) urls.push(frame.url())
	})
	await page.route(WEEK_REQUEST, async (route) => {
		if (mode === 'real') return route.fallback()
		const start = new URL(route.request().url()).searchParams.get('start')
		starts.push(start)
		if (mode === 'error') return route.fulfill({ status: 500, json: { error: { code: 'internal', message: 'x' } } })
		const now = Date.now()
		const events =
			start === currentMonday
				? [
						lessonEvent('past-done', mineId, now - 90 * 60000, zone, { mark: 'done' }),
						lessonEvent('future-planned', mineId, now + 90 * 60000, zone),
						lessonEvent('future-cancelled', mineId, now + 150 * 60000, zone, { status: 'cancelled' }),
						lessonEvent('other-student', otherId, now + 120 * 60000, zone),
						externalEvent('external', now + 60 * 60000, zone),
					]
				: []
		return route.fulfill({ json: weekWindow(mode, start, zone, events) })
	})

	const realRead = page.waitForResponse(WEEK_REQUEST, { timeout: 30000 })
	await page.goto(href)
	await page.getByRole('heading', { name: LESSONS_MINE, level: 1 }).waitFor({ timeout: 30000 })
	const loaded = page.locator(`${TAB}:not([data-state="loading"])`)
	await loaded.waitFor({ timeout: 30000 })
	const realBody = await (await realRead).json().catch(() => null)
	const realKind = realBody?.read?.state ?? 'unknown'
	const tabNames = await page.getByRole('tab').allInnerTexts()
	check(
		'the profile tabs run Overview, Lessons, Payments, Notes, Vocabulary',
		tabNames.join(',') === 'Overview,Lessons,Payments,Notes,Vocabulary',
		tabNames.join(',')
	)
	check(
		'?tab=lessons opens the Lessons tab',
		(await page.getByRole('tab', { name: 'Lessons' }).getAttribute('aria-selected')) === 'true'
	)
	const realState = await page.locator(TAB).getAttribute('data-state')
	const realText = await page.locator(TAB).innerText()
	check(
		'the real read of the dev stack is shown as it is: fresh and empty says No lessons, anything else the warning',
		realKind === 'fresh'
			? realState === 'fresh' && realText.includes('No lessons in this range')
			: realState === 'partial' &&
					realText.includes('The full lesson range has not been checked') &&
					!realText.includes('No lessons in this range'),
		`${realKind} ${realState}`
	)
	await shot(page, 'entry-lessons', 'real')

	mode = 'unavailable'
	await page.goto(href)
	await page.locator(`${TAB}[data-state="partial"]`).waitFor({ timeout: 30000 })
	const unavailableText = await page.locator(TAB).innerText()
	check(
		'an unread calendar shows the full-range warning, not No lessons',
		unavailableText.includes('The full lesson range has not been checked. Refresh before making changes.') &&
			!unavailableText.includes('No lessons in this range') &&
			(await page.locator(ROW).count()) === 0
	)
	await shot(page, 'entry-lessons', 'unchecked')

	mode = 'fresh'
	await page.getByRole('button', { name: 'Refresh records' }).click()
	await page.locator(`${TAB}[data-state="fresh"]`).waitFor({ timeout: 15000 })
	await page.locator(ROW).first().waitFor({ timeout: 15000 })
	const rows = page.locator(ROW)
	check('only the lessons of this student are listed', (await rows.count()) === 3, String(await rows.count()))
	check(
		'no other student and no external event in the list',
		(await page.locator(`${ROW}[data-event-key="other-student"]`).count()) === 0 &&
			(await page.locator(`${ROW}[data-event-key="external"]`).count()) === 0 &&
			!(await page.locator(TAB).innerText()).includes('External booking')
	)
	check(
		'the warning is gone after a fresh read',
		(await page.getByText('The full lesson range has not been checked').count()) === 0
	)
	const upcoming = page.locator('#student-lessons-upcoming').locator('xpath=ancestor::section[1]')
	const history = page.locator('#student-lessons-history').locator('xpath=ancestor::section[1]')
	const upcomingKeys = await upcoming
		.locator(ROW)
		.evaluateAll((list) => list.map((node) => node.getAttribute('data-event-key')))
	const historyKeys = await history
		.locator(ROW)
		.evaluateAll((list) => list.map((node) => node.getAttribute('data-event-key')))
	check(
		'Upcoming holds the future lessons in time order',
		upcomingKeys.join(',') === 'future-planned,future-cancelled',
		upcomingKeys.join(',')
	)
	check('History holds the past lesson', historyKeys.join(',') === 'past-done', historyKeys.join(','))
	check('the past lesson shows Done', (await history.locator(ROW).first().innerText()).includes('Done'))
	const cancelled = upcoming.locator(`${ROW}[data-event-key="future-cancelled"]`)
	check('the cancelled lesson says Cancelled', (await cancelled.innerText()).includes('Cancelled'))
	check(
		'the cancelled lesson is struck through',
		await cancelled
			.locator('[data-slot="time-pair"]')
			.evaluate((node) => getComputedStyle(node).textDecorationLine === 'line-through')
	)
	const firstName = await upcoming.locator(ROW).first().locator('a').getAttribute('aria-label')
	check('a row has the whole lesson in its accessible name', /scheduled$/.test(firstName ?? ''), firstName)
	await shot(page, 'entry-lessons', 'populated')

	const monday = starts.at(-1)
	check(
		'the first read asks for the Monday of the current week',
		monday === currentMonday,
		`${monday} ${currentMonday}`
	)
	const picker = page.locator(`${TAB} [data-slot="schedule-week-picker"]`)
	const label = await picker.innerText()
	await page.getByRole('button', { name: 'Next week' }).click()
	await page.locator(`${TAB}[data-state="fresh"]`).waitFor({ timeout: 15000 })
	await page.getByText('Choose another week to view lessons.').waitFor({ timeout: 15000 })
	check(
		'Next week asks for the next Monday and changes the label',
		starts.at(-1) === addDaysTo(currentMonday, 7) && (await picker.innerText()) !== label,
		`${starts.at(-1)} ${await picker.innerText()}`
	)
	check(
		'a fresh read without lessons says No lessons in this range',
		(await page.locator(TAB).innerText()).includes('No lessons in this range')
	)
	await shot(page, 'entry-lessons', 'empty')
	await page.getByRole('button', { name: 'Previous week' }).click()
	await page.getByRole('button', { name: 'Previous week' }).click()
	await page.getByText('Choose another week to view lessons.').waitFor({ timeout: 15000 })
	check('Previous week asks for the earlier Monday', starts.at(-1) === addDaysTo(currentMonday, -7), `${starts.at(-1)}`)
	await page.getByRole('button', { name: 'Today' }).click()
	await page.locator(ROW).first().waitFor({ timeout: 15000 })
	check('Today returns to the current week with its lessons', (await rows.count()) === 3)

	await upcoming.locator(`${ROW}[data-event-key="future-planned"] a`).click()
	await page.waitForURL(/\/schedule\?/, { timeout: 15000 })
	const scheduleUrl = new URL(urls.find((url) => url.includes('/schedule?') && url.includes('lesson=')) ?? BASE)
	check(
		'a row opens that lesson in Schedule through week and lesson',
		scheduleUrl.searchParams.get('week') !== null &&
			(scheduleUrl.searchParams.get('lesson') ?? '').startsWith('single:'),
		scheduleUrl.search.slice(0, 80)
	)

	mode = 'partial'
	await page.goto(href)
	await page.locator(`${TAB}[data-state="partial"]`).waitFor({ timeout: 30000 })
	await page.locator(ROW).first().waitFor({ timeout: 15000 })
	const partialText = await page.locator(TAB).innerText()
	check(
		'a partial read keeps the rows it has and shows the warning, not No lessons',
		(await page.locator(ROW).count()) === 3 &&
			partialText.includes('The full lesson range has not been checked. Refresh before making changes.') &&
			!partialText.includes('No lessons in this range')
	)
	await shot(page, 'entry-lessons', 'partial')

	mode = 'error'
	await page.goto(href)
	await page.getByText('Could not load lessons').waitFor({ timeout: 30000 })
	check(
		'a failed read shows the error inside the tab with the header and tabs in place',
		(await page.getByRole('heading', { name: LESSONS_MINE, level: 1 }).count()) === 1 &&
			(await page.getByRole('tab', { name: 'Payments' }).count()) === 1 &&
			(await page.getByRole('button', { name: 'Refresh' }).count()) >= 1
	)
	await shot(page, 'entry-lessons', 'error')
	mode = 'fresh'
	await page.getByRole('button', { name: 'Refresh', exact: true }).click()
	await page.locator(`${TAB}[data-state="fresh"]`).waitFor({ timeout: 15000 })
	check('Refresh reads the week again', (await page.locator(ROW).count()) === 3)

	await page.setViewportSize({ width: 390, height: 844 })
	await page.goto(href)
	await page.locator(`${TAB}[data-state="fresh"]`).waitFor({ timeout: 30000 })
	await page.locator(ROW).first().waitFor({ timeout: 15000 })
	const metrics = await page.evaluate(() => ({
		page: document.documentElement.scrollWidth - window.innerWidth,
		viewport: Math.max(
			0,
			...Array.from(document.querySelectorAll('[data-slot="scroll-area-viewport"]')).map(
				(node) => node.scrollWidth - node.clientWidth
			)
		),
	}))
	check(
		'at 390 px the page has no sideways scroll',
		metrics.page <= 0 && metrics.viewport <= 0,
		JSON.stringify(metrics)
	)
	await shot(page, 'entry-lessons', 'phone')

	const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
	check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
}

const sections = { palette: sectionPalette, ask: sectionAsk, lessons: sectionLessons }
const section = process.argv[2]
const run = sections[section]
if (!run) {
	console.log(`usage: node scripts/dev-checks/entry-web.mjs ${Object.keys(sections).join('|')} light|dark`)
	process.exit(2)
}

let child
try {
	child = await startApi()
	const ids = []
	await withBrowser(
		{ width: 1280, height: 800 },
		async ({ page, problems }) => {
			await run(page, problems, ids)
		},
		() => removeConversations(ids),
		() => removeCards()
	)
} catch (error) {
	check('section completed', false, String(error).slice(0, 1500))
} finally {
	await stopApi(child)
}
if (failures() === 0) console.log(`ENTRY_WEB_${section.toUpperCase()}_OK`)
process.exit(failures())
