import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

import { ENV_TEST, ROOT, STUDENT_LOGIN, call, quote, sql, startApi, studentCookie, teacherCookie } from './api.mjs'

const PORT = 4271
const ENDPOINT_HOST = 'push.example.test'
const ENDPOINT_BASE = `https://${ENDPOINT_HOST}/dvlab-check/`
const SECTIONS = ['routes', 'links', 'settings', 'presence']
const API_SECTIONS = new Set(['routes', 'settings', 'presence'])
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

const cleanup = () => sql(`delete from push_subscriptions where endpoint like ${quote(`${ENDPOINT_BASE}%`)}`)

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
	check('a new subscription answers 201 with an id', created.status === 201 && UUID.test(created.json?.id ?? ''), String(created.status))
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
		'encodeLessonRef matches web for single and series lessons',
		contracts.encodeLessonRef(single) === web.encodeLessonRef(single) &&
			contracts.encodeLessonRef(series) === web.encodeLessonRef(series)
	)
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
		return params.get('week') === week && JSON.stringify(web.parseLessonRef(params.get('lesson'))) === JSON.stringify(ref)
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
			minutes.status === 200 && minutes.json?.settings?.notifyLessonMinutes === 45 && readMinutes?.notifyLessonMinutes === 45,
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
	const unknownSignal = await send(api, 'POST', '/push/presence', cookie, { endpoint: newEndpoint(), screen: 'schedule' })
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
	check(
		'the schedule signal does not cover payments',
		isPresent(device, 'payments', studentA, at(1000)) === false
	)
	check(
		'a signal older than 90 s is not present',
		isPresent(device, 'schedule', null, at(90_000)) === true && isPresent(device, 'schedule', null, at(91_000)) === false
	)
	recordPresence(account, device, 'payments', studentA, at(0))
	check(
		'payments of the same student are present, another student is not',
		isPresent(device, 'payments', studentA, at(1000)) === true &&
			isPresent(device, 'payments', studentB, at(1000)) === false &&
			isPresent(device, 'payments', null, at(1000)) === false
	)
}

const RUNNERS = { routes, links, settings, presence }

const wanted = process.argv.slice(2)
const selected = wanted.length === 0 ? SECTIONS : wanted
for (const name of selected) if (!RUNNERS[name]) throw new Error(`unknown section ${name}`)

let api = null
try {
	const ctx = {}
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
