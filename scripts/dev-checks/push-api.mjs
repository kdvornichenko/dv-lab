import { spawn } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parseEnv } from 'node:util'

import {
	ENV_TEST,
	ROOT,
	STUDENT_LOGIN,
	TEACHER_LOGIN,
	call,
	quote,
	sql,
	startApi,
	studentCookie,
	teacherCookie,
} from './api.mjs'
import { removeCards } from './ledger-api/context.ts'

const PORT = 4271
const ENDPOINT_HOST = 'push.example.test'
const ENDPOINT_BASE = `https://${ENDPOINT_HOST}/dvlab-check/`
const SECTIONS = [
	'routes',
	'links',
	'settings',
	'presence',
	'config',
	'lessons',
	'payments',
	'suppress',
	'delivery',
	'assistant',
]
const API_SECTIONS = new Set([
	'routes',
	'settings',
	'presence',
	'config',
	'lessons',
	'payments',
	'suppress',
	'delivery',
	'assistant',
])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

let failures = 0

function check(name, ok, detail = '') {
	if (ok) console.log(`PASS ${name}`)
	else {
		failures++
		console.log(`FAIL ${name}${detail ? ` ${detail}` : ''}`)
	}
}

const fileEnv = parseEnv(readFileSync(ENV_TEST, 'utf8'))
const newEndpoint = () => `${ENDPOINT_BASE}${randomUUID()}`
const newKeys = () => ({ p256dh: randomBytes(65).toString('base64url'), auth: randomBytes(16).toString('base64url') })

const send = (api, method, path, cookie, body) =>
	call(api, method, path, {
		cookie,
		body,
		headers: body === undefined ? {} : { 'content-length': String(Buffer.byteLength(JSON.stringify(body))) },
	})

const CARD_PATTERN = 'Alex Example 260%'
const teacherAccounts = `select id from accounts where login = ${quote(TEACHER_LOGIN)}`

function cleanup() {
	sql(`delete from push_payment_alerts where account_id in (${teacherAccounts})`)
	sql(`delete from push_deliveries where account_id in (${teacherAccounts})`)
	removeCards(`display_name like ${quote(CARD_PATTERN)} and import_key is null`)
	sql(`delete from push_subscriptions where endpoint like ${quote(`${ENDPOINT_BASE}%`)}`)
}

const MINUTE = 60_000
const plus = (at, minutes) => new Date(at.getTime() + minutes * MINUTE)

const cardBody = (displayName) => ({
	displayName,
	rateMinor: 400000,
	currency: 'RUB',
	defaultLessonMinutes: 60,
	parent: null,
	level: null,
	goals: null,
	timeZone: null,
	gender: null,
})

async function makeCard(ctx, displayName) {
	const res = await send(ctx.api, 'POST', '/students', ctx.cookie, cardBody(displayName))
	if (res.status !== 201) throw new Error(`card create returned ${res.status}`)
	return res.json.student.id
}

function insertLesson(studentId, startsAt, { status = 'scheduled', minutes = 60 } = {}) {
	return sql(
		`insert into lessons (student_id, starts_at, duration_minutes, status) values (${quote(studentId)}, ${quote(startsAt.toISOString())}, ${minutes}, ${quote(status)}) returning id::text as id`
	).rows[0].id
}

function teacherAccountId() {
	const rows = sql(
		`select id::text as id from accounts where login = ${quote(TEACHER_LOGIN)} and status = 'active'`
	).rows
	if (rows.length !== 1) throw new Error('teacher fixture account missing')
	return rows[0].id
}

async function patchSettings(ctx, body) {
	const res = await send(ctx.api, 'PATCH', '/settings', ctx.cookie, body)
	if (res.status !== 200) throw new Error(`settings patch returned ${res.status}`)
	return res.json.settings
}

async function inProcess(ctx) {
	if (ctx.inProcess) return ctx.inProcess
	const { createDb } = await import(`${ROOT}/packages/db/src/index.ts`)
	const scheduler = await import(`${ROOT}/apps/api/src/push/scheduler.ts`)
	const pino = createRequire(`${ROOT}/apps/api/package.json`)('pino')
	const { pool, db } = createDb(fileEnv.DATABASE_URL)
	const logs = []
	const logger = pino({ level: 'info' }, { write: (line) => logs.push(line) })
	const sent = []
	const deliver = async (subscription, payload) => {
		sent.push({ subscriptionId: subscription.id, payload })
	}
	const tick = scheduler.createPushScheduler({ db, logger, deliver, paysEveryMs: 0 })
	ctx.inProcess = { pool, db, logs, logger, sent, tick, scheduler }
	return ctx.inProcess
}

async function ownSubscription(ctx, secondTimeZone) {
	const endpoint = newEndpoint()
	const res = await send(ctx.api, 'POST', '/push/subscriptions', ctx.cookie, {
		endpoint,
		keys: newKeys(),
		...(secondTimeZone ? { secondTimeZone } : {}),
	})
	if (res.status !== 201) throw new Error(`subscription create returned ${res.status}`)
	return { id: res.json.id, endpoint }
}

async function tickAt(ctx, at) {
	const { sent, tick } = await inProcess(ctx)
	const before = sent.length
	await tick.runOnce(at)
	return sent.slice(before)
}

const forLesson = (items, lessonId, subscriptionId) =>
	items.filter((item) => item.payload.url.includes(lessonId) && item.subscriptionId === subscriptionId)

async function lessons(ctx) {
	const original = (await send(ctx.api, 'GET', '/settings', ctx.cookie)).json.settings
	const zone = original.defaultTimeZone
	const links = await import(`${ROOT}/packages/contracts/src/links.ts`)
	const core = await import(`${ROOT}/packages/core/src/index.ts`)
	try {
		await patchSettings(ctx, { notifyLessonSoon: true, notifyLessonMinutes: 30 })
		const own = await ownSubscription(ctx, 'Europe/Moscow')
		const card = await makeCard(ctx, 'Alex Example 2600')
		const now = new Date()
		const soon = insertLesson(card, plus(now, 25))
		const later = insertLesson(card, plus(now, 40))

		const first = await tickAt(ctx, now)
		const soonItems = forLesson(first, soon, own.id)
		const expectedUrl = links.lessonLink(core.lessonDay(plus(now, 25), zone), { kind: 'single', lessonId: soon })
		check(
			'a lesson in 25 minutes with the 30 minute setting gives one delivery with title and link',
			soonItems.length === 1 &&
				soonItems[0].payload.title === 'Lesson with Alex Example 2600 in 25 minutes' &&
				soonItems[0].payload.url === expectedUrl,
			`count ${soonItems.length}`
		)
		check(
			'the body carries the teacher zone and the second zone of the device',
			soonItems.length === 1 &&
				(zone === 'Europe/Moscow'
					? /^[A-Z][a-z]{2}, \d{2}:\d{2} MSK$/.test(soonItems[0].payload.body)
					: /^[A-Z][a-z]{2}, \d{2}:\d{2} \S+ · \d{2}:\d{2} MSK$/.test(soonItems[0].payload.body))
		)
		check('a lesson in 40 minutes with the 30 minute setting waits', forLesson(first, later, own.id).length === 0)

		const second = await tickAt(ctx, now)
		check('the second tick sends nothing again', forLesson(second, soon, own.id).length === 0)

		sql(`update lessons set starts_at = starts_at + interval '1 hour', updated_at = now() where id = ${quote(soon)}`)
		const movedEarly = await tickAt(ctx, now)
		const movedDue = await tickAt(ctx, plus(now, 60))
		const movedItems = forLesson(movedDue, soon, own.id)
		check(
			'a lesson moved an hour later is reminded again at the new time',
			forLesson(movedEarly, soon, own.id).length === 0 &&
				movedItems.length === 1 &&
				movedItems[0].payload.title === 'Lesson with Alex Example 2600 in 25 minutes',
			`count ${movedItems.length}`
		)

		const cancelled = insertLesson(card, plus(now, 20), { status: 'cancelled' })
		const cancelledTick = await tickAt(ctx, now)
		check('a cancelled lesson sends nothing', forLesson(cancelledTick, cancelled, own.id).length === 0)

		await patchSettings(ctx, { notifyLessonSoon: false })
		const muted = insertLesson(card, plus(now, 15))
		const mutedTick = await tickAt(ctx, now)
		check('notify_lesson_soon off sends nothing', forLesson(mutedTick, muted, own.id).length === 0)

		await patchSettings(ctx, { notifyLessonSoon: true, notifyLessonMinutes: 45 })
		const widened = await tickAt(ctx, now)
		check(
			'the 45 minute setting saved through PATCH /settings sends the lesson in 40 minutes',
			forLesson(widened, later, own.id).length === 1
		)
	} finally {
		await patchSettings(ctx, {
			notifyLessonSoon: original.notifyLessonSoon,
			notifyLessonMinutes: original.notifyLessonMinutes,
			notifyPaysSoon: original.notifyPaysSoon,
		})
	}
}

const subscriptionRow = (endpoint) =>
	sql(
		`select account_id::text as account_id, revoked_at is not null as revoked, second_time_zone from push_subscriptions where endpoint = ${quote(endpoint)}`
	).rows

async function otherAccountId(api) {
	await studentCookie(api)
	const rows = sql(`select id::text as id from accounts where login = ${quote(STUDENT_LOGIN)}`).rows
	if (rows.length !== 1) throw new Error('student fixture account missing')
	return rows[0].id
}

function foreignSubscription(accountId) {
	const endpoint = newEndpoint()
	const keys = newKeys()
	sql(
		`insert into push_subscriptions (account_id, endpoint, p256dh, auth) values (${quote(accountId)}, ${quote(endpoint)}, ${quote(keys.p256dh)}, ${quote(keys.auth)})`,
		'app'
	)
	return endpoint
}

async function routes(ctx) {
	const { api, cookie } = ctx
	const hasVapid = fileEnv.PUSH_VAPID_PUBLIC_KEY !== undefined

	const anonymousConfig = await send(api, 'GET', '/push/config')
	const anonymousSubscribe = await send(api, 'POST', '/push/subscriptions', undefined, {
		endpoint: newEndpoint(),
		keys: newKeys(),
	})
	check(
		'without a session config and subscribe answer 401',
		anonymousConfig.status === 401 && anonymousSubscribe.status === 401,
		`${anonymousConfig.status} ${anonymousSubscribe.status}`
	)
	const studentConfig = await send(api, 'GET', '/push/config', await studentCookie(api))
	check('a student session gets 403', studentConfig.status === 403, String(studentConfig.status))

	const plain = await send(api, 'POST', '/push/subscriptions', cookie, {
		endpoint: `http://${ENDPOINT_HOST}/dvlab-check/${randomUUID()}`,
		keys: newKeys(),
	})
	const badKeys = await send(api, 'POST', '/push/subscriptions', cookie, {
		endpoint: newEndpoint(),
		keys: { p256dh: 'not base64 url!', auth: newKeys().auth },
	})
	const emptyAuth = await send(api, 'POST', '/push/subscriptions', cookie, {
		endpoint: newEndpoint(),
		keys: { p256dh: newKeys().p256dh, auth: '' },
	})
	check(
		'an http endpoint and malformed keys answer 400',
		plain.status === 400 && badKeys.status === 400 && emptyAuth.status === 400,
		`${plain.status} ${badKeys.status} ${emptyAuth.status}`
	)

	const endpoint = newEndpoint()
	const keys = newKeys()
	const created = await send(api, 'POST', '/push/subscriptions', cookie, {
		endpoint,
		keys,
		deviceLabel: 'Check device',
		secondTimeZone: 'Europe/Moscow',
	})
	check(
		'a new subscription answers 201 with an id',
		created.status === 201 && UUID.test(created.json?.id ?? ''),
		String(created.status)
	)
	const id = created.json?.id
	const repeated = await send(api, 'POST', '/push/subscriptions', cookie, { endpoint, keys })
	check(
		'the same subscription again answers 200 with the same id and one row',
		repeated.status === 200 && repeated.json?.id === id && subscriptionRow(endpoint).length === 1,
		String(repeated.status)
	)

	const config = await send(api, 'GET', '/push/config', cookie)
	const device = config.json?.devices?.find((item) => item.id === id)
	check(
		'GET /push/config lists the device as active with its label',
		config.status === 200 && device?.revoked === false && device?.deviceLabel === 'Check device',
		String(config.status)
	)
	check(
		'GET /push/config carries no endpoint',
		!JSON.stringify(config.json).includes(ENDPOINT_HOST) && device !== undefined && !('endpoint' in device)
	)
	check(
		'enabled and publicKey follow PUSH_VAPID_* of the check environment',
		config.json?.enabled === hasVapid &&
			(hasVapid ? config.json?.publicKey === fileEnv.PUSH_VAPID_PUBLIC_KEY : config.json?.publicKey === null),
		`enabled ${config.json?.enabled} expected ${hasVapid}`
	)
	check('GET /push/config is no-store', /no-store/.test(config.headers.get('cache-control') ?? ''))

	const removed = await send(api, 'DELETE', '/push/subscriptions', cookie, { endpoint })
	const afterRemove = await send(api, 'GET', '/push/config', cookie)
	check(
		'unsubscribe answers 204 and the device shows revoked',
		removed.status === 204 && afterRemove.json?.devices?.find((item) => item.id === id)?.revoked === true,
		String(removed.status)
	)
	const again = await send(api, 'POST', '/push/subscriptions', cookie, { endpoint, keys })
	const afterAgain = await send(api, 'GET', '/push/config', cookie)
	check(
		'subscribing again after unsubscribe clears revoked and keeps the id',
		again.status === 200 &&
			again.json?.id === id &&
			afterAgain.json?.devices?.find((item) => item.id === id)?.revoked === false,
		String(again.status)
	)

	const foreignAccount = await otherAccountId(api)
	const foreign = foreignSubscription(foreignAccount)
	const foreignRemove = await send(api, 'DELETE', '/push/subscriptions', cookie, { endpoint: foreign })
	const foreignTake = await send(api, 'POST', '/push/subscriptions', cookie, { endpoint: foreign, keys: newKeys() })
	const foreignRow = subscriptionRow(foreign)[0]
	check(
		'another account subscription is neither revoked nor taken over',
		foreignRemove.status === 204 &&
			foreignTake.status === 409 &&
			foreignRow?.revoked === false &&
			foreignRow?.account_id === foreignAccount,
		`${foreignRemove.status} ${foreignTake.status}`
	)
	const listed = await send(api, 'GET', '/push/config', cookie)
	const foreignId = sql(`select id::text as id from push_subscriptions where endpoint = ${quote(foreign)}`).rows[0]?.id
	check(
		'GET /push/config lists only own devices',
		listed.json?.devices?.every((item) => item.id !== foreignId) === true
	)
}

async function links() {
	const contracts = await import(`${ROOT}/packages/contracts/src/links.ts`)
	const web = await import(`${ROOT}/apps/web/lib/schedule-links.ts`)
	const lessonId = randomUUID()
	const seriesId = randomUUID()
	const studentId = randomUUID()
	const single = { kind: 'single', lessonId }
	const series = { kind: 'series', seriesId, originalOn: '2026-10-20' }
	const week = '2026-10-19'

	check(
		'lessonLink matches web lessonHref',
		contracts.lessonLink(week, single) === web.lessonHref(week, single) &&
			contracts.lessonLink(week, series) === web.lessonHref(week, series)
	)
	check(
		'lessonLink has the fixed shape',
		contracts.lessonLink(week, single) === `/schedule?week=${week}&lesson=single%3A${lessonId}` &&
			contracts.lessonLink(week, series) === `/schedule?week=${week}&lesson=series%3A${seriesId}%3A2026-10-20`
	)
	const roundTrip = (ref) => {
		const params = new URL(contracts.lessonLink(week, ref), 'http://localhost').searchParams
		return (
			params.get('week') === week && JSON.stringify(web.parseLessonRef(params.get('lesson'))) === JSON.stringify(ref)
		)
	}
	check('web parses the lesson ref of lessonLink back', roundTrip(single) && roundTrip(series))
	check(
		'studentPaymentsLink matches web studentHref with the payments tab',
		contracts.studentPaymentsLink(studentId) === web.studentHref(studentId, { tab: 'payments' }) &&
			contracts.studentPaymentsLink(studentId) === `/students/${studentId}?tab=payments`
	)
}

const notifyOf = (settings) => ({
	notifyLessonSoon: settings?.notifyLessonSoon,
	notifyLessonMinutes: settings?.notifyLessonMinutes,
	notifyPaysSoon: settings?.notifyPaysSoon,
})

async function settings(ctx) {
	const { api, cookie } = ctx
	const initial = await send(api, 'GET', '/settings', cookie)
	if (initial.status !== 200) throw new Error(`settings read returned ${initial.status}`)
	const original = initial.json.settings
	check(
		'GET /settings carries the three notification fields',
		typeof original.notifyLessonSoon === 'boolean' &&
			Number.isInteger(original.notifyLessonMinutes) &&
			typeof original.notifyPaysSoon === 'boolean'
	)
	try {
		const low = await send(api, 'PATCH', '/settings', cookie, { notifyLessonMinutes: 4 })
		const high = await send(api, 'PATCH', '/settings', cookie, { notifyLessonMinutes: 121 })
		const fraction = await send(api, 'PATCH', '/settings', cookie, { notifyLessonMinutes: 30.5 })
		const empty = await send(api, 'PATCH', '/settings', cookie, {})
		const unchanged = (await send(api, 'GET', '/settings', cookie)).json?.settings
		check(
			'minutes 4, 121 and 30.5 and an empty PATCH answer 400 and change nothing',
			[low, high, fraction, empty].every((res) => res.status === 400) &&
				JSON.stringify(notifyOf(unchanged)) === JSON.stringify(notifyOf(original)),
			[low, high, fraction, empty].map((res) => res.status).join(' ')
		)

		const minutes = await send(api, 'PATCH', '/settings', cookie, { notifyLessonMinutes: 45 })
		const readMinutes = (await send(api, 'GET', '/settings', cookie)).json?.settings
		check(
			'minutes 45 are saved and returned by GET /settings',
			minutes.status === 200 &&
				minutes.json?.settings?.notifyLessonMinutes === 45 &&
				readMinutes?.notifyLessonMinutes === 45,
			String(minutes.status)
		)
		const flags = await send(api, 'PATCH', '/settings', cookie, { notifyLessonSoon: false, notifyPaysSoon: false })
		const readFlags = (await send(api, 'GET', '/settings', cookie)).json?.settings
		check(
			'both switches are saved without touching the minutes',
			flags.status === 200 &&
				readFlags?.notifyLessonSoon === false &&
				readFlags?.notifyPaysSoon === false &&
				readFlags?.notifyLessonMinutes === 45,
			String(flags.status)
		)
		const legacy = await send(api, 'PATCH', '/settings', cookie, { paysSoonLessons: original.paysSoonLessons })
		check(
			'a PATCH without the new fields works and keeps them',
			legacy.status === 200 &&
				legacy.json?.settings?.paysSoonLessons === original.paysSoonLessons &&
				legacy.json?.settings?.defaultTimeZone === original.defaultTimeZone &&
				JSON.stringify(notifyOf(legacy.json?.settings)) ===
					JSON.stringify({ notifyLessonSoon: false, notifyLessonMinutes: 45, notifyPaysSoon: false }),
			String(legacy.status)
		)
	} finally {
		const restored = await send(api, 'PATCH', '/settings', cookie, notifyOf(original))
		if (restored.status !== 200) throw new Error(`settings restore returned ${restored.status}`)
	}

	const { createDb } = await import(`${ROOT}/packages/db/src/index.ts`)
	const { readTeacherSettings } = await import(`${ROOT}/apps/api/src/settings/settings.ts`)
	const { pool, db } = createDb(fileEnv.DATABASE_URL)
	try {
		const defaults = await readTeacherSettings(db, randomUUID())
		check(
			'without a settings row the notifications are on, 30 minutes, on',
			JSON.stringify(notifyOf(defaults)) ===
				JSON.stringify({ notifyLessonSoon: true, notifyLessonMinutes: 30, notifyPaysSoon: true })
		)
	} finally {
		await pool.end()
	}
}

async function presence(ctx) {
	const { api, cookie } = ctx
	const endpoint = newEndpoint()
	const created = await send(api, 'POST', '/push/subscriptions', cookie, {
		endpoint,
		keys: newKeys(),
		secondTimeZone: 'Europe/Moscow',
	})
	if (created.status !== 201) throw new Error(`subscription create returned ${created.status}`)

	const signal = await send(api, 'POST', '/push/presence', cookie, {
		endpoint,
		screen: 'schedule',
		secondTimeZone: 'Asia/Tokyo',
	})
	check(
		'a signal of an own subscription is accepted and updates the second zone',
		signal.status === 204 && subscriptionRow(endpoint)[0]?.second_time_zone === 'Asia/Tokyo',
		String(signal.status)
	)
	const plain = await send(api, 'POST', '/push/presence', cookie, {
		endpoint,
		screen: 'payments',
		studentId: randomUUID(),
	})
	check(
		'a signal without a zone keeps the stored zone',
		plain.status === 204 && subscriptionRow(endpoint)[0]?.second_time_zone === 'Asia/Tokyo',
		String(plain.status)
	)

	const foreign = foreignSubscription(await otherAccountId(api))
	const foreignSignal = await send(api, 'POST', '/push/presence', cookie, { endpoint: foreign, screen: 'schedule' })
	const unknownSignal = await send(api, 'POST', '/push/presence', cookie, {
		endpoint: newEndpoint(),
		screen: 'schedule',
	})
	check(
		'a foreign or unknown endpoint answers 404',
		foreignSignal.status === 404 && unknownSignal.status === 404,
		`${foreignSignal.status} ${unknownSignal.status}`
	)
	const anonymous = await send(api, 'POST', '/push/presence', undefined, { endpoint, screen: 'schedule' })
	const badScreen = await send(api, 'POST', '/push/presence', cookie, { endpoint, screen: 'today' })
	check(
		'without a session 401, an unknown screen 400',
		anonymous.status === 401 && badScreen.status === 400,
		`${anonymous.status} ${badScreen.status}`
	)
	await send(api, 'DELETE', '/push/subscriptions', cookie, { endpoint })
	const revoked = await send(api, 'POST', '/push/presence', cookie, { endpoint, screen: 'schedule' })
	check('a revoked subscription answers 404', revoked.status === 404, String(revoked.status))

	const { isPresent, recordPresence } = await import(`${ROOT}/apps/api/src/push/presence.ts`)
	const account = randomUUID()
	const device = newEndpoint()
	const other = newEndpoint()
	const studentA = randomUUID()
	const studentB = randomUUID()
	const now = Date.now()
	const at = (offset) => new Date(now + offset)
	recordPresence(account, device, 'schedule', null, at(0))
	check(
		'a fresh schedule signal is present for its device only',
		isPresent(device, 'schedule', null, at(1000)) === true && isPresent(other, 'schedule', null, at(1000)) === false
	)
	check('the schedule signal does not cover payments', isPresent(device, 'payments', studentA, at(1000)) === false)
	check(
		'a signal older than 90 s is not present',
		isPresent(device, 'schedule', null, at(90_000)) === true &&
			isPresent(device, 'schedule', null, at(91_000)) === false
	)
	recordPresence(account, device, 'payments', studentA, at(0))
	check(
		'payments of the same student are present, another student is not',
		isPresent(device, 'payments', studentA, at(1000)) === true &&
			isPresent(device, 'payments', studentB, at(1000)) === false &&
			isPresent(device, 'payments', null, at(1000)) === false
	)
}

const PUSH_NAMES = ['PUSH_VAPID_PUBLIC_KEY', 'PUSH_VAPID_PRIVATE_KEY', 'PUSH_VAPID_SUBJECT']
const SIDE_PORT = 4272
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function withoutPush(source) {
	const env = { ...source }
	for (const name of PUSH_NAMES) delete env[name]
	return env
}

async function spawnApi(push, nodeEnv = 'test') {
	const base = `http://127.0.0.1:${SIDE_PORT}`
	const env = {
		...withoutPush(process.env),
		...withoutPush(fileEnv),
		...push,
		NODE_ENV: nodeEnv,
		PORT: String(SIDE_PORT),
		APP_ORIGIN: base,
		LOG_LEVEL: 'info',
	}
	delete env.MIGRATOR_DATABASE_URL
	const child = spawn(process.execPath, ['apps/api/src/server.ts'], {
		cwd: ROOT,
		env,
		stdio: ['ignore', 'pipe', 'pipe'],
	})
	let output = ''
	let exit = null
	child.stdout.on('data', (chunk) => (output += chunk))
	child.stderr.on('data', (chunk) => (output += chunk))
	const exited = new Promise((resolve) =>
		child.on('exit', (code, signal) => {
			exit = { code, signal }
			resolve(exit)
		})
	)
	const api = { base, port: SIDE_PORT, logs: () => output }
	api.stop = async () => {
		if (exit) return exit
		child.kill('SIGTERM')
		if ((await Promise.race([exited, sleep(15000).then(() => 'timeout')])) === 'timeout') {
			child.kill('SIGKILL')
			await exited
		}
		return exit
	}
	const deadline = Date.now() + 20000
	while (Date.now() < deadline) {
		if (exit) return { started: false, exit, output }
		try {
			if ((await call(api, 'GET', '/healthz')).status === 200) return { started: true, api, output }
		} catch {}
		await sleep(200)
	}
	await api.stop()
	return { started: false, exit, output }
}

function leaks(text) {
	return PUSH_NAMES.slice(0, 2).some((name) => fileEnv[name] !== undefined && text.includes(fileEnv[name]))
}

async function config(ctx) {
	const { api, cookie } = ctx
	const hasPair = PUSH_NAMES.every((name) => fileEnv[name] !== undefined)
	check('the check environment holds the local VAPID pair', hasPair)

	const endpoint = newEndpoint()
	const created = await send(api, 'POST', '/push/subscriptions', cookie, { endpoint, keys: newKeys() })
	if (created.status !== 201) throw new Error(`subscription create returned ${created.status}`)
	const withPair = await send(api, 'GET', '/push/config', cookie)
	check(
		'api with the pair answers enabled true and the public key',
		withPair.status === 200 &&
			withPair.json?.enabled === true &&
			typeof withPair.json?.publicKey === 'string' &&
			withPair.json.publicKey.length > 0 &&
			withPair.json.publicKey === fileEnv.PUSH_VAPID_PUBLIC_KEY,
		`status ${withPair.status} enabled ${withPair.json?.enabled}`
	)
	check(
		'GET /push/config never carries the private key',
		!JSON.stringify(withPair.json).includes(fileEnv.PUSH_VAPID_PRIVATE_KEY ?? '\u0000')
	)

	const off = await spawnApi({})
	try {
		check('api without PUSH_VAPID_* starts', off.started, JSON.stringify(off.exit))
		if (off.started) {
			const offCookie = await teacherCookie(off.api)
			const disabled = await send(off.api, 'GET', '/push/config', offCookie)
			check(
				'api without PUSH_VAPID_* answers enabled false, publicKey null and still lists devices',
				disabled.status === 200 &&
					disabled.json?.enabled === false &&
					disabled.json?.publicKey === null &&
					disabled.json?.devices?.some((item) => item.id === created.json.id) === true,
				`status ${disabled.status} enabled ${disabled.json?.enabled}`
			)
		}
	} finally {
		if (off.started) await off.api.stop()
	}

	const badSubject = await spawnApi({
		PUSH_VAPID_PUBLIC_KEY: fileEnv.PUSH_VAPID_PUBLIC_KEY,
		PUSH_VAPID_PRIVATE_KEY: fileEnv.PUSH_VAPID_PRIVATE_KEY,
		PUSH_VAPID_SUBJECT: 'http://localhost',
	})
	if (badSubject.started) await badSubject.api.stop()
	check(
		'a subject that is not https stops the api with a config error',
		!badSubject.started && /Invalid push configuration/.test(badSubject.output) && !leaks(badSubject.output),
		JSON.stringify(badSubject.exit)
	)
	const partial = await spawnApi({ PUSH_VAPID_PUBLIC_KEY: fileEnv.PUSH_VAPID_PUBLIC_KEY })
	if (partial.started) await partial.api.stop()
	check(
		'one variable of three stops the api with a config error',
		!partial.started && /Invalid push configuration/.test(partial.output) && !leaks(partial.output),
		JSON.stringify(partial.exit)
	)
}

async function ledgerTools(ctx) {
	const settingsNow = (await send(ctx.api, 'GET', '/settings', ctx.cookie)).json.settings
	const zone = settingsNow.defaultTimeZone
	const core = await import(`${ROOT}/packages/core/src/index.ts`)
	const today = core.scheduleToday(new Date(), zone)
	const opening = async (studentId, lessonsHundredths) => {
		const res = await send(ctx.api, 'PUT', `/students/${studentId}/opening-balance`, ctx.cookie, {
			lessonsHundredths,
			on: core.addDays(today, -3),
			expectedDefaultTimeZone: zone,
		})
		if (res.status !== 200) throw new Error(`opening balance returned ${res.status}`)
	}
	const doneLesson = async (studentId, hoursAgo, minutes = 60) => {
		const lessonId = insertLesson(studentId, new Date(Date.now() - hoursAgo * 60 * MINUTE), { minutes })
		const res = await send(ctx.api, 'POST', `/schedule/lessons/${lessonId}/mark`, ctx.cookie, { kind: 'done' })
		if (res.status !== 200) throw new Error(`mark returned ${res.status}`)
	}
	const pay = async (studentId, lessonsHundredths) => {
		const res = await send(ctx.api, 'POST', '/payments', ctx.cookie, {
			studentId,
			paidOn: today,
			expectedDefaultTimeZone: zone,
			amountMinor: 100000,
			currency: 'RUB',
			lessonsHundredths,
		})
		if (res.status !== 201) throw new Error(`payment returned ${res.status}`)
	}
	return { settings: settingsNow, opening, doneLesson, pay }
}

const alertRow = (studentId) =>
	sql(
		`select armed, last_state from push_payment_alerts where student_id = ${quote(studentId)} and account_id in (${teacherAccounts})`
	).rows[0]

async function payments(ctx) {
	const tools = await ledgerTools(ctx)
	const original = tools.settings
	try {
		await patchSettings(ctx, { paysSoonLessons: 2, notifyPaysSoon: true })
		const own = await ownSubscription(ctx)
		const a = await makeCard(ctx, 'Alex Example 2601')
		const b = await makeCard(ctx, 'Alex Example 2602')
		const c = await makeCard(ctx, 'Alex Example 2603')
		const d = await makeCard(ctx, 'Alex Example 2604')
		const e = await makeCard(ctx, 'Alex Example 2605')
		const f = await makeCard(ctx, 'Alex Example 2606')
		for (const id of [a, c, d, f]) await tools.opening(id, 300)
		await tools.opening(b, 100)
		const now = () => new Date()
		const ours = (items, id) => forLesson(items, id, own.id)

		const first = await tickAt(ctx, now())
		check(
			'the first evaluation sends nothing and only records the state',
			[a, b, c, d, e, f].every((id) => ours(first, id).length === 0) &&
				alertRow(a)?.armed === true &&
				alertRow(a)?.last_state === 'plenty' &&
				alertRow(b)?.armed === false &&
				alertRow(b)?.last_state === 'pays_soon' &&
				alertRow(e) === undefined
		)

		await tools.doneLesson(a, 26)
		const reached = await tickAt(ctx, now())
		const reachedItems = ours(reached, a)
		check(
			'an armed student marked down to Pays soon gives one delivery',
			reachedItems.length === 1 &&
				reachedItems[0].payload.title === 'Alex Example 2601 has 2 lessons left' &&
				reachedItems[0].payload.body === 'Pays soon. Open payments to record a payment.' &&
				reachedItems[0].payload.url === `/students/${a}?tab=payments` &&
				alertRow(a)?.armed === false,
			`count ${reachedItems.length}`
		)
		const again = await tickAt(ctx, now())
		check('the next tick sends nothing again', ours(again, a).length === 0 && ours(again, b).length === 0)

		await tools.pay(a, 100)
		const rearmed = await tickAt(ctx, now())
		check(
			'a payment back to plenty re-arms without a delivery',
			ours(rearmed, a).length === 0 && alertRow(a)?.armed === true
		)
		await tools.doneLesson(a, 25)
		const second = await tickAt(ctx, now())
		check('a new transition to Pays soon gives a new delivery', ours(second, a).length === 1)

		await tools.doneLesson(c, 30, 240)
		const owes = await tickAt(ctx, now())
		check(
			'an armed student going straight to Owes sends nothing and is disarmed',
			ours(owes, c).length === 0 && alertRow(c)?.armed === false && alertRow(c)?.last_state === 'owes'
		)
		await tools.pay(c, 200)
		const partial = await tickAt(ctx, now())
		check(
			'a partial payment from debt up to Pays soon sends nothing',
			ours(partial, c).length === 0 && alertRow(c)?.last_state === 'pays_soon' && alertRow(c)?.armed === false
		)
		await tools.pay(c, 300)
		const plenty = await tickAt(ctx, now())
		check('a payment up to plenty arms again', ours(plenty, c).length === 0 && alertRow(c)?.armed === true)

		await tools.opening(d, 100)
		const archived = await send(ctx.api, 'POST', `/students/${d}/archive`, ctx.cookie)
		if (archived.status !== 200) throw new Error(`archive returned ${archived.status}`)
		await patchSettings(ctx, { notifyPaysSoon: false })
		await tools.opening(f, 100)
		const quiet = await tickAt(ctx, now())
		check(
			'an archived card, a card without opening balance and notify_pays_soon off send nothing',
			ours(quiet, d).length === 0 &&
				ours(quiet, e).length === 0 &&
				ours(quiet, f).length === 0 &&
				alertRow(e) === undefined
		)
	} finally {
		await patchSettings(ctx, {
			paysSoonLessons: original.paysSoonLessons,
			notifyLessonSoon: original.notifyLessonSoon,
			notifyLessonMinutes: original.notifyLessonMinutes,
			notifyPaysSoon: original.notifyPaysSoon,
		})
	}
}

async function suppress(ctx) {
	const tools = await ledgerTools(ctx)
	const original = tools.settings
	const { recordPresence } = await import(`${ROOT}/apps/api/src/push/presence.ts`)
	try {
		await patchSettings(ctx, {
			paysSoonLessons: 2,
			notifyPaysSoon: true,
			notifyLessonSoon: true,
			notifyLessonMinutes: 30,
		})
		const teacher = teacherAccountId()
		const one = await ownSubscription(ctx)
		const two = await ownSubscription(ctx)
		const card = await makeCard(ctx, 'Alex Example 2607')
		const now = new Date()

		const watched = insertLesson(card, plus(now, 20))
		recordPresence(teacher, one.endpoint, 'schedule', null, now)
		const fresh = await tickAt(ctx, now)
		check(
			'a fresh schedule signal mutes the lesson on its device only',
			forLesson(fresh, watched, one.id).length === 0 && forLesson(fresh, watched, two.id).length === 1
		)
		const stale = insertLesson(card, plus(now, 22))
		recordPresence(teacher, one.endpoint, 'schedule', null, new Date(now.getTime() - 91_000))
		const staleTick = await tickAt(ctx, now)
		check(
			'a signal older than 90 s does not mute',
			forLesson(staleTick, stale, one.id).length === 1 && forLesson(staleTick, stale, two.id).length === 1
		)

		const other = await makeCard(ctx, 'Alex Example 2608')
		const same = await makeCard(ctx, 'Alex Example 2609')
		await tools.opening(other, 300)
		await tools.opening(same, 300)
		await tickAt(ctx, new Date())
		await tools.opening(other, 100)
		recordPresence(teacher, one.endpoint, 'payments', same, new Date())
		const otherTick = await tickAt(ctx, new Date())
		check(
			'payments of another student do not mute the payment push',
			forLesson(otherTick, other, one.id).length === 1 && forLesson(otherTick, other, two.id).length === 1
		)
		await tools.opening(same, 100)
		recordPresence(teacher, one.endpoint, 'payments', same, new Date())
		const sameTick = await tickAt(ctx, new Date())
		check(
			'payments of the same student mute the payment push on that device',
			forLesson(sameTick, same, one.id).length === 0 && forLesson(sameTick, same, two.id).length === 1
		)
	} finally {
		await patchSettings(ctx, {
			paysSoonLessons: original.paysSoonLessons,
			notifyLessonSoon: original.notifyLessonSoon,
			notifyLessonMinutes: original.notifyLessonMinutes,
			notifyPaysSoon: original.notifyPaysSoon,
		})
	}
}

const pairEnv = () => Object.fromEntries(PUSH_NAMES.map((name) => [name, fileEnv[name]]))

async function schedulerStarts(push, nodeEnv) {
	const side = await spawnApi(push, nodeEnv)
	if (!side.started) return { started: false, scheduler: false }
	await sleep(500)
	const scheduler = side.api.logs().includes('push scheduler started')
	await side.api.stop()
	return { started: true, scheduler }
}

async function delivery(ctx) {
	const { db, logs, logger } = await inProcess(ctx)
	const { createWebPushDeliver } = await import(`${ROOT}/apps/api/src/push/deliver.ts`)
	const { activeSubscriptions } = await import(`${ROOT}/apps/api/src/push/subscriptions.ts`)
	const teacher = teacherAccountId()
	const ok = await ownSubscription(ctx)
	const gone = await ownSubscription(ctx)
	const missing = await ownSubscription(ctx)
	const broken = await ownSubscription(ctx)
	const statusFor = new Map([
		[ok.endpoint, 201],
		[gone.endpoint, 410],
		[missing.endpoint, 404],
		[broken.endpoint, 500],
	])
	const calls = []
	const fakeSend = async (subscription, body, options) => {
		calls.push({ body: JSON.parse(body), options })
		const statusCode = statusFor.get(subscription.endpoint)
		if (statusCode === 201) return { statusCode, body: '', headers: {} }
		const error = new Error(`Received unexpected response code from ${subscription.endpoint}`)
		Object.assign(error, { statusCode, endpoint: subscription.endpoint, body: 'push service said no' })
		throw error
	}
	const deliver = createWebPushDeliver({
		push: {
			enabled: true,
			publicKey: fileEnv.PUSH_VAPID_PUBLIC_KEY,
			privateKey: fileEnv.PUSH_VAPID_PRIVATE_KEY,
			subject: fileEnv.PUSH_VAPID_SUBJECT,
		},
		db,
		logger,
		send: fakeSend,
	})
	const payload = {
		title: 'Lesson with Alex Example 2600 in 25 minutes',
		body: 'Mon, 18:00 VN',
		tag: 'lesson:check',
		url: '/schedule?week=2026-10-19',
	}
	const logsBefore = logs.length
	const targets = (await activeSubscriptions(db, teacher)).filter((item) =>
		[ok.id, gone.id, missing.id, broken.id].includes(item.id)
	)
	for (const subscription of targets) await deliver(subscription, payload)
	const state = (id) =>
		sql(
			`select last_success_at is not null as success, failed_at is not null as failed, revoked_at is not null as revoked from push_subscriptions where id = ${quote(id)}`
		).rows[0]
	check(
		'web-push gets the payload with VAPID details, TTL and a timeout',
		calls.length === 4 &&
			calls.every(
				(item) =>
					item.body.title === payload.title &&
					item.body.url === payload.url &&
					item.options.TTL === 600 &&
					item.options.timeout > 0 &&
					item.options.vapidDetails?.subject === fileEnv.PUSH_VAPID_SUBJECT
			),
		`calls ${calls.length}`
	)
	check('201 records last_success_at', state(ok.id)?.success === true && state(ok.id)?.revoked === false)
	const active = (await activeSubscriptions(db, teacher)).map((item) => item.id)
	check(
		'410 and 404 revoke the subscription and it is no longer selected',
		state(gone.id)?.revoked === true &&
			state(missing.id)?.revoked === true &&
			!active.includes(gone.id) &&
			!active.includes(missing.id) &&
			active.includes(ok.id)
	)
	check(
		'500 records failed_at and keeps the subscription',
		state(broken.id)?.failed === true && active.includes(broken.id)
	)
	const written = logs.slice(logsBefore).join('\n')
	check(
		'the delivery log carries subscription ids and codes, no endpoint, name or service answer',
		written.includes(gone.id) &&
			written.includes('"statusCode":410') &&
			!written.includes(ENDPOINT_HOST) &&
			!written.includes('Alex Example') &&
			!written.includes('push service said no')
	)

	const withPair = await schedulerStarts(pairEnv(), 'development')
	const withoutPair = await schedulerStarts({}, 'development')
	check(
		'api with the pair starts the push scheduler, without the pair it does not',
		withPair.started && withPair.scheduler && withoutPair.started && !withoutPair.scheduler,
		JSON.stringify({ withPair, withoutPair })
	)
	check('the check api under NODE_ENV test keeps the scheduler off', !ctx.api.logs().includes('push scheduler started'))
}

async function assistant(ctx) {
	const { db, logger } = await inProcess(ctx)
	const { createAssistantNotifier } = await import(`${ROOT}/apps/api/src/push/assistant.ts`)
	const presenceModule = await import(`${ROOT}/apps/api/src/push/presence.ts`)
	const { chatLink } = await import(`${ROOT}/packages/contracts/src/index.ts`)
	const { readTeacherSettings } = await import(`${ROOT}/apps/api/src/settings/settings.ts`)
	const accountId = teacherAccountId()
	const own = await ownSubscription(ctx)
	const deliveries = []
	const notify = createAssistantNotifier({
		db,
		logger,
		deliver: async (subscription, payload) => {
			deliveries.push({ subscriptionId: subscription.id, payload })
		},
	})
	const conversationId = randomUUID()
	const event = (waiting) => ({ accountId, conversationId, title: 'Past simple practice', waiting })
	const mine = () => deliveries.filter((item) => item.subscriptionId === own.id)

	const initial = (await send(ctx.api, 'GET', '/settings', ctx.cookie)).json?.settings
	check('GET /settings carries the notifyAssistant switch', typeof initial?.notifyAssistant === 'boolean')
	const defaults = await readTeacherSettings(db, randomUUID())
	check('without a settings row the assistant push is off', defaults.notifyAssistant === false)
	await patchSettings(ctx, { notifyAssistant: true })
	check('the chat link is /?chat=<id>', chatLink(conversationId) === `/?chat=${conversationId}`)

	await notify(event(false))
	const ready = mine().at(-1)?.payload
	check(
		'a finished turn pushes "Reply is ready" with the chat title, a chat tag and the chat link',
		mine().length === 1 &&
			ready.title === 'Reply is ready' &&
			ready.body === 'Past simple practice' &&
			ready.tag === `chat:${conversationId}` &&
			ready.url === `/?chat=${conversationId}`,
		JSON.stringify(ready)
	)
	await notify(event(true))
	const waiting = mine().at(-1)?.payload
	check(
		'a proposal that waits pushes "Waiting for your decision" under the same tag',
		mine().length === 2 && waiting.title === 'Waiting for your decision' && waiting.tag === ready.tag,
		JSON.stringify(waiting)
	)
	check('the push carries no reply text', Object.keys(waiting).sort().join() === 'body,tag,title,url')

	try {
		const off = await patchSettings(ctx, { notifyAssistant: false })
		await notify(event(false))
		check('with the switch off nothing is pushed', off.notifyAssistant === false && mine().length === 2)
	} finally {
		const on = await patchSettings(ctx, { notifyAssistant: true })
		check('the switch is turned on again', on.notifyAssistant === true)
	}

	const front = await ownSubscription(ctx)
	presenceModule.recordPresence(accountId, front.endpoint, 'other', null)
	const before = deliveries.length
	await notify(event(false))
	const added = deliveries.slice(before)
	check(
		'a device with a fresh presence signal gets nothing, the other device does',
		added.some((item) => item.subscriptionId === own.id) && !added.some((item) => item.subscriptionId === front.id),
		JSON.stringify(added.map((item) => item.subscriptionId))
	)
	await patchSettings(ctx, { notifyAssistant: initial.notifyAssistant })
}

const RUNNERS = { routes, links, settings, presence, config, lessons, payments, suppress, delivery, assistant }

const wanted = process.argv.slice(2)
const selected = wanted.length === 0 ? SECTIONS : wanted
for (const name of selected) if (!RUNNERS[name]) throw new Error(`unknown section ${name}`)

let api = null
const ctx = {}
try {
	if (selected.some((name) => API_SECTIONS.has(name))) {
		cleanup()
		api = await startApi({ port: PORT })
		ctx.api = api
		ctx.cookie = await teacherCookie(api)
	}
	for (const name of selected) {
		console.log(`-- ${name}`)
		await RUNNERS[name](ctx)
	}
} finally {
	if (ctx.inProcess) {
		await ctx.inProcess.tick.close()
		await ctx.inProcess.pool.end()
	}
	if (api) {
		await api.stop()
		cleanup()
	}
}

if (failures > 0) {
	console.log(`FAILURES ${failures}`)
	process.exit(1)
}
console.log(wanted.length === 0 ? 'PUSH_API_OK' : `PUSH_API_SECTIONS_OK ${selected.join(' ')}`)
