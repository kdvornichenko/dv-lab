import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

import { BASE, ROOT, STATE_DIR, check, failures, launch, shot, signIn, sql, theme } from './web.mjs'

const NODE = process.execPath
const SEED = `${ROOT}/scripts/dev-checks/calendar-seed.mjs`
const COMMANDS = `${ROOT}/scripts/dev-checks/calendar-commands.mjs`
const WAIT = `${ROOT}/scripts/dev-checks/wait-dev.mjs`
const VIEWPORTS = [
	{ width: 1440, height: 820 },
	{ width: 1280, height: 720 },
]
const BODY = '[data-slot="week-grid-body"] [data-slot="calendar-event"]'
const BAND = '[data-slot="calendar-all-day"] [data-slot="calendar-event"]'
const MINUTE = 48 / 60
const DAY_START = 120
const CARD_ONE = 'calendar-seed:alex-example-0001'
const CARD_TWO = 'calendar-commands:alex-example-0002'
const MODES = {
	applied: (revision) => ({
		state: 'applied',
		effect: 'confirmed',
		issue: null,
		confirmedRevision: revision,
		nextAction: 'none',
	}),
	syncing: () => ({
		state: 'dispatching',
		effect: 'unknown',
		issue: null,
		confirmedRevision: null,
		nextAction: 'wait',
	}),
	unknown: () => ({
		state: 'outcome_unknown',
		effect: 'unknown',
		issue: 'provider_unavailable',
		confirmedRevision: null,
		nextAction: 'wait',
	}),
	refused: () => ({
		state: 'failed',
		effect: 'none',
		issue: 'not_applied',
		confirmedRevision: null,
		nextAction: 'retry_new_command',
	}),
}

const real = (problems) =>
	problems.filter((problem) => !problem.includes('server caches disabled') && !problem.includes('status of 404'))
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const addDays = (date, days) => {
	const value = new Date(`${date}T00:00:00Z`)
	value.setUTCDate(value.getUTCDate() + days)
	return value.toISOString().slice(0, 10)
}

function run(script, ...args) {
	const result = spawnSync(NODE, [script, ...args], { encoding: 'utf8', timeout: 300000 })
	if (result.status !== 0)
		throw new Error(`${script} ${args.join(' ')} failed: ${(result.stdout + result.stderr).slice(-300)}`)
	return result.stdout
}

const owned = []

async function startStack() {
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

function count(table) {
	return sql(`select count(*)::int as n from ${table}`).rows?.[0]?.n ?? -1
}

function studentId(key) {
	return sql(`select id from students where import_key = '${key}'`).rows?.[0]?.id ?? null
}

function purgeFixtures() {
	const card = `(select id from students where import_key = '${CARD_TWO}')`
	sql(`begin;
delete from lesson_marks where series_id in (select id from lesson_series where student_id in ${card}) or lesson_id in (select id from lessons where student_id in ${card});
delete from lesson_exceptions where series_id in (select id from lesson_series where student_id in ${card});
delete from lessons where student_id in ${card};
delete from lesson_series where student_id in ${card};
delete from students where import_key = '${CARD_TWO}';
commit;`)
}

function operationOf(path) {
	if (path.endsWith('/assign')) return 'assign'
	if (path.endsWith('/google/events')) return 'event_create'
	if (path.endsWith('/delete')) return 'event_delete'
	if (path.includes('/google/events/')) return 'event_update'
	if (path.includes('/occurrences/') && path.endsWith('/move')) return 'move'
	if (path.includes('/series/') && path.endsWith('/move')) return 'move_series'
	if (path.endsWith('/move')) return 'move'
	if (path.endsWith('/end')) return 'end_series'
	return 'create'
}

async function prepare(viewport, ids) {
	const { browser, context, page, problems } = await launch(viewport)
	const calls = []
	const conflictLog = []
	const commands = new Map()
	const state = {
		revision: '1',
		generation: 1,
		assigned: false,
		ignored: false,
		next: 'applied',
		release: () => {
			for (const item of commands.values()) item.mode = 'applied'
		},
	}
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
		if (json?.read?.state === 'fresh') {
			for (const event of json.events) {
				if (event.title === 'Alex Example 0001' && state.assigned) {
					event.suggestion = null
					event.binding = {
						kind: 'lesson',
						ref: { kind: 'single', lessonId: ids.fakeLesson },
						studentId: ids.one,
						version: event.version,
						mark: null,
					}
				}
				if (event.title === 'Synthetic event 07' && !state.ignored)
					event.suggestion = { studentId: ids.one, scope: 'event' }
				if (event.title === 'Synthetic event 12' && event.binding.kind === 'external')
					event.suggestion = { studentId: ids.one, scope: 'series' }
				if (event.title === 'Synthetic event 06' && ids.pastLesson) {
					event.binding = {
						kind: 'lesson',
						ref: { kind: 'single', lessonId: ids.pastLesson },
						studentId: ids.one,
						version: event.version,
						mark: null,
					}
					event.suggestion = null
				}
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
		const path = url.pathname.replace('/api', '')
		if (path.endsWith('/ignore')) {
			calls.push({ path, body, operation: 'ignore' })
			state.ignored = true
			return route.fulfill({ status: 204 })
		}
		const commandId = randomUUID()
		const operation = operationOf(url.pathname)
		calls.push({ path, body, operation })
		commands.set(commandId, {
			mode: state.next,
			base: {
				commandId,
				requestId: body?.requestId,
				generation: state.generation,
				expectedVersion: body?.expectedVersion,
				operation,
				affectedRefs: [],
			},
		})
		state.next = 'applied'
		if (operation === 'assign') state.assigned = true
		return route.fulfill({
			status: 202,
			json: { commandId, statusUrl: `/api/google/commands/${commandId}` },
		})
	})
	page.on('response', async (response) => {
		if (response.url().includes('/google/conflicts'))
			conflictLog.push({
				status: response.status(),
				text: (await response.text().catch(() => '')).slice(0, 200),
				req: (response.request().postData() ?? '').slice(0, 300),
			})
	})
	await context.route(/\/api\/google\/commands\//, async (route) => {
		const url = new URL(route.request().url())
		const key = decodeURIComponent(url.pathname.split('/').pop())
		const found = url.pathname.includes('/by-request/')
			? [...commands.values()].find((item) => item.base.requestId === key)
			: commands.get(key)
		if (!found) return route.continue()
		return route.fulfill({ json: { ...found.base, ...MODES[found.mode](state.revision) } })
	})
	return { browser, page, problems, calls, conflictLog, state }
}

async function openWeek(page) {
	await page.goto(`${BASE}/schedule`, { timeout: 120000 })
	await page.locator(BODY).first().waitFor({ timeout: 120000 })
	await page.waitForTimeout(1500)
}

async function nextWeek(page) {
	await page.getByRole('button', { name: 'Next week' }).first().click()
	await page.waitForTimeout(1500)
}

async function previousWeek(page) {
	await page.getByRole('button', { name: 'Previous week' }).first().click()
	await page.waitForTimeout(1500)
}

async function columnTop(page, date) {
	const box = await page.locator(`[data-slot="week-grid-column"][data-date="${date}"]`).boundingBox()
	if (!box) throw new Error(`no column for ${date}`)
	return box
}

async function reveal(page, hour) {
	await page.evaluate(
		({ minutes, minute }) => {
			const body = document.querySelector('[data-slot="week-grid-body"]')
			body.scrollTop = Math.max(0, minutes * minute - body.clientHeight / 2)
		},
		{ minutes: (((hour * 60 - DAY_START) % 1440) + 1440) % 1440, minute: MINUTE }
	)
	await page.waitForTimeout(250)
}

async function pointAt(page, date, hour, minutes = 0) {
	const column = await columnTop(page, date)
	const lessonMinutes = (((hour * 60 + minutes - DAY_START) % 1440) + 1440) % 1440
	return { x: column.x + column.width / 2 - 6, y: column.y + lessonMinutes * MINUTE }
}

function block(page, title, band = false) {
	return page
		.locator(band ? BAND : BODY)
		.filter({ hasText: title })
		.first()
}

async function gesture(page, from, to, { release = true, escape = false, steps = 14 } = {}) {
	await page.mouse.move(from.x, from.y)
	await page.mouse.down()
	await page.mouse.move(from.x + 6, from.y + 6, { steps: 3 })
	await page.mouse.move(to.x, to.y, { steps })
	await page.waitForTimeout(250)
	const chip = await page
		.locator('[data-slot="week-grid-move-chip"]')
		.first()
		.innerText({ timeout: 1000 })
		.catch(() => null)
	if (escape) await page.keyboard.press('Escape')
	if (release) await page.mouse.up()
	return chip
}

async function dragBlock(page, title, date, hour, minutes = 0, options = {}) {
	const target = block(page, title)
	const box = await target.boundingBox()
	if (!box) throw new Error(`no block ${title}`)
	const from = { x: box.x + box.width / 2 - 6, y: box.y + 9 }
	const to = await pointAt(page, date, hour, minutes)
	return gesture(page, from, { x: to.x, y: to.y + 9 }, options)
}

async function resizeBlock(page, title, deltaMinutes, options = {}) {
	const target = block(page, title)
	const box = await target.boundingBox()
	if (!box) throw new Error(`no block ${title}`)
	const from = { x: box.x + box.width / 2, y: box.y + box.height - 2 }
	return gesture(page, from, { x: from.x, y: from.y + deltaMinutes * MINUTE }, options)
}

async function sent(calls, operation, count) {
	const started = Date.now()
	while (calls.filter((call) => call.operation === operation).length < count) {
		if (Date.now() - started > 25000) throw new Error(`no ${operation} call number ${count}`)
		await wait(100)
	}
}

async function idle(page, timeout = 40000) {
	const started = Date.now()
	while (Date.now() - started < timeout) {
		const open = await page.evaluate(
			() =>
				document.querySelectorAll('[role="dialog"]').length +
				document.querySelectorAll('[data-slot="calendar-event"][data-mark]').length
		)
		if (open === 0) {
			await page.waitForTimeout(600)
			return
		}
		await wait(200)
	}
	throw new Error('the schedule did not settle: a dialog or a pending block is still there')
}

async function settle(page, calls, operation, count) {
	await sent(calls, operation, count)
	await idle(page)
}

async function confirmAll(page, state) {
	state.release()
	await idle(page)
}

async function asked(page, title) {
	const dialog = page.getByRole('dialog').last()
	await dialog.getByText(title).waitFor({ timeout: 20000 })
	await page.waitForTimeout(600)
	return dialog
}

function inColumn(page, date, title) {
	return page
		.locator(`[data-slot="week-grid-column"][data-date="${date}"] [data-slot="calendar-event"]`)
		.filter({ hasText: title })
}

async function columnOf(locator) {
	return locator.first().evaluate((element) => element.closest('[data-slot="week-grid-column"]')?.dataset.date ?? null)
}

async function formDialog(page) {
	const dialog = page.getByRole('dialog').last()
	await dialog.waitFor({ timeout: 20000 })
	await page.waitForTimeout(800)
	return dialog
}

async function closeAll(page) {
	for (let attempt = 0; attempt < 4 && (await page.getByRole('dialog').count()) > 0; attempt += 1) {
		await page.keyboard.press('Escape')
		await page.waitForTimeout(400)
		const discard = page
			.getByRole('dialog')
			.last()
			.getByRole('button', { name: /^Discard/ })
		if ((await discard.count()) > 0) await discard.first().click()
		await page.waitForTimeout(400)
	}
}

async function suite(viewport, monday, ids) {
	const tag = `${viewport.width}x${viewport.height}`
	const { browser, page, problems, calls, conflictLog, state } = await prepare(viewport, ids)
	const commandsBefore = count('google_commands')
	const ignoresBefore = count('google_event_ignores')
	const day = (offset) => addDays(monday, offset)
	try {
		await signIn(page)
		await openWeek(page)
		await reveal(page, 12)

		const eventBlock = block(page, 'Synthetic event 01')
		const cursor = await eventBlock.evaluate((element) => getComputedStyle(element).cursor)
		check(`${tag} a plain event block shows the grab cursor`, cursor === 'grab', cursor)
		const stripCursor = await eventBlock
			.locator('[data-slot="calendar-event-resize"]')
			.evaluate((element) => getComputedStyle(element).cursor)
		check(`${tag} the foot strip shows the resize cursor`, stripCursor === 'ns-resize', stripCursor)
		check(
			`${tag} all-day chips show no grab or resize cursor`,
			(await page
				.locator(BAND)
				.first()
				.evaluate((element) => getComputedStyle(element).cursor === 'default')) &&
				(await page.locator(`${BAND} [data-slot="calendar-event-resize"]`).count()) === 0
		)
		check(`${tag} a cancelled event is not drawn`, (await block(page, 'Synthetic event 09').count()) === 0)

		const updates = () => calls.filter((call) => call.operation === 'event_update')
		const moves = () => calls.filter((call) => call.operation === 'move')

		state.next = 'syncing'
		const chip = await dragBlock(page, 'Synthetic event 01', day(3), 14)
		check(
			`${tag} the drag chip shows the date once the day changes`,
			chip !== null && /\w{3} \d+ \w{3}, 14:00–15:00/.test(chip),
			String(chip)
		)
		await sent(calls, 'event_update', 1)
		const moved = updates()[0]
		check(
			`${tag} the drop is sent at once with scope one and the dropped time`,
			moved?.body?.scope === 'one' &&
				moved.body.changes.date === day(3) &&
				moved.body.changes.startTime === '14:00' &&
				moved.body.changes.durationMinutes === undefined,
			JSON.stringify(moved?.body)
		)
		const dropped = inColumn(page, day(3), 'Synthetic event 01')
		await dropped.first().waitFor({ timeout: 15000 })
		check(
			`${tag} the drop opens no form and no dialog stays`,
			(await page.getByRole('button', { name: 'Save changes' }).count()) === 0 &&
				(await page.locator('[role="dialog"]').count()) === 0 &&
				(await page.getByText(/Saving…|Moving…/).count()) === 0
		)
		check(
			`${tag} the dropped block stands at the new place, dimmed, with a spinner`,
			(await dropped.count()) === 1 &&
				(await block(page, 'Synthetic event 01').count()) === 1 &&
				(await dropped.first().getAttribute('data-mark')) === 'syncing' &&
				(await dropped.locator('[data-slot="calendar-event-pending"]').count()) === 1 &&
				Number(await dropped.first().evaluate((element) => getComputedStyle(element).opacity)) < 1
		)
		await dropped.first().hover()
		await page.waitForTimeout(900)
		check(
			`${tag} the tooltip of the dropped block says it is syncing`,
			(await page.locator('[data-slot="event-tooltip"][data-variant="syncing"]').count()) > 0 &&
				(await page.getByText('Syncing with Google Calendar…').count()) > 0
		)
		await page.mouse.move(2, 400)
		await shot(page, `calendar-drag-${tag}`, 'event-syncing')
		await confirmAll(page, state)
		check(
			`${tag} a confirmed drop leaves no success notice`,
			(await page.getByText('Event updated').count()) === 0 &&
				(await page.getByText('Could not change the event').count()) === 0 &&
				(await page.getByText('Change not confirmed').count()) === 0
		)

		await reveal(page, 12)
		const escaped = await dragBlock(page, 'Synthetic event 02', day(2), 16, 0, { release: false, escape: true })
		await page.mouse.up()
		await page.waitForTimeout(500)
		check(
			`${tag} Esc cancels the drag and opens nothing`,
			escaped !== null &&
				(await page.locator('[data-slot="week-grid-move-frame"]').count()) === 0 &&
				(await page.locator('[role="dialog"]').count()) === 0
		)

		if (ids.pastLesson !== null) {
			await reveal(page, 12)
			const pastBlock = block(page, 'Synthetic event 06')
			const pastCursor = await pastBlock.evaluate((element) => getComputedStyle(element).cursor)
			const pastBox = await pastBlock.boundingBox()
			const pastFrom = { x: pastBox.x + pastBox.width / 2, y: pastBox.y + 9 }
			const pastTo = await pointAt(page, day(4), 10)
			await page.mouse.move(pastFrom.x, pastFrom.y)
			await page.mouse.down()
			await page.mouse.move(pastTo.x, pastTo.y, { steps: 10 })
			await page.waitForTimeout(250)
			check(
				`${tag} a past lesson has the default cursor and shows no frame`,
				pastCursor === 'default' && (await page.locator('[data-slot="week-grid-move-frame"]').count()) === 0,
				pastCursor
			)
			await page.mouse.up()
			await page.waitForTimeout(500)
			await closeAll(page)
		} else {
			console.log(`SKIP [${theme}] ${tag} no past lesson: Monday 11:00 has not come yet`)
		}

		await reveal(page, 10)
		const refusedFrom = await columnOf(block(page, 'Synthetic event 03'))
		state.next = 'refused'
		await dragBlock(page, 'Synthetic event 03', day(5), 11)
		await sent(calls, 'event_update', 2)
		const refusal = page.locator('[data-slot="banner"]').filter({ hasText: 'Could not change the event' })
		await refusal.first().waitFor({ timeout: 30000 })
		const refusalText = (await refusal.first().innerText()).replace(/\n/g, ' | ')
		check(
			`${tag} a Google refusal leaves a notice with the reason and the old time`,
			refusalText.includes('Google Calendar did not accept the change.') && /It is back at /.test(refusalText),
			refusalText
		)
		await page.waitForTimeout(500)
		check(
			`${tag} the refused block is back in its column and the dialog shows no error`,
			(await inColumn(page, refusedFrom, 'Synthetic event 03').count()) === 1 &&
				(await inColumn(page, day(5), 'Synthetic event 03').count()) === 0 &&
				(await page.locator('[data-slot="calendar-event"][data-mark]').count()) === 0 &&
				(await page.locator('[role="dialog"]').count()) === 0
		)
		check(`${tag} a refused move offers no Edit again`, (await refusal.first().getByText('Edit again').count()) === 0)
		await shot(page, `calendar-drag-${tag}`, 'event-refused')
		await page.waitForTimeout(4500)
		check(`${tag} the refusal notice stays after the usual toast time`, (await refusal.count()) === 1)
		await refusal.first().getByRole('button', { name: 'Dismiss' }).click()
		await refusal.first().waitFor({ state: 'detached', timeout: 10000 })
		await idle(page)

		await reveal(page, 10)
		state.next = 'unknown'
		await dragBlock(page, 'Synthetic event 04', day(5), 12)
		await sent(calls, 'event_update', 3)
		const unconfirmed = inColumn(page, day(5), 'Synthetic event 04').and(page.locator('[data-mark="unconfirmed"]'))
		await unconfirmed.first().waitFor({ timeout: 30000 })
		const warning = page.locator('[data-slot="banner"]').filter({ hasText: 'Change not confirmed' })
		await warning.first().waitFor({ timeout: 30000 })
		check(
			`${tag} an unknown outcome puts a triangle on the block and a notice with Check status`,
			(await unconfirmed.locator('[data-slot="calendar-event-unconfirmed"]').count()) === 1 &&
				(await unconfirmed.locator('[data-slot="calendar-event-pending"]').count()) === 0 &&
				(await warning.first().getByText('This change has not been confirmed.').count()) === 1 &&
				(await warning.first().locator('[data-slot="banner-action"]', { hasText: 'Check status' }).count()) === 1
		)
		await shot(page, `calendar-drag-${tag}`, 'event-unconfirmed')
		await page.waitForTimeout(4500)
		check(`${tag} the unconfirmed notice stays after the usual toast time`, (await warning.count()) === 1)
		state.release()
		await warning.first().waitFor({ state: 'detached', timeout: 40000 })
		await idle(page)
		check(
			`${tag} once Google confirms, the triangle and the notice are gone`,
			(await page.locator('[data-slot="calendar-event-unconfirmed"]').count()) === 0 &&
				(await page.getByText('Change not confirmed').count()) === 0
		)

		await reveal(page, 15)
		await dragBlock(page, 'Synthetic event 12', day(4), 16)
		const weekly = await asked(page, 'Change repeating event')
		check(
			`${tag} a weekly member drop asks only the scope, three rows, no form, nothing sent`,
			(await weekly.getByRole('radio').count()) === 3 &&
				(await page.getByRole('button', { name: 'Save changes' }).count()) === 0 &&
				updates().length === 3
		)
		await shot(page, `calendar-drag-${tag}`, 'event-scope')
		await weekly.getByRole('button', { name: 'Back' }).click()
		await idle(page)
		check(
			`${tag} Back puts the weekly block back and sends nothing`,
			updates().length === 3 &&
				(await inColumn(page, day(2), 'Synthetic event 12').count()) === 1 &&
				(await page.locator('[data-slot="week-grid-move-frame"]').count()) === 0
		)
		await reveal(page, 15)
		await dragBlock(page, 'Synthetic event 12', day(4), 16)
		const again = await asked(page, 'Change repeating event')
		await again.getByRole('radio', { name: 'This and following events' }).click()
		await again.getByRole('button', { name: 'Save', exact: true }).click()
		await settle(page, calls, 'event_update', 4)
		const following = updates().at(-1)
		check(
			`${tag} the weekly member is sent with scope following and the new time`,
			following?.body?.scope === 'following' &&
				following.body.changes.date === day(4) &&
				following.body.changes.startTime === '16:00',
			JSON.stringify(following?.body)
		)

		await reveal(page, 15)
		await dragBlock(page, 'Synthetic event 13', day(3), 16)
		await settle(page, calls, 'event_update', 5)
		const otherCall = updates().at(-1)
		check(
			`${tag} one occurrence of a non-weekly series is sent at once with scope one`,
			otherCall?.body?.scope === 'one' &&
				otherCall.body.changes.startTime === '16:00' &&
				(await page.getByText('Change repeating event').count()) === 0,
			JSON.stringify(otherCall?.body)
		)

		await reveal(page, 12)
		const resizeChip = await resizeBlock(page, 'Synthetic event 15', 45, { release: false })
		check(`${tag} the resize chip shows the new range without a date`, resizeChip === '11:00–13:15', String(resizeChip))
		await shot(page, `calendar-drag-${tag}`, 'event-resize')
		await page.mouse.up()
		await settle(page, calls, 'event_update', 6)
		const resizeCall = updates().at(-1)
		check(
			`${tag} the resize release is sent at once with only the new length`,
			resizeCall?.body?.changes?.durationMinutes === 135 &&
				Object.keys(resizeCall.body.changes).length === 1 &&
				(await page.getByRole('button', { name: 'Save changes' }).count()) === 0,
			JSON.stringify(resizeCall?.body)
		)

		await reveal(page, 12)
		const shortChip = await resizeBlock(page, 'Synthetic event 15', -400, { release: false })
		check(`${tag} a resize cannot go below start plus 15 minutes`, shortChip === '11:00–11:15', String(shortChip))
		await page.keyboard.press('Escape')
		await page.mouse.up()
		await page.waitForTimeout(400)
		await reveal(page, 12)
		const longBox = await block(page, 'Synthetic event 15').boundingBox()
		const bodyBox = await page.locator('[data-slot="week-grid-body"]').boundingBox()
		const longFrom = { x: longBox.x + longBox.width / 2, y: longBox.y + longBox.height - 2 }
		await gesture(page, longFrom, { x: longFrom.x, y: bodyBox.y + bodyBox.height - 2 }, { release: false })
		await page.waitForTimeout(4500)
		const longChip = await page.locator('[data-slot="week-grid-move-chip"]').first().innerText()
		check(`${tag} a resize stops at 02:00 at the foot of the column`, longChip.endsWith('–02:00'), longChip)
		await page.keyboard.press('Escape')
		await page.mouse.up()
		await page.waitForTimeout(400)
		check(`${tag} the cancelled resizes opened nothing`, (await page.locator('[role="dialog"]').count()) === 0)

		await reveal(page, 13)
		const suggested = block(page, 'Alex Example 0001')
		check(
			`${tag} the matching event shows the info dot`,
			(await suggested.locator('[data-slot="calendar-event-dot"]').count()) === 1
		)
		await suggested.hover()
		await page.waitForTimeout(900)
		check(
			`${tag} the tooltip says who it may be`,
			(await page.getByText("May be Alex Example 0001's lesson. Click to assign.").count()) > 0
		)
		await shot(page, `calendar-drag-${tag}`, 'tooltip')
		await suggested.click()
		const details = await formDialog(page)
		check(
			`${tag} the details show the name match box`,
			(await details.getByRole('group', { name: 'Name match' }).count()) === 1 &&
				(await details.getByText("Looks like Alex Example 0001's lesson.").count()) === 1 &&
				(await details.getByText('Applies to this event.').count()) === 1
		)
		await shot(page, `calendar-drag-${tag}`, 'suggestion')
		await details.getByRole('button', { name: 'Assign to Alex Example 0001' }).click()
		await settle(page, calls, 'assign', 1)
		const assign = calls.find((call) => call.operation === 'assign')
		check(
			`${tag} Assign posts the student of the match`,
			assign?.body?.studentId === ids.one && /\/google\/events\/[^/]+\/assign$/.test(assign.path),
			JSON.stringify(assign)
		)
		await page.waitForTimeout(800)
		check(
			`${tag} after the server result the dot is gone and the block is a lesson`,
			(await block(page, 'Alex Example 0001').locator('[data-slot="calendar-event-dot"]').count()) === 0 &&
				(await block(page, 'Alex Example 0001').getAttribute('data-binding')) === 'lesson'
		)

		await reveal(page, 15)
		await block(page, 'Synthetic event 12').click()
		const series = await formDialog(page)
		check(
			`${tag} a series match says it applies to the series`,
			(await series.getByText('Applies to this series.').count()) === 1
		)
		await page.keyboard.press('Escape')
		await page.waitForTimeout(500)

		await reveal(page, 11)
		await block(page, 'Synthetic event 07').click()
		const ignoreDialog = await formDialog(page)
		await ignoreDialog.getByRole('button', { name: 'Ignore' }).click()
		const started = Date.now()
		while (!calls.some((call) => call.operation === 'ignore') && Date.now() - started < 15000) await wait(100)
		await page.waitForTimeout(1200)
		const ignored = calls.find((call) => call.operation === 'ignore')
		check(
			`${tag} Ignore posts the ignore request with the row version`,
			Boolean(ignored) && /\/ignore$/.test(ignored.path) && typeof ignored.body?.expectedVersion === 'string',
			JSON.stringify(ignored)
		)
		check(
			`${tag} after Ignore the box is gone and the dot is gone`,
			(await ignoreDialog.getByRole('group', { name: 'Name match' }).count()) === 0 &&
				(await block(page, 'Synthetic event 07').locator('[data-slot="calendar-event-dot"]').count()) === 0
		)
		check(
			`${tag} the dismissed event offers the manual Assign row`,
			(await ignoreDialog.getByText('Not a lesson').count()) === 1
		)
		await ignoreDialog.getByRole('button', { name: 'Assign…' }).click()
		await page.getByPlaceholder('Search students').waitFor({ timeout: 10000 })
		await page.getByPlaceholder('Search students').fill('0002')
		await page.waitForTimeout(400)
		const options = await page.getByRole('option').allInnerTexts()
		check(
			`${tag} the manual Assign popover filters the students`,
			options.length === 1 &&
				options[0].includes('Alex Example 0002') &&
				(await page.getByText('Applies to this event.').count()) > 0,
			options.join(',')
		)
		await shot(page, `calendar-drag-${tag}`, 'manual-assign')
		await page.getByRole('option', { name: /Alex Example 0002/ }).click()
		await settle(page, calls, 'assign', 2)
		const manual = calls.filter((call) => call.operation === 'assign').at(-1)
		check(
			`${tag} the manual pick posts the picked student`,
			manual?.body?.studentId === ids.two,
			JSON.stringify(manual?.body)
		)

		await nextWeek(page)
		await page.locator('[data-slot="week-grid-body"] [data-binding="lesson"]').first().waitFor({ timeout: 30000 })
		const nextMonday = day(7)
		const lessonOn = (date) =>
			page.locator(`[data-slot="week-grid-column"][data-date="${date}"] [data-binding="lesson"]`).first()
		await reveal(page, 18)
		const singleBox = await lessonOn(day(8)).boundingBox()
		check(`${tag} the fixture single lesson is in next week`, singleBox !== null)
		const singleFrom = { x: singleBox.x + singleBox.width / 2 - 6, y: singleBox.y + 9 }
		const singleTo = await pointAt(page, addDays(nextMonday, 3), 19)
		await gesture(page, singleFrom, { x: singleTo.x, y: singleTo.y + 9 })
		await settle(page, calls, 'move', 1)
		const singleMove = moves()[0]
		check(
			`${tag} a single lesson drop is moved at once, without a form or a scope question`,
			Boolean(singleMove) &&
				/\/schedule\/lessons\/[^/]+\/move$/.test(singleMove.path) &&
				singleMove.body.date === addDays(nextMonday, 3) &&
				singleMove.body.startTime === '19:00' &&
				singleMove.body.durationMinutes === undefined &&
				(await page.getByRole('group', { name: 'Move lesson' }).count()) === 0,
			JSON.stringify(singleMove)
		)

		await reveal(page, 18)
		const resizeBox = await lessonOn(day(8)).boundingBox()
		const lessonChip = await gesture(
			page,
			{ x: resizeBox.x + resizeBox.width / 2, y: resizeBox.y + resizeBox.height - 2 },
			{ x: resizeBox.x + resizeBox.width / 2, y: resizeBox.y + resizeBox.height - 2 + 45 * MINUTE },
			{ release: false }
		)
		check(`${tag} the lesson resize chip shows the range`, lessonChip === '18:00–19:45', String(lessonChip))
		await shot(page, `calendar-drag-${tag}`, 'lesson-resize')
		await page.mouse.up()
		await settle(page, calls, 'move', 2)
		const stretchCall = moves().at(-1)
		check(
			`${tag} the lesson resize is sent at once with durationMinutes`,
			stretchCall?.body?.durationMinutes === 105 &&
				stretchCall.body.date === day(8) &&
				stretchCall.body.startTime === '18:00' &&
				(await page.getByRole('group', { name: 'Move lesson' }).count()) === 0,
			JSON.stringify(stretchCall?.body)
		)

		await page.waitForTimeout(1500)
		await reveal(page, 15)
		const seriesBox = await lessonOn(day(9)).boundingBox()
		check(`${tag} the fixture series lesson is in next week`, seriesBox !== null)
		const dropMember = async () => {
			await page.waitForTimeout(1500)
			await reveal(page, 15)
			const box = await lessonOn(day(9)).boundingBox()
			const to = await pointAt(page, addDays(nextMonday, 4), 10)
			await gesture(page, { x: box.x + box.width / 2 - 6, y: box.y + 9 }, { x: to.x, y: to.y + 9 })
			return asked(page, 'Change repeating lesson')
		}
		const lessonScope = await dropMember()
		const beforeScope = calls.filter((call) => call.operation === 'move' || call.operation === 'move_series').length
		check(
			`${tag} a series lesson drop asks only the scope, three rows and the marks line, no form`,
			(await lessonScope.getByRole('radio').count()) === 3 &&
				(await lessonScope.getByText('Past lessons and their marks stay at their old time.').count()) === 1 &&
				(await page.getByRole('group', { name: 'Move lesson' }).count()) === 0 &&
				beforeScope === 2
		)
		await shot(page, `calendar-drag-${tag}`, 'lesson-scope')
		await lessonScope.getByRole('button', { name: 'Back' }).click()
		await idle(page)
		check(
			`${tag} Back puts the lesson back and sends nothing`,
			calls.filter((call) => call.operation === 'move' || call.operation === 'move_series').length === beforeScope &&
				(await lessonOn(day(9)).count()) === 1 &&
				(await page.locator('[data-slot="week-grid-move-frame"]').count()) === 0
		)
		const occurrenceScope = await dropMember()
		await occurrenceScope.getByRole('radio', { name: 'This lesson' }).click()
		await occurrenceScope.getByRole('button', { name: 'Save', exact: true }).click()
		await settle(page, calls, 'move', 3)
		const occurrence = moves().at(-1)
		check(
			`${tag} this lesson goes through the occurrence move`,
			/\/occurrences\/[^/]+\/move$/.test(occurrence.path) && occurrence.body.startTime === '10:00',
			JSON.stringify(occurrence)
		)

		for (const [choice, label] of [
			['This and following lessons', 'following'],
			['All lessons', 'all'],
		]) {
			const picker = await dropMember()
			await picker.getByRole('radio', { name: choice }).click()
			if (label === 'following') await shot(page, `calendar-drag-${tag}`, 'lesson-following')
			await picker.getByRole('button', { name: 'Save', exact: true }).click()
			await settle(page, calls, 'move_series', label === 'following' ? 1 : 2)
			const call = calls.filter((item) => item.operation === 'move_series').at(-1)
			check(
				`${tag} ${label} sends the series move at once, from the right occurrence, without a Move series dialog`,
				/\/schedule\/series\/[^/]+\/move$/.test(call.path) &&
					call.body.weekday === 5 &&
					call.body.startTime === '10:00' &&
					call.body.from === day(9) &&
					call.body.durationMinutes === undefined &&
					(await page.getByText('Move series').count()) === 0,
				JSON.stringify(call.body)
			)
		}

		await previousWeek(page)
		await page.locator(BODY).first().waitFor({ timeout: 30000 })
		check(
			`${tag} the commands reached no api table`,
			count('google_commands') === commandsBefore && count('google_event_ignores') === ignoresBefore,
			`${commandsBefore}/${ignoresBefore}`
		)
		check(`${tag} no console problems`, real(problems).length === 0, real(problems).slice(0, 2).join(' || '))
	} catch (error) {
		await shot(page, `calendar-drag-${tag}`, 'failure').catch(() => {})
		console.log('calls', JSON.stringify(conflictLog.slice(-2)))
		console.log('problems', real(problems).slice(0, 4).join(' || '))
		throw error
	} finally {
		await browser.close()
	}
}

let completed = false
try {
	const down = spawnSync(NODE, [WAIT, 'down'], { encoding: 'utf8' })
	if (down.status !== 0) throw new Error('ports 3000 and 4000 are not free, stop the running stack first')
	const fixtures = run(COMMANDS, 'fixtures', 'dev')
	const monday = /monday (\d{4}-\d{2}-\d{2})/.exec(fixtures)?.[1]
	if (!monday) throw new Error('fixtures printed no monday')
	const ids = {
		one: studentId(CARD_ONE),
		two: studentId(CARD_TWO),
		fakeLesson: randomUUID(),
		pastLesson: Date.parse(`${monday}T11:00:00+07:00`) < Date.now() ? randomUUID() : null,
	}
	if (!ids.one || !ids.two) throw new Error('synthetic cards are missing')
	await startStack()
	for (const viewport of VIEWPORTS) await suite(viewport, monday, ids)
	completed = true
} catch (error) {
	check('script completed', false, String(error).slice(0, 400))
} finally {
	try {
		run(SEED, 'down', 'dev')
		purgeFixtures()
	} catch (error) {
		check('synthetic data removed', false, String(error).slice(0, 200))
	}
	await stopStack()
	const down = spawnSync(NODE, [WAIT, 'down'], { encoding: 'utf8' })
	check('ports 3000 and 4000 are free', down.status === 0, down.stdout.trim())
}
console.log(`screenshots in ${STATE_DIR}`)
if (completed && failures() === 0) console.log('CALENDAR_WEB_DRAG_OK')
process.exit(failures() === 0 && completed ? 0 : 1)
