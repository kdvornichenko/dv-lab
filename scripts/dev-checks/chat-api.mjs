import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { isDeepStrictEqual, parseEnv } from 'node:util'

import * as core from '../../packages/core/src/index.ts'
import { ENV_TEST, STUDENT_LOGIN } from './api.mjs'
import { removeCards } from './ledger-api/context.ts'
import { call, quote, sql, startApi, studentCookie, teacherCookie } from './schedule-api/io.ts'

const PORT = 4224
const VN = core.SCHEDULE_TIME_ZONE
const PREFIX = 'Alex Example 220'
const SECTIONS = {
	records: sectionRecords,
	conversations: sectionConversations,
	notes: sectionNotes,
	comments: sectionComments,
	actions: sectionActions,
	budget: sectionBudget,
}

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
	const pino = createRequire(new URL('../../apps/api/package.json', import.meta.url))('pino')
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

function removeChats(where) {
	const conversations = `select id from chat_conversations where ${where}`
	sql(`delete from chat_actions where conversation_id in (${conversations})`)
	sql(`delete from chat_usage_attempts where conversation_id in (${conversations})`)
	sql(`delete from chat_turns where conversation_id in (${conversations})`)
	sql(`delete from chat_messages where reply_to is not null and conversation_id in (${conversations})`)
	sql(`delete from chat_messages where conversation_id in (${conversations})`)
	return sql(`delete from chat_conversations where ${where}`).rowCount
}

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
	console.log(`fixture conversations removed ${removeChats('true')}`)
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

function removeEntries(where) {
	const cards = `select id from students where ${where}`
	sql(`delete from lesson_comments where student_id in (${cards})`)
	sql(`delete from student_notes where student_id in (${cards})`)
	sql(`delete from student_sections where student_id in (${cards})`)
}

const noteRow = (id) =>
	sql(
		`select student_id, section_kind, body, revision, retracted_at is not null as retracted from student_notes where id = ${quote(id)}`
	).rows[0]

async function sectionNotes(ctx) {
	const { api, cookie } = ctx
	const { appendStudentNoteRequest, NOTE_MAX_LENGTH } = await import('../../packages/contracts/src/index.ts')
	const { createDb } = await import('../../packages/db/src/index.ts')
	const { appendStudentNote, listStudentNotes, retractStudentNote } = await import('../../apps/api/src/cards/notes.ts')
	const url = parseEnv(readFileSync(ENV_TEST, 'utf8')).DATABASE_URL
	const { db, pool } = createDb(url)
	try {
		const student = await studentCookie(api)
		const as = (method, path, body) => send(api, method, path, { cookie, body })
		const accountId = sql(`select id from accounts where role = 'teacher' and status = 'active'`).rows[0].id
		const live = await createCard(ctx, 'Alex Example 2207')
		const archived = await createCard(ctx, 'Alex Example 2208')
		const other = await createCard(ctx, 'Alex Example 2209')
		const archive = await as('POST', `/students/${archived}/archive`, {})
		if (archive.status !== 200) throw new Error(`archive returned ${archive.status}`)
		const secret = 'Zeta note body'
		const sectionText = 'Section text stays'

		const first = await appendStudentNote(db, accountId, live, { sectionKind: 'goals', body: secret })
		const second = await appendStudentNote(db, accountId, live, { sectionKind: 'goals', body: secret })
		check(
			'two notes with the same text are two records with their own ids at revision 1',
			first !== null && second !== null && first.id !== second.id && first.revision === 1 && second.revision === 1
		)
		const foreignNote = await appendStudentNote(db, accountId, other, { sectionKind: 'level', body: 'Other card note' })
		check('a note on another card is its own record', foreignNote !== null && foreignNote.id !== first.id)
		check(
			'append to an archived card gives null and writes nothing',
			(await appendStudentNote(db, accountId, archived, { sectionKind: 'goals', body: secret })) === null &&
				sql(`select count(*)::int as n from student_notes where student_id = ${quote(archived)}`).rows[0].n === 0
		)
		check(
			'append to an unknown card gives null',
			(await appendStudentNote(db, accountId, randomUUID(), { sectionKind: 'goals', body: secret })) === null
		)
		check(
			'list of an unknown card is null, of an archived card is empty',
			(await listStudentNotes(db, accountId, randomUUID())) === null &&
				(await listStudentNotes(db, accountId, archived)).length === 0
		)

		const parsed = (body, sectionKind = 'goals') => appendStudentNoteRequest.safeParse({ sectionKind, body })
		check(
			'the append contract trims, keeps 2000 characters, refuses 2001, empty, NUL and unknown sections without cutting',
			parsed(`  ${'ж'.repeat(NOTE_MAX_LENGTH)}  `).data?.body === 'ж'.repeat(NOTE_MAX_LENGTH) &&
				parsed('😀'.repeat(NOTE_MAX_LENGTH)).success &&
				!parsed('x'.repeat(NOTE_MAX_LENGTH + 1)).success &&
				!parsed('   ').success &&
				!parsed('a\u0000b').success &&
				!parsed('fine', 'nope').success &&
				!appendStudentNoteRequest.safeParse({ sectionKind: 'goals', body: 'fine', x: 1 }).success
		)

		const list = await as('GET', `/students/${live}/notes`)
		check(
			'GET notes answers 200 no-store with both notes, oldest first, no student id or account',
			list.status === 200 &&
				list.headers.get('cache-control') === 'no-store' &&
				list.json.notes.map((item) => item.id).join() === [first.id, second.id].join() &&
				list.json.notes.every(
					(item) =>
						item.sectionKind === 'goals' &&
						item.body === secret &&
						item.revision === 1 &&
						item.retractedAt === null &&
						!('studentId' in item)
				),
			`${list.status}`
		)
		const listOther = await as('GET', `/students/${other}/notes`)
		check(
			'notes of one card do not appear on another',
			listOther.status === 200 && listOther.json.notes.length === 1 && listOther.json.notes[0].id === foreignNote.id
		)
		const listArchived = await as('GET', `/students/${archived}/notes`)
		check(
			'GET notes of an archived card answers 200 and empty',
			listArchived.status === 200 && listArchived.json.notes.length === 0
		)
		for (const [label, path] of [
			['unknown card', `/students/${randomUUID()}/notes`],
			['malformed card id', '/students/not-a-uuid/notes'],
		]) {
			const res = await as('GET', path)
			check(`GET notes ${label}: 404 not_found`, res.status === 404 && res.json?.error?.code === 'not_found')
		}

		const put = await as('PUT', `/students/${live}/sections/goals`, { body: sectionText })
		const afterPut = await as('GET', `/students/${live}/notes`)
		check(
			'saving the section text changes no note',
			put.status === 200 &&
				put.json.section.body === sectionText &&
				afterPut.json.notes.length === 2 &&
				afterPut.json.notes.every((item) => item.body === secret && item.revision === 1)
		)
		const third = await appendStudentNote(db, accountId, live, { sectionKind: 'goals', body: 'Third note' })
		const sections = await as('GET', `/students/${live}/sections`)
		const goals = sections.json.sections.find((item) => item.kind === 'goals')
		check(
			'a note leaves the section text as it was and the text does not hold the note',
			goals.body === sectionText && !goals.body.includes('Third note') && !goals.body.includes(secret)
		)

		const lowRevision = await as('POST', `/students/${live}/notes/${first.id}/retract`, { expectedRevision: 0 })
		const noRevision = await as('POST', `/students/${live}/notes/${first.id}/retract`, {})
		const extraKey = await as('POST', `/students/${live}/notes/${first.id}/retract`, { expectedRevision: 1, x: 1 })
		check(
			'retract with a bad body: 400 invalid_request and the note is untouched',
			[lowRevision, noRevision, extraKey].every(
				(res) => res.status === 400 && res.json?.error?.code === 'invalid_request'
			) &&
				noteRow(first.id).revision === 1 &&
				noteRow(first.id).retracted === false
		)
		const stale = await as('POST', `/students/${live}/notes/${first.id}/retract`, { expectedRevision: 5 })
		check(
			'retract with a stale revision: 409 precondition_failed and nothing changed',
			stale.status === 409 &&
				stale.json?.error?.code === 'precondition_failed' &&
				noteRow(first.id).revision === 1 &&
				noteRow(first.id).retracted === false
		)
		const wrongCard = await as('POST', `/students/${other}/notes/${first.id}/retract`, { expectedRevision: 1 })
		check(
			'retract through another card URL: 404 and the note is untouched',
			wrongCard.status === 404 && noteRow(first.id).retracted === false
		)
		for (const [label, path] of [
			['unknown note', `/students/${live}/notes/${randomUUID()}/retract`],
			['malformed note id', `/students/${live}/notes/not-a-uuid/retract`],
			['unknown card', `/students/${randomUUID()}/notes/${first.id}/retract`],
			['malformed card id', `/students/not-a-uuid/notes/${first.id}/retract`],
		]) {
			const res = await as('POST', path, { expectedRevision: 1 })
			check(`retract ${label}: 404 not_found`, res.status === 404 && res.json?.error?.code === 'not_found')
		}

		const retracted = await as('POST', `/students/${live}/notes/${first.id}/retract`, { expectedRevision: 1 })
		const kept = noteRow(first.id)
		check(
			'retract with the right revision: 200, revision +1, retracted_at set and the row stays',
			retracted.status === 200 &&
				retracted.json.note.id === first.id &&
				retracted.json.note.revision === 2 &&
				retracted.json.note.retractedAt !== null &&
				kept.revision === 2 &&
				kept.retracted === true &&
				kept.body === secret
		)
		const again = await as('POST', `/students/${live}/notes/${first.id}/retract`, { expectedRevision: 1 })
		const againCurrent = await as('POST', `/students/${live}/notes/${first.id}/retract`, { expectedRevision: 2 })
		check(
			'a second retract is 409 with the old revision and with the current one, and changes nothing',
			again.status === 409 && againCurrent.status === 409 && noteRow(first.id).revision === 2
		)
		const afterRetract = await as('GET', `/students/${live}/notes`)
		check(
			'the retracted note leaves the list, its twin stays',
			afterRetract.json.notes.map((item) => item.id).join() === [second.id, third.id].join()
		)
		const goalsAfter = (await as('GET', `/students/${live}/sections`)).json.sections.find(
			(item) => item.kind === 'goals'
		)
		check('retracting a note leaves the section text as it was', goalsAfter.body === sectionText)

		const race = await Promise.all([
			as('POST', `/students/${live}/notes/${second.id}/retract`, { expectedRevision: 1 }),
			as('POST', `/students/${live}/notes/${second.id}/retract`, { expectedRevision: 1 }),
		])
		check(
			'two simultaneous retracts: one 200 and one 409, revision grows once',
			race
				.map((res) => res.status)
				.sort()
				.join() === '200,409' && noteRow(second.id).revision === 2
		)
		check(
			'the other card note and the third note are intact',
			noteRow(foreignNote.id).retracted === false && noteRow(third.id).retracted === false
		)

		const tx = await db.transaction(async (executor) => {
			const result = await retractStudentNote(executor, accountId, third.id, 1)
			const listed = await listStudentNotes(executor, accountId, live)
			return { result, listed }
		})
		check(
			'retract works inside a caller transaction with the caller executor',
			tx.result.kind === 'retracted' && tx.result.note.revision === 2 && tx.listed.length === 0
		)

		const asStudentRoutes = [
			['GET', `/students/${live}/notes`],
			['POST', `/students/${live}/notes/${third.id}/retract`],
		]
		for (const [method, path] of asStudentRoutes) {
			const body = method === 'GET' ? undefined : { expectedRevision: 2 }
			const asStudent = await send(api, method, path, { cookie: student, body })
			const anonymous = await send(api, method, path, { body })
			check(
				`${method} ${path.replace(/[0-9a-f-]{36}/g, ':id')}: student 403 and no session 401 without text`,
				asStudent.status === 403 &&
					anonymous.status === 401 &&
					!JSON.stringify(asStudent.json).includes(secret) &&
					!JSON.stringify(anonymous.json).includes(secret)
			)
		}

		const denied = (statement) => {
			try {
				sql(statement, 'app')
				return 'done'
			} catch (err) {
				return String(err.message)
			}
		}
		const refusals = [
			denied(`delete from student_notes where id = ${quote(second.id)}`),
			denied('truncate student_notes'),
			denied(`delete from lesson_comments where student_id = ${quote(live)}`),
			denied('truncate lesson_comments'),
		]
		check(
			'the application role cannot DELETE or TRUNCATE either table',
			refusals.every((text) => text.includes('42501')),
			refusals.join(' | ')
		)
		check(
			'the application role has no DELETE or TRUNCATE privilege on either table',
			sql(
				"select bool_or(has_table_privilege('dvlab_app', t, 'DELETE') or has_table_privilege('dvlab_app', t, 'TRUNCATE')) as p from unnest(array['student_notes', 'lesson_comments']) as t"
			).rows[0].p === false
		)
		check('api log has no note text', !api.logs().includes(secret) && !api.logs().includes('Third note'))
		return 'CHAT_NOTES_OK'
	} finally {
		await pool.end()
	}
}

const commentRow = (id) =>
	sql(
		`select student_id, series_id::text as series_id, original_on::text as original_on, lesson_id::text as lesson_id, body, revision, retracted_at is not null as retracted from lesson_comments where id = ${quote(id)}`
	).rows[0]

async function sectionComments(ctx) {
	const { api, cookie } = ctx
	const { appendLessonCommentRequest, COMMENT_MAX_LENGTH } = await import('../../packages/contracts/src/index.ts')
	const { createDb } = await import('../../packages/db/src/index.ts')
	const { appendLessonComment, listLessonComments, retractLessonComment } =
		await import('../../apps/api/src/schedule/comments.ts')
	const { seriesAnchor, prepareSeriesChange } = await import('../../apps/api/src/schedule/series.ts')
	const url = parseEnv(readFileSync(ENV_TEST, 'utf8')).DATABASE_URL
	const { db, pool } = createDb(url)
	try {
		const student = await studentCookie(api)
		const as = (method, path, body) => send(api, method, path, { cookie, body })
		const accountId = sql(`select id from accounts where role = 'teacher' and status = 'active'`).rows[0].id
		const zone = sql(
			`select coalesce((select default_time_zone from teacher_settings where account_id = ${quote(accountId)}), ${quote(VN)}) as zone`
		).rows[0].zone
		const today = core.scheduleToday(new Date(), zone)
		const card = await createCard(ctx, 'Alex Example 2200')
		await setOpening(ctx, card, 600, core.addDays(today, -60))
		const secret = 'Zeta comment body'
		const lessonAt = (days, status = 'scheduled') =>
			sql(
				`insert into lessons (student_id, starts_at, duration_minutes, status) values (${quote(card)}, ${quote(core.zonedInstant(core.addDays(today, days), '09:00', zone).toISOString())}, 60, ${quote(status)}) returning id`
			).rows[0].id
		const started = lessonAt(-3)
		const future = lessonAt(3)
		const cancelled = lessonAt(-2, 'cancelled')
		const startsOn = core.addDays(today, -21)
		const weekday = core.weekdayOf(startsOn)
		const seriesId = sql(
			`insert into lesson_series (student_id, weekday, start_time, time_zone, duration_minutes, starts_on) values (${quote(card)}, ${weekday}, '09:00', ${quote(zone)}, 60, ${quote(startsOn)}) returning id`
		).rows[0].id
		const rule = {
			id: seriesId,
			studentId: card,
			weekday,
			startTime: '09:00',
			timeZone: zone,
			durationMinutes: 60,
			startsOn,
			endsOn: null,
		}
		const dayMinus14 = core.addDays(today, -14)
		const dayMinus7 = core.addDays(today, -7)
		const dayPlus14 = core.addDays(today, 14)
		const single = (lessonId) => ({ kind: 'single', lessonId })
		const occurrence = (originalOn) => ({ kind: 'series', seriesId, originalOn })
		const marksBefore = sql('select count(*)::int as n from lesson_marks').rows[0].n
		const balanceBefore = (await as('GET', `/chat/records?studentId=${card}`)).json.balanceMinutes

		check(
			'a series with no marks and no comments anchors at its first date',
			(await seriesAnchor(db, rule, null)) === startsOn
		)
		const early = await appendLessonComment(db, accountId, single(future), secret, new Date())
		const earlyOccurrence = await appendLessonComment(db, accountId, occurrence(dayPlus14), secret, new Date())
		check(
			'a comment on a lesson that has not started is not_started and writes nothing',
			early.kind === 'not_started' &&
				earlyOccurrence.kind === 'not_started' &&
				sql(`select count(*)::int as n from lesson_comments where student_id = ${quote(card)}`).rows[0].n === 0
		)
		check(
			'a comment on an unknown lesson, an unknown series or a date off the series is not_found',
			(await appendLessonComment(db, accountId, single(randomUUID()), secret, new Date())).kind === 'not_found' &&
				(await appendLessonComment(db, accountId, occurrence(core.addDays(dayMinus14, 1)), secret, new Date())).kind ===
					'not_found' &&
				(
					await appendLessonComment(
						db,
						accountId,
						{ kind: 'series', seriesId: randomUUID(), originalOn: dayMinus14 },
						secret,
						new Date()
					)
				).kind === 'not_found'
		)
		const first = await appendLessonComment(db, accountId, single(started), secret, new Date())
		const second = await appendLessonComment(db, accountId, single(started), secret, new Date())
		check(
			'two comments with the same text on a started lesson are two records with their own ids at revision 1',
			first.kind === 'ok' &&
				second.kind === 'ok' &&
				first.comment.id !== second.comment.id &&
				first.comment.revision === 1 &&
				second.comment.revision === 1 &&
				commentRow(first.comment.id).student_id === card
		)
		const onCancelled = await appendLessonComment(db, accountId, single(cancelled), 'Cancelled but started', new Date())
		check('a cancelled lesson that has started takes a comment', onCancelled.kind === 'ok')
		const onOccurrence = await appendLessonComment(db, accountId, occurrence(dayMinus14), 'Occurrence note', new Date())
		check(
			'a started occurrence of a series takes a comment keyed by the series and the date',
			onOccurrence.kind === 'ok' &&
				onOccurrence.comment.ref.kind === 'series' &&
				commentRow(onOccurrence.comment.id).series_id === seriesId &&
				commentRow(onOccurrence.comment.id).original_on === dayMinus14 &&
				commentRow(onOccurrence.comment.id).lesson_id === null
		)

		const parsed = (body) => appendLessonCommentRequest.safeParse({ body })
		check(
			'the append contract trims, keeps 2000 characters, refuses 2001, empty, NUL and extra keys without cutting',
			parsed(`  ${'ж'.repeat(COMMENT_MAX_LENGTH)}  `).data?.body === 'ж'.repeat(COMMENT_MAX_LENGTH) &&
				parsed('😀'.repeat(COMMENT_MAX_LENGTH)).success &&
				!parsed('x'.repeat(COMMENT_MAX_LENGTH + 1)).success &&
				!parsed('   ').success &&
				!parsed('a\u0000b').success &&
				!appendLessonCommentRequest.safeParse({ body: 'fine', x: 1 }).success
		)

		const list = await as('GET', `/schedule/lessons/${started}/comments`)
		check(
			'GET lesson comments answers 200 no-store with both comments, oldest first, with the lesson ref',
			list.status === 200 &&
				list.headers.get('cache-control') === 'no-store' &&
				list.json.comments.map((item) => item.id).join() === [first.comment.id, second.comment.id].join() &&
				list.json.comments.every(
					(item) =>
						item.body === secret &&
						item.revision === 1 &&
						item.retractedAt === null &&
						item.ref.kind === 'single' &&
						item.ref.lessonId === started &&
						!('studentId' in item)
				),
			`${list.status}`
		)
		const listOccurrence = await as('GET', `/schedule/series/${seriesId}/occurrences/${dayMinus14}/comments`)
		check(
			'GET occurrence comments answers 200 with the occurrence comment only',
			listOccurrence.status === 200 &&
				listOccurrence.json.comments.length === 1 &&
				listOccurrence.json.comments[0].id === onOccurrence.comment.id
		)
		const listEmpty = await as('GET', `/schedule/lessons/${future}/comments`)
		check(
			'GET comments of a lesson with none answers 200 and empty',
			listEmpty.status === 200 && listEmpty.json.comments.length === 0
		)
		for (const [label, path] of [
			['unknown lesson', `/schedule/lessons/${randomUUID()}/comments`],
			['malformed lesson id', '/schedule/lessons/not-a-uuid/comments'],
			['unknown series', `/schedule/series/${randomUUID()}/occurrences/${dayMinus14}/comments`],
			['malformed date', `/schedule/series/${seriesId}/occurrences/2026-13-40/comments`],
		]) {
			const res = await as('GET', path)
			check(`GET comments ${label}: 404 not_found`, res.status === 404 && res.json?.error?.code === 'not_found')
		}
		const noCreate = await as('POST', `/schedule/lessons/${started}/comments`, { body: secret })
		check(
			'there is no route that creates a comment',
			noCreate.status === 404 &&
				sql(`select count(*)::int as n from lesson_comments where lesson_id = ${quote(started)}`).rows[0].n === 2
		)

		const lowRevision = await as('POST', `/schedule/comments/${first.comment.id}/retract`, { expectedRevision: 0 })
		const noRevision = await as('POST', `/schedule/comments/${first.comment.id}/retract`, {})
		const extraKey = await as('POST', `/schedule/comments/${first.comment.id}/retract`, { expectedRevision: 1, x: 1 })
		check(
			'retract with a bad body: 400 invalid_request and the comment is untouched',
			[lowRevision, noRevision, extraKey].every(
				(res) => res.status === 400 && res.json?.error?.code === 'invalid_request'
			) &&
				commentRow(first.comment.id).revision === 1 &&
				commentRow(first.comment.id).retracted === false
		)
		const stale = await as('POST', `/schedule/comments/${first.comment.id}/retract`, { expectedRevision: 5 })
		check(
			'retract with a stale revision: 409 precondition_failed and nothing changed',
			stale.status === 409 &&
				stale.json?.error?.code === 'precondition_failed' &&
				commentRow(first.comment.id).revision === 1 &&
				commentRow(first.comment.id).retracted === false
		)
		for (const [label, path] of [
			['unknown comment', `/schedule/comments/${randomUUID()}/retract`],
			['malformed comment id', '/schedule/comments/not-a-uuid/retract'],
		]) {
			const res = await as('POST', path, { expectedRevision: 1 })
			check(`retract ${label}: 404 not_found`, res.status === 404 && res.json?.error?.code === 'not_found')
		}

		const held = async () => seriesAnchor(db, rule, null)
		const anchoredAfter = core.addDays(dayMinus14, 7)
		check(
			'an unretracted comment on a started unmarked occurrence moves the anchor to the next series date',
			(await held()) === anchoredAfter,
			`${await held()}`
		)
		const prepare = (from, startTime) =>
			db.transaction((tx) =>
				prepareSeriesChange(
					tx,
					accountId,
					{
						operation: 'move_series',
						seriesId,
						input: {
							from,
							weekday: core.weekdayOf(from),
							startTime,
							expectedDefaultTimeZone: zone,
							requestId: randomUUID(),
							expectedVersion: 'fixture-version',
						},
					},
					new Date(),
					null
				)
			)
		const refusal = async (from) => {
			try {
				await prepare(from, '10:30')
				return 'accepted'
			} catch (error) {
				return error?.code ?? String(error?.message)
			}
		}
		const commandsBefore = sql('select count(*)::int as n from google_commands').rows[0].n
		check(
			'move_series from the commented occurrence or earlier: precondition_failed, from the anchor: accepted',
			(await refusal(dayMinus14)) === 'precondition_failed' &&
				(await refusal(startsOn)) === 'precondition_failed' &&
				(await refusal(anchoredAfter)) === 'accepted' &&
				sql('select count(*)::int as n from google_commands').rows[0].n === commandsBefore
		)

		const moved = sql(
			`insert into lesson_exceptions (series_id, original_on, kind, starts_at, duration_minutes) values (${quote(seriesId)}, ${quote(dayMinus14)}, 'moved', ${quote(core.zonedInstant(core.addDays(dayMinus14, 1), '15:00', zone).toISOString())}, 60) returning original_on`
		).rowCount
		sql(
			`update lessons set starts_at = ${quote(core.zonedInstant(core.addDays(today, -4), '16:00', zone).toISOString())} where id = ${quote(started)}`
		)
		const afterMove = await as('GET', `/schedule/lessons/${started}/comments`)
		const afterMoveOccurrence = await as('GET', `/schedule/series/${seriesId}/occurrences/${dayMinus14}/comments`)
		check(
			'moving a lesson or an occurrence leaves its comments on the same key',
			moved === 1 &&
				afterMove.json.comments.map((item) => item.id).join() === [first.comment.id, second.comment.id].join() &&
				afterMoveOccurrence.json.comments.map((item) => item.id).join() === onOccurrence.comment.id
		)

		const retracted = await as('POST', `/schedule/comments/${first.comment.id}/retract`, { expectedRevision: 1 })
		const kept = commentRow(first.comment.id)
		check(
			'retract with the right revision: 200, revision +1, retracted_at set and the row stays',
			retracted.status === 200 &&
				retracted.json.comment.id === first.comment.id &&
				retracted.json.comment.revision === 2 &&
				retracted.json.comment.retractedAt !== null &&
				kept.revision === 2 &&
				kept.retracted === true &&
				kept.body === secret
		)
		const again = await as('POST', `/schedule/comments/${first.comment.id}/retract`, { expectedRevision: 1 })
		const againCurrent = await as('POST', `/schedule/comments/${first.comment.id}/retract`, { expectedRevision: 2 })
		check(
			'a second retract is 409 with the old revision and with the current one, and changes nothing',
			again.status === 409 && againCurrent.status === 409 && commentRow(first.comment.id).revision === 2
		)
		const afterRetract = await as('GET', `/schedule/lessons/${started}/comments`)
		check(
			'the retracted comment leaves the list, its twin stays',
			afterRetract.json.comments.map((item) => item.id).join() === second.comment.id
		)
		const race = await Promise.all([
			as('POST', `/schedule/comments/${second.comment.id}/retract`, { expectedRevision: 1 }),
			as('POST', `/schedule/comments/${second.comment.id}/retract`, { expectedRevision: 1 }),
		])
		check(
			'two simultaneous retracts: one 200 and one 409, revision grows once',
			race
				.map((res) => res.status)
				.sort()
				.join() === '200,409' && commentRow(second.comment.id).revision === 2
		)

		const tx = await db.transaction(async (executor) => {
			const result = await retractLessonComment(executor, accountId, onCancelled.comment.id, 1)
			const listed = await listLessonComments(executor, accountId, single(cancelled))
			return { result, listed }
		})
		check(
			'retract works inside a caller transaction with the caller executor',
			tx.result.kind === 'retracted' && tx.result.comment.revision === 2 && tx.listed.length === 0
		)
		check('list of an unknown lesson is null', (await listLessonComments(db, accountId, single(randomUUID()))) === null)

		const lastRetract = await as('POST', `/schedule/comments/${onOccurrence.comment.id}/retract`, {
			expectedRevision: 1,
		})
		check(
			'after the last comment on the occurrence is retracted the anchor is the first series date again',
			lastRetract.status === 200 && (await held()) === startsOn,
			`${await held()}`
		)
		check(
			'comments leave marks and the balance as they were',
			sql('select count(*)::int as n from lesson_marks').rows[0].n === marksBefore &&
				(await as('GET', `/chat/records?studentId=${card}`)).json.balanceMinutes === balanceBefore
		)
		check(
			'every comment row is still there after the retracts',
			sql(`select count(*)::int as n from lesson_comments where student_id = ${quote(card)}`).rows[0].n === 4
		)

		const routesAsStudent = [
			['GET', `/schedule/lessons/${started}/comments`],
			['GET', `/schedule/series/${seriesId}/occurrences/${dayMinus14}/comments`],
			['POST', `/schedule/comments/${second.comment.id}/retract`],
		]
		for (const [method, path] of routesAsStudent) {
			const body = method === 'GET' ? undefined : { expectedRevision: 2 }
			const asStudent = await send(api, method, path, { cookie: student, body })
			const anonymous = await send(api, method, path, { body })
			check(
				`${method} ${path.replace(/[0-9a-f-]{36}/g, ':id').replace(/\d{4}-\d{2}-\d{2}/, ':date')}: student 403 and no session 401 without text`,
				asStudent.status === 403 &&
					anonymous.status === 401 &&
					!JSON.stringify(asStudent.json).includes(secret) &&
					!JSON.stringify(anonymous.json).includes(secret)
			)
		}
		const denied = (statement) => {
			try {
				sql(statement, 'app')
				return 'done'
			} catch (err) {
				return String(err.message)
			}
		}
		const refusals = [
			denied(`delete from lesson_comments where id = ${quote(second.comment.id)}`),
			denied('truncate lesson_comments'),
		]
		check(
			'the application role cannot DELETE or TRUNCATE lesson_comments',
			refusals.every((text) => text.includes('42501')),
			refusals.join(' | ')
		)
		check('api log has no comment text', !api.logs().includes(secret) && !api.logs().includes('Occurrence note'))
		return 'CHAT_COMMENTS_OK'
	} finally {
		await pool.end()
	}
}

const markOf = (lessonId) =>
	sql(`select kind, revision from lesson_marks where lesson_id = ${quote(lessonId)}`).rows[0] ?? null

const actionCount = (conversationId) =>
	sql(`select count(*)::int as n from chat_actions where conversation_id = ${quote(conversationId)}`).rows[0].n

async function sectionActions(ctx) {
	const { api, cookie } = ctx
	const { createDb } = await import('../../packages/db/src/index.ts')
	const { executeLocalAction } = await import('../../apps/api/src/chat/actions.ts')
	const { insertMessage } = await import('../../apps/api/src/chat/messages.ts')
	const url = parseEnv(readFileSync(ENV_TEST, 'utf8')).DATABASE_URL
	const { db, pool } = createDb(url)
	try {
		const as = (method, path, body) => send(api, method, path, { cookie, body })
		const accountId = sql(`select id from accounts where role = 'teacher' and status = 'active'`).rows[0].id
		const zone = sql(
			`select coalesce((select default_time_zone from teacher_settings where account_id = ${quote(accountId)}), ${quote(VN)}) as zone`
		).rows[0].zone
		const today = core.scheduleToday(new Date(), zone)
		const yesterday = core.addDays(today, -1)
		const name = 'Alex Example 2206'
		const card = await createCard(ctx, name)
		await setOpening(ctx, card, 600, core.addDays(today, -60))
		const lessonAt = (date, time) =>
			sql(
				`insert into lessons (student_id, starts_at, duration_minutes, status) values (${quote(card)}, ${quote(core.zonedInstant(date, time, zone).toISOString())}, 60, 'scheduled') returning id`
			).rows[0].id
		const first = lessonAt(yesterday, '09:00')
		const balance = async () => (await as('GET', `/chat/records?studentId=${card}`)).json.balanceMinutes
		const binding = { studentId: card, text: name, start: 1, end: 1 + name.length }
		const message = (requestId, tail) => ({ requestId, text: `@${name} ${tail}`, mentions: [binding] })
		const created = await as('POST', '/chat/conversations')
		const conversationId = created.json.conversation.id
		ctx.conversations.push(conversationId)
		const post = (body) => as('POST', `/chat/conversations/${conversationId}/messages`, body)
		const undo = (actionId, requestId) => as('POST', `/chat/actions/${actionId}/undo`, { requestId })
		const replyBlock = (res) => res.json?.messages?.[1]?.blocks?.[0]
		const startBalance = await balance()
		check('the card starts with six lessons', startBalance === 360, `${startBalance}`)

		const r1 = randomUUID()
		const was = message(r1, `was ${yesterday}`)
		const sent = await post(was)
		const block = replyBlock(sent)
		check(
			'"was <date>" marks the exact lesson Done at once with one action and a reply block',
			sent.status === 201 &&
				sent.json.messages.length === 2 &&
				sent.json.messages[0].role === 'teacher' &&
				sent.json.messages[0].body === was.text &&
				sent.json.messages[1].role === 'assistant' &&
				block?.type === 'action_result' &&
				block.kind === 'mark' &&
				block.mark === 'done' &&
				block.before === 'none' &&
				block.undo === 'available' &&
				block.effect?.kind === 'deducts' &&
				block.effect.minutes === 60 &&
				block.lessonMinutes === 60 &&
				block.studentName === name &&
				block.timeZone === zone &&
				markOf(first)?.kind === 'done' &&
				markOf(first)?.revision === 1 &&
				actionCount(conversationId) === 1,
			`${sent.status} ${JSON.stringify(block)}`
		)
		check(
			'the conversation moved up after the message',
			sent.json.conversation.updatedAt > created.json.conversation.updatedAt
		)
		check('Done deducts one lesson', (await balance()) === 300)
		const replayed = await post(was)
		check(
			'the same requestId returns the original messages and makes no second effect',
			replayed.status === 200 &&
				replayed.json.messages.map((item) => item.id).join() === sent.json.messages.map((item) => item.id).join() &&
				markOf(first)?.revision === 1 &&
				actionCount(conversationId) === 1
		)
		const changed = await post({ ...was, text: `${was.text} ` })
		check(
			'the same requestId with another text: 409 precondition_failed and nothing written',
			changed.status === 409 &&
				changed.json?.error?.code === 'precondition_failed' &&
				markOf(first)?.revision === 1 &&
				actionCount(conversationId) === 1
		)
		const other = await as('POST', '/chat/conversations')
		ctx.conversations.push(other.json.conversation.id)
		const crossed = await as('POST', `/chat/conversations/${other.json.conversation.id}/messages`, was)
		check('the same requestId in another conversation: 409', crossed.status === 409)

		const u1 = randomUUID()
		const undone = await undo(block.actionId, u1)
		check(
			'Undo returns the previous mark with a new revision',
			undone.status === 200 &&
				undone.json.block.undo === 'done' &&
				undone.json.block.actionId === block.actionId &&
				markOf(first)?.kind === 'none' &&
				markOf(first)?.revision === 2,
			`${undone.status} ${JSON.stringify(markOf(first))}`
		)
		check('Undo gives the lesson back', (await balance()) === 360)
		const undoAgain = await undo(block.actionId, u1)
		const undoOther = await undo(block.actionId, randomUUID())
		check(
			'a repeated Undo returns the saved result and changes nothing',
			undoAgain.status === 200 &&
				undoAgain.json.block.undo === 'done' &&
				undoOther.status === 200 &&
				undoOther.json.block.undo === 'done' &&
				markOf(first)?.revision === 2
		)
		const read = await as('GET', `/chat/conversations/${conversationId}`)
		check(
			'the conversation read shows the messages in order with the undone result',
			read.status === 200 && read.json.messages.length === 2 && read.json.messages[1].blocks[0].undo === 'done'
		)

		const r2 = randomUUID()
		const second = await post(message(r2, `was at the lesson ${yesterday}`))
		const secondBlock = replyBlock(second)
		check(
			'a second Done from the chat writes the next revision',
			second.status === 201 && secondBlock?.type === 'action_result' && markOf(first)?.revision === 3
		)
		for (const kind of ['no_show', 'done']) {
			const res = await as('POST', `/schedule/lessons/${first}/mark`, { kind })
			if (res.status !== 200) throw new Error(`mark returned ${res.status}`)
		}
		const staleUndo = await undo(secondBlock.actionId, randomUUID())
		check(
			'Undo after Done -> No-show -> Done outside the chat is stale and leaves the mark',
			staleUndo.status === 200 &&
				staleUndo.json.block.undo === 'stale' &&
				markOf(first)?.kind === 'done' &&
				markOf(first)?.revision === 5,
			`${JSON.stringify(staleUndo.json)} ${JSON.stringify(markOf(first))}`
		)
		const staleRead = await as('GET', `/chat/conversations/${conversationId}`)
		check('the read shows the stale result', staleRead.json.messages.at(-1).blocks[0].undo === 'stale')
		check('the balance follows the mark', (await balance()) === 300)

		const noteText = 'Zeta chat note body'
		const noteMessage = { requestId: randomUUID(), text: `/note @${name} ${noteText}`, mentions: [] }
		noteMessage.mentions.push({ studentId: card, text: name, start: 7, end: 7 + name.length })
		const noted = await post(noteMessage)
		const noteBlock = replyBlock(noted)
		const twin = await post({ ...noteMessage, requestId: randomUUID() })
		const twinBlock = replyBlock(twin)
		const noteRows = () =>
			sql(
				`select id, revision, retracted_at is not null as retracted, section_kind from student_notes where student_id = ${quote(card)} order by created_at, id`
			).rows
		check(
			'/note adds a note record in General info with the text in the result block',
			noted.status === 201 &&
				noteBlock?.type === 'action_result' &&
				noteBlock.kind === 'note' &&
				noteBlock.text === noteText &&
				twinBlock?.type === 'action_result' &&
				noteRows().length === 2 &&
				noteRows().every((row) => row.section_kind === 'general_info' && row.revision === 1)
		)
		const noteUndo = await undo(noteBlock.actionId, randomUUID())
		const [retractedNote, keptNote] = noteRows()
		check(
			'Undo of a note retracts only its own record, the twin with the same text stays',
			noteUndo.status === 200 &&
				noteUndo.json.block.undo === 'done' &&
				retractedNote.retracted === true &&
				retractedNote.revision === 2 &&
				keptNote.retracted === false &&
				keptNote.revision === 1
		)

		const commentText = 'Zeta chat comment body'
		const context = { accountId, now: new Date(), defaultTimeZone: zone }
		const commentCount = () =>
			sql(`select count(*)::int as n from lesson_comments where student_id = ${quote(card)}`).rows[0].n
		const viaModel = (intent) =>
			db.transaction(async (tx) => {
				const asked = await insertMessage(tx, {
					accountId,
					conversationId,
					role: 'teacher',
					body: 'model turn',
					requestId: randomUUID(),
					requestDigest: 'model',
				})
				const source = { conversationId, messageId: asked.id }
				const result = await executeLocalAction(tx, context, source, { kind: 'lesson', intent, body: commentText })
				await insertMessage(tx, {
					accountId,
					conversationId,
					role: 'assistant',
					body: '',
					blocks: [result],
					replyTo: asked.id,
				})
				return result
			})
		const commentBlock = await viaModel({ kind: 'comment', studentId: card, scope: 'one', date: yesterday })
		check(
			'a comment on a started lesson is added with its result block',
			commentBlock.type === 'action_result' &&
				commentBlock.kind === 'comment' &&
				commentBlock.text === commentText &&
				commentCount() === 1,
			JSON.stringify(commentBlock)
		)
		const laterComment = await viaModel({
			kind: 'comment',
			studentId: card,
			scope: 'one',
			date: core.addDays(today, 1),
		})
		check(
			'a comment on a lesson that has not started gets no result and writes nothing',
			laterComment.type !== 'action_result' && commentCount() === 1,
			JSON.stringify(laterComment)
		)
		const commentUndo = await undo(commentBlock.actionId, randomUUID())
		check(
			'Undo of a comment retracts it',
			commentUndo.status === 200 &&
				commentUndo.json.block.undo === 'done' &&
				sql(
					`select count(*)::int as n from lesson_comments where student_id = ${quote(card)} and retracted_at is not null`
				).rows[0].n === 1
		)

		const effectsBefore = tableCounts()
		const moved = await post(message(randomUUID(), 'moved to tomorrow 18:00'))
		const cancelled = await post(message(randomUUID(), `didn't happen ${yesterday}`))
		check(
			'"moved to" and "didn\'t happen" answer connection_required on an api without Google',
			replyBlock(moved)?.type === 'refused' &&
				replyBlock(moved)?.code === 'connection_required' &&
				replyBlock(cancelled)?.code === 'connection_required'
		)
		const free = await post(message(randomUUID(), 'how is the reading going?'))
		const plain = await post({ requestId: randomUUID(), text: 'What should we do next week?', mentions: [] })
		check(
			'free text without a quick form answers model_unavailable',
			replyBlock(free)?.code === 'model_unavailable' && replyBlock(plain)?.code === 'model_unavailable'
		)
		const staleMention = await post({
			requestId: randomUUID(),
			text: `@${name}x was`,
			mentions: [{ studentId: randomUUID(), text: `${name}x`, start: 1, end: 2 + name.length }],
		})
		check('a binding to an unknown student answers mention_stale', replyBlock(staleMention)?.code === 'mention_stale')
		const effectsAfter = tableCounts()
			.split(',')
			.filter((item) => !item.startsWith('chat_'))
			.join()
		check(
			'refusals write no effect outside the chat tables',
			effectsBefore
				.split(',')
				.filter((item) => !item.startsWith('chat_'))
				.join() === effectsAfter
		)

		const later = lessonAt(yesterday, '15:00')
		const ambiguous = await post(message(randomUUID(), `no show ${yesterday}`))
		const question = replyBlock(ambiguous)
		check(
			'two lessons on the day: a question with both lessons and a reply for each, nothing marked',
			question?.type === 'clarify' &&
				question.question === 'which_lesson' &&
				question.options.length === 2 &&
				question.studentName === name &&
				question.options.every((option) => option.reply.startsWith("didn't come ")) &&
				markOf(later) === null &&
				markOf(first)?.revision === 5,
			JSON.stringify(question)
		)
		const chosen = question.options.find((option) => option.time === '15:00')
		const answered = await post(message(randomUUID(), chosen.reply))
		check(
			'the reply of an option marks that lesson No-show',
			replyBlock(answered)?.type === 'action_result' &&
				replyBlock(answered).mark === 'no_show' &&
				markOf(later)?.kind === 'no_show',
			JSON.stringify(replyBlock(answered))
		)
		check('No-show deducts one lesson', (await balance()) === 240)

		for (const [label, body] of [
			['empty text', { requestId: randomUUID(), text: '', mentions: [] }],
			['spaces only', { requestId: randomUUID(), text: '   ', mentions: [] }],
			['NUL', { requestId: randomUUID(), text: 'a\u0000b', mentions: [] }],
			['too long', { requestId: randomUUID(), text: 'x'.repeat(20001), mentions: [] }],
			['no requestId', { text: 'hello', mentions: [] }],
			['extra key', { requestId: randomUUID(), text: 'hello', mentions: [], x: 1 }],
			[
				'21 mentions',
				{
					requestId: randomUUID(),
					text: 'hello',
					mentions: Array.from({ length: 21 }, () => ({ studentId: card, text: 'h', start: 0, end: 1 })),
				},
			],
		]) {
			const res = await post(body)
			check(
				`send with ${label}: 400 invalid_request`,
				res.status === 400 && res.json?.error?.code === 'invalid_request'
			)
		}
		const longest = await post({ requestId: randomUUID(), text: 'ж'.repeat(20000), mentions: [] })
		check(
			'a 20000-character message is kept whole',
			longest.status === 201 && longest.json.messages[0].body.length === 20000
		)
		const unknown = await as('POST', `/chat/conversations/${randomUUID()}/messages`, message(randomUUID(), 'was'))
		const removed = await as('POST', '/chat/conversations')
		ctx.conversations.push(removed.json.conversation.id)
		await send(api, 'DELETE', `/chat/conversations/${removed.json.conversation.id}`, {
			cookie,
			body: { expectedRevision: 1 },
		})
		const toDeleted = await as(
			'POST',
			`/chat/conversations/${removed.json.conversation.id}/messages`,
			message(randomUUID(), 'was')
		)
		check('sending to an unknown or deleted conversation: 404', unknown.status === 404 && toDeleted.status === 404)
		const undoUnknown = await undo(randomUUID(), randomUUID())
		const refusedAction = sql(
			`select id from chat_actions where conversation_id = ${quote(conversationId)} and state = 'refused' limit 1`
		).rows[0].id
		const undoRefused = await undo(refusedAction, randomUUID())
		check(
			'Undo of an unknown action is 404, of a question is 409',
			undoUnknown.status === 404 && undoRefused.status === 409
		)

		const denied = (statement) => {
			try {
				sql(statement, 'app')
				return 'done'
			} catch (err) {
				return String(err.message)
			}
		}
		const refusals = [
			denied(`delete from chat_messages where conversation_id = ${quote(conversationId)}`),
			denied(`delete from chat_actions where conversation_id = ${quote(conversationId)}`),
			denied('truncate chat_messages'),
			denied('truncate chat_actions'),
		]
		check(
			'the application role cannot DELETE or TRUNCATE chat messages and actions',
			refusals.every((text) => text.includes('42501')),
			refusals.join(' | ')
		)
		check(
			'action rows keep no student text',
			sql(
				`select count(*)::int as n from chat_actions where conversation_id = ${quote(conversationId)} and (coalesce(target::text, '') || coalesce(before::text, '') || coalesce(after::text, '') || result::text) ~ 'Zeta|Alex'`
			).rows[0].n === 0
		)
		check(
			'api log has no message text',
			!api.logs().includes(noteText) && !api.logs().includes(commentText) && !api.logs().includes('reading going')
		)
		return 'CHAT_ACTIONS_OK'
	} finally {
		await pool.end()
	}
}

const periodOf = (id) =>
	sql(
		`select starts_on::text as starts_on, ends_before::text as ends_before, time_zone, spent_nano::text as spent, held_nano::text as held from chat_budget_periods where id = ${quote(id)}`
	).rows[0]

const attemptOf = (id) =>
	sql(
		`select state, cost_nano::text as cost, reserved_nano::text as reserved, usage from chat_usage_attempts where id = ${quote(id)}`
	).rows[0]

function throws(action) {
	try {
		action()
		return false
	} catch {
		return true
	}
}

async function sectionBudget(ctx) {
	const { api, cookie } = ctx
	const { createDb } = await import('../../packages/db/src/index.ts')
	const budget = await import('../../apps/api/src/chat/budget.ts')
	const { resolveModelChoice } = await import('../../apps/api/src/chat/model-config.ts')
	const { readAssistantSettings, saveAssistantSettings } = await import('../../apps/api/src/settings/settings.ts')
	const pino = createRequire(new URL('../../apps/api/package.json', import.meta.url))('pino')
	const url = parseEnv(readFileSync(ENV_TEST, 'utf8')).DATABASE_URL
	const first = createDb(url)
	const second = createDb(url)
	const db = first.db
	const logLines = []
	const logger = pino({ level: 'info' }, { write: (line) => logLines.push(line) })
	const accountId = sql(`select id from accounts where role = 'teacher' and status = 'active'`).rows[0].id
	const original = sql(
		`select chat_monthly_cap_usd::text as cap, chat_models as models, chat_model as model, chat_effort as effort from teacher_settings where account_id = ${quote(accountId)}`
	).rows[0]
	const clearBudget = () => {
		sql(`delete from chat_usage_attempts where account_id = ${quote(accountId)}`)
		return sql(`delete from chat_budget_periods where account_id = ${quote(accountId)}`).rowCount
	}
	console.log(`fixture budget periods removed ${clearBudget()}`)
	const setCap = async (monthlyCapUsd) => {
		const saved = await saveAssistantSettings(db, accountId, { monthlyCapUsd })
		if (!saved.ok) throw new Error(`cap ${monthlyCapUsd} was not saved`)
	}
	const choose = async (model) => {
		const settings = await readAssistantSettings(db, accountId)
		const choice = resolveModelChoice(settings, model === null ? null : { model, effort: null })
		if (choice.kind !== 'resolved') throw new Error(`model ${model} is not resolved`)
		return choice
	}
	const reserve = (conversationId, choice, now = new Date(), executor = db) =>
		executor.transaction((tx) => budget.reserveAttempt(tx, accountId, conversationId, choice, now))
	try {
		await saveAssistantSettings(db, accountId, { models: null, model: null, effort: null, monthlyCapUsd: '10.00' })
		const defaults = await readAssistantSettings(db, accountId)
		check(
			'the default monthly cap is $10 and reads as 10 dollars in nano',
			defaults.monthlyCapUsd === '10.00' && budget.usdToNano(defaults.monthlyCapUsd) === 10_000_000_000n
		)
		check(
			'usdToNano and nanoToUsd convert decimal text without floats',
			budget.usdToNano('0.125') === 125_000_000n &&
				budget.usdToNano('12.5') === 12_500_000_000n &&
				budget.usdToNano('0.000000001') === 1n &&
				budget.nanoToUsd(10_000_000_000n) === '10.00' &&
				budget.nanoToUsd(2_000_000n) === '0.002' &&
				budget.nanoToUsd(1n) === '0.000000001' &&
				budget.nanoToUsd(0n) === '0.00'
		)
		check(
			'usdToNano rejects exponent, sign, bare fraction and more than nine decimals',
			['1e3', '-1', '.5', '1.0000000001', ''].every((text) => throws(() => budget.usdToNano(text)))
		)
		const haiku = await choose(null)
		const fable = await choose('claude-fable-5-1')
		check(
			'reserve uses max input at the larger of input and cache write plus max output at the output price',
			budget.reserveNano(haiku) === 20_500_000n && budget.reserveNano(fable) === 2_050_000_000n,
			`${budget.reserveNano(haiku)} ${budget.reserveNano(fable)}`
		)
		const tinyPricing = {
			inputPerMTok: '0.000001',
			cacheWrite5mPerMTok: '0.000001',
			cacheReadPerMTok: '0.000001',
			outputPerMTok: '0.000001',
		}
		const zeroUsage = { inputTokens: 0, outputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 }
		check(
			'cost counts input, cache write, cache read and output and rounds up',
			budget.costNano(haiku.model.pricing, {
				inputTokens: 1000,
				outputTokens: 100000,
				cacheCreationInputTokens: 2000,
				cacheReadInputTokens: 5000,
			}) === 50_400_000n &&
				budget.costNano(tinyPricing, { ...zeroUsage, inputTokens: 1 }) === 1n &&
				budget.costNano(tinyPricing, zeroUsage) === 0n
		)

		const conversation = async () => {
			const res = await send(api, 'POST', '/chat/conversations', { cookie })
			if (res.status !== 201) throw new Error(`conversation create returned ${res.status}`)
			ctx.conversations.push(res.json.conversation.id)
			return res.json.conversation.id
		}
		const one = await conversation()
		const two = await conversation()

		const a1 = await reserve(one, haiku)
		check(
			'a reserve that fits is accepted',
			a1.ok && a1.reservedNano === 20_500_000n,
			JSON.stringify(a1, (k, v) => (typeof v === 'bigint' ? String(v) : v))
		)
		const period = periodOf(a1.periodId)
		const zone = sql(
			`select coalesce((select default_time_zone from teacher_settings where account_id = ${quote(accountId)}), ${quote(VN)}) as zone`
		).rows[0].zone
		const month = core.zonedParts(new Date(), zone).date.slice(0, 7)
		check(
			'the period is the current month in the teacher zone and holds the reserve',
			period.starts_on === `${month}-01` &&
				period.time_zone === zone &&
				period.held === '20500000' &&
				period.spent === '0' &&
				attemptOf(a1.attemptId).state === 'reserved',
			JSON.stringify(period)
		)
		const dispatched = await budget.markDispatched(db, a1.attemptId)
		const dispatchedAgain = await budget.markDispatched(db, a1.attemptId)
		check('markDispatched moves reserved to dispatched once', dispatched && !dispatchedAgain)
		check('release refuses an attempt that may have been sent', !(await budget.release(db, a1.attemptId)))
		const bigUsage = {
			inputTokens: 1000,
			outputTokens: 100000,
			cacheCreationInputTokens: 2000,
			cacheReadInputTokens: 5000,
		}
		const settled = await budget.settleAttempt(db, logger, a1.attemptId, bigUsage)
		const afterSettle = periodOf(a1.periodId)
		check(
			'settle with usage above the reserve writes the actual cost to spent and frees the reserve',
			settled.settled &&
				afterSettle.spent === '50400000' &&
				afterSettle.held === '0' &&
				attemptOf(a1.attemptId).state === 'settled' &&
				attemptOf(a1.attemptId).cost === '50400000',
			JSON.stringify(afterSettle)
		)
		const overLine = logLines.map((line) => JSON.parse(line)).find((line) => line.attemptId === a1.attemptId)
		check(
			'the overrun is logged at warn with attempt, model, reserve, cost and token counts only',
			overLine?.level === 40 &&
				overLine.model === haiku.model.id &&
				overLine.reservedNano === '20500000' &&
				overLine.costNano === '50400000' &&
				overLine.outputTokens === 100000 &&
				Object.keys(overLine).every((key) =>
					[
						'level',
						'time',
						'pid',
						'hostname',
						'msg',
						'attemptId',
						'model',
						'reservedNano',
						'costNano',
						'inputTokens',
						'outputTokens',
						'cacheCreationInputTokens',
						'cacheReadInputTokens',
					].includes(key)
				),
			JSON.stringify(overLine)
		)
		const settledAgain = await budget.settleAttempt(db, logger, a1.attemptId, { ...bigUsage, outputTokens: 1 })
		check(
			'a second settle changes nothing',
			!settledAgain.settled && periodOf(a1.periodId).spent === '50400000' && attemptOf(a1.attemptId).cost === '50400000'
		)

		const a2 = await reserve(two, haiku)
		const priced = (await readAssistantSettings(db, accountId)).models.map((entry) =>
			entry.id === haiku.model.id
				? {
						...entry,
						pricing: {
							inputPerMTok: '1.00',
							cacheWrite5mPerMTok: '1.25',
							cacheReadPerMTok: '0.10',
							outputPerMTok: '5.00',
						},
					}
				: entry
		)
		const repriced = await saveAssistantSettings(db, accountId, { models: priced })
		const smallUsage = { inputTokens: 1000, outputTokens: 1000, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 }
		await budget.markDispatched(db, a2.attemptId)
		await budget.settleAttempt(db, logger, a2.attemptId, smallUsage)
		check(
			'a tariff change in settings does not change the cost of an accepted attempt',
			repriced.ok &&
				attemptOf(a2.attemptId).cost === '600000' &&
				budget.costNano(priced[0].pricing, smallUsage) === 6_000_000n &&
				periodOf(a1.periodId).spent === '51000000',
			JSON.stringify(attemptOf(a2.attemptId))
		)
		await saveAssistantSettings(db, accountId, { models: null })

		const a3 = await reserve(one, haiku)
		await budget.markDispatched(db, a3.attemptId)
		const unknown = await budget.markUnknown(db, a3.attemptId)
		const snapshotUnknown = await budget.readBudgetSnapshot(db, accountId)
		check(
			'markUnknown keeps the reserve held and the snapshot counts the unconfirmed attempt',
			unknown &&
				attemptOf(a3.attemptId).state === 'unknown' &&
				periodOf(a1.periodId).held === '20500000' &&
				snapshotUnknown.budget.unknownAttempts === 1 &&
				snapshotUnknown.budget.heldUsd === '0.0205' &&
				snapshotUnknown.budget.spentUsd === '0.051',
			JSON.stringify(snapshotUnknown.budget)
		)
		const a4 = await reserve(two, haiku)
		check('an unknown attempt does not close admission while the next reserve fits', a4.ok)
		const released = await budget.release(db, a4.attemptId)
		const releasedAgain = await budget.release(db, a4.attemptId)
		check(
			'release returns the reserve of a reserved attempt once',
			released &&
				!releasedAgain &&
				attemptOf(a4.attemptId).state === 'released' &&
				periodOf(a1.periodId).held === '20500000'
		)

		const states = {}
		for (const cap of ['1.00', '0.09', '0.08', '0.07']) {
			await setCap(cap)
			states[cap] = (await budget.readBudgetSnapshot(db, accountId)).budget
		}
		check(
			'snapshot state is ok below 80%, warning from 80% and reached at the cap',
			states['1.00'].state === 'ok' &&
				states['0.09'].state === 'ok' &&
				states['0.08'].state === 'warning' &&
				states['0.07'].state === 'reached' &&
				states['0.07'].remainingUsd === '0.00' &&
				states['0.08'].remainingUsd === '0.0085',
			JSON.stringify(states)
		)
		await setCap('0.08')
		const insufficient = await reserve(one, haiku)
		await setCap('0.07')
		const reached = await reserve(one, haiku)
		check(
			'a reserve that does not fit is budget_insufficient and a cap below usage is budget_reached, nothing held',
			!insufficient.ok &&
				insufficient.code === 'budget_insufficient' &&
				!reached.ok &&
				reached.code === 'budget_reached' &&
				periodOf(a1.periodId).held === '20500000' &&
				sql(`select count(*)::int as n from chat_usage_attempts where account_id = ${quote(accountId)}`).rows[0].n === 4
		)

		await setCap('10.00')
		const read = await send(api, 'GET', '/settings/assistant', { cookie })
		const usage = read.json?.usage ?? []
		check(
			'GET /settings/assistant carries budget and usage by conversation',
			read.status === 200 &&
				read.json.budget.capUsd === '10.00' &&
				read.json.budget.spentUsd === '0.051' &&
				read.json.budget.heldUsd === '0.0205' &&
				read.json.budget.unknownAttempts === 1 &&
				read.json.budget.state === 'ok' &&
				read.json.budget.resetOn > `${month}-01` &&
				usage.length === 2 &&
				usage[0].conversationId === one &&
				usage[0].costUsd === '0.0709' &&
				usage[0].attempts === 2 &&
				usage[0].models.join() === haiku.model.id &&
				usage[1].conversationId === two &&
				usage[1].costUsd === '0.0006' &&
				usage[1].attempts === 1,
			JSON.stringify(read.json?.budget) + JSON.stringify(usage)
		)
		const patched = await send(api, 'PATCH', '/settings/assistant', { cookie, body: { monthlyCapUsd: '12.50' } })
		check(
			'PATCH /settings/assistant answers with the new cap in the budget',
			patched.status === 200 && patched.json.budget.capUsd === '12.50' && patched.json.usage.length === 2
		)
		await setCap('10.00')

		await setCap('3.00')
		const racedAt = core.zonedInstant('2031-03-15', '12:00', zone)
		const raced = await Promise.all([reserve(one, fable, racedAt, first.db), reserve(two, fable, racedAt, second.db)])
		const racedPeriods = sql(
			`select id, held_nano::text as held from chat_budget_periods where account_id = ${quote(accountId)} and starts_on = '2031-03-01'`
		).rows
		check(
			'two parallel first reserves of a new month share one period and stay within the cap',
			racedPeriods.length === 1 &&
				raced.filter((item) => item.ok).length === 1 &&
				raced.filter((item) => !item.ok && item.code === 'budget_insufficient').length === 1 &&
				racedPeriods[0].held === '2050000000',
			JSON.stringify(racedPeriods)
		)
		await setCap('10.00')
		const bothAt = core.zonedInstant('2031-04-15', '12:00', zone)
		const both = await Promise.all([reserve(one, fable, bothAt, first.db), reserve(two, fable, bothAt, second.db)])
		const bothPeriods = sql(
			`select held_nano::text as held from chat_budget_periods where account_id = ${quote(accountId)} and starts_on = '2031-04-01'`
		).rows
		check(
			'two parallel reserves that fit both pass without a unique key error',
			both.every((item) => item.ok) && bothPeriods.length === 1 && bothPeriods[0].held === '4100000000',
			JSON.stringify(bothPeriods)
		)

		const lateAt = core.zonedInstant('2031-05-31', '23:30', zone)
		const nextAt = core.zonedInstant('2031-06-01', '00:30', zone)
		const may = await reserve(one, haiku, lateAt)
		const june = await reserve(one, haiku, nextAt)
		await budget.markDispatched(db, may.attemptId)
		await budget.settleAttempt(db, logger, may.attemptId, smallUsage)
		const mayPeriod = periodOf(may.periodId)
		const junePeriod = periodOf(june.periodId)
		check(
			'the month turns at midnight in the teacher zone and a late settle lands in its own period',
			may.periodId !== june.periodId &&
				mayPeriod.starts_on === '2031-05-01' &&
				mayPeriod.ends_before === '2031-06-01' &&
				junePeriod.starts_on === '2031-06-01' &&
				junePeriod.ends_before === '2031-07-01' &&
				mayPeriod.spent === '600000' &&
				mayPeriod.held === '0' &&
				junePeriod.spent === '0' &&
				junePeriod.held === '20500000',
			`${JSON.stringify(mayPeriod)} ${JSON.stringify(junePeriod)}`
		)
		const decemberAt = core.zonedInstant('2031-12-31', '12:00', zone)
		const december = await reserve(one, haiku, decemberAt)
		check('December ends before January of the next year', periodOf(december.periodId).ends_before === '2032-01-01')

		const denied = (statement) => {
			try {
				sql(statement, 'app')
				return 'done'
			} catch (err) {
				return String(err.message)
			}
		}
		const refusals = [
			denied(`delete from chat_usage_attempts where account_id = ${quote(accountId)}`),
			denied(`delete from chat_budget_periods where account_id = ${quote(accountId)}`),
			denied('truncate chat_usage_attempts'),
			denied('truncate chat_budget_periods'),
		]
		check(
			'the application role cannot DELETE or TRUNCATE budget periods and attempts',
			refusals.every((text) => text.includes('42501')),
			refusals.join(' | ')
		)
		check('api log has no budget numbers of the check', !api.logs().includes('50400000'))
		return 'CHAT_BUDGET_OK'
	} finally {
		clearBudget()
		if (original)
			await saveAssistantSettings(db, accountId, {
				monthlyCapUsd: original.cap,
				models: original.models,
				model: original.model,
				effort: original.effort,
			})
		await first.pool.end()
		await second.pool.end()
	}
}

const section = process.argv[2]
const run = SECTIONS[section]

const CHILDREN = { target: './chat-target.mjs', calendar: './chat-calendar.mjs', runs: './chat-runs.mjs' }

if (section in CHILDREN) {
	const child = spawnSync(process.execPath, [new URL(CHILDREN[section], import.meta.url).pathname], {
		stdio: 'inherit',
	})
	process.exit(child.status ?? 1)
}

if (!run) {
	console.log(
		`usage: node scripts/dev-checks/chat-api.mjs ${[...Object.keys(SECTIONS), ...Object.keys(CHILDREN)].join('|')}`
	)
	process.exit(2)
}

removeEntries(`display_name like ${quote(`${PREFIX}%`)} and import_key is null`)
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
	if (conversations.length > 0) removeChats(`id in (${conversations.map(quote).join(', ')})`)
	if (ids.length > 0) removeEntries(`id in (${ids.map(quote).join(', ')}) and import_key is null`)
	if (ids.length > 0) removeCards(`id in (${ids.map(quote).join(', ')}) and import_key is null`)
}

if (failures === 0 && done) console.log(done)
else console.log(`${section} failures ${failures}`)

process.exit(failures === 0 && done ? 0 : 1)
