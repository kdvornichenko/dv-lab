import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'

import * as core from '../../packages/core/src/index.ts'
import { STUDENT_LOGIN } from './api.mjs'
import { removeCards } from './ledger-api/context.ts'
import { call, quote, sql, startApi, studentCookie, teacherCookie } from './schedule-api/io.ts'

const PORT = 4224
const VN = core.SCHEDULE_TIME_ZONE
const PREFIX = 'Alex Example 220'
const SECTIONS = { records: sectionRecords, conversations: sectionConversations }

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
		const asStudentRoute = await send(ctx.api, method, path, { cookie: student, body })
		check(`${method} ${path.replace(/[0-9a-f-]{36}/g, ':id')}: student session 403`, asStudentRoute.status === 403)
		const anonymousRoute = await send(ctx.api, method, path, { body })
		check(`${method} ${path.replace(/[0-9a-f-]{36}/g, ':id')}: no session 401`, anonymousRoute.status === 401)
	}

	check('reads create no rows in any table', tableCounts() === before)
	return 'CHAT_RECORDS_OK'
}

const conversationRow = (id) =>
	sql(`select title, revision, deleted_at is not null as deleted from chat_conversations where id = ${quote(id)}`)
		.rows[0]

const conversationCounts = () =>
	tableCounts()
		.split(',')
		.filter((item) => !item.startsWith('chat_conversations='))

function send(api, method, path, options = {}) {
	if (method !== 'DELETE' || options.body === undefined) return call(api, method, path, options)
	const length = String(Buffer.byteLength(JSON.stringify(options.body)))
	return call(api, method, path, { ...options, headers: { 'content-length': length } })
}

async function sectionConversations(ctx) {
	const { api, cookie } = ctx
	const student = await studentCookie(api)
	const as = (method, path, body) => send(api, method, path, { cookie, body })
	const track = (id) => ctx.conversations.push(id)
	console.log(`fixture conversations removed ${sql('delete from chat_conversations').rowCount}`)
	const before = conversationCounts()
	const secret = 'Zeta check title'

	const first = await as('POST', '/chat/conversations')
	const second = await as('POST', '/chat/conversations')
	check(
		'create answers 201 with a New chat at revision 1',
		first.status === 201 &&
			first.headers.get('cache-control') === 'no-store' &&
			first.json.conversation.title === 'New chat' &&
			first.json.conversation.revision === 1 &&
			second.status === 201,
		`${first.status}`
	)
	const a = first.json.conversation.id
	const b = second.json.conversation.id
	track(a)
	track(b)
	check('two creates make two conversations', a !== b)

	let list = await as('GET', '/chat/conversations')
	let ids = list.json.conversations.map((item) => item.id)
	check('list holds both, newest first', list.status === 200 && ids.join() === [b, a].join(), ids.join())

	const renamed = await as('PATCH', `/chat/conversations/${a}`, { title: `  ${secret}  `, expectedRevision: 1 })
	check(
		'rename saves the trimmed title and bumps the revision',
		renamed.status === 200 &&
			renamed.json.conversation.title === secret &&
			renamed.json.conversation.revision === 2 &&
			conversationRow(a).title === secret
	)
	list = await as('GET', '/chat/conversations')
	ids = list.json.conversations.map((item) => item.id)
	check('renamed conversation moves to the top by updated_at', ids.join() === [a, b].join(), ids.join())
	const sorted = [...list.json.conversations].sort(
		(x, y) => y.updatedAt.localeCompare(x.updatedAt) || x.id.localeCompare(y.id)
	)
	check('list order is updated_at descending then id', sorted.map((item) => item.id).join() === ids.join())

	const one = await as('GET', `/chat/conversations/${a}`)
	check('read one answers 200 with the title', one.status === 200 && one.json.conversation.title === secret)
	for (const [label, path] of [
		['unknown id', `/chat/conversations/${randomUUID()}`],
		['malformed id', '/chat/conversations/not-a-uuid'],
	]) {
		const res = await as('GET', path)
		check(`read ${label}: 404 not_found`, res.status === 404 && res.json?.error?.code === 'not_found')
	}

	const stale = await as('PATCH', `/chat/conversations/${a}`, { title: 'Stale title', expectedRevision: 1 })
	const afterStale = conversationRow(a)
	check(
		'rename with a stale revision: 409 precondition_failed and nothing changed',
		stale.status === 409 &&
			stale.json?.error?.code === 'precondition_failed' &&
			afterStale.title === secret &&
			afterStale.revision === 2
	)
	const staleDelete = await as('DELETE', `/chat/conversations/${a}`, { expectedRevision: 1 })
	check(
		'delete with a stale revision: 409 and nothing changed',
		staleDelete.status === 409 && conversationRow(a).deleted === false && conversationRow(a).title === secret
	)

	const invalid = [
		['empty title', { title: '', expectedRevision: 2 }],
		['blank title', { title: '   ', expectedRevision: 2 }],
		['161 characters', { title: 'x'.repeat(161), expectedRevision: 2 }],
		['title with a null character', { title: 'a\u0000b', expectedRevision: 2 }],
		['non-string title', { title: 7, expectedRevision: 2 }],
		['missing revision', { title: 'Fine' }],
		['zero revision', { title: 'Fine', expectedRevision: 0 }],
		['extra key', { title: 'Fine', expectedRevision: 2, x: 1 }],
	]
	for (const [label, body] of invalid) {
		const res = await as('PATCH', `/chat/conversations/${a}`, body)
		check(`rename ${label}: 400 invalid_request`, res.status === 400 && res.json?.error?.code === 'invalid_request')
	}
	const deleteInvalid = await as('DELETE', `/chat/conversations/${a}`, { expectedRevision: 2, x: 1 })
	check('delete with an extra key: 400', deleteInvalid.status === 400)
	const deleteNoBody = await as('DELETE', `/chat/conversations/${a}`)
	check('delete without a body: 400', deleteNoBody.status === 400)
	check('rejected requests changed nothing', conversationRow(a).title === secret && conversationRow(a).revision === 2)

	const longTitle = 'ж'.repeat(160)
	const longOk = await as('PATCH', `/chat/conversations/${a}`, { title: longTitle, expectedRevision: 2 })
	check('a 160-character title is kept in full', longOk.status === 200 && longOk.json.conversation.title === longTitle)
	const emoji = '😀'.repeat(160)
	const emojiOk = await as('PATCH', `/chat/conversations/${a}`, { title: emoji, expectedRevision: 3 })
	check(
		'160 code points of emoji are kept in full',
		emojiOk.status === 200 && emojiOk.json.conversation.title === emoji
	)

	const rows = [
		['read one', 'GET', `/chat/conversations/${a}`, undefined],
		['list', 'GET', '/chat/conversations', undefined],
		['create', 'POST', '/chat/conversations', undefined],
		['rename', 'PATCH', `/chat/conversations/${a}`, { title: 'Fine', expectedRevision: 4 }],
		['delete', 'DELETE', `/chat/conversations/${a}`, { expectedRevision: 4 }],
	]
	const countBeforeRoles = sql('select count(*)::int as n from chat_conversations').rows[0].n
	for (const [label, method, path, body] of rows) {
		const asStudent = await send(api, method, path, { cookie: student, body })
		check(`${label}: student session 403`, asStudent.status === 403 && !JSON.stringify(asStudent.json).includes(secret))
		const anonymous = await send(api, method, path, { body })
		check(`${label}: no session 401`, anonymous.status === 401)
	}
	check(
		'role checks changed no conversation',
		sql('select count(*)::int as n from chat_conversations').rows[0].n === countBeforeRoles &&
			conversationRow(a).revision === 4 &&
			conversationRow(a).deleted === false
	)

	const studentId = sql(`select id from accounts where login = ${quote(STUDENT_LOGIN)}`).rows[0].id
	const foreign = sql(
		`insert into chat_conversations (account_id, title) values (${quote(studentId)}, 'Foreign check') returning id`
	).rows[0].id
	track(foreign)
	const foreignRead = await as('GET', `/chat/conversations/${foreign}`)
	const foreignRename = await as('PATCH', `/chat/conversations/${foreign}`, { title: 'Taken', expectedRevision: 1 })
	const foreignDelete = await as('DELETE', `/chat/conversations/${foreign}`, { expectedRevision: 1 })
	const foreignList = await as('GET', '/chat/conversations')
	check(
		'another account conversation: read, rename and delete are 404 and it is not listed',
		foreignRead.status === 404 &&
			foreignRename.status === 404 &&
			foreignDelete.status === 404 &&
			!foreignList.json.conversations.some((item) => item.id === foreign) &&
			conversationRow(foreign).title === 'Foreign check' &&
			conversationRow(foreign).revision === 1
	)

	const removed = await as('DELETE', `/chat/conversations/${a}`, { expectedRevision: 4 })
	const tomb = conversationRow(a)
	check(
		'delete answers 204 and keeps a tombstone row without the old title',
		removed.status === 204 &&
			tomb.deleted === true &&
			tomb.title === 'Deleted chat' &&
			tomb.revision === 5 &&
			!JSON.stringify(sql(`select * from chat_conversations where id = ${quote(a)}`).rows).includes('ж')
	)
	const again = await as('DELETE', `/chat/conversations/${a}`, { expectedRevision: 5 })
	const afterDeleteRead = await as('GET', `/chat/conversations/${a}`)
	const afterDeleteRename = await as('PATCH', `/chat/conversations/${a}`, { title: 'Back', expectedRevision: 5 })
	const afterList = await as('GET', '/chat/conversations')
	check(
		'a deleted conversation is 404 for delete, read and rename and is not listed',
		again.status === 404 &&
			afterDeleteRead.status === 404 &&
			afterDeleteRename.status === 404 &&
			!afterList.json.conversations.some((item) => item.id === a) &&
			afterList.json.conversations.some((item) => item.id === b)
	)

	const appDelete = (() => {
		try {
			sql(`delete from chat_conversations where id = ${quote(b)}`, 'app')
			return 'deleted'
		} catch (err) {
			return String(err.message)
		}
	})()
	const appTruncate = (() => {
		try {
			sql('truncate chat_conversations', 'app')
			return 'truncated'
		} catch (err) {
			return String(err.message)
		}
	})()
	check(
		'the application role cannot DELETE or TRUNCATE the table',
		appDelete.includes('42501') && appTruncate.includes('42501'),
		`${appDelete} ${appTruncate}`
	)
	check(
		'the application role has no DELETE privilege',
		sql("select has_table_privilege('dvlab_app', 'chat_conversations', 'DELETE') as p").rows[0].p === false
	)
	check('the other conversation is intact', conversationRow(b).deleted === false)
	check('no row appeared or changed in any other table', isDeepStrictEqual(conversationCounts(), before))
	check('api log has no conversation title', !api.logs().includes(secret))
	return 'CHAT_CONVERSATIONS_OK'
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
const conversations = []
let api = null
let done = null

try {
	api = await startApi({ port: PORT })
	const cookie = await teacherCookie(api)
	done = await run({ api, cookie, ids, conversations })
	check('api log has no fixture name', !api.logs().includes('Alex Example'))
} catch (err) {
	failures++
	console.log(`FAIL ${section} crashed ${err instanceof Error ? err.message : String(err)}`)
} finally {
	if (api) await api.stop()
	if (conversations.length > 0)
		sql(`delete from chat_conversations where id in (${conversations.map(quote).join(', ')})`)
	if (ids.length > 0) removeCards(`id in (${ids.map(quote).join(', ')}) and import_key is null`)
}

if (failures === 0 && done) console.log(done)
else console.log(`${section} failures ${failures}`)

process.exit(failures === 0 && done ? 0 : 1)
