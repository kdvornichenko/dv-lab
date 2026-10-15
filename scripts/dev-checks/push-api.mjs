import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

import { ENV_TEST, ROOT, STUDENT_LOGIN, call, quote, sql, startApi, studentCookie, teacherCookie } from './api.mjs'

const PORT = 4271
const ENDPOINT_HOST = 'push.example.test'
const ENDPOINT_BASE = `https://${ENDPOINT_HOST}/dvlab-check/`
const SECTIONS = ['routes', 'links']
const API_SECTIONS = new Set(['routes'])
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

const RUNNERS = { routes, links }

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
