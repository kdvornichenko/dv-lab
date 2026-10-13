import { spawn, spawnSync } from 'node:child_process'

import { BASE, ROOT, STATE_DIR, check, failures, launch, shot, signIn } from './web.mjs'

const NODE = process.execPath
const SEED = `${ROOT}/scripts/dev-checks/calendar-seed.mjs`
const WAIT = `${ROOT}/scripts/dev-checks/wait-dev.mjs`
const FIELD = '#settings-calendar-choice'
const OPEN = `${BASE}/settings?tab=calendar`

const real = (problems) =>
	problems.filter(
		(problem) =>
			!problem.includes('server caches disabled') &&
			!problem.includes('status of 503') &&
			!problem.includes('status of 409')
	)
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function seed(...args) {
	const result = spawnSync(NODE, [SEED, ...args], { encoding: 'utf8' })
	if (result.status !== 0)
		throw new Error(`seed ${args.join(' ')} failed: ${(result.stdout + result.stderr).slice(-200)}`)
	return result.stdout
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

const ACTIONS = {
	not_connected: ['connect', 'switch'],
	connected: ['disconnect', 'switch'],
	reconnect_required: ['reconnect', 'disconnect', 'switch'],
	disconnecting: [],
	disconnect_failed: ['retry_disconnect', 'confirm_revoked'],
}

const CALENDARS = [
	{ id: 'synthetic-a', label: 'Teaching', timeZone: 'Asia/Ho_Chi_Minh', primary: true, color: '#5484ed' },
	{ id: 'synthetic-b', label: 'Personal', timeZone: 'Europe/London', primary: false, color: '#51b749' },
	{ id: 'synthetic-c', label: 'Tutoring', timeZone: 'Asia/Ho_Chi_Minh', primary: false, color: null },
]

function model() {
	const server = {
		state: 'connected',
		calendarId: 'synthetic-a',
		generation: 4,
		list: 'two',
		listDelay: 0,
		postStatus: 200,
		posts: [],
		listReads: 0,
	}
	server.snapshot = () => {
		const calendar = CALENDARS.find((entry) => entry.id === server.calendarId)
		return {
			state: server.state,
			calendar: { id: calendar.id, label: calendar.label, timeZone: calendar.timeZone },
			generation: server.generation,
			issue: server.state === 'reconnect_required' ? 'reconnect_required' : null,
			pendingCommandCount: 0,
			disconnectResolution: server.state === 'not_connected' ? 'operator_confirmed' : 'none',
			allowedActions: ACTIONS[server.state],
		}
	}
	server.entries = () => {
		const pool = server.list === 'one' ? CALENDARS.slice(0, 1) : CALENDARS
		return pool.map((entry) => ({ ...entry, current: entry.id === server.calendarId }))
	}
	return server
}

async function install(page, server) {
	await page.route('**/api/google/connection', (route) => route.fulfill({ json: server.snapshot() }))
	await page.route('**/api/google/calendars', async (route) => {
		server.listReads += 1
		if (server.listDelay > 0) await wait(server.listDelay)
		if (server.list === 'fail') return route.fulfill({ status: 503, json: { error: { code: 'internal_error' } } })
		return route.fulfill({ json: { calendars: server.list === 'none' ? [] : server.entries() } })
	})
	await page.route('**/api/google/calendar', async (route) => {
		const body = route.request().postDataJSON()
		server.posts.push(body)
		if (server.postStatus !== 200)
			return route.fulfill({ status: server.postStatus, json: { error: { code: 'precondition_failed' } } })
		server.calendarId = body.calendarId
		server.generation += 1
		return route.fulfill({ json: server.snapshot() })
	})
}

async function triggerText(page) {
	return ((await page.locator(FIELD).innerText()) ?? '').trim()
}

async function syncTop(page) {
	return Math.round((await page.locator('#settings-calendar-sync').boundingBox()).y)
}

async function connectionBox(page) {
	return page.locator('[data-slot="calendar-connection-content"]').boundingBox()
}

async function ready(page, mode) {
	await page.goto(OPEN, { timeout: 120000 })
	await page.locator('#settings-calendar-sync').waitFor({ timeout: 60000 })
	if (mode === 'field') await page.locator(FIELD).waitFor({ timeout: 30000 })
}

async function states() {
	const { browser, page, problems } = await launch({ width: 1280, height: 900 })
	const server = model()
	const tops = []
	const heights = []
	const remember = async () => {
		tops.push(await syncTop(page))
		heights.push(Math.round((await connectionBox(page)).height))
	}
	try {
		await install(page, server)
		await signIn(page)

		server.listDelay = 3000
		await page.goto(OPEN, { timeout: 120000 })
		await page.locator(`button${FIELD}`).waitFor({ timeout: 30000 })
		const loadingText = await triggerText(page)
		check('loading shows the disabled Select with its sentence', loadingText === 'Loading calendars…', loadingText)
		check('loading has a spinner', (await page.locator('[data-slot="calendar-choice"] svg.animate-spin').count()) >= 1)
		check('loading Select is disabled', await page.locator(`button${FIELD}`).isDisabled())
		await shot(page, 'calendar-settings-choice', 'loading')
		await remember()
		await page.locator(`button${FIELD}:not([disabled])`).waitFor({ timeout: 30000 })
		server.listDelay = 0

		const label = (await page.locator('label[for="settings-calendar-choice"]').innerText()).trim()
		check('field label is Calendar', label === 'Calendar', label)
		check('helper sentence is shown', (await page.getByText('Events are added to this calendar.').count()) === 1)
		check('two calendars: Select shows the current name', (await triggerText(page)) === 'Teaching')
		const triggerBox = await page.locator(`button${FIELD}`).boundingBox()
		check('Select is at most 360px wide', triggerBox.width <= 360.5, String(triggerBox.width))
		await shot(page, 'calendar-settings-choice', 'two')
		await remember()

		server.list = 'one'
		await ready(page, 'none')
		await page.getByText('Events are added to this calendar.').waitFor({ timeout: 30000 })
		check('one calendar is plain text', (await page.locator(`p${FIELD}`).innerText()).trim() === 'Teaching')
		check('one calendar has no Select', (await page.locator(`button${FIELD}`).count()) === 0)
		await shot(page, 'calendar-settings-choice', 'one')
		await remember()

		server.list = 'none'
		await ready(page, 'none')
		await page.getByText('No calendar in this account can be changed.').waitFor({ timeout: 30000 })
		check('none writable shows the sentence', true)
		check('none writable has no helper', (await page.getByText('Events are added to this calendar.').count()) === 0)
		check('none writable has no Select', (await page.locator(`button${FIELD}`).count()) === 0)
		await shot(page, 'calendar-settings-choice', 'none')
		await remember()

		server.list = 'fail'
		await ready(page, 'none')
		await page.getByText('Could not load calendars.').waitFor({ timeout: 30000 })
		const retry = page.getByRole('button', { name: 'Retry' })
		check('failed shows Retry', (await retry.count()) === 1)
		const colors = await page.evaluate(() => {
			const sentence = [...document.querySelectorAll('[role="alert"]')].find((element) =>
				element.textContent?.includes('Could not load calendars.')
			)
			const label = document.querySelector('label[for="settings-calendar-choice"]')
			return {
				sentence: sentence ? getComputedStyle(sentence).color : null,
				label: label ? getComputedStyle(label).color : null,
			}
		})
		check(
			'failed sentence is destructive',
			colors.sentence !== null && colors.sentence !== colors.label,
			JSON.stringify(colors)
		)
		await shot(page, 'calendar-settings-choice', 'failed')
		await remember()
		server.list = 'two'
		await retry.click()
		await page.locator(`button${FIELD}:not([disabled])`).waitFor({ timeout: 30000 })
		check('Retry loads the list', (await triggerText(page)) === 'Teaching')

		for (const state of ['reconnect_required', 'not_connected', 'disconnecting', 'disconnect_failed']) {
			server.state = state
			server.list = 'two'
			const before = server.listReads
			await ready(page, 'field')
			{
				const trigger = page.locator(`button${FIELD}`)
				check(`${state}: field stays and is disabled`, await trigger.isDisabled())
				check(`${state}: name is shown`, (await triggerText(page)) === 'Teaching')
				const opacity = await trigger.evaluate((element) => getComputedStyle(element).opacity)
				check(`${state}: field is at 50%`, opacity === '0.5', opacity)
				check(`${state}: no list is requested`, server.listReads === before)
			}
			await shot(page, 'calendar-settings-choice', state)
			await remember()
		}
		check('Sync panel never moves between states', new Set(tops).size === 1, tops.join(','))
		check(
			'Connection panel is at least 292px of content in every state',
			Math.min(...heights) >= 292,
			heights.join(',')
		)
		check('settings page has no console problems', real(problems).length === 0, real(problems).slice(0, 2).join(' || '))
	} finally {
		await browser.close()
	}
}

async function switching() {
	const { browser, page, problems } = await launch({ width: 1280, height: 900 })
	const server = model()
	try {
		await install(page, server)
		await signIn(page)
		await ready(page, 'field')
		const trigger = page.locator(`button${FIELD}`)
		const pick = async (name) => {
			await trigger.click()
			await page.getByRole('option', { name }).click()
			await page.getByRole('dialog').waitFor({ timeout: 10000 })
		}

		await trigger.click()
		await page.getByRole('option').first().waitFor({ timeout: 10000 })
		const options = await page.getByRole('option').allInnerTexts()
		check(
			'the list holds the three calendars',
			options.map((text) => text.trim()).join('|') === 'Teaching|Personal|Tutoring',
			options.join('|')
		)
		await shot(page, 'calendar-settings-choice', 'list')
		await page.getByRole('option', { name: 'Personal' }).click()
		const dialog = page.getByRole('dialog')
		await dialog.waitFor({ timeout: 10000 })
		check('choosing opens the confirmation', (await dialog.getByText('Use another calendar?').count()) === 1)
		check('Select keeps the current name behind the dialog', (await triggerText(page)) === 'Teaching')
		check('nothing was posted by choosing', server.posts.length === 0)
		const body = (await dialog.innerText()).replace(/\s+/g, ' ')
		check(
			'body names the new calendar',
			body.includes(
				'New and changed events go to Personal. Events already in the schedule from the previous calendar stay as read-only history. Lessons are not copied to Personal.'
			),
			body.slice(0, 200)
		)
		const focused = await page.evaluate(() => document.activeElement?.textContent?.trim())
		check('the safe button is focused', focused === 'Keep Teaching', String(focused))
		const labels = await dialog.getByRole('button').allInnerTexts()
		check(
			'buttons are Keep and Use',
			labels
				.map((text) => text.trim())
				.join('|')
				.includes('Keep Teaching') && labels.join('|').includes('Use Personal'),
			labels.join('|')
		)
		await page.waitForTimeout(700)
		await shot(page, 'calendar-settings-choice', 'dialog')

		await dialog.getByRole('button', { name: 'Keep Teaching' }).click()
		await dialog.waitFor({ state: 'detached', timeout: 10000 })
		check('Keep closes the dialog', true)
		check('Keep leaves the name', (await triggerText(page)) === 'Teaching')
		check('Keep posts nothing', server.posts.length === 0)

		server.postStatus = 409
		await pick('Personal')
		await page.getByRole('button', { name: 'Use Personal' }).click()
		const failure = page.getByRole('dialog').getByRole('alert')
		await failure
			.filter({ hasText: 'Could not switch the calendar. Refresh the connection status before trying again.' })
			.waitFor({ timeout: 10000 })
		check('a refused switch shows the sentence in the reserved slot', true)
		const slot = await failure.boundingBox()
		check('the failure slot is two lines high', slot.height >= 43, String(slot.height))
		check('the dialog stays open after a failure', (await page.getByRole('dialog').count()) === 1)
		check('the name did not change after a failure', (await triggerText(page)) === 'Teaching')
		const post = server.posts[0]
		check(
			'the request names the calendar and the generation',
			server.posts.length === 1 &&
				post.calendarId === 'synthetic-b' &&
				post.expectedGeneration === 4 &&
				/^[0-9a-f-]{36}$/.test(post.requestId),
			JSON.stringify(post)
		)
		await shot(page, 'calendar-settings-choice', 'failure')
		await page.getByRole('button', { name: 'Keep Teaching' }).click()
		await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 10000 })

		server.postStatus = 200
		await pick('Personal')
		await page.getByRole('button', { name: 'Use Personal' }).click()
		await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 15000 })
		await page.locator(`button${FIELD}:not([disabled])`).waitFor({ timeout: 30000 })
		check('success posts once more', server.posts.length === 2 && server.posts[1].expectedGeneration === 4)
		check(
			'after the server confirms the name changes',
			(await triggerText(page)) === 'Personal',
			await triggerText(page)
		)
		check('the connection lines follow', (await page.getByText('Europe/London').count()) === 1)
		await shot(page, 'calendar-settings-choice', 'switched')
		check('settings page has no console problems', real(problems).length === 0, real(problems).slice(0, 2).join(' || '))
	} finally {
		await browser.close()
	}
}

async function phone() {
	const { browser, page } = await launch({ width: 390, height: 844 })
	const server = model()
	try {
		await install(page, server)
		await signIn(page)
		await ready(page, 'field')
		const box = await page.locator(`button${FIELD}`).boundingBox()
		check('phone: the Select fits the screen', box.x >= 0 && box.x + box.width <= 390, `${box.x}+${box.width}`)
		await page.locator(`button${FIELD}`).click()
		await page.getByRole('option', { name: 'Personal' }).click()
		const dialog = page.getByRole('dialog')
		await dialog.waitFor({ timeout: 10000 })
		const dialogBox = await dialog.boundingBox()
		check(
			'phone: the dialog fits the screen',
			dialogBox.x >= 0 && dialogBox.x + dialogBox.width <= 390,
			JSON.stringify(dialogBox)
		)
		await shot(page, 'calendar-settings-choice', 'phone')
	} finally {
		await browser.close()
	}
}

let completed = false
try {
	seed('up', 'dev', 'week')
	await startStack()
	await states()
	await switching()
	await phone()
	completed = true
} catch (error) {
	check('script completed', false, String(error).slice(0, 400))
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
if (completed && failures() === 0) console.log('CALENDAR_WEB_SETTINGS_OK')
process.exit(failures() === 0 && completed ? 0 : 1)
