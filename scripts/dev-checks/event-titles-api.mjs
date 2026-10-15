import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parseEnv } from 'node:util'

import { createApp } from '../../apps/api/src/app.ts'
import { createSignIn } from '../../apps/api/src/auth/sign-in.ts'
import { createEventTitles } from '../../apps/api/src/calendar/event-titles.ts'
import { CalendarFault } from '../../apps/api/src/calendar/gateway.ts'
import { createDb, resolveDatabaseUrl } from '../../packages/db/src/index.ts'
import { ENV_TEST, call, teacherCookie } from './api.mjs'

const apiRequire = createRequire(new URL('../../apps/api/package.json', import.meta.url))
const pino = apiRequire('pino')
const { serve } = apiRequire('@hono/node-server')

const GATEWAY_SOURCE = readFileSync(new URL('../../apps/api/src/calendar/gateway.ts', import.meta.url), 'utf8')
const PORT = 4231
const CALENDAR = 'synthetic-calendar'
let failures = 0
function check(name, ok, detail = '') {
	console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`)
	if (!ok) failures++
}

const url = resolveDatabaseUrl('app', { ...parseEnv(readFileSync(ENV_TEST, 'utf8')), NODE_ENV: 'test' })
const { pool, db } = createDb(url)
const logger = pino({ level: 'silent' })

let mode = 'ok'
let evicted = 0
const calls = []
const pages = {
	first: {
		nextPageToken: 'page-2',
		items: [
			{ status: 'confirmed', summary: 'Екатерина', start: { dateTime: '2026-06-01T10:00:00+07:00' } },
			{
				status: 'confirmed',
				summary: 'Alex Example 0001',
				description: 'hidden-description',
				start: { dateTime: '2026-06-05T18:00:00+07:00' },
				end: { dateTime: '2026-06-05T19:30:00+07:00' },
			},
			{ status: 'tentative', summary: 'Екатерина', start: { dateTime: '2026-07-03T18:00:00+07:00' } },
		],
	},
	'page-2': {
		items: [
			{ status: 'confirmed', summary: 'Eкатерина', start: { dateTime: '2026-08-31T09:00:00+07:00' } },
			{ status: 'confirmed', start: { date: '2026-08-10' }, end: { date: '2026-08-11' } },
			{ status: 'confirmed', summary: 'Outside', start: { dateTime: '2026-09-01T09:00:00+07:00' } },
		],
	},
}

const eventTitles = createEventTitles({
	db,
	credentials: {
		async accessToken(_accountId, signal) {
			if (mode === 'disconnected') throw new CalendarFault('connection_required')
			return { accessToken: 'synthetic-token', connection: { calendarId: CALENDAR }, db, signal }
		},
		evict() {
			evicted++
		},
	},
	source: {
		async eventTitles(token, query) {
			calls.push({ token, ...query })
			if (mode === 'reconnect') throw new CalendarFault('reconnect_required')
			if (mode === 'down') throw new CalendarFault('provider_unavailable')
			if (mode === 'loop') return { nextPageToken: 'same', items: [] }
			return pages[query.pageToken ?? 'first']
		},
	},
})

const app = createApp({
	logger,
	db,
	gitSha: 'check',
	appOrigin: `http://127.0.0.1:${PORT}`,
	production: false,
	isStopping: () => false,
	signIn: createSignIn({ db, logger, requireClientIp: false }),
	eventTitles,
})
const server = serve({ fetch: app.fetch, port: PORT })
const api = { base: `http://127.0.0.1:${PORT}`, port: PORT }

try {
	const cookie = await teacherCookie(api)
	const path = '/schedule/event-titles?from=2026-06-01&to=2026-08-31'

	const anonymous = await call(api, 'GET', path)
	check('anonymous request is refused', anonymous.status === 401, anonymous.status)

	const ok = await call(api, 'GET', path, { cookie })
	check('summer range answers 200', ok.status === 200, ok.status)
	check('two pages are read', calls.length === 2, calls.length)
	check(
		'query uses the connected calendar and lesson-day bounds',
		calls[0]?.calendarId === CALENDAR && calls[0]?.token === 'synthetic-token' && calls[1]?.pageToken === 'page-2',
		JSON.stringify({ timeMin: calls[0]?.timeMin, timeMax: calls[0]?.timeMax })
	)
	const events = ok.json?.events ?? []
	const timedKeys = ['day,durationMinutes,time,title', 'day,time,title']
	check(
		'titles, days, times and lengths only',
		events.every((item) =>
			(typeof item.time === 'string' ? timedKeys : ['day,title']).includes(Object.keys(item).sort().join())
		),
		JSON.stringify(events.map((item) => Object.keys(item).sort().join()))
	)
	const timed = events.find((item) => item.title === 'Alex Example 0001')
	check(
		'timed event has the teacher-zone start and its length',
		timed?.day === '2026-06-05' && timed?.time === '18:00' && timed?.durationMinutes === 90,
		JSON.stringify(timed)
	)
	check(
		'timed event without end has a time and no length',
		events.some((item) => item.day === '2026-06-01' && item.time === '10:00' && !('durationMinutes' in item))
	)
	const allDay = events.find((item) => item.title === null && item.day === '2026-08-10')
	check(
		'all-day event has no time and no length',
		allDay !== undefined && !('time' in allDay) && !('durationMinutes' in allDay),
		JSON.stringify(allDay)
	)
	check('description is not returned', !JSON.stringify(ok.json).includes('hidden-description'))
	check(
		'events.list asks for start and end, without description',
		/fields: 'nextPageToken,items\(status,summary,start,end\)'/.test(GATEWAY_SOURCE)
	)
	check('out-of-range event is dropped', events.length === 5, events.length)
	check(
		'Екатерина in June and July',
		events
			.filter((item) => item.title === 'Екатерина')
			.map((item) => item.day)
			.join() === '2026-06-01,2026-07-03'
	)
	check(
		'untitled event keeps null title',
		events.some((item) => item.title === null && item.day === '2026-08-10')
	)
	check('no-store header', ok.headers.get('cache-control')?.includes('no-store'))

	for (const [query, name] of [
		['from=2026-08-31&to=2026-06-01', 'reversed range'],
		['from=2026-01-01&to=2027-02-05', '401 days'],
		['from=2026-06-01', 'missing end'],
	]) {
		const res = await call(api, 'GET', `/schedule/event-titles?${query}`, { cookie })
		check(`${name} answers 400 invalid_request`, res.status === 400 && res.json?.error?.code === 'invalid_request')
	}

	for (const [next, status, code] of [
		['reconnect', 409, 'reconnect_required'],
		['disconnected', 409, 'connection_required'],
		['down', 503, 'provider_unavailable'],
		['loop', 503, 'invalid_provider_data'],
	]) {
		mode = next
		const res = await call(api, 'GET', path, { cookie })
		check(`${next} answers ${status} ${code}`, res.status === status && res.json?.error?.code === code, res.status)
	}
	check('reconnect evicts the cached token', evicted === 1, evicted)
} finally {
	server.close()
	await pool.end()
}

console.log(failures ? `EVENT_TITLES_API_FAILED ${failures}` : 'EVENT_TITLES_API_OK')
process.exit(failures ? 1 : 0)
