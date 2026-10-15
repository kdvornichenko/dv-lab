import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parseEnv } from 'node:util'

import { createApp } from '../../apps/api/src/app.ts'
import { createSignIn } from '../../apps/api/src/auth/sign-in.ts'
import { createEventTitles } from '../../apps/api/src/calendar/event-titles.ts'
import { CalendarFault } from '../../apps/api/src/calendar/gateway.ts'
import { checkSentence, gateContext, learnNames, learnWhen } from '../../apps/api/src/chat/publish-gate.ts'
import { CHAT_TOOL_ENTRIES, runTool } from '../../apps/api/src/chat/tools.ts'
import { chatBlock } from '../../packages/contracts/src/chat.ts'
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

const NAMES = [
	['2026-06-02', 'Екатерина'],
	['2026-06-09', 'Екатерина'],
	['2026-06-16', 'Yekaterina IELTS 7.5'],
	['2026-06-23', 'Jekaterina'],
	['2026-06-30', 'Катя speaking'],
	['2026-07-07', 'Katya'],
	['2026-07-14', 'Ekatarina'],
	['2026-07-21', 'Яна'],
	['2026-07-28', 'Ангелика'],
	['2026-08-04', 'Ирина'],
	['2026-08-11', 'Other'],
	['2026-08-18', 'Иван'],
]
pages.names = {
	items: NAMES.map(([day, summary]) => ({
		status: 'confirmed',
		summary,
		start: { dateTime: `${day}T10:00:00+07:00` },
		end: { dateTime: `${day}T11:30:00+07:00` },
	})),
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
			if (mode === 'names') return pages.names
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
		'calendar_events is a read-only show tool with a period step, no student and not strict',
		entry?.effect === 'show' &&
			entry.strict === false &&
			entry.optional.join() === 'title,merge' &&
			entry.step?.student === null &&
			entry.step?.period === 'range'
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
		'records carry date, start and end time, length and title only',
		namedRecords.every((item) => Object.keys(item).sort().join() === 'date,duration_minutes,end_time,time,title') &&
			named.json.more === 0
	)
	check(
		'one spelling with a Latin lookalike stays one group in a valid calendar_events block',
		entry?.effect === 'show' &&
			chatBlock.safeParse(named.block).success &&
			named.block?.type === 'calendar_events' &&
			named.block.groups.length === 1 &&
			named.block.groups[0].events.map((item) => item.date).join() === '2026-06-01,2026-07-03,2026-08-31' &&
			named.json.shown === true,
		JSON.stringify(named.block)
	)

	const everything = await tool(summer)
	check(
		'no title reads every titled event of the period as one group',
		!everything.isError &&
			everything.json.records.length === 4 &&
			everything.block?.groups.length === 1 &&
			everything.block.groups[0].title === null &&
			everything.block.query === null &&
			everything.block.merged === true &&
			everything.block.groups[0].events.length === 4,
		everything.content
	)
	const nullTitle = await tool({ ...summer, title: null })
	check('title null is the same as no title', nullTitle.json.records?.length === 4, nullTitle.content)
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

	mode = 'names'
	const fuzzy = await tool({ ...summer, title: 'Екатерина' })
	const groups = fuzzy.block?.groups ?? []
	check(
		'the search finds other spellings and short forms and groups them by spelling',
		chatBlock.safeParse(fuzzy.block).success &&
			groups.map((group) => `${group.title}:${group.events.map((item) => item.date).join('+')}`).join() ===
				'Екатерина:2026-06-02+2026-06-09,Yekaterina:2026-06-16,Jekaterina:2026-06-23,Катя:2026-06-30,Katya:2026-07-07,Ekatarina:2026-07-14',
		JSON.stringify(groups.map((group) => [group.title, group.events.length]))
	)
	check(
		'group events keep the full title and the start time',
		groups[1]?.events[0]?.title === 'Yekaterina IELTS 7.5' && groups[1]?.events[0]?.time === '10:00'
	)
	const fuzzyTitles = (fuzzy.json.records ?? []).map((item) => item.title).join('|')
	check(
		'threshold negatives stay out: Яна, Ангелика, Ирина and Other',
		!/Яна|Ангелика|Ирина|Other/.test(fuzzyTitles) && fuzzy.json.groups?.length === 6,
		fuzzyTitles
	)
	check(
		'the model is told about the block and the merge',
		/block with a copy button/.test(fuzzy.json.note ?? '') && /merge true/.test(fuzzy.json.note ?? '')
	)
	const merged = await tool({ ...summer, title: 'Екатерина', merge: true })
	check(
		'merge true gives one group of every match labelled by the request',
		merged.block?.merged === true &&
			merged.block.groups.length === 1 &&
			merged.block.groups[0].title === 'Екатерина' &&
			merged.block.groups[0].events.length === 7,
		JSON.stringify(merged.block?.groups.map((group) => [group.title, group.events.length]))
	)
	const diminutive = await tool({ ...summer, title: 'Ваня' })
	check(
		'a short form finds the full name',
		diminutive.block?.groups.map((group) => group.title).join() === 'Иван',
		diminutive.content
	)
	const anna = await tool({ ...summer, title: 'Анна' })
	check(
		'Анна does not find Яна and shows no block',
		!anna.isError && anna.json.records.length === 0 && anna.block === null && anna.json.shown === false,
		anna.content
	)

	const gate = gateContext()
	learnWhen(gate, fuzzy.content, 'Asia/Ho_Chi_Minh', '2026')
	learnNames(gate, fuzzy.content)
	const published = [
		'Нашла события с Екатериной с 2 июня по 14 июля.',
		'Yekaterina IELTS 7.5 идёт 16 июня с 10:00 до 11:30.',
		'Группы: Екатерина, Yekaterina, Jekaterina, Катя, Katya и Ekatarina.',
	]
	check(
		'the gate publishes dates, end times and titles with digits from the result',
		published.every((sentence) => checkSentence(sentence, gate) === 'publish'),
		published.map((sentence) => checkSentence(sentence, gate)).join()
	)
	check(
		'the gate still holds a derived count of lessons and a length in minutes',
		checkSentence('Всего 7 занятий.', gate) === 'withhold' &&
			checkSentence('16 июня в 10:00 (90 минут).', gate) === 'withhold'
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
