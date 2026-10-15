import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parseEnv } from 'node:util'

import { createApp } from '../../apps/api/src/app.ts'
import { createSignIn } from '../../apps/api/src/auth/sign-in.ts'
import { createEventTitles } from '../../apps/api/src/calendar/event-titles.ts'
import { CalendarFault } from '../../apps/api/src/calendar/gateway.ts'
import { CHAT_TOOL_ENTRIES, runTool } from '../../apps/api/src/chat/tools.ts'
import { createDb, resolveDatabaseUrl } from '../../packages/db/src/index.ts'
import { ENV_TEST, TEACHER_LOGIN, call, quote, sql, teacherCookie } from './api.mjs'

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

const CYRILLIC = { A: 'А', a: 'а', E: 'Е', e: 'е', x: 'х', m: 'м', p: 'р' }
const lookalike = (text) => text.replace(/[AaEexmp]/g, (letter) => CYRILLIC[letter])
const MANY = 35
pages.many = {
	items: Array.from({ length: MANY }, (_, index) => {
		const day = `2026-06-${String((index % 30) + 1).padStart(2, '0')}`
		return {
			status: 'confirmed',
			summary: index % 2 === 0 ? lookalike('Alex Example 0002') : 'ALEX EXAMPLE 0002',
			start: { dateTime: `${day}T09:00:00+07:00` },
			end: { dateTime: `${day}T09:45:00+07:00` },
		}
	}),
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
			if (mode === 'many') return pages.many
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

	const accountId = sql(`select id from accounts where login = ${quote(TEACHER_LOGIN)} and role = 'teacher'`).rows[0]
		?.id
	const tool = async (input, titles = eventTitles) => {
		const outcome = await runTool(
			{
				db,
				chat: { accountId, now: new Date(), defaultTimeZone: 'Asia/Ho_Chi_Minh', calendarEnabled: true },
				source: { conversationId: null, messageId: null },
				persist: async () => {},
				issued: new Map(),
				shown: new Set(),
				essay: false,
				eventTitles: titles ?? undefined,
			},
			'calendar_events',
			input
		)
		return { ...outcome, json: JSON.parse(outcome.content) }
	}
	const summer = { from: '2026-06-01', to: '2026-08-31' }
	const entry = CHAT_TOOL_ENTRIES.find((item) => item.name === 'calendar_events')
	check(
		'calendar_events is a read tool with a period step and no student',
		entry?.effect === 'read' && entry.step?.student === null && entry.step?.period === 'range'
	)

	mode = 'ok'
	const named = await tool({ ...summer, title: 'екатерина' })
	const namedRecords = named.json.records ?? []
	check(
		'title filter ignores case and Latin lookalikes',
		!named.isError && namedRecords.map((item) => item.date).join() === '2026-06-01,2026-07-03,2026-08-31',
		named.content
	)
	check(
		'records carry date, time, length and title only',
		namedRecords.every((item) => Object.keys(item).sort().join() === 'date,duration_minutes,time,title') &&
			named.json.more === 0
	)
	const alex = await tool({ ...summer, title: 'ALEX example' })
	check(
		'timed match has HH:MM and duration_minutes',
		alex.json.records?.length === 1 &&
			alex.json.records[0].date === '2026-06-05' &&
			alex.json.records[0].time === '18:00' &&
			alex.json.records[0].duration_minutes === 90,
		alex.content
	)
	check('description never reaches the model', !alex.content.includes('hidden-description'))
	const blank = await tool({ ...summer, title: '   ' })
	check('blank title is refused', blank.isError && blank.json.error === 'invalid_arguments', blank.content)

	const before = calls.length
	const tooLong = await tool({ from: '2026-01-01', to: '2027-02-05', title: 'Alex' })
	check(
		'401 days are refused before Google is read',
		tooLong.isError && tooLong.json.error === 'range_too_long' && calls.length === before,
		tooLong.content
	)
	const longest = await tool({ from: '2026-01-01', to: '2027-02-04', title: 'Alex' })
	check('400 days are read', !longest.isError && calls.length > before, longest.content)

	mode = 'many'
	const many = await tool({ ...summer, title: 'alex example 0002' })
	const manyRecords = many.json.records ?? []
	check(
		`${MANY} matches give 30 records and the number of the rest`,
		manyRecords.length === 30 && many.json.more === MANY - 30,
		JSON.stringify({ records: manyRecords.length, more: many.json.more })
	)
	check(
		'both lookalike spellings match',
		manyRecords.some((item) => item.title === 'ALEX EXAMPLE 0002') &&
			manyRecords.some((item) => item.title === lookalike('Alex Example 0002'))
	)
	check(
		'records are in date order',
		manyRecords.every((item, index) => index === 0 || manyRecords[index - 1].date <= item.date)
	)

	for (const [next, code] of [
		['disconnected', 'calendar_not_connected'],
		['reconnect', 'calendar_not_connected'],
		['down', 'calendar_unavailable'],
	]) {
		mode = next
		const res = await tool({ ...summer, title: 'Alex' })
		check(`calendar_events ${next} answers ${code}`, res.isError && res.json.error === code, res.content)
	}
	const off = await tool({ ...summer, title: 'Alex' }, null)
	check(
		'calendar_events without the calendar answers calendar_not_connected',
		off.isError && off.json.error === 'calendar_not_connected',
		off.content
	)
} finally {
	server.close()
	await pool.end()
}

console.log(failures ? `EVENT_TITLES_API_FAILED ${failures}` : 'EVENT_TITLES_API_OK')
process.exit(failures ? 1 : 0)
