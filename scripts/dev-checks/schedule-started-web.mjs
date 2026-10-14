import { spawn, spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { TEACHER_LOGIN } from './api.mjs'
import { calendarSql, startCalendarApi } from './calendar-env.mjs'
import { BASE, ROOT, STATE_DIR, check, failures, launch, shot, signIn, theme } from './web.mjs'

const core = await import(`${ROOT}/packages/core/src/index.ts`)

const TARGET = process.argv.includes('test') ? 'test' : 'dev'
const NODE = process.execPath
const SEED = `${ROOT}/scripts/dev-checks/calendar-seed.mjs`
const WAIT = `${ROOT}/scripts/dev-checks/wait-dev.mjs`
const VIEWPORT = { width: 1440, height: 820 }
const BODY = '[data-slot="week-grid-body"] [data-slot="calendar-event"]'
const MINUTE = 48 / 60
const DAY_START = 120
const CARD = 'calendar-seed:alex-example-0001'
const NAME = 'Alex Example 0001'
const DONE_LINE = 'Marked Done: this lesson stays where it is. To move or cancel it, set the mark to Scheduled first.'
const EARLIER = 'section[aria-labelledby="today-earlier"]'
const DONE_REFUSAL = 'This lesson is marked Done, so it stays where it is.'
const OUTSIDE_LINE =
	'This week is outside the synced range, from 8 weeks back to 53 weeks ahead. Calendar changes are unavailable.'
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
}

const real = (problems) =>
	problems.filter(
		(problem) =>
			!problem.includes('server caches disabled') &&
			!problem.includes('status of 404') &&
			!problem.includes('status of 409')
	)
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const addDays = (date, days) => {
	const value = new Date(`${date}T00:00:00Z`)
	value.setUTCDate(value.getUTCDate() + days)
	return value.toISOString().slice(0, 10)
}
const weekdayOf = (date) => new Date(`${date}T00:00:00Z`).getUTCDay() || 7

const owned = []

let api = null

async function startStack() {
	api = await startCalendarApi({
		port: 4000,
		envFile: TARGET === 'test' ? '.env.test' : '.env',
		appOrigin: 'http://localhost:3000',
	})
	owned.push(spawn('yarn', ['workspace', '@dv-lab/web', 'dev'], { cwd: ROOT, detached: true, stdio: 'ignore' }))
	const up = spawnSync(NODE, [WAIT, 'up'], { encoding: 'utf8' })
	if (up.status !== 0) throw new Error('dev stack did not come up')
}

async function stopStack() {
	if (api !== null) await api.stop()
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

function seed(...args) {
	const result = spawnSync(NODE, [SEED, args[0], TARGET, ...args.slice(2)], { encoding: 'utf8', timeout: 300000 })
	if (result.status !== 0)
		throw new Error(`calendar-seed ${args.join(' ')} failed: ${(result.stdout + result.stderr).slice(-300)}`)
	return result.stdout
}

function sql(text) {
	return calendarSql(TARGET, 'migrator', text)
}

function count(table) {
	return sql(`select count(*)::int as n from ${table}`).rows?.[0]?.n ?? -1
}

function operationOf(path) {
	if (path.endsWith('/cancel')) return 'cancel'
	if (path.endsWith('/restore')) return 'restore'
	if (path.includes('/occurrences/') && path.endsWith('/move')) return 'move'
	if (path.includes('/series/') && path.endsWith('/move')) return 'move_series'
	if (path.endsWith('/move')) return 'move'
	if (path.endsWith('/end')) return 'end_series'
	return 'create'
}

async function prepare(ctx) {
	const { browser, context, page, problems } = await launch(VIEWPORT)
	const calls = []
	const commands = new Map()
	const state = {
		revision: '1',
		generation: 1,
		scenario: 'single',
		next: 'applied',
		fail: null,
		today: false,
		release: () => {
			for (const item of commands.values()) item.mode = 'applied'
		},
	}
	const instant = (date, time, zone) => core.zonedInstant(date, time, zone)
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
			const zone = json.requestedRange.timeZone
			state.window = {
				range: json.requestedRange,
				keyParts: [zone, json.connection?.calendar?.id, json.connection?.generation, json.read.revision],
			}
			const want = instant(ctx.lessonDate, '15:00', zone).getTime()
			const target = json.events.find(
				(event) => event.title === 'Synthetic event 12' && Date.parse(event.when.startsAt) === want
			)
			const scenario = state.scenario
			if (target && scenario !== 'none') {
				const mark = scenario === 'noshow' ? 'no_show' : scenario === 'done' ? 'done' : null
				const single = scenario === 'single' || scenario === 'done'
				const binding = {
					kind: 'lesson',
					ref: single
						? { kind: 'single', lessonId: ctx.ids.single }
						: { kind: 'series', seriesId: ctx.ids.series, originalOn: ctx.lessonDate },
					studentId: ctx.ids.one,
					version: target.version,
					mark,
				}
				target.binding = binding
				target.title = null
				target.suggestion = null
				if (!single) {
					json.series = [
						{
							version: target.version,
							allFrom: scenario === 'noshow' ? addDays(ctx.lessonDate, 7) : ctx.lessonDate,
							series: {
								id: ctx.ids.series,
								studentId: ctx.ids.one,
								weekday: weekdayOf(ctx.lessonDate),
								startTime: '15:00',
								timeZone: target.when.timeZone,
								durationMinutes: 60,
								startsOn: '2026-01-07',
								endsOn: null,
								referenceOccurrence: {
									originalOn: ctx.lessonDate,
									actualStartsAt: new Date(want).toISOString().replace('.000Z', 'Z'),
									ruleStartsAt: null,
								},
							},
						},
					]
				}
			}
		}
		return route.fulfill({ response, json })
	})
	await context.route(/\/api\/today$/, async (route) => {
		const response = await route.fetch()
		let json
		try {
			json = await response.json()
		} catch {
			return route.fulfill({ response })
		}
		if (state.today && json?.date) {
			const zone = json.defaultTimeZone
			const block = (key, startsAt, outcome, mark, actions) => ({
				key,
				ref: { kind: 'single', lessonId: key },
				studentId: ctx.ids.one,
				studentName: NAME,
				studentStatus: 'active',
				studentGoal: null,
				startsAt: startsAt.toISOString().replace('.000Z', 'Z'),
				timeZone: zone,
				durationMinutes: 60,
				movedTo: null,
				movedFrom: null,
				outcome,
				actions,
				ledger: { openingOn: null, noShowDeducts: false, lessonMinutes: 60 },
				mark,
				markRevision: null,
			})
			const open = { move: true, cancel: true, restore: false, mark: true, series: false }
			const frozen = { move: false, cancel: false, restore: false, mark: true, series: false }
			json.earlier = [
				block(ctx.ids.far, instant(addDays(ctx.monday, -84), '15:00', zone), 'planned', null, open),
				block(ctx.ids.single, instant(ctx.lessonDate, '15:00', zone), 'planned', null, open),
			]
			json.lessons = [block(ctx.ids.doneToday, new Date(Date.now() - 60000), 'done', 'done', frozen)]
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
		const operation = operationOf(url.pathname)
		calls.push({ path: url.pathname.replace('/api', ''), body, operation })
		if (state.fail !== null) {
			const code = state.fail
			state.fail = null
			return route.fulfill({
				status: 409,
				json: { error: { code, message: 'Refused for the check.', requestId: randomUUID() } },
			})
		}
		const commandId = randomUUID()
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
		return route.fulfill({
			status: 202,
			json: { commandId, statusUrl: `/api/google/commands/${commandId}` },
		})
	})
	await context.route(/\/api\/google\/conflicts$/, async (route) => {
		const request = route.request()
		if (request.method() !== 'POST' || !state.window) return route.continue()
		const values = [request.postData() ?? '', ...state.window.keyParts]
		const inputKey = createHash('sha256').update(values.map(String).join('\0')).digest('hex')
		return route.fulfill({
			json: {
				state: 'complete',
				complete: true,
				inputKey,
				checkedRange: state.window.range,
				checkedAt: new Date().toISOString(),
				events: [],
			},
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
	return { browser, page, problems, calls, state }
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
	const box = await page.locator(`[data-slot="week-grid-column"][data-date="${date}"]`).boundingBox()
	if (!box) throw new Error(`no column for ${date}`)
	const from = (((hour * 60 + minutes - DAY_START) % 1440) + 1440) % 1440
	return { x: box.x + box.width / 2 - 6, y: box.y + from * MINUTE }
}

async function openPreviousWeek(page) {
	await page.goto(`${BASE}/schedule`, { timeout: 120000 })
	await page.locator(BODY).first().waitFor({ timeout: 120000 })
	await page.waitForTimeout(1200)
	await page.getByRole('button', { name: 'Previous week' }).first().click()
	await page.waitForTimeout(1500)
}

const lessonOn = (page, date) =>
	page.locator(`[data-slot="week-grid-column"][data-date="${date}"] [data-binding="lesson"]`).first()

async function drag(page, date, to, hour, { release = true, escape = false } = {}) {
	await reveal(page, 15)
	const box = await lessonOn(page, date).boundingBox()
	if (!box) throw new Error(`no lesson on ${date}`)
	const target = await pointAt(page, to, hour)
	await page.mouse.move(box.x + box.width / 2 - 6, box.y + 9)
	await page.mouse.down()
	await page.mouse.move(box.x + box.width / 2, box.y + 15, { steps: 3 })
	await page.mouse.move(target.x, target.y + 9, { steps: 14 })
	await page.waitForTimeout(250)
	if (escape) await page.keyboard.press('Escape')
	if (release) await page.mouse.up()
}

async function sent(calls, operation, number) {
	const started = Date.now()
	while (calls.filter((call) => call.operation === operation).length < number) {
		if (Date.now() - started > 25000) throw new Error(`no ${operation} call number ${number}`)
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
	throw new Error('the page did not settle: a dialog or a pending block is still there')
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

async function openLesson(page, date) {
	await reveal(page, 15)
	await lessonOn(page, date).click()
	const dialog = page.getByRole('dialog').last()
	await dialog.waitFor({ timeout: 15000 })
	await page.waitForTimeout(700)
	return dialog
}

async function pickDate(page, date) {
	await page.locator('#move-lesson-date').click()
	const key = `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}/${date.slice(0, 4)}`
	const cell = page.locator(`button[data-day="${key}"]`).first()
	for (let step = 0; step < 4 && (await cell.count()) === 0; step += 1) {
		await page.getByRole('button', { name: /next month/i }).click()
		await page.waitForTimeout(150)
	}
	for (let step = 0; step < 8 && (await cell.count()) === 0; step += 1) {
		await page.getByRole('button', { name: /previous month/i }).click()
		await page.waitForTimeout(150)
	}
	await cell.click()
	await page.waitForTimeout(300)
}

const textCount = (scope, text) => scope.getByText(text, { exact: false }).count()

async function schedule(ctx, state, page, calls, problems) {
	const day = (offset) => addDays(ctx.monday, offset)
	const lessonDate = ctx.lessonDate
	const next = addDays(lessonDate, 1)
	const futureDate = addDays(ctx.monday, 10)

	state.scenario = 'single'
	await openPreviousWeek(page)
	await reveal(page, 15)
	const cursor = await lessonOn(page, lessonDate).evaluate((element) => getComputedStyle(element).cursor)
	check('a started unmarked lesson shows the grab cursor', cursor === 'grab', cursor)
	await drag(page, lessonDate, next, 10)
	await sent(calls, 'move', 1)
	const dropped = calls.find((call) => call.operation === 'move')
	check(
		'a started lesson dropped on a past slot is sent at once, without a form or a question',
		/\/schedule\/lessons\/[^/]+\/move$/.test(dropped.path) &&
			dropped.body.date === next &&
			dropped.body.startTime === '10:00' &&
			(await page.getByRole('group', { name: 'Move lesson' }).count()) === 0 &&
			(await page.getByRole('dialog').count()) === 0,
		JSON.stringify(dropped)
	)
	await idle(page)

	state.fail = 'lesson_done'
	await drag(page, lessonDate, next, 11)
	await sent(calls, 'move', 2)
	const refusal = page.locator('[data-slot="banner"]').filter({ hasText: 'Could not change the lesson' })
	await refusal.first().waitFor({ timeout: 30000 })
	const refusalText = (await refusal.first().innerText()).replace(/\n/g, ' | ')
	check(
		'lesson_done on a move shows its own sentence and the old time',
		refusalText.includes(DONE_REFUSAL) &&
			!refusalText.includes('Google Calendar did not accept') &&
			/It is back at /.test(refusalText),
		refusalText
	)
	await shot(page, 'schedule-started', 'refusal-done')
	await refusal.first().getByRole('button', { name: 'Dismiss' }).click()
	await refusal.first().waitFor({ state: 'detached', timeout: 10000 })
	await idle(page)

	state.fail = 'outside_sync_window'
	await drag(page, lessonDate, next, 12)
	await sent(calls, 'move', 3)
	const outside = page.locator('[data-slot="banner"]').filter({ hasText: 'Could not change the lesson' })
	await outside.first().waitFor({ timeout: 30000 })
	const outsideText = (await outside.first().innerText()).replace(/\n/g, ' | ')
	check(
		'outside_sync_window on a move shows the range sentence',
		outsideText.includes(OUTSIDE_LINE) && !outsideText.includes('Google Calendar did not accept'),
		outsideText
	)
	await outside.first().getByRole('button', { name: 'Dismiss' }).click()
	await outside.first().waitFor({ state: 'detached', timeout: 10000 })
	await idle(page)

	let dialog = await openLesson(page, lessonDate)
	check(
		'the dialog of a started unmarked one-off offers Move lesson and Cancel lesson',
		(await dialog.getByRole('button', { name: 'Move lesson' }).isEnabled()) &&
			(await dialog.getByRole('button', { name: 'Cancel lesson' }).isEnabled())
	)
	await shot(page, 'schedule-started', 'single-dialog')
	await dialog.getByRole('button', { name: 'Cancel lesson' }).click()
	await dialog.locator('[data-slot="lesson-cancel-question"]').waitFor({ timeout: 10000 })
	check(
		'cancelling a started one-off asks the footer question and no scope dialog',
		(await page.getByText('Cancel repeating lesson').count()) === 0 &&
			(await textCount(dialog, 'The mark is kept')) === 0
	)
	state.fail = 'lesson_done'
	await dialog.getByRole('button', { name: 'Yes, cancel' }).click()
	await sent(calls, 'cancel', 1)
	await dialog.getByRole('alert').filter({ hasText: DONE_REFUSAL }).first().waitFor({ timeout: 15000 })
	check('lesson_done on a cancel shows its own sentence in the dialog', true)
	await dialog.getByRole('button', { name: 'Yes, cancel' }).click()
	await sent(calls, 'cancel', 2)
	await idle(page)
	const cancelCall = calls.filter((call) => call.operation === 'cancel').at(-1)
	check(
		'the second cancel reaches the lesson cancel route',
		/\/schedule\/lessons\/[^/]+\/cancel$/.test(cancelCall.path)
	)

	state.scenario = 'noshow'
	await openPreviousWeek(page)
	await drag(page, lessonDate, next, 10)
	await sent(calls, 'move', 4)
	const alone = calls.filter((call) => call.operation === 'move').at(-1)
	check(
		'a drop of an occurrence earlier than allFrom is sent alone at once, no scope question',
		/\/schedule\/series\/[^/]+\/occurrences\/[^/]+\/move$/.test(alone.path) &&
			(await page.getByText('Change repeating lesson').count()) === 0,
		JSON.stringify(alone)
	)
	await idle(page)
	dialog = await openLesson(page, lessonDate)
	await dialog.getByRole('button', { name: 'Cancel lesson' }).click()
	await dialog.locator('[data-slot="lesson-cancel-question"]').waitFor({ timeout: 10000 })
	check(
		'cancelling a started no-show occurrence asks the footer question with the kept-mark phrase',
		(await page.getByText('Cancel repeating lesson').count()) === 0 &&
			(await textCount(dialog, 'The mark is kept; a cancelled lesson deducts nothing.')) === 1
	)
	await dialog.getByRole('button', { name: 'Keep' }).click()
	await dialog.getByRole('button', { name: 'Move lesson' }).click()
	const form = page.getByRole('group', { name: 'Move lesson' })
	await form.waitFor({ timeout: 10000 })
	await page.locator('#move-lesson-length').fill('02')
	await page.locator('#move-lesson-length-minutes').press('Enter')
	await page.waitForTimeout(400)
	check(
		'a no-show moved to a past start keeps its mark, the line says so',
		(await textCount(form, 'The no-show stays: the new start is not later than now.')) === 1 &&
			(await textCount(form, 'The no-show is removed')) === 0
	)
	check(
		'the form says the lesson moves alone',
		(await textCount(
			form,
			'This lesson moves alone: a lesson of this series on or after it has a mark or a comment.'
		)) === 1
	)
	await pickDate(page, futureDate)
	check(
		'a no-show moved to a later start loses its mark, the line says so',
		(await textCount(
			form,
			'The no-show is removed: the new start is later than now. The lesson is Scheduled again and nothing is deducted.'
		)) === 1 && (await textCount(form, 'The no-show stays')) === 0
	)
	await shot(page, 'schedule-started', 'noshow-form')
	await form.getByRole('button', { name: 'Move lesson' }).click()
	await sent(calls, 'move', 5)
	const aloneSave = calls.filter((call) => call.operation === 'move').at(-1)
	check(
		'Save of an occurrence earlier than allFrom moves it alone without ScopeDialog',
		/\/occurrences\/[^/]+\/move$/.test(aloneSave.path) &&
			aloneSave.body.date === futureDate &&
			(await page.getByText('Change repeating lesson').count()) === 0,
		JSON.stringify(aloneSave)
	)
	await idle(page)

	state.scenario = 'series'
	await openPreviousWeek(page)
	await drag(page, lessonDate, next, 10)
	const picker = page.getByRole('dialog').last()
	await picker.getByText('Change repeating lesson').waitFor({ timeout: 20000 })
	await page.waitForTimeout(600)
	check(
		'a drop of an occurrence from allFrom asks three rows and the marks line',
		(await picker.getByRole('radio').count()) === 3 &&
			(await textCount(
				picker,
				'Lessons with a mark or a comment, and the lessons before them, stay at their old time.'
			)) === 1
	)
	await shot(page, 'schedule-started', 'series-scope')
	await picker.getByRole('button', { name: 'Back' }).click()
	await idle(page)
	dialog = await openLesson(page, lessonDate)
	await dialog.getByRole('button', { name: 'Cancel lesson' }).click()
	await dialog.locator('[data-slot="lesson-cancel-question"]').waitFor({ timeout: 10000 })
	check(
		'cancelling a started occurrence from allFrom asks the footer question, not ScopeDialog',
		(await page.getByText('Cancel repeating lesson').count()) === 0
	)
	await dialog.getByRole('button', { name: 'Yes, cancel' }).click()
	await sent(calls, 'cancel', 3)
	const cancelSeries = calls.filter((call) => call.operation === 'cancel').at(-1)
	check(
		'the started occurrence is cancelled through its occurrence route',
		/\/schedule\/series\/[^/]+\/occurrences\/[^/]+\/cancel$/.test(cancelSeries.path),
		cancelSeries.path
	)
	await idle(page)
	dialog = await openLesson(page, lessonDate)
	await dialog.getByRole('button', { name: 'Move lesson' }).click()
	await form.waitFor({ timeout: 10000 })
	await pickDate(page, next)
	check('a lesson that can move with others has no moves-alone line', (await textCount(form, 'moves alone')) === 0)
	await form.getByRole('button', { name: 'Move lesson' }).click()
	const scope = page.getByRole('dialog').last()
	await scope.getByText('Change repeating lesson').waitFor({ timeout: 10000 })
	await page.waitForTimeout(500)
	check('Save asks three rows', (await scope.getByRole('radio').count()) === 3)
	await scope.getByRole('radio', { name: 'All lessons' }).click()
	state.next = 'syncing'
	await scope.getByRole('button', { name: 'Save', exact: true }).click()
	await sent(calls, 'move_series', 1)
	const all = calls.find((call) => call.operation === 'move_series')
	check(
		'All lessons cuts at allFrom with the shifted day, the time and newStartsOn',
		/\/schedule\/series\/[^/]+\/move$/.test(all.path) &&
			all.body.from === lessonDate &&
			all.body.weekday === weekdayOf(next) &&
			all.body.startTime === '15:00' &&
			all.body.newStartsOn === next &&
			all.body.durationMinutes === undefined &&
			(await page.getByText('Move series').count()) === 0,
		JSON.stringify(all.body)
	)
	const moved = page.locator(
		`[data-slot="week-grid-column"][data-date="${next}"] [data-binding="lesson"][data-mark="syncing"]`
	)
	await moved.first().waitFor({ timeout: 15000 })
	check('the block stands at the new place with the pending marker', (await moved.count()) === 1)
	await shot(page, 'schedule-started', 'series-all')
	state.release()
	await idle(page)

	state.scenario = 'done'
	await openPreviousWeek(page)
	await reveal(page, 15)
	const doneCursor = await lessonOn(page, lessonDate).evaluate((element) => getComputedStyle(element).cursor)
	check('a Done lesson has the default cursor', doneCursor === 'default', doneCursor)
	await drag(page, lessonDate, next, 10)
	check(
		'a Done lesson shows no frame and sends nothing',
		(await page.locator('[data-slot="week-grid-move-frame"]').count()) === 0 &&
			calls.filter((call) => call.operation === 'move').length === 5
	)
	await closeAll(page)
	dialog = await openLesson(page, lessonDate)
	check(
		'the dialog of a Done lesson shows the Done line instead of Move lesson and Cancel lesson',
		(await textCount(dialog, DONE_LINE)) === 1 &&
			(await dialog.getByRole('button', { name: 'Move lesson' }).count()) === 0 &&
			(await dialog.getByRole('button', { name: 'Cancel lesson' }).count()) === 0
	)
	await shot(page, 'schedule-started', 'done-dialog')
	await closeAll(page)

	state.scenario = 'none'
	await openPreviousWeek(page)
	await reveal(page, 20)
	const monday = day(-7)
	const point = await pointAt(page, monday, 20)
	await page.mouse.click(point.x, point.y + 20)
	const created = page.getByRole('dialog').last()
	await created.getByText('New lesson').waitFor({ timeout: 15000 })
	await page.locator('#new-lesson-student').click()
	await page.getByRole('option', { name: NAME }).click()
	await shot(page, 'schedule-started', 'create-past')
	await created.getByRole('button', { name: 'Add lesson' }).click()
	await sent(calls, 'create', 1)
	const create = calls.find((call) => call.operation === 'create')
	check(
		'a lesson is created in a past slot of the grid',
		create.body?.date === monday && create.body.studentId === ctx.ids.one,
		JSON.stringify(create.body)
	)
	await idle(page)
	check('no console problems on the schedule', real(problems).length === 0, real(problems).slice(0, 2).join(' || '))
}

async function today(ctx, state, page, calls, problems) {
	state.today = true
	state.scenario = 'single'
	await page.goto(`${BASE}/`, { timeout: 120000 })
	await page.locator(`${EARLIER} [data-slot="today-row-open"]`).first().waitFor({ timeout: 60000 })
	await page.waitForTimeout(1000)
	const rows = page.locator(`${EARLIER} [data-slot="today-row-open"]`)
	check('Earlier, not marked has the two synthetic rows and no move button', (await rows.count()) === 2)
	check(
		'a row has no move button of its own',
		(await page.locator(EARLIER).getByRole('button', { name: /move/i }).count()) === 0
	)

	await rows.nth(1).click()
	let dialog = page.getByRole('dialog').last()
	await dialog.waitFor({ timeout: 15000 })
	await dialog.getByRole('button', { name: 'Move lesson' }).waitFor({ timeout: 15000 })
	for (
		let attempt = 0;
		attempt < 40 && !(await dialog.getByRole('button', { name: 'Move lesson' }).isEnabled());
		attempt += 1
	)
		await page.waitForTimeout(250)
	check(
		'the Today dialog of a started lesson shows the mark row and enabled Move lesson and Cancel lesson',
		(await dialog.locator('[data-slot="lesson-mark-row"]').count()) === 1 &&
			(await dialog.getByRole('button', { name: 'Move lesson' }).isEnabled()) &&
			(await dialog.getByRole('button', { name: 'Cancel lesson' }).isEnabled())
	)
	await shot(page, 'schedule-started', 'today-dialog')
	await dialog.getByRole('button', { name: 'Move lesson' }).click()
	const form = page.getByRole('group', { name: 'Move lesson' })
	await form.waitFor({ timeout: 10000 })
	check('the Today form has no scope question and no moves-alone line', (await textCount(form, 'moves alone')) === 0)
	await pickDate(page, addDays(ctx.lessonDate, 1))
	const before = calls.length
	await form.getByRole('button', { name: 'Move lesson' }).click()
	const started = Date.now()
	while (calls.length === before && Date.now() - started < 25000) await wait(100)
	const moveCall = calls.at(-1)
	check(
		'Today moves only this lesson through the one-off route',
		calls.length === before + 1 &&
			moveCall.operation === 'move' &&
			moveCall.path === `/schedule/lessons/${ctx.ids.single}/move` &&
			moveCall.body.date === addDays(ctx.lessonDate, 1),
		JSON.stringify(moveCall)
	)
	await page.waitForTimeout(1500)
	check('the dialog closed after Save', (await page.getByRole('dialog').count()) === 0)

	await rows.nth(1).click()
	dialog = page.getByRole('dialog').last()
	for (
		let attempt = 0;
		attempt < 40 &&
		!(await dialog
			.getByRole('button', { name: 'Cancel lesson' })
			.isEnabled()
			.catch(() => false));
		attempt += 1
	)
		await page.waitForTimeout(250)
	await dialog.getByRole('button', { name: 'Cancel lesson' }).click()
	await dialog.locator('[data-slot="lesson-cancel-question"]').waitFor({ timeout: 10000 })
	const cancelBefore = calls.length
	await dialog.getByRole('button', { name: 'Yes, cancel' }).click()
	const cancelStarted = Date.now()
	while (calls.length === cancelBefore && Date.now() - cancelStarted < 25000) await wait(100)
	const cancelCall = calls.at(-1)
	check(
		'Cancel lesson from Today sends the cancel command',
		cancelCall.operation === 'cancel' && cancelCall.path === `/schedule/lessons/${ctx.ids.single}/cancel`,
		JSON.stringify(cancelCall)
	)
	await page.getByText('Lesson cancelled').first().waitFor({ timeout: 15000 })
	await page.waitForTimeout(800)
	check('the dialog closed after the cancel', (await page.getByRole('dialog').count()) === 0)

	await rows.nth(0).click()
	dialog = page.getByRole('dialog').last()
	await dialog.waitFor({ timeout: 15000 })
	await page.waitForTimeout(2500)
	const line = dialog.locator('[data-slot="lesson-unavailable-line"]')
	check(
		'a lesson of a week outside the range keeps its buttons inactive and says why',
		(await line.count()) === 1 &&
			(await dialog.getByRole('button', { name: 'Move lesson' }).isDisabled()) &&
			(await dialog.getByRole('button', { name: 'Cancel lesson' }).isDisabled()),
		(await line.count()) === 1 ? await line.innerText() : 'no line'
	)
	console.log(
		`INFO [${theme}] unavailable line: ${(
			await line
				.first()
				.innerText()
				.catch(() => '')
		).trim()}`
	)
	await shot(page, 'schedule-started', 'today-unavailable')
	await closeAll(page)

	await page.locator('section[aria-labelledby="today-lessons"] [data-slot="today-row-open"]').first().click()
	dialog = page.getByRole('dialog').last()
	await dialog.waitFor({ timeout: 15000 })
	await page.waitForTimeout(2500)
	check(
		'the Today dialog of a Done lesson shows the Done line and the mark row, no Move lesson or Cancel lesson',
		(await textCount(dialog, DONE_LINE)) === 1 &&
			(await dialog.locator('[data-slot="lesson-mark-row"]').count()) === 1 &&
			(await dialog.getByRole('button', { name: 'Move lesson' }).count()) === 0 &&
			(await dialog.getByRole('button', { name: 'Cancel lesson' }).count()) === 0
	)
	await shot(page, 'schedule-started', 'today-done')
	await closeAll(page)
	check('no console problems on Today', real(problems).length === 0, real(problems).slice(0, 2).join(' || '))
}

let completed = false
let seeded = false
try {
	const down = spawnSync(NODE, [WAIT, 'down'], { encoding: 'utf8' })
	if (down.status !== 0) throw new Error('ports 3000 and 4000 are not free, stop the running stack first')
	const up = seed('up', TARGET, 'week')
	seeded = true
	const monday = /monday (\d{4}-\d{2}-\d{2})/.exec(up)?.[1]
	if (!monday) throw new Error('seed printed no monday')
	const one = sql(`select id from students where import_key = '${CARD}'`).rows?.[0]?.id
	if (!one) throw new Error('the synthetic card is missing')
	const ctx = {
		monday,
		lessonDate: addDays(monday, -5),
		ids: { one, single: randomUUID(), series: randomUUID(), far: randomUUID(), doneToday: randomUUID() },
	}
	const commandsBefore = count('google_commands')
	await startStack()
	const { browser, page, problems, calls, state } = await prepare(ctx)
	try {
		if (TARGET === 'test') await signIn(page, TEACHER_LOGIN, readFileSync(`${STATE_DIR}/teacher.secret`, 'utf8').trim())
		else await signIn(page)
		await schedule(ctx, state, page, calls, problems)
		await today(ctx, state, page, calls, problems)
		check('the commands reached no api table', count('google_commands') === commandsBefore)
		completed = true
	} catch (error) {
		await shot(page, 'schedule-started', 'failure').catch(() => {})
		console.log('problems', real(problems).slice(0, 4).join(' || '))
		throw error
	} finally {
		await browser.close()
	}
} catch (error) {
	check('script completed', false, String(error).slice(0, 400))
} finally {
	if (seeded) {
		try {
			seed('down', TARGET)
		} catch (error) {
			check('synthetic data removed', false, String(error).slice(0, 200))
		}
	}
	await stopStack()
	const down = spawnSync(NODE, [WAIT, 'down'], { encoding: 'utf8' })
	check('ports 3000 and 4000 are free', down.status === 0, down.stdout.trim())
}
console.log(`screenshots in ${STATE_DIR}`)
if (completed && failures() === 0) console.log('SCHEDULE_STARTED_WEB_OK')
process.exit(failures() === 0 && completed ? 0 : 1)
