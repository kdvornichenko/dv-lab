import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

import { BASE, ROOT, STATE_DIR, check, failures, launch, shot, signIn, sql } from './web.mjs'

const NODE = process.execPath
const SEED = `${ROOT}/scripts/dev-checks/calendar-seed.mjs`
const WAIT = `${ROOT}/scripts/dev-checks/wait-dev.mjs`
const VIEWPORTS = [
	{ width: 1440, height: 820 },
	{ width: 1280, height: 720 },
]
const BODY = '[data-slot="week-grid-body"] [data-slot="calendar-event"]'
const BAND = '[data-slot="calendar-all-day"] [data-slot="calendar-event"]'
const POLL_WINDOW_MS = 30000

const real = (problems) =>
	problems.filter((problem) => !problem.includes('server caches disabled') && !problem.includes('status of 404'))
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

function commandCount() {
	const result = sql('select count(*)::int as n from google_commands')
	return result.rows?.[0]?.n ?? -1
}

function operationOf(method, path) {
	if (path.endsWith('/google/events')) return 'event_create'
	if (path.endsWith('/delete')) return 'event_delete'
	if (path.includes('/google/events/')) return 'event_update'
	if (path.endsWith('/end')) return 'end_series'
	if (path.endsWith('/cancel')) return 'cancel'
	if (path.endsWith('/restore')) return 'restore'
	if (path.includes('/series/') && path.endsWith('/move')) return 'move'
	return 'create'
}

async function prepare(viewport, { injectLesson = false } = {}) {
	const { browser, context, page, problems } = await launch(viewport)
	const calls = []
	const commands = new Map()
	const state = { revision: '1', generation: 1, lesson: injectLesson, lessonInfo: null }
	await context.route(/\/api\/schedule\/week/, async (route) => {
		const response = await route.fetch()
		let json
		try {
			json = await response.json()
		} catch {
			return route.fulfill({ response })
		}
		if (json?.read?.revision) state.revision = json.read.revision
		if (json?.connection?.generation !== undefined) state.generation = json.connection.generation
		if (state.lesson && json?.read?.state === 'fresh') {
			const target = json.events.find((event) => event.title === 'Synthetic event 12')
			if (target && state.lessonInfo) {
				const { seriesId, studentId, version } = state.lessonInfo
				const start = new Date(target.when.startsAt)
				const originalOn = target.when.startsAt.slice(0, 10)
				target.binding = {
					kind: 'lesson',
					ref: { kind: 'series', seriesId, originalOn },
					studentId,
					version,
				}
				target.title = null
				json.series = [
					{
						version,
						series: {
							id: seriesId,
							studentId,
							weekday: 3,
							startTime: '15:00',
							timeZone: target.when.timeZone,
							durationMinutes: 60,
							startsOn: '2026-01-07',
							endsOn: null,
							referenceOccurrence: {
								originalOn,
								actualStartsAt: start.toISOString().replace('.000Z', 'Z'),
								ruleStartsAt: null,
							},
						},
					},
				]
			}
		}
		return route.fulfill({ response, json })
	})
	await context.route(/\/api\/(google\/events|schedule\/(lessons|series))/, async (route) => {
		const request = route.request()
		const url = new URL(request.url())
		if (request.method() !== 'POST' || url.pathname.endsWith('/mark')) return route.continue()
		let body = null
		try {
			body = request.postDataJSON()
		} catch {
			body = null
		}
		const commandId = randomUUID()
		const operation = operationOf(request.method(), url.pathname)
		calls.push({ path: url.pathname.replace('/api', ''), body, operation })
		commands.set(commandId, {
			commandId,
			requestId: body?.requestId,
			generation: state.generation,
			expectedVersion: body?.expectedVersion,
			operation,
			effect: 'confirmed',
			state: 'applied',
			issue: null,
			confirmedRevision: state.revision,
			affectedRefs: [],
			nextAction: 'none',
		})
		return route.fulfill({
			status: 202,
			json: { commandId, statusUrl: `/api/google/commands/${commandId}` },
		})
	})
	await context.route(/\/api\/google\/commands\//, async (route) => {
		const url = new URL(route.request().url())
		const key = decodeURIComponent(url.pathname.split('/').pop())
		const found = url.pathname.includes('/by-request/')
			? [...commands.values()].find((item) => item.requestId === key)
			: commands.get(key)
		if (!found) return route.continue()
		return route.fulfill({ json: found })
	})
	return { browser, context, page, problems, calls, state }
}

async function openWeek(page) {
	await page.goto(`${BASE}/schedule`, { timeout: 120000 })
	await page.locator(BODY).first().waitFor({ timeout: 120000 })
	await page.waitForTimeout(1500)
}

async function openEvent(page, title, band = false) {
	await page
		.locator(band ? BAND : BODY)
		.filter({ hasText: title })
		.first()
		.click()
	const dialog = page.getByRole('dialog').last()
	await dialog.waitFor({ timeout: 15000 })
	await page.waitForTimeout(700)
	return dialog
}

async function closed(page, calls, operation, count) {
	const started = Date.now()
	while (calls.filter((call) => call.operation === operation).length < count) {
		if (Date.now() - started > 20000) throw new Error(`no ${operation} call number ${count}`)
		await wait(100)
	}
	await page.getByRole('dialog').first().waitFor({ state: 'detached', timeout: 20000 })
	await page.waitForTimeout(600)
}

async function suite(viewport) {
	const tag = `${viewport.width}x${viewport.height}`
	const { browser, page, problems, calls, state } = await prepare(viewport)
	const commandsBefore = commandCount()
	try {
		await signIn(page)
		await openWeek(page)

		const body = page.locator('[data-slot="week-grid-body"]')
		const box = await body.boundingBox()
		await page.mouse.click(box.x + box.width * 0.82, Math.max(box.y, 0) + 220)
		await page.getByRole('dialog').last().waitFor({ timeout: 15000 })
		await page.getByRole('tab', { name: 'Event' }).click()
		const created = page.getByRole('dialog').last()
		check(`${tag} new event dialog title and tabs`, (await created.getByText('New event').count()) > 0)
		await page.locator('#new-event-title').focus()
		await page.locator('#new-event-title').blur()
		check(
			`${tag} no title error on a bare blur`,
			(await created.getByText('Enter a title for the event.').count()) === 0
		)
		await page.locator('#new-event-color').click()
		await page.getByRole('option').first().waitFor({ timeout: 10000 })
		await page.waitForTimeout(500)
		const options = await page.getByRole('option').allInnerTexts()
		check(
			`${tag} colour list has Default and eleven names`,
			options.some((text) => text.includes('Default')) &&
				[
					'Lavender',
					'Sage',
					'Grape',
					'Flamingo',
					'Banana',
					'Tangerine',
					'Peacock',
					'Graphite',
					'Blueberry',
					'Basil',
					'Tomato',
				].every((name) => options.some((text) => text.includes(name))),
			options.join(',')
		)
		await page.getByRole('option', { name: /Tomato/ }).click()
		await page.locator('#new-event-title').fill('Editor check event')
		await page.locator('#new-event-place').fill('Synthetic room 9')
		await page.locator('#new-event-description').fill('Synthetic note for the check.')
		await shot(page, `calendar-editor-${tag}`, 'create')
		await created.getByRole('button', { name: 'Add event' }).click()
		await closed(page, calls, 'event_create', 1)
		check(`${tag} created event toast`, (await page.getByText('Event added').count()) > 0)
		const create = calls.find((call) => call.operation === 'event_create')
		check(
			`${tag} create sends title, colour, place and description`,
			create?.body?.title === 'Editor check event' &&
				create.body.colorId === '11' &&
				create.body.location === 'Synthetic room 9' &&
				create.body.description === 'Synthetic note for the check.' &&
				create.body.expectedVersion === state.revision,
			JSON.stringify(create?.body)
		)
		await page.waitForTimeout(800)

		let dialog = await openEvent(page, 'Synthetic event 15')
		const text = await dialog.innerText()
		check(
			`${tag} details show place, description and calendar`,
			text.includes('Synthetic room 1') &&
				text.includes('Synthetic description for a seeded event.') &&
				text.includes('Synthetic calendar') &&
				text.includes('Busy'),
			text.replace(/\n/g, ' | ')
		)
		check(
			`${tag} details offer Delete event and Edit event`,
			(await dialog.getByRole('button', { name: 'Delete event' }).count()) === 1 &&
				(await dialog.getByRole('button', { name: 'Edit event' }).count()) === 1
		)
		await shot(page, `calendar-editor-${tag}`, 'details')

		await dialog.getByRole('button', { name: 'Edit event' }).click()
		await page.waitForTimeout(700)
		const edit = page.getByRole('dialog').last()
		const save = edit.getByRole('button', { name: 'Save changes' })
		check(`${tag} Save is disabled while the form is clean`, await save.isDisabled())
		await page.locator('#event-edit-title').fill('Synthetic event 15 renamed')
		await page.waitForTimeout(400)
		check(`${tag} Save enables after a change`, await save.isEnabled())
		await shot(page, `calendar-editor-${tag}`, 'edit')
		await save.click()
		await closed(page, calls, 'event_update', 1)
		const update = calls.find((call) => call.operation === 'event_update')
		check(
			`${tag} single event save sends only the title with scope one`,
			update?.body?.scope === 'one' &&
				JSON.stringify(Object.keys(update.body.changes)) === '["title"]' &&
				update.body.changes.title === 'Synthetic event 15 renamed',
			JSON.stringify(update?.body)
		)
		await page.waitForTimeout(800)

		dialog = await openEvent(page, 'Synthetic event 12')
		check(
			`${tag} weekly event says it repeats every Wednesday`,
			(await dialog.innerText()).includes('Repeats every Wednesday'),
			(await dialog.innerText()).replace(/\n/g, ' | ')
		)
		await dialog.getByRole('button', { name: 'Edit event' }).click()
		await page.waitForTimeout(700)
		await page.locator('#event-edit-title').fill('Weekly renamed')
		await page.getByRole('dialog').last().getByRole('button', { name: 'Save changes' }).click()
		const scope = page.getByRole('dialog').last()
		await scope.getByText('Change repeating event').waitFor({ timeout: 10000 })
		const radios = await scope.getByRole('radio').count()
		const disabled = await scope.locator('[role="radio"][aria-disabled="true"], [role="radio"][data-disabled]').count()
		check(
			`${tag} weekly save asks three scopes, all available`,
			radios === 3 && disabled === 0,
			`${radios}/${disabled}`
		)
		check(
			`${tag} scope dialog autofocuses the safe button`,
			(await scope.getByRole('button', { name: 'Back' }).evaluate((element) => element === document.activeElement)) ===
				true
		)
		await page.waitForTimeout(600)
		await shot(page, `calendar-editor-${tag}`, 'scope-save')
		await scope.getByRole('radio', { name: 'All events' }).click()
		await scope.getByRole('button', { name: 'Save', exact: true }).click()
		await closed(page, calls, 'event_update', 2)
		const weeklyUpdate = calls.filter((call) => call.operation === 'event_update').at(-1)
		check(
			`${tag} weekly save sends scope all`,
			weeklyUpdate?.body?.scope === 'all' && weeklyUpdate.body.changes.title === 'Weekly renamed',
			JSON.stringify(weeklyUpdate?.body)
		)
		await page.waitForTimeout(800)

		dialog = await openEvent(page, 'Synthetic event 12')
		await dialog.getByRole('button', { name: 'Delete event' }).click()
		const remove = page.getByRole('dialog').last()
		await remove.getByText('Delete repeating event').waitFor({ timeout: 10000 })
		await page.waitForTimeout(600)
		await shot(page, `calendar-editor-${tag}`, 'scope-delete')
		await remove.getByRole('radio', { name: 'This and following events' }).click()
		await remove.getByRole('button', { name: 'Delete', exact: true }).click()
		await closed(page, calls, 'event_delete', 1)
		const deleted = calls.find((call) => call.operation === 'event_delete')
		check(
			`${tag} repeating delete sends scope following`,
			deleted?.body?.scope === 'following' && deleted.path.endsWith('/delete'),
			JSON.stringify(deleted)
		)
		await page.waitForTimeout(800)

		dialog = await openEvent(page, 'Synthetic event 13')
		const otherText = await dialog.innerText()
		check(
			`${tag} unsupported repeat is read-only with the Google sentence`,
			otherText.includes('Repeats every 2 weeks') &&
				otherText.includes("This repeat rule can't be edited here. Change it in Google Calendar.") &&
				(await dialog.getByRole('button', { name: 'Edit event' }).count()) === 0 &&
				(await dialog.getByRole('button', { name: 'Delete event' }).count()) === 0,
			otherText.replace(/\n/g, ' | ')
		)
		await shot(page, `calendar-editor-${tag}`, 'unsupported-repeat')
		await page.keyboard.press('Escape')
		await page.waitForTimeout(500)

		dialog = await openEvent(page, 'Synthetic event 10', true)
		check(
			`${tag} all-day event offers Delete only`,
			(await dialog.getByRole('button', { name: 'Delete event' }).count()) === 1 &&
				(await dialog.getByRole('button', { name: 'Edit event' }).count()) === 0 &&
				(await dialog.getByRole('button', { name: 'Close' }).count()) > 0
		)
		await dialog.getByRole('button', { name: 'Delete event' }).click()
		const confirm = page.getByRole('dialog').last()
		await confirm.waitFor({ timeout: 10000 })
		await page.waitForTimeout(600)
		await shot(page, `calendar-editor-${tag}`, 'confirm-delete')
		await confirm.getByRole('button', { name: 'Delete event' }).click()
		await closed(page, calls, 'event_delete', 2)
		const allDayDelete = calls.filter((call) => call.operation === 'event_delete').at(-1)
		check(
			`${tag} all-day delete sends scope one`,
			allDayDelete?.body?.scope === 'one',
			JSON.stringify(allDayDelete?.body)
		)
		await page.waitForTimeout(800)

		dialog = await openEvent(page, 'Synthetic event 14')
		check(
			`${tag} read-only event shows Close and the reason`,
			(await dialog.getByRole('button', { name: 'Edit event' }).count()) === 0 &&
				(await dialog.getByRole('button', { name: 'Delete event' }).count()) === 0 &&
				(await dialog.locator('[data-slot="event-read-only"]').count()) === 1,
			(await dialog.innerText()).replace(/\n/g, ' | ')
		)
		await shot(page, `calendar-editor-${tag}`, 'read-only')
		await page.keyboard.press('Escape')
		await page.waitForTimeout(500)

		dialog = await openEvent(page, 'Synthetic event 04')
		await dialog.getByRole('button', { name: 'Edit event' }).click()
		await page.waitForTimeout(700)
		await page.locator('#event-edit-title').fill('Draft kept while Google changes')
		const startValue = await page.locator('#event-edit-time').innerText()
		seed('bump', 'dev', 'dvseed04')
		const refresh = page.getByRole('button', { name: /Changed in Google/ })
		const started = Date.now()
		await refresh.waitFor({ timeout: POLL_WINDOW_MS })
		check(`${tag} stale draft shows Changed in Google`, true, `${Date.now() - started} ms`)
		check(
			`${tag} stale draft keeps the typed title and disables Save`,
			(await page.locator('#event-edit-title').inputValue()) === 'Draft kept while Google changes' &&
				(await page.getByRole('dialog').last().getByRole('button', { name: 'Save changes' }).isDisabled())
		)
		await shot(page, `calendar-editor-${tag}`, 'stale')
		await refresh.click()
		let freshValue = startValue
		for (let attempt = 0; attempt < 30 && freshValue === startValue; attempt += 1) {
			await page.waitForTimeout(200)
			freshValue = await page.locator('#event-edit-time').innerText()
		}
		await shot(page, `calendar-editor-${tag}`, 'refreshed')
		check(
			`${tag} Refresh loads the Google version`,
			(await refresh.count()) === 0 &&
				freshValue !== startValue &&
				(await page.locator('#event-edit-title').inputValue()) === 'Synthetic event 04',
			`${startValue} -> ${freshValue}`
		)
		await page.keyboard.press('Escape')
		await page.waitForTimeout(500)
		if ((await page.getByRole('dialog').count()) > 0) {
			await page
				.getByRole('dialog')
				.last()
				.getByRole('button', { name: /^Discard/ })
				.click()
			await page.waitForTimeout(400)
			await page.keyboard.press('Escape')
		}
		await page.waitForTimeout(500)

		dialog = await openEvent(page, 'Synthetic event 05')
		const gone = sql(
			"delete from google_calendar_events where event_id = 'dvseed05' and calendar_id like 'synthetic-calendar%'"
		)
		const wiped = sql(
			"update google_sync_state set revision = revision + 1 where calendar_id like 'synthetic-calendar%'"
		)
		check(`${tag} removal rows prepared`, gone.rowCount === 1 && wiped.rowCount === 1, JSON.stringify([gone, wiped]))
		const banner = page.getByText('This event no longer exists in Google Calendar.')
		await banner.waitFor({ timeout: POLL_WINDOW_MS })
		check(`${tag} removed event shows the banner`, true)
		check(
			`${tag} removed event offers only Close`,
			(await page.getByRole('dialog').last().getByRole('button', { name: 'Edit event' }).count()) === 0
		)
		await shot(page, `calendar-editor-${tag}`, 'removed')
		await page.keyboard.press('Escape')
		await page.waitForTimeout(500)

		check(`${tag} no intercepted command reached the api`, commandCount() === commandsBefore, `${commandsBefore}`)
		check(`${tag} no console problems`, real(problems).length === 0, real(problems).slice(0, 2).join(' || '))
	} catch (error) {
		await shot(page, `calendar-editor-${tag}`, 'failure').catch(() => {})
		console.log('calls', JSON.stringify(calls).slice(0, 800))
		console.log('problems', real(problems).slice(0, 4).join(' || '))
		throw error
	} finally {
		await browser.close()
	}
}

async function lessonScope(viewport) {
	const tag = `${viewport.width}x${viewport.height}`
	const { browser, context, page, problems, calls, state } = await prepare(viewport, { injectLesson: true })
	try {
		await signIn(page)
		const students = await page.request.get(`${BASE}/api/students`)
		const list = (await students.json()).students ?? []
		const card = list.find((row) => row.displayName === 'Alex Example 0001')
		if (!card) throw new Error('synthetic card is missing')
		state.lessonInfo = { seriesId: randomUUID(), studentId: card.id, version: 'lesson-check-version' }
		await openWeek(page)
		await page.locator(BODY).filter({ hasText: 'Busy' }).first().waitFor({ timeout: 20000 })
		const dialog = await openEvent(page, 'Busy')
		await shot(page, `calendar-editor-${tag}`, 'lesson-details')
		await dialog.getByRole('button', { name: 'Cancel lesson' }).click()
		const scope = page.getByRole('dialog').last()
		await scope.getByText('Cancel repeating lesson').waitFor({ timeout: 10000 })
		check(
			`${tag} lesson cancel scope has two rows and the marks caption`,
			(await scope.getByRole('radio').count()) === 2 &&
				(await scope.getByText('Past lessons and their marks stay as they are.').count()) === 1
		)
		await page.waitForTimeout(600)
		await shot(page, `calendar-editor-${tag}`, 'lesson-cancel-scope')
		await scope.getByRole('radio', { name: 'This and following lessons' }).click()
		await scope.getByRole('button', { name: 'Cancel lessons' }).click()
		await closed(page, calls, 'end_series', 1)
		const ended = calls.find((call) => call.operation === 'end_series')
		check(
			`${tag} cancelling following ends the series the day before`,
			Boolean(ended) && ended.path.endsWith('/end') && /^\d{4}-\d{2}-\d{2}$/.test(ended.body?.lastOn),
			JSON.stringify(ended)
		)
		void context
		check(
			`${tag} lesson scope has no console problems`,
			real(problems).length === 0,
			real(problems).slice(0, 2).join(' || ')
		)
	} finally {
		await browser.close()
	}
}

let completed = false
try {
	seed('up', 'dev', 'week')
	await startStack()
	for (const viewport of VIEWPORTS) {
		await suite(viewport)
		seed('up', 'dev', 'week')
	}
	await lessonScope(VIEWPORTS[0])
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
if (completed && failures() === 0) console.log('CALENDAR_WEB_EDITOR_OK')
process.exit(failures() === 0 && completed ? 0 : 1)
