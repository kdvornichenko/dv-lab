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
	const state = { revision: '1', generation: 1, assigned: false, ignored: false }
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
			? [...commands.values()].find((item) => item.requestId === key)
			: commands.get(key)
		if (!found) return route.continue()
		return route.fulfill({ json: found })
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

async function settle(page, calls, operation, count) {
	const started = Date.now()
	while (calls.filter((call) => call.operation === operation).length < count) {
		if (Date.now() - started > 25000) throw new Error(`no ${operation} call number ${count}`)
		await wait(100)
	}
	await page.getByRole('dialog').first().waitFor({ state: 'detached', timeout: 25000 })
	await page.waitForTimeout(600)
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

async function enabled(locator, timeout = 30000) {
	const started = Date.now()
	while (Date.now() - started < timeout) {
		if (await locator.isEnabled().catch(() => false)) return true
		await wait(250)
	}
	return false
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

		const chip = await dragBlock(page, 'Synthetic event 01', day(3), 14)
		check(
			`${tag} the drag chip shows the date once the day changes`,
			chip !== null && /\w{3} \d+ \w{3}, 14:00–15:00/.test(chip),
			String(chip)
		)
		const edit = await formDialog(page)
		check(
			`${tag} the drop opens the edit form and sends nothing`,
			(await edit.getByRole('button', { name: 'Save changes' }).count()) === 1 &&
				calls.length === 0 &&
				(await page.locator('[data-slot="week-grid-move-frame"][data-state="draft"]').count()) === 1
		)
		await shot(page, `calendar-drag-${tag}`, 'event-drop')
		const save = edit.getByRole('button', { name: 'Save changes' })
		check(`${tag} Save waits for the overlap check, then enables`, await enabled(save))
		await save.click()
		await settle(page, calls, 'event_update', 1)
		const moved = calls.find((call) => call.operation === 'event_update')
		check(
			`${tag} the moved event is sent with scope one and the dropped time`,
			moved?.body?.scope === 'one' &&
				moved.body.changes.date === day(3) &&
				moved.body.changes.startTime === '14:00' &&
				moved.body.changes.durationMinutes === undefined,
			JSON.stringify(moved?.body)
		)

		await reveal(page, 12)
		const escaped = await dragBlock(page, 'Synthetic event 02', day(2), 16, 0, { release: false, escape: true })
		await page.mouse.up()
		await page.waitForTimeout(500)
		check(
			`${tag} Esc cancels the drag and opens nothing`,
			escaped !== null &&
				(await page.locator('[data-slot="week-grid-move-frame"]').count()) === 0 &&
				(await page.getByRole('dialog').count()) === 0
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

		await reveal(page, 15)
		await dragBlock(page, 'Synthetic event 12', day(4), 16)
		const weekly = await formDialog(page)
		check(
			`${tag} a weekly member drop opens the edit form and starts the check`,
			(await weekly.getByRole('button', { name: 'Save changes' }).count()) === 1 &&
				calls.filter((call) => call.operation === 'event_update').length === 1
		)
		const weeklySave = weekly.getByRole('button', { name: 'Save changes' })
		await enabled(weeklySave)
		await weeklySave.click()
		const scope = page.getByRole('dialog').last()
		await scope.getByText('Change repeating event').waitFor({ timeout: 10000 })
		await page.waitForTimeout(500)
		check(
			`${tag} the scope is asked at Save, three rows, nothing sent yet`,
			(await scope.getByRole('radio').count()) === 3 &&
				calls.filter((call) => call.operation === 'event_update').length === 1
		)
		await shot(page, `calendar-drag-${tag}`, 'event-scope')
		await scope.getByRole('radio', { name: 'This and following events' }).click()
		await scope.getByRole('button', { name: 'Save', exact: true }).click()
		await settle(page, calls, 'event_update', 2)
		const following = calls.filter((call) => call.operation === 'event_update').at(-1)
		check(
			`${tag} the weekly member is sent with scope following and the new time`,
			following?.body?.scope === 'following' &&
				following.body.changes.date === day(4) &&
				following.body.changes.startTime === '16:00',
			JSON.stringify(following?.body)
		)

		await reveal(page, 15)
		await dragBlock(page, 'Synthetic event 13', day(3), 16)
		const other = await formDialog(page)
		check(
			`${tag} one occurrence of a non-weekly series opens a time-only form`,
			(await other.getByRole('button', { name: 'Save changes' }).count()) === 1 &&
				(await page.locator('#event-edit-title').isDisabled())
		)
		await shot(page, `calendar-drag-${tag}`, 'event-other')
		const otherSave = other.getByRole('button', { name: 'Save changes' })
		await enabled(otherSave)
		await otherSave.click()
		await settle(page, calls, 'event_update', 3)
		const otherCall = calls.filter((call) => call.operation === 'event_update').at(-1)
		check(
			`${tag} the non-weekly occurrence is sent with scope one`,
			otherCall?.body?.scope === 'one' && otherCall.body.changes.startTime === '16:00',
			JSON.stringify(otherCall?.body)
		)

		await reveal(page, 12)
		const resizeChip = await resizeBlock(page, 'Synthetic event 15', 45, { release: false })
		check(`${tag} the resize chip shows the new range without a date`, resizeChip === '11:00–13:15', String(resizeChip))
		await shot(page, `calendar-drag-${tag}`, 'event-resize')
		await page.mouse.up()
		const resized = await formDialog(page)
		check(
			`${tag} the resize release opens the form with the new end`,
			(await resized.getByRole('button', { name: 'Save changes' }).count()) === 1 &&
				`${await page.locator('#event-edit-length').inputValue()}:${await page.locator('#event-edit-length-minutes').inputValue()}` ===
					'02:15'
		)
		const resizeSave = resized.getByRole('button', { name: 'Save changes' })
		await enabled(resizeSave)
		await resizeSave.click()
		await settle(page, calls, 'event_update', 4)
		const resizeCall = calls.filter((call) => call.operation === 'event_update').at(-1)
		check(
			`${tag} the resize sends only the new length`,
			resizeCall?.body?.changes?.durationMinutes === 135 && Object.keys(resizeCall.body.changes).length === 1,
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
		check(`${tag} the cancelled resizes opened nothing`, (await page.getByRole('dialog').count()) === 0)

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
		const lesson = await formDialog(page)
		check(
			`${tag} a future lesson drop opens its Move form with the Length field`,
			(await lesson.getByRole('group', { name: 'Move lesson' }).count()) === 1 &&
				(await lesson.locator('#move-lesson-length').count()) === 1 &&
				calls.filter((call) => call.operation === 'move').length === 0
		)
		await shot(page, `calendar-drag-${tag}`, 'lesson-drop')
		const moveButton = lesson.getByRole('button', { name: 'Move lesson' })
		await enabled(moveButton)
		await moveButton.click()
		await settle(page, calls, 'move', 1)
		const singleMove = calls.find((call) => call.operation === 'move')
		check(
			`${tag} a single lesson is moved without a scope question`,
			Boolean(singleMove) &&
				/\/schedule\/lessons\/[^/]+\/move$/.test(singleMove.path) &&
				singleMove.body.date === addDays(nextMonday, 3) &&
				singleMove.body.startTime === '19:00' &&
				singleMove.body.durationMinutes === undefined,
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
		await page.mouse.up()
		const stretched = await formDialog(page)
		const lengthText = `${await stretched.locator('#move-lesson-length').inputValue()}:${await stretched.locator('#move-lesson-length-minutes').inputValue()}`
		check(
			`${tag} the resize opens Move lesson with the new length`,
			(await stretched.getByRole('group', { name: 'Move lesson' }).count()) === 1 && lengthText === '01:45',
			lengthText
		)
		await shot(page, `calendar-drag-${tag}`, 'lesson-resize')
		const stretchMove = stretched.getByRole('button', { name: 'Move lesson' })
		await enabled(stretchMove)
		await stretchMove.click()
		await settle(page, calls, 'move', 2)
		const stretchCall = calls.filter((call) => call.operation === 'move').at(-1)
		check(
			`${tag} the lesson resize sends durationMinutes`,
			stretchCall?.body?.durationMinutes === 105 &&
				stretchCall.body.date === day(8) &&
				stretchCall.body.startTime === '18:00',
			JSON.stringify(stretchCall?.body)
		)

		await page.waitForTimeout(1500)
		await reveal(page, 15)
		const seriesBox = await lessonOn(day(9)).boundingBox()
		check(`${tag} the fixture series lesson is in next week`, seriesBox !== null)
		const seriesFrom = { x: seriesBox.x + seriesBox.width / 2 - 6, y: seriesBox.y + 9 }
		const seriesTo = await pointAt(page, addDays(nextMonday, 4), 10)
		await gesture(page, seriesFrom, { x: seriesTo.x, y: seriesTo.y + 9 })
		const member = await formDialog(page)
		const memberMove = member.getByRole('button', { name: 'Move lesson' })
		await enabled(memberMove)
		const beforeScope = calls.filter((call) => call.operation === 'move' || call.operation === 'move_series').length
		await memberMove.click()
		const lessonScope = page.getByRole('dialog').last()
		await lessonScope.getByText('Change repeating lesson').waitFor({ timeout: 10000 })
		await page.waitForTimeout(500)
		check(
			`${tag} the lesson scope is asked at Save with three rows and the marks line`,
			(await lessonScope.getByRole('radio').count()) === 3 &&
				(await lessonScope.getByText('Past lessons and their marks stay at their old time.').count()) === 1 &&
				calls.filter((call) => call.operation === 'move' || call.operation === 'move_series').length === beforeScope
		)
		await shot(page, `calendar-drag-${tag}`, 'lesson-scope')
		await lessonScope.getByRole('button', { name: 'Back' }).click()
		await page.waitForTimeout(500)
		check(
			`${tag} Back returns to the form with the values kept`,
			(await page.getByRole('group', { name: 'Move lesson' }).count()) === 1
		)
		await memberMove.click()
		const again = page.getByRole('dialog').last()
		await again.getByRole('radio', { name: 'This lesson' }).click()
		await again.getByRole('button', { name: 'Save', exact: true }).click()
		await settle(page, calls, 'move', 3)
		const occurrence = calls.filter((call) => call.operation === 'move').at(-1)
		check(
			`${tag} this lesson goes through the occurrence move`,
			/\/occurrences\/[^/]+\/move$/.test(occurrence.path) && occurrence.body.startTime === '10:00',
			JSON.stringify(occurrence)
		)

		for (const [choice, label] of [
			['This and following lessons', 'following'],
			['All lessons', 'all'],
		]) {
			await page.waitForTimeout(1500)
			await reveal(page, 15)
			const box = await lessonOn(day(9)).boundingBox()
			const to = await pointAt(page, addDays(nextMonday, 4), 10)
			await gesture(page, { x: box.x + box.width / 2 - 6, y: box.y + 9 }, { x: to.x, y: to.y + 9 })
			const form = await formDialog(page)
			const submit = form.getByRole('button', { name: 'Move lesson' })
			await enabled(submit)
			await submit.click()
			const picker = page.getByRole('dialog').last()
			await picker.getByText('Change repeating lesson').waitFor({ timeout: 10000 })
			await picker.getByRole('radio', { name: choice }).click()
			await picker.getByRole('button', { name: 'Save', exact: true }).click()
			const seriesDialog = page.getByRole('dialog').last()
			await seriesDialog.getByText('Move series', { exact: true }).first().waitFor({ timeout: 15000 })
			await page.waitForTimeout(800)
			const dialogText = await seriesDialog.innerText()
			check(
				`${tag} ${label} opens the move series dialog with the dropped day and time`,
				dialogText.includes('Friday') && dialogText.includes('10:00'),
				dialogText.replace(/\n/g, ' | ').slice(0, 300)
			)
			if (label === 'following') await shot(page, `calendar-drag-${tag}`, 'lesson-following')
			const apply = seriesDialog.getByRole('button', { name: 'Move series' }).last()
			await enabled(apply)
			await apply.click()
			await settle(page, calls, 'move_series', label === 'following' ? 1 : 2)
			const call = calls.filter((item) => item.operation === 'move_series').at(-1)
			check(
				`${tag} ${label} sends the series move from the right occurrence`,
				/\/schedule\/series\/[^/]+\/move$/.test(call.path) &&
					call.body.weekday === 5 &&
					call.body.startTime === '10:00' &&
					call.body.from === day(9),
				JSON.stringify(call.body)
			)
			await page.waitForTimeout(800)
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
