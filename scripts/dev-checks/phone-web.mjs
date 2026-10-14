import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createConnection } from 'node:net'

import * as contracts from '../../packages/contracts/src/index.ts'
import * as core from '../../packages/core/src/index.ts'
import { BASE, ROOT, STATE_DIR, check, env, failures, shot, sql, theme } from './browser-context.ts'

const playwright = process.env.PLAYWRIGHT_CORE ?? '/Volumes/T7/personal/ielts/node_modules/playwright-core/index.mjs'
const { chromium } = await import(playwright)

const SIZES = [
	{ width: 375, height: 812 },
	{ width: 320, height: 640 },
]
const LONG = 'Alex Example 2396 Wolfeschlegelsteinhausenbergerdorff-Montgomery'
const SECOND = 'Alex Example 2397 Featherstonehaugh-Bartholomew'
const THIRD = 'Alex Example 2398'
const FIXTURES = `display_name ~ '^Alex Example 239[6-9]( |$)' and import_key is null`
const VN = 'Asia/Ho_Chi_Minh'
const FIELD = '[data-slot="chat-composer-field"]'
const POPUP = '[data-slot="mention-popup"]'
const SEND = '[data-slot="chat-send"]'
const CHANGE = '[data-slot="chat-change"]'
const CALENDAR_CHANGE = '[data-slot="chat-calendar-change"]'
const MINUTE = 60000
const HOUR = 3600000
const DAY = 24 * HOUR
const EXPECTED_NOISE =
	/status of 500|status of 404|Reduced Motion enabled|Failed to load resource|server caches disabled|Route "\/login": Next\.js encountered URL data/
const PLAIN_COLOR = { id: null, background: null, foreground: null, custom: false }
const q = (value) => `'${String(value).replaceAll("'", "''")}'`

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

async function freePort() {
	for (let port = 4281; port < 4300; port++) if (await portFree(port)) return port
	throw new Error('no free port for the api with the fake model')
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

async function startFakeModelApi(port) {
	const childEnv = {
		...process.env,
		PORT: String(port),
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
			const res = await fetch(`http://127.0.0.1:${port}/healthz`)
			if (res.status === 200) return child
		} catch {}
		await new Promise((resolve) => setTimeout(resolve, 300))
	}
	child.kill('SIGTERM')
	throw new Error('the api with the fake model did not answer /healthz in 30 s')
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

function removeConversations(ids) {
	if (ids.length === 0) return
	const list = ids.map((id) => `'${id}'`).join(', ')
	sql(`delete from chat_actions where conversation_id in (${list})`)
	sql(`delete from chat_usage_attempts where conversation_id in (${list})`)
	sql(`delete from chat_turns where conversation_id in (${list})`)
	sql(`delete from chat_messages where reply_to is not null and conversation_id in (${list})`)
	sql(`delete from chat_messages where conversation_id in (${list})`)
	const result = sql(`delete from chat_conversations where id in (${list})`)
	console.log(`fixture conversations removed ${result.rowCount}`)
}

function removeFixtures() {
	const cards = `select id from students where ${FIXTURES}`
	const conversations = sql(
		`select distinct conversation_id as id from chat_actions where target->>'studentId' in (select id::text from students where ${FIXTURES})`
	).rows.map((row) => row.id)
	removeConversations(conversations)
	sql(`delete from student_notes where student_id in (${cards})`)
	sql(`delete from lesson_comments where student_id in (${cards})`)
	sql(`delete from student_sections where student_id in (${cards})`)
	sql(`delete from accounts where student_id in (${cards}) and role = 'student'`)
	sql(`delete from payments where student_id in (${cards})`)
	const result = sql(`delete from students where ${FIXTURES}`)
	console.log(`fixture cards removed ${result.rowCount}`)
}

async function openPhone() {
	const browser = await chromium.launch()
	const context = await browser.newContext({
		viewport: SIZES[0],
		colorScheme: theme,
		hasTouch: true,
		isMobile: true,
		deviceScaleFactor: 2,
	})
	const page = await context.newPage()
	const problems = []
	page.on('console', (message) => {
		if (message.type() === 'error' || message.type() === 'warning')
			problems.push(`${message.type()}: ${message.text().slice(0, 300)}`)
	})
	page.on('pageerror', (error) => problems.push(`pageerror: ${String(error).slice(0, 300)}`))
	return { browser, page, problems }
}

async function prepare(page, apiOrigin, chatPort) {
	await page.addInitScript((value) => {
		try {
			localStorage.setItem('theme', value)
		} catch {}
		document.addEventListener('DOMContentLoaded', () => {
			const style = document.createElement('style')
			style.textContent = 'nextjs-portal{display:none!important}'
			document.head.append(style)
		})
	}, theme)
	if (apiOrigin !== BASE)
		await page.route('**/api/**', async (route) => {
			const headers = { ...(await route.request().allHeaders()), origin: apiOrigin }
			try {
				await route.fulfill({ response: await route.fetch({ headers }) })
			} catch {
				await route.abort().catch(() => undefined)
			}
		})
	if (chatPort !== null)
		await page.route('**/api/chat/**', async (route) => {
			const url = new URL(route.request().url())
			const target = `http://127.0.0.1:${chatPort}${url.pathname.replace(/^\/api/, '')}${url.search}`
			const headers = { ...(await route.request().allHeaders()), origin: BASE, 'x-forwarded-for': '127.0.0.1' }
			try {
				await route.fulfill({ response: await route.fetch({ url: target, headers }) })
			} catch {
				await route.abort().catch(() => undefined)
			}
		})
}

async function signInAs(page) {
	await page.goto(`${BASE}/login`)
	await page.getByLabel('Login or email').fill(env.DEV_TEACHER_LOGIN)
	await page.locator('#password').fill(env.DEV_TEACHER_PASSWORD)
	await page.getByRole('button', { name: 'Sign in to dv-lab' }).click()
	await page.waitForURL(`${BASE}/`, { timeout: 30000 })
}

async function call(page, apiOrigin, method, path, body) {
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

async function makeCard(page, apiOrigin, name, opening = true) {
	const created = await call(page, apiOrigin, 'POST', '/students', {
		displayName: name,
		rateMinor: 400000,
		currency: 'RUB',
		defaultLessonMinutes: 60,
		parent: null,
		level: null,
		goals: null,
		timeZone: null,
	})
	check(`the fixture card ${name.slice(0, 20)} is created`, created.status === 201, String(created.status))
	const id = created.json.student.id
	if (opening) {
		const zone = (await call(page, apiOrigin, 'GET', `/students/${id}`)).json.defaultTimeZone
		const set = await call(page, apiOrigin, 'PUT', `/students/${id}/opening-balance`, {
			lessonsHundredths: 200,
			on: core.addDays(core.scheduleToday(new Date(), zone), -1),
			expectedDefaultTimeZone: zone,
		})
		check(`the opening balance of ${name.slice(0, 20)} is set`, set.status === 200, String(set.status))
	}
	return id
}

function scanInPage(scope) {
	const W = window.innerWidth
	const H = window.innerHeight
	const INTERACTIVE =
		'button, a[href], input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea, select, [role="tab"], [role="option"], [role="menuitem"], [role="combobox"], [role="switch"], [role="checkbox"], [contenteditable="true"], [contenteditable="plaintext-only"]'
	const hiddenIn = (el) => {
		for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
			if (node.localName === 'nextjs-portal') return true
			if (node.hasAttribute('inert') || node.hasAttribute('hidden') || node.getAttribute('aria-hidden') === 'true')
				return true
			const style = getComputedStyle(node)
			if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return true
		}
		return false
	}
	const name = (el) => {
		const label = el.getAttribute('aria-label') ?? ''
		const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ')
		const slot = el.getAttribute('data-slot') ?? ''
		return `${el.localName}${slot ? `[${slot}]` : ''} "${(label || text).slice(0, 36)}"`
	}
	const scrollerOf = (el) => {
		for (let node = el.parentElement; node; node = node.parentElement) {
			const style = getComputedStyle(node)
			if ((style.overflowX === 'auto' || style.overflowX === 'scroll') && node.scrollWidth > node.clientWidth + 1)
				return node
		}
		return null
	}
	const out = {
		page: document.documentElement.scrollWidth - W,
		areas: [],
		offscreen: [],
		fonts: [],
		clipped: [],
		small: [],
		overlap: [],
		text: [],
		seen: 0,
	}
	for (const area of document.querySelectorAll('[data-slot="scroll-area-viewport"]')) {
		if (hiddenIn(area)) continue
		const extra = area.scrollWidth - area.clientWidth
		if (extra > 1) out.areas.push(`${name(area)} +${extra}`)
	}
	const controls = [...document.querySelectorAll(INTERACTIVE)].filter((el) => {
		if (hiddenIn(el) || el.closest('.sr-only')) return false
		if (scope && !el.closest(scope)) return false
		const box = el.getBoundingClientRect()
		return box.width >= 2 && box.height >= 2
	})
	out.seen = controls.length
	for (const el of controls) {
		const box = el.getBoundingClientRect()
		const style = getComputedStyle(el)
		const scroller = scrollerOf(el)
		if (scroller === null) {
			if (box.left < -0.5 || box.right > W + 0.5)
				out.offscreen.push(`${name(el)} ${Math.round(box.left)}..${Math.round(box.right)}`)
		} else {
			const around = scroller.getBoundingClientRect()
			if (around.left < -0.5 || around.right > W + 0.5)
				out.offscreen.push(`scroller of ${name(el)} ${Math.round(around.left)}..${Math.round(around.right)}`)
		}
		const field =
			el.matches('input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]') &&
			!el.matches('[type="file"], [type="range"], [type="button"], [type="submit"]')
		if (field && parseFloat(style.fontSize) < 15.99) out.fonts.push(`${name(el)} ${style.fontSize}`)
		const ellipsis = style.textOverflow === 'ellipsis' || /truncate|line-clamp/.test(el.className)
		const named = (el.getAttribute('aria-label') ?? '').trim().length > 0
		if (!ellipsis && !named && !field && el.localName !== 'a') {
			const inner = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
			let spill = false
			for (let text = inner.nextNode(); text; text = inner.nextNode()) {
				if (!text.nodeValue || !text.nodeValue.trim() || text.parentElement?.closest('.sr-only')) continue
				let shortened = false
				for (let up = text.parentElement; up && up !== el; up = up.parentElement) {
					const inside = getComputedStyle(up)
					if (
						inside.textOverflow === 'ellipsis' ||
						inside.overflowX !== 'visible' ||
						/truncate|line-clamp/.test(up.className)
					)
						shortened = true
				}
				if (shortened) continue
				const range = document.createRange()
				range.selectNodeContents(text)
				const rect = range.getBoundingClientRect()
				if (rect.width > 0 && (rect.right > box.right + 1 || rect.left < box.left - 1 || rect.bottom > box.bottom + 2))
					spill = true
			}
			const cut = style.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1
			if (spill || cut) out.clipped.push(`${name(el)} box ${Math.round(box.width)}x${Math.round(box.height)}`)
		}
	}
	const clippedAt = (el, px, py) => {
		for (let up = el.parentElement; up && up !== document.body; up = up.parentElement) {
			const style = getComputedStyle(up)
			if (style.overflowX === 'visible' && style.overflowY === 'visible') continue
			const around = up.getBoundingClientRect()
			if (px < around.left || px > around.right || py < around.top || py > around.bottom) return true
		}
		return false
	}
	for (let i = 0; i < controls.length; i++)
		for (let j = i + 1; j < controls.length; j++) {
			const a = controls[i]
			const b = controls[j]
			if (a.contains(b) || b.contains(a)) continue
			const x = a.getBoundingClientRect()
			const y = b.getBoundingClientRect()
			const width = Math.min(x.right, y.right) - Math.max(x.left, y.left)
			const height = Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top)
			if (width <= 3 || height <= 3) continue
			const px = Math.max(x.left, y.left) + width / 2
			const py = Math.max(x.top, y.top) + height / 2
			if (clippedAt(a, px, py) || clippedAt(b, px, py)) continue
			out.overlap.push(`${name(a)} x ${name(b)}`)
		}
	const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		if (!node.nodeValue || !node.nodeValue.trim()) continue
		const parent = node.parentElement
		if (!parent || hiddenIn(parent) || parent.closest('script, style, noscript, .sr-only')) continue
		if (scope && !parent.closest(scope)) continue
		const range = document.createRange()
		range.selectNodeContents(node)
		const spilled = [...range.getClientRects()].some((box) => box.width > 0 && (box.right > W + 0.5 || box.left < -0.5))
		if (!spilled || scrollerOf(parent) !== null) continue
		let clipped = false
		for (let up = parent; up && up !== document.body; up = up.parentElement) {
			const style = getComputedStyle(up)
			if (style.overflowX !== 'visible') {
				const box = up.getBoundingClientRect()
				if (box.right <= W + 0.5 && box.left >= -0.5) clipped = true
			}
		}
		if (!clipped) out.text.push(`${name(parent)} "${node.nodeValue.trim().slice(0, 30)}"`)
	}
	const extent = (el, axis) => {
		el.scrollIntoView({ block: 'center', inline: 'nearest' })
		const box = el.getBoundingClientRect()
		const cx = box.left + box.width / 2
		const cy = box.top + box.height / 2
		const hit = (x, y) => {
			if (x < 0 || y < 0 || x >= W || y >= H) return true
			const target = document.elementFromPoint(x, y)
			return target !== null && (target === el || el.contains(target))
		}
		if (!hit(cx, cy)) return null
		let before = 0
		let after = 0
		while (before < 30 && hit(axis === 'y' ? cx : cx - before - 1, axis === 'y' ? cy - before - 1 : cy)) before++
		while (after < 30 && hit(axis === 'y' ? cx : cx + after + 1, axis === 'y' ? cy + after + 1 : cy)) after++
		return before + after + 1
	}
	for (const el of controls) {
		if (getComputedStyle(el).display === 'inline' || el.disabled || el.getAttribute('aria-disabled') === 'true')
			continue
		const box = el.getBoundingClientRect()
		const needY = box.height < 43.5
		const needX = box.width < 43.5
		if (!needY && !needX) continue
		const high = needY ? extent(el, 'y') : 44
		const wide = needX ? extent(el, 'x') : 44
		if (high === null || wide === null) {
			out.small.push(`${name(el)} covered`)
			continue
		}
		if (high < 43.5 || wide < 43.5) out.small.push(`${name(el)} ${wide}x${high}`)
	}
	return out
}

async function measure(page, label, size, { hit = true, scope = null } = {}) {
	await page.waitForTimeout(450)
	const result = await page.evaluate(scanInPage, scope)
	const where = `${label} @${size.width}`
	const shown = process.env.PHONE_VERBOSE ? 60 : 5
	const list = (items) => `${items.length}: ${items.slice(0, shown).join(' | ')}`
	check(
		`${where}: the page does not scroll sideways and no area scrolls sideways`,
		result.page <= 0 && result.areas.length === 0,
		`page ${result.page}, areas ${result.areas.join(' | ')}`
	)
	check(`${where}: every control is inside the window`, result.offscreen.length === 0, list(result.offscreen))
	check(`${where}: text is inside the window`, result.text.length === 0, list(result.text))
	check(`${where}: text fields are 16 px`, result.fonts.length === 0, list(result.fonts))
	check(`${where}: no label is cut off`, result.clipped.length === 0, list(result.clipped))
	check(`${where}: no two controls overlap`, result.overlap.length === 0, list(result.overlap))
	if (hit)
		check(
			`${where}: touch targets reach 44 px (${result.seen} controls)`,
			result.small.length === 0,
			list(result.small)
		)
	return result
}

async function tap(page, locator) {
	await locator.scrollIntoViewIfNeeded()
	const box = await locator.boundingBox()
	if (!box) throw new Error('no box to tap')
	await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
}

async function inWindow(locator, size) {
	const box = await locator.boundingBox()
	if (!box) return { ok: false, box: null }
	return {
		ok:
			box.x >= -0.5 &&
			box.y >= -0.5 &&
			box.x + box.width <= size.width + 0.5 &&
			box.y + box.height <= size.height + 0.5,
		box: { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) },
	}
}

async function inWidth(locator, size) {
	const box = await locator.boundingBox()
	return {
		ok: box !== null && box.x >= -0.5 && box.x + box.width <= size.width + 0.5,
		box: box === null ? null : { x: Math.round(box.x), w: Math.round(box.width) },
	}
}

async function fitDialog(page, size, label) {
	const dialog = page.locator('[role="dialog"]:visible').last()
	await dialog.waitFor({ timeout: 15000 })
	await page.waitForTimeout(500)
	const fit = await inWindow(dialog, size)
	check(`${label} @${size.width}: the dialog fits the window`, fit.ok, JSON.stringify(fit.box))
	const count = await page.locator('[role="dialog"]:visible').count()
	check(`${label} @${size.width}: one dialog is open`, count === 1, String(count))
	const buttons = await dialog.locator('button:visible').evaluateAll((nodes) =>
		nodes
			.map((node) => {
				const box = node.getBoundingClientRect()
				return {
					label: node.getAttribute('aria-label') ?? node.textContent.trim().slice(0, 20),
					bottom: box.bottom,
					top: box.top,
				}
			})
			.filter((item) => item.bottom > innerHeight + 0.5 || item.top < -0.5)
	)
	check(
		`${label} @${size.width}: every dialog button is reachable without scrolling the page`,
		buttons.length === 0,
		JSON.stringify(buttons)
	)
	return dialog
}

async function closeDialog(page) {
	await page.keyboard.press('Escape')
	await page.waitForTimeout(500)
	if ((await page.locator('[role="dialog"]:visible').count()) > 0) {
		const discard = page.getByRole('button', { name: /Discard/ })
		if (await discard.isVisible().catch(() => false)) await discard.click()
		await page.waitForTimeout(400)
	}
}

function zoneOffsetMs(zone, instant) {
	const text =
		new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' })
			.formatToParts(instant)
			.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT'
	const match = /GMT([+-])(\d{2}):?(\d{2})?/.exec(text)
	if (!match) return 0
	return (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] ?? 0)) * MINUTE
}

function weekRange(monday, zone) {
	const guess = Date.parse(`${monday}T00:00:00Z`)
	const start = guess - zoneOffsetMs(zone, new Date(guess))
	return { start: new Date(start).toISOString(), end: new Date(start + 7 * DAY).toISOString(), timeZone: zone }
}

function block(options) {
	return {
		key: options.key,
		ref: { kind: 'single', lessonId: randomUUID() },
		studentId: options.studentId,
		studentName: options.name,
		studentStatus: 'active',
		studentGoal: null,
		startsAt: new Date(options.startMs).toISOString(),
		timeZone: VN,
		durationMinutes: 60,
		movedTo: null,
		movedFrom: null,
		outcome: options.outcome ?? 'planned',
		actions: { move: true, cancel: true, restore: false, mark: options.mark ?? false, series: false },
		ledger: { openingOn: null, noShowDeducts: false, lessonMinutes: 60 },
		mark: options.marked ?? null,
		markRevision: options.marked ? 1 : null,
	}
}

async function todayBase(route, apiOrigin) {
	const headers = { ...(await route.request().allHeaders()), origin: apiOrigin }
	return (await route.fetch({ headers })).json()
}

function paysSoonRow(id, displayName, balanceMinutes) {
	return {
		id,
		displayName,
		status: 'active',
		rateMinor: 400000,
		currency: 'RUB',
		defaultLessonMinutes: 60,
		balanceMinutes,
		nextLessonAt: null,
		nextLesson: { status: { state: 'unavailable', reason: 'provider_unavailable' }, result: 'unknown', startsAt: null },
	}
}

async function sectionToday({ page, apiOrigin, problems }) {
	const first = await makeCard(page, apiOrigin, LONG)
	const second = await makeCard(page, apiOrigin, SECOND)
	const third = await makeCard(page, apiOrigin, THIRD)
	let mode = 'rows'
	const marks = []
	await page.route(/\/api\/today(\?|$)/, async (route) => {
		if (mode === 'real') return route.fallback()
		if (mode === 'error') return route.fulfill({ status: 500, json: { error: { code: 'internal', message: 'x' } } })
		const base = await todayBase(route, apiOrigin)
		const now = Date.now()
		const rows =
			mode === 'empty'
				? []
				: [
						block({ key: 'a', studentId: first, name: LONG, startMs: now - 90 * MINUTE, mark: true }),
						block({
							key: 'b',
							studentId: second,
							name: SECOND,
							startMs: now - 4 * HOUR,
							outcome: 'done',
							mark: true,
							marked: 'done',
						}),
						block({ key: 'c', studentId: first, name: LONG, startMs: now + 90 * MINUTE }),
						block({ key: 'd', studentId: third, name: THIRD, startMs: now + 3 * HOUR }),
					]
		const earlier =
			mode === 'empty'
				? []
				: [block({ key: 'e', studentId: second, name: SECOND, startMs: now - DAY - HOUR, mark: true })]
		const paysSoon =
			mode === 'empty'
				? []
				: [paysSoonRow(first, LONG, -120), paysSoonRow(second, SECOND, 60), paysSoonRow(third, THIRD, 30)]
		const read =
			mode === 'partial'
				? {
						state: 'last_known',
						fetchedAt: new Date(now - HOUR).toISOString(),
						revision: '1',
						reason: 'provider_unavailable',
					}
				: base.calendarRead
		return route.fulfill({
			json: {
				...base,
				calendarRead: read,
				calendarWrite: mode === 'partial' ? { state: 'blocked', reason: 'provider_unavailable' } : base.calendarWrite,
				lessons: rows,
				earlier,
				series: [],
				paysSoon,
				paysSoonLessons: 4,
			},
		})
	})
	await page.route(/\/api\/schedule\/lessons\/[^/]+\/mark$/, (route) => {
		marks.push(route.request().url())
		return route.fulfill({ status: 404, json: { error: { code: 'not_found', message: 'x' } } })
	})
	for (const size of SIZES) {
		await page.setViewportSize(size)
		if (size.width === 320) await page.emulateMedia({ reducedMotion: 'reduce' })
		mode = 'rows'
		await page.goto(`${BASE}/`)
		await page.locator('[data-slot="today-row"]').first().waitFor({ timeout: 30000 })
		const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches)
		check(`today @${size.width}: the context reports a coarse pointer`, coarse)
		await measure(page, 'today', size)
		await shot(page, 'phone-today', `${size.width}`)
		const counters = await page.locator('[data-slot="today-counters"] > *').evaluateAll((nodes) =>
			nodes.map((node) => {
				const box = node.getBoundingClientRect()
				return { x: Math.round(box.x), y: Math.round(box.y) }
			})
		)
		check(
			`today @${size.width}: the four counters are two by two`,
			counters.length === 4 &&
				new Set(counters.map((item) => item.x)).size === 2 &&
				new Set(counters.map((item) => item.y)).size === 2,
			JSON.stringify(counters)
		)
		const panels = await page.locator('section[aria-labelledby^="today-"]').evaluateAll((nodes) =>
			nodes.map((node) => {
				const box = node.getBoundingClientRect()
				return {
					id: node.getAttribute('aria-labelledby'),
					x: Math.round(box.x),
					top: Math.round(box.top),
					w: Math.round(box.width),
				}
			})
		)
		check(
			`today @${size.width}: the panels stand one under the other`,
			panels.length === 3 &&
				panels.every((item) => item.x === panels[0].x && item.w === panels[0].w) &&
				panels[0].top < panels[1].top &&
				panels[1].top < panels[2].top,
			JSON.stringify(panels)
		)
		const rows = await page.locator('[data-slot="today-row"]').evaluateAll((nodes) =>
			nodes
				.filter((node) => node.getBoundingClientRect().width > 0)
				.map((node) => {
					const box = node.getBoundingClientRect()
					return box.left >= 0 && box.right <= innerWidth
				})
		)
		check(
			`today @${size.width}: every lesson row is inside the window`,
			rows.length === 5 && rows.every(Boolean),
			JSON.stringify(rows)
		)

		const before = marks.length
		const mark = page.locator('[data-slot="today-row"] button[aria-label^="Mark "]').first()
		await tap(page, mark)
		await page.waitForTimeout(700)
		check(
			`today @${size.width}: the tap on a mark button sends the mark`,
			marks.length > before,
			`${marks.length - before}`
		)
		check(
			`today @${size.width}: the tap on a mark button does not open the lesson`,
			(await page.locator('[role="dialog"]:visible').count()) === 0
		)
		const change = page.locator('[data-slot="today-row"] button[aria-label$="Change the mark"]').first()
		await tap(page, change)
		await page.waitForTimeout(500)
		check(
			`today @${size.width}: the tap on the mark menu opens the menu and not the lesson`,
			(await page.locator('[role="menu"]:visible').count()) === 1 &&
				(await page.locator('[role="dialog"]:visible').count()) === 0
		)
		await measure(page, 'today mark menu', size, { scope: '[role="menu"]' })
		await page.keyboard.press('Escape')
		await page.waitForTimeout(400)

		await tap(page, page.locator('[data-slot="today-row-open"]').first())
		await fitDialog(page, size, 'today lesson dialog')
		await measure(page, 'today lesson dialog', size)
		await shot(page, 'phone-today', `${size.width}-lesson`)
		await closeDialog(page)

		const add = page.getByRole('button', { name: 'Add payment', exact: true })
		const addFit = await inWidth(add, size)
		check(`today @${size.width}: Add payment is visible`, addFit.ok, JSON.stringify(addFit.box))
		await tap(page, add)
		await fitDialog(page, size, 'today payment dialog')
		await measure(page, 'today payment dialog', size)
		await shot(page, 'phone-today', `${size.width}-payment`)
		await closeDialog(page)

		for (const next of ['empty', 'partial', 'error']) {
			mode = next
			await page.goto(`${BASE}/`)
			await page.waitForTimeout(1500)
			await page.locator('main, [role="main"], h1').first().waitFor({ timeout: 30000 })
			const text = await page.locator('body').innerText()
			if (next === 'empty')
				check(
					`today empty @${size.width}: the empty day keeps Open schedule and Add payment`,
					text.includes('No lessons today') &&
						(await page.getByRole('button', { name: 'Add payment', exact: true }).isVisible()) &&
						(await page.getByRole('link', { name: 'Open schedule' }).first().isVisible())
				)
			if (next === 'partial')
				check(
					`today partial @${size.width}: the partial read says Read-only and keeps Refresh and Add payment`,
					text.includes('Read-only') &&
						(await page.getByRole('button', { name: 'Refresh', exact: true }).first().isVisible()) &&
						(await page.getByRole('button', { name: 'Add payment', exact: true }).isVisible())
				)
			if (next === 'error')
				check(
					`today error @${size.width}: the failed read says Could not load Today and keeps Refresh`,
					text.includes('Could not load Today') &&
						(await page.getByRole('button', { name: 'Refresh', exact: true }).isVisible()),
					text.slice(0, 120).replace(/\n/g, ' | ')
				)
			await measure(page, `today ${next}`, size)
			await shot(page, 'phone-today', `${size.width}-${next}`)
		}
	}
	const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
	check('today: no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
}

function agendaEvent(key, studentId, startMs, title, options = {}) {
	return {
		eventKey: key,
		version: 'v1',
		title,
		when: {
			kind: 'timed',
			startsAt: new Date(startMs).toISOString(),
			endsAt: new Date(startMs + HOUR).toISOString(),
			timeZone: VN,
		},
		status: options.status ?? 'confirmed',
		blocksTime: true,
		color: PLAIN_COLOR,
		location: null,
		seriesMember: false,
		binding:
			studentId === null
				? { kind: 'external' }
				: { kind: 'lesson', ref: { kind: 'single', lessonId: randomUUID() }, studentId, version: 'v1', mark: null },
		suggestion: null,
		editBlock: null,
	}
}

function weekWindow(kind, monday, events) {
	const range = weekRange(monday, VN)
	const fetchedAt = new Date().toISOString()
	return {
		requestedRange: range,
		snapshotRange: range,
		connection: {
			state: 'connected',
			calendar: { id: 'check-calendar', label: 'Check calendar', timeZone: VN },
			generation: 1,
			issue: null,
			pendingCommandCount: 0,
			disconnectResolution: 'none',
			allowedActions: ['disconnect', 'switch'],
		},
		read:
			kind === 'partial'
				? { state: 'last_known', fetchedAt, revision: '1', reason: 'provider_unavailable' }
				: { state: 'fresh', fetchedAt, revision: '1' },
		events,
		series: [],
		write: kind === 'partial' ? { state: 'blocked', reason: 'provider_unavailable' } : { state: 'ready' },
	}
}

async function sectionSchedule({ page, apiOrigin, problems }) {
	const first = await makeCard(page, apiOrigin, LONG)
	let mode = 'rows'
	const weeks = []
	await page.route(/\/api\/schedule\/week\?/, async (route) => {
		if (mode === 'real') return route.fallback()
		if (mode === 'error') return route.fulfill({ status: 500, json: { error: { code: 'internal', message: 'x' } } })
		const monday = new URL(route.request().url()).searchParams.get('start')
		weeks.push(monday)
		const day = Date.parse(weekRange(monday, VN).start)
		const events =
			mode === 'empty'
				? []
				: [
						agendaEvent('a', first, day + 2 * DAY + 9 * HOUR, LONG),
						agendaEvent('b', first, day + 2 * DAY + 11 * HOUR, 'Cancelled lesson', { status: 'cancelled' }),
						agendaEvent('c', null, day + 2 * DAY + 14 * HOUR, 'Wolfeschlegelsteinhausenbergerdorff external booking'),
						agendaEvent('d', first, day + 3 * DAY + 10 * HOUR, SECOND),
						agendaEvent('e', first, day + 5 * DAY + 8 * HOUR, THIRD),
					]
		const headers = { ...(await route.request().allHeaders()), origin: apiOrigin }
		const base = await (await route.fetch({ headers })).json()
		const own = weekWindow(mode, monday, events)
		const window =
			base.connection?.state === 'connected'
				? {
						...own,
						requestedRange: base.requestedRange,
						snapshotRange: base.requestedRange,
						connection: base.connection,
					}
				: own
		const parsed = contracts.googleScheduleWindow.safeParse(window)
		if (!parsed.success)
			throw new Error(`the synthetic week is invalid: ${JSON.stringify(parsed.error.issues).slice(0, 400)}`)
		return route.fulfill({ json: window })
	})
	for (const size of SIZES) {
		await page.setViewportSize(size)
		if (size.width === 320) await page.emulateMedia({ reducedMotion: 'reduce' })
		mode = 'rows'
		await page.goto(`${BASE}/schedule`)
		await page.locator('[data-slot="calendar-agenda"] [data-event-key]').first().waitFor({ timeout: 30000 })
		const grid = page.locator('[data-slot="week-grid"]')
		const agenda = page.locator('[data-slot="calendar-agenda"]')
		check(
			`schedule @${size.width}: the day list is shown and the grid is hidden`,
			(await agenda.isVisible()) &&
				!(await grid
					.first()
					.isVisible()
					.catch(() => false))
		)
		await measure(page, 'schedule', size)
		await shot(page, 'phone-schedule', `${size.width}`)
		const dates = await page
			.locator('[data-slot="agenda-date"]')
			.evaluateAll((nodes) =>
				nodes.filter((node) => node.getBoundingClientRect().width > 0).map((node) => node.getAttribute('data-date'))
			)
		check(
			`schedule @${size.width}: the days run in date order`,
			dates.length === 3 && [...dates].sort().join() === dates.join(),
			dates.join(',')
		)
		const heading = (await page.locator('h1').first().innerText()).trim()
		const rows = await page.locator('[data-slot="calendar-agenda"] [data-event-key]').evaluateAll((nodes) =>
			nodes.map((node) => {
				const box = node.getBoundingClientRect()
				return box.left >= 0 && box.right <= innerWidth && box.height >= 44
			})
		)
		check(
			`schedule @${size.width}: every row is inside the window and 44 px high`,
			rows.length >= 4 && rows.every(Boolean),
			JSON.stringify(rows)
		)
		await tap(page, page.locator('[data-slot="calendar-agenda"] [data-event-key="a"]'))
		await fitDialog(page, size, 'schedule lesson dialog')
		await measure(page, 'schedule lesson dialog', size)
		await shot(page, 'phone-schedule', `${size.width}-lesson`)
		await closeDialog(page)
		check(
			`schedule @${size.width}: closing the dialog keeps the selected week`,
			(await page.locator('h1').first().innerText()).trim() === heading
		)
		const newEvent = page.getByRole('button', { name: /New event/ }).first()
		await tap(page, newEvent)
		await fitDialog(page, size, 'schedule new event dialog')
		await measure(page, 'schedule new event dialog', size)
		await shot(page, 'phone-schedule', `${size.width}-new`)
		await closeDialog(page)
		for (const next of ['empty', 'partial', 'error']) {
			mode = next
			await page.goto(`${BASE}/schedule`)
			await page.waitForTimeout(1800)
			const text = await page.locator('body').innerText()
			if (next === 'empty')
				check(
					`schedule empty @${size.width}: the empty week says so`,
					text.includes('No Google Calendar events in this range.')
				)
			if (next === 'partial')
				check(
					`schedule partial @${size.width}: the partial read says Read-only and keeps Refresh`,
					text.includes('Read-only') &&
						(await page.getByRole('button', { name: 'Refresh', exact: true }).first().isVisible())
				)
			if (next === 'error')
				check(
					`schedule error @${size.width}: the failed read says that no checked view is available and keeps Refresh`,
					text.includes('No checked calendar view is available') &&
						(await page.getByRole('button', { name: 'Refresh', exact: true }).first().isVisible()),
					text.slice(0, 120).replace(/\n/g, ' | ')
				)
			await measure(page, `schedule ${next}`, size)
			await shot(page, 'phone-schedule', `${size.width}-${next}`)
		}
	}
	const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
	check('schedule: no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
}

async function sectionProfile({ page, apiOrigin, problems }) {
	const id = await makeCard(page, apiOrigin, LONG)
	const zone = (await call(page, apiOrigin, 'GET', `/students/${id}`)).json.defaultTimeZone
	const today = core.scheduleToday(new Date(), zone)
	for (const [lessons, amount, note] of [
		[
			300,
			987654321,
			'Prepayment for the autumn course including the extra conversation club sessions and the exam preparation block',
		],
		[100, 123456, 'Short note'],
		[200, 55555555, 'Wolfeschlegelsteinhausenbergerdorff-reference-1234567890-abcdefghijklmnopqrstuvwxyz'],
	]) {
		const res = await call(page, apiOrigin, 'POST', '/payments', {
			studentId: id,
			paidOn: today,
			expectedDefaultTimeZone: zone,
			amountMinor: amount,
			currency: 'RUB',
			lessonsHundredths: lessons,
			note,
		})
		check('a payment is created', res.status === 201, String(res.status))
	}
	for (const size of SIZES) {
		await page.setViewportSize(size)
		if (size.width === 320) await page.emulateMedia({ reducedMotion: 'reduce' })
		await page.goto(`${BASE}/students/${id}`)
		await page.getByRole('heading', { name: LONG, level: 1 }).waitFor({ timeout: 30000 })
		await page.getByRole('tab').first().waitFor({ timeout: 30000 })
		const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches)
		check(`profile @${size.width}: the context reports a coarse pointer`, coarse)
		await page.waitForTimeout(800)
		await measure(page, 'profile overview', size)
		await shot(page, 'phone-profile', `${size.width}`)
		const strip = page.getByRole('tablist').first()
		const stripFit = await strip.evaluate((node) => {
			const box = node.getBoundingClientRect()
			return { left: box.left, right: box.right, scroll: node.scrollWidth - node.clientWidth }
		})
		check(
			`profile @${size.width}: the tab strip stays inside the window and the page does not scroll sideways`,
			stripFit.left >= 0 &&
				stripFit.right <= size.width + 0.5 &&
				(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)),
			JSON.stringify(stripFit)
		)
		for (const label of ['Vocabulary', 'Notes', 'Payments', 'Lessons', 'Overview']) {
			const tab = page.getByRole('tab', { name: label, exact: true })
			await tap(page, tab)
			await page.waitForTimeout(900)
			const visible = await tab.evaluate((node) => {
				const list = node.closest('[role="tablist"]')
				const box = node.getBoundingClientRect()
				const around = list.getBoundingClientRect()
				return (
					box.left >= around.left - 1 && box.right <= around.right + 1 && box.left >= -1 && box.right <= innerWidth + 1
				)
			})
			check(`profile ${label} @${size.width}: the selected tab is inside the strip`, visible)
			await measure(page, `profile ${label}`, size)
			if (label === 'Payments') await shot(page, 'phone-profile', `${size.width}-payments`)
		}
		await tap(page, page.getByRole('tab', { name: 'Payments', exact: true }))
		await page.waitForTimeout(900)
		const edit = page.getByRole('button', { name: /^Edit payment of / }).first()
		const del = page.getByRole('button', { name: /^Delete payment of / }).first()
		await edit.scrollIntoViewIfNeeded()
		const editFit = await inWidth(edit, size)
		await del.scrollIntoViewIfNeeded()
		const delFit = await inWidth(del, size)
		check(
			`profile @${size.width}: Edit payment and Delete payment can be reached`,
			editFit.ok && delFit.ok,
			JSON.stringify([editFit.box, delFit.box])
		)
		await tap(page, edit)
		const dialog = await fitDialog(page, size, 'profile edit payment dialog')
		const amountBox = await dialog.getByLabel('Amount').boundingBox()
		const lessonsBox = await dialog.getByLabel('Lessons').first().boundingBox()
		check(
			`profile @${size.width}: the payment fields are one column`,
			amountBox !== null && lessonsBox !== null && Math.abs(amountBox.x - lessonsBox.x) < 2,
			JSON.stringify({ amountBox, lessonsBox })
		)
		await measure(page, 'profile edit payment dialog', size)
		await shot(page, 'phone-profile', `${size.width}-edit-payment`)
		await closeDialog(page)
		await tap(page, page.getByRole('tab', { name: 'Overview', exact: true }))
		await page.waitForTimeout(700)
		await tap(page, page.getByRole('button', { name: 'Edit details', exact: true }))
		await fitDialog(page, size, 'profile edit details dialog')
		await measure(page, 'profile edit details dialog', size)
		await shot(page, 'phone-profile', `${size.width}-edit-details`)
		await closeDialog(page)
		await tap(page, page.getByRole('button', { name: 'Record payment', exact: true }))
		await fitDialog(page, size, 'profile record payment dialog')
		await measure(page, 'profile record payment dialog', size)
		await closeDialog(page)
	}
	const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
	check('profile: no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
}

async function sectionPalette({ page, apiOrigin, problems }) {
	const id = await makeCard(page, apiOrigin, LONG, false)
	await makeCard(page, apiOrigin, THIRD, false)
	for (const size of SIZES) {
		await page.setViewportSize(size)
		if (size.width === 320) await page.emulateMedia({ reducedMotion: 'reduce' })
		await page.goto(`${BASE}/`)
		await page.getByRole('button', { name: 'Search', exact: true }).first().waitFor({ timeout: 30000 })
		await page.waitForTimeout(800)
		await tap(page, page.getByRole('button', { name: 'Search', exact: true }).first())
		const palette = page.locator('[data-palette]')
		await palette.waitFor({ timeout: 15000 })
		await page.locator('[data-palette] [role="option"]').first().waitFor({ timeout: 15000 })
		const fit = await inWindow(palette, size)
		check(`palette @${size.width}: the palette fits the window`, fit.ok, JSON.stringify(fit.box))
		await measure(page, 'palette', size)
		await shot(page, 'phone-palette', `${size.width}`)
		await page.keyboard.type('Alex Example 2396')
		await page.waitForTimeout(700)
		const options = page.locator('[data-palette] [role="option"]')
		check(
			`palette @${size.width}: the search lists the long-named card`,
			(await options.count()) >= 1,
			String(await options.count())
		)
		await measure(page, 'palette search', size)
		await shot(page, 'phone-palette', `${size.width}-search`)
		const row = options.filter({ hasText: 'Alex Example 2396' }).first()
		await tap(page, row)
		await page.waitForURL(`${BASE}/students/${id}`, { timeout: 15000 })
		check(
			`palette @${size.width}: the tap on a student row opens the profile and closes the palette`,
			(await page.locator('[data-palette]').count()) === 0
		)
	}
	const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
	check('palette: no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
}

function calendarBlock(studentName, lessonStart) {
	return {
		type: 'calendar_proposal',
		actionId: randomUUID(),
		operation: 'move',
		studentName,
		timeZone: VN,
		lesson: { key: `l:${randomUUID()}`, startsAt: lessonStart, durationMinutes: 60 },
		target: { kind: 'lesson', startsAt: new Date(Date.parse(lessonStart) + DAY).toISOString(), durationMinutes: 60 },
		clearsNoShow: false,
		state: 'proposed',
		undo: null,
	}
}

function syntheticReply(conversation, body, proposal) {
	const now = new Date().toISOString()
	return {
		conversation,
		turn: null,
		messages: [
			{
				id: randomUUID(),
				role: 'teacher',
				body: body.text,
				mentions: body.mentions,
				blocks: [],
				steps: [],
				createdAt: now,
				finishedAt: null,
			},
			{
				id: randomUUID(),
				role: 'assistant',
				body: '',
				mentions: [],
				blocks: [proposal],
				steps: [],
				createdAt: now,
				finishedAt: now,
			},
		],
	}
}

async function mention(page, name) {
	await page.locator(FIELD).click()
	await page.keyboard.type(`@${name.split(' ').slice(0, 3).join(' ')}`)
	await page.locator(POPUP).waitFor({ timeout: 15000 })
}

async function sectionChat({ page, apiOrigin, problems, conversations }) {
	await makeCard(page, apiOrigin, LONG)
	let synthetic = false
	let conversation = null
	await page.route('**/api/chat/conversations/*/messages', async (route) => {
		if (!synthetic || route.request().method() !== 'POST') return route.fallback()
		synthetic = false
		const body = route.request().postDataJSON()
		const id = new URL(route.request().url()).pathname.split('/').at(-2)
		const read = await page.request
			.fetch(`${BASE}/api/chat/conversations/${id}`, { headers: { origin: apiOrigin } })
			.catch(() => null)
		conversation = conversation ?? (read ? (await read.json().catch(() => null))?.conversation : null)
		const lessonStart = new Date(Date.now() + 2 * DAY).toISOString()
		const proposal = calendarBlock(LONG, lessonStart)
		const fallbackConversation = conversation ?? {
			id,
			title: null,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		}
		return route.fulfill({ status: 201, json: syntheticReply(fallbackConversation, body, proposal) })
	})
	for (const size of SIZES) {
		await page.setViewportSize(size)
		if (size.width === 320) await page.emulateMedia({ reducedMotion: 'reduce' })
		await page.goto(`${BASE}/chat`)
		await page.getByRole('heading', { name: 'Chat', level: 1 }).waitFor({ timeout: 30000 })
		const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches)
		check(`chat @${size.width}: the context reports a coarse pointer`, coarse)
		await tap(page, page.getByRole('button', { name: 'New chat', exact: true }).first())
		const field = page.locator(FIELD)
		await field.waitFor({ timeout: 30000 })
		await page.locator('[data-slot="chat-commands"]').waitFor({ timeout: 15000 })
		const rows = await page.locator('[data-slot="chat-commands"] button').evaluateAll((nodes) =>
			nodes.map((node) => {
				const box = node.getBoundingClientRect()
				return { h: Math.round(box.height), inside: box.left >= 0 && box.right <= innerWidth }
			})
		)
		check(
			`chat @${size.width}: the command rows are 44 px high and inside the window`,
			rows.length > 0 && rows.every((row) => row.h >= 44 && row.inside),
			JSON.stringify(rows)
		)
		await measure(page, 'chat empty', size)
		await shot(page, 'phone-chat', `${size.width}-new`)
		const sendInside = async () => {
			const send = page.locator(SEND)
			const box = await send.boundingBox()
			return (
				box !== null &&
				box.x >= 0 &&
				box.x + box.width <= size.width + 0.5 &&
				box.y >= 0 &&
				box.y + box.height <= size.height + 0.5
			)
		}
		check(`chat @${size.width}: Send is inside the window`, await sendInside())
		await field.focus()
		await page.waitForTimeout(300)
		check(`chat @${size.width}: Send stays inside the window after the field takes focus`, await sendInside())
		await page.keyboard.type('word '.repeat(70))
		await page.waitForTimeout(400)
		const fieldBox = await field.boundingBox()
		check(
			`chat @${size.width}: a long draft keeps Send inside the window and the field below half the window`,
			(await sendInside()) && fieldBox !== null && fieldBox.height < size.height / 2,
			JSON.stringify(fieldBox)
		)
		await measure(page, 'chat long draft', size)
		await shot(page, 'phone-chat', `${size.width}-draft`)
		await page.keyboard.press('Meta+a')
		await page.keyboard.press('Backspace')

		await mention(page, LONG)
		const popupRows = await page.locator(`${POPUP} [role="option"]`).evaluateAll((nodes) =>
			nodes.map((node) => {
				const box = node.getBoundingClientRect()
				return { h: Math.round(box.height), inside: box.left >= 0 && box.right <= innerWidth }
			})
		)
		check(
			`chat mention popup @${size.width}: the rows are 44 px high and inside the window`,
			popupRows.length > 0 && popupRows.every((row) => row.h >= 44 && row.inside),
			JSON.stringify(popupRows)
		)
		const popupBox = await inWindow(page.locator(POPUP), size)
		check(`chat mention popup @${size.width}: the popup fits the window`, popupBox.ok, JSON.stringify(popupBox.box))
		check(
			`chat mention popup @${size.width}: the page does not scroll sideways`,
			await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
		)
		await page.keyboard.press('Enter')
		await page.locator(POPUP).waitFor({ state: 'detached', timeout: 5000 })
		await page.waitForTimeout(500)
		await page.keyboard.type(' [fake:payment] amount: 8000')
		const typed = await field.evaluate((node) => ('value' in node ? node.value : node.textContent))
		check(
			`chat @${size.width}: the draft holds the mention and the typed text`,
			typed.includes('[fake:payment]'),
			`${typed} / active ${await page.evaluate(() => document.activeElement?.getAttribute('data-slot') ?? document.activeElement?.localName)}`
		)
		await tap(page, page.locator(SEND))
		await page.locator(CHANGE).first().waitFor({ timeout: 30000 })
		await page.locator(SEND).waitFor({ timeout: 30000 })
		const id = new URL(page.url()).searchParams.get('c')
		if (id && !conversations.includes(id)) conversations.push(id)
		const proposal = page.locator(CHANGE).first()
		await proposal.scrollIntoViewIfNeeded()
		await page.waitForTimeout(500)
		const decisions = proposal.getByRole('button')
		const decisionCount = await decisions.count()
		const decisionFit = []
		for (let index = 0; index < decisionCount; index++) {
			const button = decisions.nth(index)
			await button.scrollIntoViewIfNeeded()
			const box = await button.boundingBox()
			const top = await button.evaluate((node) => {
				const rect = node.getBoundingClientRect()
				const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
				return hit === node || node.contains(hit)
			})
			const composerBox = await field.boundingBox()
			decisionFit.push(
				box !== null &&
					box.x >= 0 &&
					box.x + box.width <= size.width + 0.5 &&
					top &&
					(composerBox === null || box.y + box.height <= composerBox.y + 1)
			)
		}
		check(
			`chat @${size.width}: the decision buttons are fully visible and the composer does not cover them`,
			decisionCount >= 2 && decisionFit.every(Boolean),
			JSON.stringify(decisionFit)
		)
		await measure(page, 'chat payment proposal', size)
		await shot(page, 'phone-chat', `${size.width}-proposal`)

		await field.click()
		await page.keyboard.type(`${'W'.repeat(140)} and the wrapped tail`)
		await tap(page, page.locator(SEND))
		await page.locator(SEND).waitFor({ timeout: 30000 })
		await page.waitForTimeout(2500)
		await page.locator(SEND).waitFor({ timeout: 30000 })
		await measure(page, 'chat long message and answer', size)
		await shot(page, 'phone-chat', `${size.width}-long`)

		synthetic = true
		await mention(page, LONG)
		await page.keyboard.press('Enter')
		await page.locator(POPUP).waitFor({ state: 'detached', timeout: 5000 })
		await page.waitForTimeout(500)
		await page.keyboard.type(' synthetic')
		await tap(page, page.locator(SEND))
		await page.locator(CALENDAR_CHANGE).first().waitFor({ timeout: 15000 })
		const calendar = page.locator(CALENDAR_CHANGE).first()
		await calendar.scrollIntoViewIfNeeded()
		await page.waitForTimeout(500)
		const calendarButtons = calendar.getByRole('button')
		const calendarFit = []
		for (let index = 0; index < (await calendarButtons.count()); index++) {
			const button = calendarButtons.nth(index)
			await button.scrollIntoViewIfNeeded()
			const box = await button.boundingBox()
			const composerBox = await field.boundingBox()
			calendarFit.push(
				box !== null &&
					box.x >= 0 &&
					box.x + box.width <= size.width + 0.5 &&
					(composerBox === null || box.y + box.height <= composerBox.y + 1)
			)
		}
		check(
			`chat @${size.width}: the calendar proposal buttons are fully visible and above the composer`,
			calendarFit.length >= 2 && calendarFit.every(Boolean),
			JSON.stringify(calendarFit)
		)
		await measure(page, 'chat calendar proposal', size)
		await shot(page, 'phone-chat', `${size.width}-calendar`)
	}
	const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
	check('chat: no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
}

const sections = {
	today: sectionToday,
	schedule: sectionSchedule,
	chat: sectionChat,
	profile: sectionProfile,
	palette: sectionPalette,
}
const section = process.argv[2]
const run = sections[section]
if (!run) {
	console.log(`usage: node scripts/dev-checks/phone-web.mjs ${Object.keys(sections).join('|')} light|dark`)
	process.exit(2)
}

let browser
let lastPage = null
let fakeApi = null
const conversations = []
const teacher = sql(`select id from accounts where role = 'teacher' and status = 'active'`).rows[0]?.id
const period =
	section === 'chat' && teacher
		? sql(
				`select id, spent_nano::text as spent, held_nano::text as held from chat_budget_periods where account_id = ${q(teacher)} order by starts_on desc limit 1`
			).rows[0]
		: undefined
try {
	const apiOrigin = await detectApiOrigin()
	const health = await fetch('http://127.0.0.1:4000/healthz').catch(() => null)
	if (!health || health.status !== 200)
		throw new Error('the dev api does not answer on 4000: this script needs the dev stack')
	let chatPort = null
	if (section === 'chat') {
		chatPort = await freePort()
		fakeApi = await startFakeModelApi(chatPort)
	}
	removeFixtures()
	const opened = await openPhone()
	browser = opened.browser
	lastPage = opened.page
	await prepare(opened.page, apiOrigin, chatPort)
	await signInAs(opened.page)
	await run({ page: opened.page, apiOrigin, problems: opened.problems, conversations })
} catch (error) {
	check('section completed', false, String(error).slice(0, 1500))
	if (lastPage) await shot(lastPage, 'phone-failed', section).catch(() => undefined)
} finally {
	try {
		await browser?.close()
	} catch {}
	await stopApi(fakeApi)
	removeConversations(conversations)
	removeFixtures()
	if (period)
		sql(
			`update chat_budget_periods set spent_nano = ${period.spent}, held_nano = ${period.held} where id = '${period.id}'`
		)
}
console.log(`screenshots in ${STATE_DIR}`)
if (failures() === 0) console.log(`PHONE_WEB_${section.toUpperCase()}_OK`)
process.exit(failures())
