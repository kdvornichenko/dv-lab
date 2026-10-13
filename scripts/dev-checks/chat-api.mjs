import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'

import * as core from '../../packages/core/src/index.ts'
import { removeCards } from './ledger-api/context.ts'
import { call, quote, sql, startApi, studentCookie, teacherCookie } from './schedule-api/io.ts'

const PORT = 4224
const VN = core.SCHEDULE_TIME_ZONE
const PREFIX = 'Alex Example 220'
const SECTIONS = { records: sectionRecords }

let failures = 0

function check(name, ok, detail = '') {
	if (ok) console.log(`PASS ${name}`)
	else {
		failures++
		console.log(`FAIL ${name}${detail ? ` ${detail}` : ''}`)
	}
}

const cardBody = (displayName) => ({
	displayName,
	rateMinor: null,
	currency: null,
	defaultLessonMinutes: 60,
	parent: null,
	level: null,
	goals: null,
	timeZone: null,
})

async function createCard(ctx, displayName) {
	const res = await call(ctx.api, 'POST', '/students', { cookie: ctx.cookie, body: cardBody(displayName) })
	if (res.status !== 201) throw new Error(`card create returned ${res.status}`)
	ctx.ids.push(res.json.student.id)
	return res.json.student.id
}

async function setOpening(ctx, studentId, lessonsHundredths, on) {
	const res = await call(ctx.api, 'PUT', `/students/${studentId}/opening-balance`, {
		cookie: ctx.cookie,
		body: { lessonsHundredths, on },
	})
	if (res.status !== 200) throw new Error(`opening balance returned ${res.status}`)
}

async function doneLesson(ctx, studentId, date) {
	const startsAt = core.zonedInstant(date, '10:00', VN).toISOString()
	const id = sql(
		`insert into lessons (student_id, starts_at, duration_minutes, status) values (${quote(studentId)}, ${quote(startsAt)}, 60, 'scheduled') returning id`
	).rows[0].id
	const res = await call(ctx.api, 'POST', `/schedule/lessons/${id}/mark`, {
		cookie: ctx.cookie,
		body: { kind: 'done' },
	})
	if (res.status !== 200) throw new Error(`mark returned ${res.status}`)
}

function tableCounts() {
	const out = sql(
		`select table_name as t, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text as n from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`
	)
	return out.rows.map((row) => `${row.t}=${row.n}`).join(',')
}

async function routeList() {
	const { createApp } = await import('../../apps/api/src/app.ts')
	const pino = (await import('pino')).default
	const app = createApp({
		logger: pino({ level: 'silent' }),
		db: {},
		gitSha: 'check',
		appOrigin: 'http://127.0.0.1',
		production: false,
		isStopping: () => false,
		signIn: {},
	})
	const seen = new Set()
	const list = []
	for (const route of app.routes) {
		if (!route.path.startsWith('/chat') || route.method === 'ALL') continue
		const key = `${route.method} ${route.path}`
		if (seen.has(key)) continue
		seen.add(key)
		list.push({ method: route.method, path: route.path.replace(/:[A-Za-z]+/g, () => randomUUID()) })
	}
	return list
}

async function sectionRecords(ctx) {
	const today = core.zonedParts(new Date(), VN).date
	const opening = core.addDays(today, -4)
	const after = core.addDays(opening, 1)
	const cards = {
		plenty: await createCard(ctx, 'Alex Example 2201'),
		unset: await createCard(ctx, 'Alex Example 2202'),
		owes: await createCard(ctx, 'Alex Example 2203'),
		soon: await createCard(ctx, 'Alex Example 2204'),
		marked: await createCard(ctx, 'Alex Example 2205'),
		archived: await createCard(ctx, 'Alex Example 2206'),
	}
	await setOpening(ctx, cards.plenty, 500, opening)
	await setOpening(ctx, cards.owes, 0, opening)
	await setOpening(ctx, cards.soon, 200, opening)
	await setOpening(ctx, cards.marked, 300, opening)
	await setOpening(ctx, cards.archived, 100, opening)
	await doneLesson(ctx, cards.owes, after)
	await doneLesson(ctx, cards.marked, after)
	const archive = await call(ctx.api, 'POST', `/students/${cards.archived}/archive`, { cookie: ctx.cookie, body: {} })
	if (archive.status !== 200) throw new Error(`archive returned ${archive.status}`)
	const expected = {
		plenty: { minutes: 300, paysSoon: false },
		unset: { minutes: null, paysSoon: false },
		owes: { minutes: -60, paysSoon: true },
		soon: { minutes: 120, paysSoon: true },
		marked: { minutes: 120, paysSoon: true },
		archived: { minutes: 60, paysSoon: false },
	}
	const student = await studentCookie(ctx.api)
	const routes = await routeList()
	check(
		'the chat routes are listed from the app',
		routes.some((item) => item.path.startsWith('/chat/records'))
	)
	const before = tableCounts()
	const todayRes = await call(ctx.api, 'GET', '/today', { cookie: ctx.cookie })
	const listRes = await call(ctx.api, 'GET', '/students', { cookie: ctx.cookie })
	check('today and students answer', todayRes.status === 200 && listRes.status === 200)
	for (const [key, id] of Object.entries(cards)) {
		const facts = await call(ctx.api, 'GET', `/chat/records?studentId=${id}`, { cookie: ctx.cookie })
		const detail = await call(ctx.api, 'GET', `/students/${id}`, { cookie: ctx.cookie })
		const row = listRes.json.students.find((item) => item.id === id)
		const inToday = todayRes.json.paysSoon.some((item) => item.id === id)
		const own = facts.json
		check(
			`${key}: records answer 200 with no-store`,
			facts.status === 200 && facts.headers.get('cache-control') === 'no-store'
		)
		check(
			`${key}: balance equals Students list and profile`,
			own.balanceMinutes === row.balanceMinutes && own.balanceMinutes === detail.json.student.balanceMinutes
		)
		check(
			`${key}: balance is the expected value`,
			own.balanceMinutes === expected[key].minutes,
			`got ${own.balanceMinutes}`
		)
		check(`${key}: Pays soon equals Today`, own.paysSoon === inToday && own.paysSoon === expected[key].paysSoon)
		check(
			`${key}: next lesson result equals the profile`,
			own.nextLesson.result === detail.json.student.nextLesson.result &&
				own.nextLesson.startsAt === detail.json.student.nextLesson.startsAt &&
				isDeepStrictEqual(own.nextLesson.status.state, detail.json.student.nextLesson.status.state)
		)
		check(
			`${key}: card fields`,
			own.student.id === id &&
				own.student.status === (key === 'archived' ? 'archived' : 'active') &&
				own.paysSoonLessons === todayRes.json.paysSoonLessons &&
				own.defaultTimeZone === todayRes.json.defaultTimeZone
		)
	}
	check(
		'no opening balance is null, not zero',
		(await call(ctx.api, 'GET', `/chat/records?studentId=${cards.unset}`, { cookie: ctx.cookie })).json
			.balanceMinutes === null
	)

	const malformed = [
		['no student id', '/chat/records'],
		['empty student id', '/chat/records?studentId='],
		['malformed student id', '/chat/records?studentId=not-a-uuid'],
		['extra query key', `/chat/records?studentId=${cards.plenty}&x=1`],
	]
	for (const [label, path] of malformed) {
		const res = await call(ctx.api, 'GET', path, { cookie: ctx.cookie })
		check(`${label}: 400 invalid_request`, res.status === 400 && res.json?.error?.code === 'invalid_request')
	}
	const missing = await call(ctx.api, 'GET', `/chat/records?studentId=${randomUUID()}`, { cookie: ctx.cookie })
	check(
		'unknown student: 404 without a body of data',
		missing.status === 404 && missing.json?.error?.code === 'not_found' && !('student' in missing.json)
	)

	const secret = 'Alex Example 2201'
	const asStudent = await call(ctx.api, 'GET', `/chat/records?studentId=${cards.plenty}`, { cookie: student })
	check(
		'student session: 403 without card data',
		asStudent.status === 403 &&
			!JSON.stringify(asStudent.json).includes(secret) &&
			!('balanceMinutes' in (asStudent.json ?? {}))
	)
	const anonymous = await call(ctx.api, 'GET', `/chat/records?studentId=${cards.plenty}`, {})
	check(
		'no session: 401 without card data',
		anonymous.status === 401 && !JSON.stringify(anonymous.json).includes(secret)
	)
	const forged = await call(ctx.api, 'GET', `/chat/records?studentId=${cards.plenty}`, { cookie: 'x'.repeat(43) })
	check(
		'unknown session: 401 without card data',
		forged.status === 401 && !JSON.stringify(forged.json).includes(secret)
	)

	for (const { method, path } of routes) {
		const body = method === 'GET' ? undefined : {}
		const asStudentRoute = await call(ctx.api, method, path, { cookie: student, body })
		check(`${method} ${path.replace(/[0-9a-f-]{36}/g, ':id')}: student session 403`, asStudentRoute.status === 403)
		const anonymousRoute = await call(ctx.api, method, path, { body })
		check(`${method} ${path.replace(/[0-9a-f-]{36}/g, ':id')}: no session 401`, anonymousRoute.status === 401)
	}

	check('reads create no rows in any table', tableCounts() === before)
	return 'CHAT_RECORDS_OK'
}

const section = process.argv[2]
const run = SECTIONS[section]

if (!run) {
	console.log(`usage: node scripts/dev-checks/chat-api.mjs ${Object.keys(SECTIONS).join('|')}`)
	process.exit(2)
}

const tails = removeCards(`display_name like ${quote(`${PREFIX}%`)} and import_key is null`)
console.log(`fixture tails removed ${tails}`)

const ids = []
let api = null
let done = null

try {
	api = await startApi({ port: PORT })
	const cookie = await teacherCookie(api)
	done = await run({ api, cookie, ids })
	check('api log has no fixture name', !api.logs().includes('Alex Example'))
} catch (err) {
	failures++
	console.log(`FAIL ${section} crashed ${err instanceof Error ? err.message : String(err)}`)
} finally {
	if (api) await api.stop()
	if (ids.length > 0) removeCards(`id in (${ids.map(quote).join(', ')}) and import_key is null`)
}

if (failures === 0 && done) console.log(done)
else console.log(`${section} failures ${failures}`)

process.exit(failures === 0 && done ? 0 : 1)
