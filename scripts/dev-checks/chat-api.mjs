import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { isDeepStrictEqual, parseEnv } from 'node:util'

import * as core from '../../packages/core/src/index.ts'
import { ENV_TEST, ROOT, STUDENT_LOGIN } from './api.mjs'
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
	answers: sectionAnswers,
	models: sectionModels,
	delete: sectionDelete,
	title: sectionTitle,
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

		const twinName = `${name} Twin`
		await createCard(ctx, twinName)
		await createCard(ctx, twinName)
		const goneName = 'Alex Example 2208 Gone'
		const typedGone = await createCard(ctx, goneName)
		const typedArchived = await as('POST', `/students/${typedGone}/archive`)
		check('the archived fixture card is archived', typedArchived.status === 200, `${typedArchived.status}`)
		const typedThread = await as('POST', '/chat/conversations')
		ctx.conversations.push(typedThread.json.conversation.id)
		const typedPost = (text, mentions = []) =>
			as('POST', `/chat/conversations/${typedThread.json.conversation.id}/messages`, {
				requestId: randomUUID(),
				text,
				mentions,
			})
		const typedStored = (res) => res.json?.messages?.[0]?.mentions
		const typedLower = name.toLowerCase()
		const typedText = `/recap @${typedLower}, please`
		const typed = await typedPost(typedText)
		check(
			'a typed @name without a binding is bound by the server in the units of the client, case-insensitive',
			typed.status === 201 &&
				isDeepStrictEqual(typedStored(typed), [
					{ studentId: card, text: typedLower, start: 8, end: 8 + name.length },
				]) &&
				typedText.slice(8, 8 + name.length) === typedLower,
			JSON.stringify(typedStored(typed))
		)
		const typedRead = await as('GET', `/chat/conversations/${typedThread.json.conversation.id}`)
		check(
			'the server binding is stored with the message',
			isDeepStrictEqual(typedRead.json.messages.find((item) => item.body === typedText)?.mentions, typedStored(typed))
		)
		const typedTwins = await typedPost(`@${twinName} hello`)
		check(
			'two active cards with one name are not bound and a shorter name is not taken instead',
			typedTwins.status === 201 && isDeepStrictEqual(typedStored(typedTwins), []),
			JSON.stringify(typedStored(typedTwins))
		)
		const typedArchivedPost = await typedPost(`@${goneName} hello`)
		check(
			'an archived card is not bound',
			typedArchivedPost.status === 201 && isDeepStrictEqual(typedStored(typedArchivedPost), []),
			JSON.stringify(typedStored(typedArchivedPost))
		)
		const clientText = `@${name} and @${name} again`
		const typedSecond = clientText.lastIndexOf('@') + 1
		const typedClient = await typedPost(clientText, [binding])
		check(
			'a client binding stays as sent and is not duplicated, another typed @name next to it is bound',
			typedClient.status === 201 &&
				isDeepStrictEqual(typedStored(typedClient), [
					binding,
					{ studentId: card, text: name, start: typedSecond, end: typedSecond + name.length },
				]),
			JSON.stringify(typedStored(typedClient))
		)
		const typedInside = await typedPost(`mail@${name} and @${name}x and @${name}`)
		const typedTail = `mail@${name} and @${name}x and @${name}`.lastIndexOf('@') + 1
		check(
			'a name inside a word or followed by a letter is not bound',
			typedInside.status === 201 &&
				isDeepStrictEqual(typedStored(typedInside), [
					{ studentId: card, text: name, start: typedTail, end: typedTail + name.length },
				]),
			JSON.stringify(typedStored(typedInside))
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

const dayRows = (block) =>
	block.lessons.map((lesson) => `${lesson.key}|${lesson.startsAt}|${lesson.outcome}|${lesson.studentId}`)

const todayRows = (lessons) =>
	lessons.map((lesson) => `${lesson.key}|${lesson.startsAt}|${lesson.outcome}|${lesson.studentId}`)

const dueRows = (students) =>
	students.map((item) => `${item.id}|${item.displayName}|${item.balanceMinutes}|${item.defaultLessonMinutes}`)

const countOf = (table) => Number(sql(`select count(*)::int as n from ${table}`).rows[0].n)

async function sectionAnswers(ctx) {
	const { api, cookie } = ctx
	const student = await studentCookie(api)
	const { createDb } = await import('../../packages/db/src/index.ts')
	const { readChatDay } = await import('../../apps/api/src/chat/facts.ts')
	const { readLessonDay } = await import('../../apps/api/src/today/today.ts')
	const { sendMessage } = await import('../../apps/api/src/chat/actions.ts')
	const url = parseEnv(readFileSync(ENV_TEST, 'utf8')).DATABASE_URL
	const { pool, db } = createDb(url)
	try {
		const accountId = sql(`select id from accounts where role = 'teacher' and status = 'active'`).rows[0].id
		const first = await call(api, 'GET', '/today', { cookie })
		if (first.status !== 200) throw new Error(`today returned ${first.status}`)
		const zone = first.json.defaultTimeZone
		const date = first.json.date
		const tomorrow = core.addDays(date, 1)
		const opening = core.addDays(date, -4)
		const cards = {
			unset: await createCard(ctx, 'Alex Example 2207'),
			owes: await createCard(ctx, 'Alex Example 2208'),
			zero: await createCard(ctx, 'Alex Example 2209'),
		}
		await setOpening(ctx, cards.owes, 0, opening)
		await setOpening(ctx, cards.zero, 0, opening)
		await doneLesson(ctx, cards.owes, core.addDays(opening, 1))
		const dayStart = core.startOfLessonDay(date, zone)
		const startsAt = new Date(Math.max(dayStart.getTime() + 60000, Date.now() - 30 * 60000)).toISOString()
		sql(
			`insert into lessons (student_id, starts_at, duration_minutes, status) values (${quote(cards.zero)}, ${quote(startsAt)}, 60, 'scheduled')`
		)
		const expected = { unset: null, owes: -60, zero: 0 }
		const todayRes = await call(api, 'GET', '/today', { cookie })
		if (todayRes.status !== 200) throw new Error(`today returned ${todayRes.status}`)

		const created = await call(api, 'POST', '/chat/conversations', { cookie })
		const conversation = created.json.conversation.id
		ctx.conversations.push(conversation)
		const say = (text) =>
			send(api, 'POST', `/chat/conversations/${conversation}/messages`, {
				cookie,
				body: { requestId: randomUUID(), text, mentions: [] },
			})
		const refresh = (key, as = cookie) => send(api, 'POST', '/chat/records/refresh', { cookie: as, body: { key } })

		const usageBefore = countOf('chat_usage_attempts')
		const turnsBefore = countOf('chat_turns')

		const today = await say('/today')
		const todayBlock = today.json?.messages?.[1]?.blocks?.[0]
		check(
			'/today answers 201 with one lessons block and no model turn',
			today.status === 201 &&
				today.json.turn === null &&
				today.json.messages.length === 2 &&
				today.json.messages[1].body === '' &&
				today.json.messages[1].blocks.length === 1 &&
				todayBlock.type === 'lessons' &&
				todayBlock.day === 'today'
		)
		check(
			'/today shows the lessons of GET /today for the same date and zone',
			isDeepStrictEqual(dayRows(todayBlock), todayRows(todayRes.json.lessons)) &&
				todayBlock.date === todayRes.json.date &&
				todayBlock.defaultTimeZone === zone &&
				todayBlock.calendarRead.state === todayRes.json.calendarRead.state,
			JSON.stringify(dayRows(todayBlock))
		)
		check(
			'the fixture lesson of today is in the block',
			todayBlock.lessons.some((lesson) => lesson.studentId === cards.zero && lesson.startsAt === startsAt)
		)

		const tomorrowReply = await say('/tomorrow')
		const tomorrowBlock = tomorrowReply.json?.messages?.[1]?.blocks?.[0]
		check(
			'/tomorrow answers a lessons block for the next day of the teacher zone',
			tomorrowReply.status === 201 &&
				tomorrowReply.json.turn === null &&
				tomorrowBlock.type === 'lessons' &&
				tomorrowBlock.day === 'tomorrow' &&
				tomorrowBlock.date === tomorrow &&
				tomorrowBlock.lessons.every((lesson) => core.lessonDay(new Date(lesson.startsAt), zone) === tomorrow)
		)

		const paysReply = await say('/payments')
		const paysBlock = paysReply.json?.messages?.[1]?.blocks?.[0]
		const dueToday = todayRes.json.paysSoon.map((item) => ({
			id: item.id,
			displayName: item.displayName,
			balanceMinutes: item.balanceMinutes,
			defaultLessonMinutes: item.defaultLessonMinutes,
		}))
		check(
			'/payments shows the Pays soon list of GET /today in the same order',
			paysReply.status === 201 &&
				paysReply.json.turn === null &&
				paysBlock.type === 'pays_soon' &&
				isDeepStrictEqual(dueRows(paysBlock.students), dueRows(dueToday)) &&
				paysBlock.paysSoonLessons === todayRes.json.paysSoonLessons,
			JSON.stringify(dueRows(paysBlock?.students ?? []))
		)
		check(
			'the debt and zero cards are in Pays soon and the card without an opening balance is not',
			paysBlock.students.some((item) => item.id === cards.owes && item.balanceMinutes === -60) &&
				paysBlock.students.some((item) => item.id === cards.zero && item.balanceMinutes === 0) &&
				!paysBlock.students.some((item) => item.id === cards.unset)
		)

		const spaced = await say('  /TODAY ')
		check('a read command ignores case and outer spaces', spaced.json?.messages?.[1]?.blocks?.[0]?.type === 'lessons')
		const prose = await say('/today please')
		check(
			'a read command with extra words is a free question and needs the model',
			prose.status === 201 &&
				prose.json.turn === null &&
				prose.json.messages[1].blocks.length === 1 &&
				prose.json.messages[1].blocks[0].type === 'refused' &&
				prose.json.messages[1].blocks[0].code === 'model_unavailable'
		)
		check(
			'no read command created a budget attempt or a model turn',
			countOf('chat_usage_attempts') === usageBefore && countOf('chat_turns') === turnsBefore
		)

		const tablesBefore = tableCounts()
		const listRes = await call(api, 'GET', '/students', { cookie })
		for (const [key, id] of Object.entries(cards)) {
			const res = await refresh({ kind: 'student', studentId: id })
			const detail = await call(api, 'GET', `/students/${id}`, { cookie })
			const block = res.json?.block
			check(
				`${key}: refresh answers a facts block with no-store`,
				res.status === 200 && res.headers.get('cache-control') === 'no-store' && block?.type === 'facts'
			)
			check(
				`${key}: the facts balance equals the profile and the list`,
				block.facts.balanceMinutes === detail.json.student.balanceMinutes &&
					block.facts.balanceMinutes === listRes.json.students.find((item) => item.id === id).balanceMinutes &&
					block.facts.balanceMinutes === expected[key],
				`got ${block.facts.balanceMinutes}`
			)
			check(
				`${key}: the facts next lesson equals the profile and is never none without a fresh read`,
				isDeepStrictEqual(block.facts.nextLesson, detail.json.student.nextLesson) &&
					(block.facts.nextLesson.result !== 'none' || block.facts.nextLesson.status.state === 'fresh')
			)
			check(
				`${key}: the facts Pays soon equals Today`,
				block.facts.paysSoon === todayRes.json.paysSoon.some((item) => item.id === id) &&
					block.facts.paysSoonLessons === todayRes.json.paysSoonLessons &&
					block.facts.defaultTimeZone === zone &&
					block.facts.student.id === id
			)
		}
		check(
			'the card without an opening balance has a null balance, not zero',
			(await refresh({ kind: 'student', studentId: cards.unset })).json.block.facts.balanceMinutes === null
		)
		const dayAgain = await refresh({ kind: 'day', day: 'today' })
		const paysAgain = await refresh({ kind: 'day', day: 'payments' })
		const tomorrowAgain = await refresh({ kind: 'day', day: 'tomorrow' })
		check(
			'refresh by day answers the same blocks as the commands',
			dayAgain.json.block.type === 'lessons' &&
				isDeepStrictEqual(dayRows(dayAgain.json.block), todayRows(todayRes.json.lessons)) &&
				paysAgain.json.block.type === 'pays_soon' &&
				isDeepStrictEqual(dueRows(paysAgain.json.block.students), dueRows(dueToday)) &&
				tomorrowAgain.json.block.type === 'lessons' &&
				tomorrowAgain.json.block.date === tomorrow
		)
		const malformed = [
			['no key', {}],
			['unknown kind', { key: { kind: 'week' } }],
			['bad student id', { key: { kind: 'student', studentId: 'x' } }],
			['bad day', { key: { kind: 'day', day: 'yesterday' } }],
			['extra field', { key: { kind: 'day', day: 'today' }, x: 1 }],
		]
		for (const [label, body] of malformed) {
			const res = await send(api, 'POST', '/chat/records/refresh', { cookie, body })
			check(`refresh ${label}: 400 invalid_request`, res.status === 400 && res.json?.error?.code === 'invalid_request')
		}
		const missing = await refresh({ kind: 'student', studentId: randomUUID() })
		check('refresh of an unknown student: 404', missing.status === 404 && missing.json?.error?.code === 'not_found')
		const asStudent = await refresh({ kind: 'day', day: 'today' }, student)
		check('refresh with a student session: 403 without data', asStudent.status === 403 && !('block' in asStudent.json))
		const anonymous = await send(api, 'POST', '/chat/records/refresh', {
			body: { key: { kind: 'day', day: 'today' } },
		})
		check('refresh without a session: 401', anonymous.status === 401)
		check('refresh and the read commands create no extra rows outside chat messages', tableCounts() === tablesBefore)

		const context = { accountId, now: new Date(), defaultTimeZone: 'Invalid/Zone', calendarEnabled: false }
		const broken = await sendMessage(db, context, conversation, {
			requestId: randomUUID(),
			text: '/today',
			mentions: [],
		})
		const failed = broken.kind === 'sent' ? broken.messages[1]?.blocks[0] : null
		check(
			'a failing read gives a read_failed block with the key and no model turn',
			failed?.type === 'read_failed' && failed.key.kind === 'day' && failed.key.day === 'today' && broken.turn === null
		)
		const healed = await refresh(failed.key)
		check(
			'Refresh records for the failed key answers a fresh lessons block',
			healed.status === 200 && healed.json.block.type === 'lessons'
		)

		const sunday = '2026-10-11'
		const sundayNoon = core.zonedInstant(sunday, '12:00', zone)
		const sundayContext = { accountId, now: sundayNoon, defaultTimeZone: zone }
		const monday = core.addDays(core.lessonDay(sundayNoon, zone), 1)
		const onSunday = await readChatDay(db, sundayContext, 'tomorrow')
		const owner = await readLessonDay(db, sundayContext, monday)
		check(
			'on a teacher Sunday, tomorrow is the Monday of the next week read from its own window',
			core.lessonDay(sundayNoon, zone) === sunday &&
				onSunday.date === monday &&
				core.mondayOf(monday) !== core.mondayOf(sunday) &&
				isDeepStrictEqual(dayRows(onSunday), todayRows(owner.lessons))
		)

		check(
			'the read commands left no budget attempt or turn behind',
			countOf('chat_usage_attempts') === usageBefore && countOf('chat_turns') === turnsBefore
		)
		return 'CHAT_ANSWERS_OK'
	} finally {
		await pool.end()
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

const MODELS_PORT = 4232
const DELETE_PORT = 4233
const TITLE_PORT = 4234
const HAIKU = 'claude-haiku-5-5'
const SONNET = 'claude-sonnet-5-5'
const OPUS = 'claude-opus-5-5'
const ABSENT = 'claude-absent-9-9'
const INVENTED = 'claude-invented-1-0'

async function startFakeProviderApi(port = MODELS_PORT, delay = '5') {
	const base = `http://127.0.0.1:${port}`
	const env = {
		...process.env,
		NODE_ENV: 'test',
		PORT: String(port),
		APP_ORIGIN: base,
		LOG_LEVEL: 'info',
		ANTHROPIC_API_KEY: 'sk-ant-fake-check',
		CHAT_FAKE_DELAY_MS: delay,
	}
	delete env.DATABASE_URL
	delete env.MIGRATOR_DATABASE_URL
	const child = spawn(
		process.execPath,
		[
			'--import',
			`${ROOT}/scripts/dev-checks/chat-fake-anthropic.mjs`,
			'--env-file=.env.test',
			'apps/api/src/server.ts',
		],
		{ cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] }
	)
	let output = ''
	child.stdout.on('data', (chunk) => (output += chunk))
	child.stderr.on('data', (chunk) => (output += chunk))
	const stop = () =>
		new Promise((resolve) => {
			if (child.exitCode !== null) return resolve()
			const timer = setTimeout(() => child.kill('SIGKILL'), 15000)
			child.once('exit', () => {
				clearTimeout(timer)
				resolve()
			})
			child.kill('SIGTERM')
		})
	const deadline = Date.now() + 30000
	while (Date.now() < deadline) {
		if (child.exitCode !== null) break
		try {
			if ((await fetch(`${base}/healthz`)).status === 200) return { base, port, logs: () => output, stop }
		} catch {}
		await new Promise((resolve) => setTimeout(resolve, 300))
	}
	await stop()
	throw new Error('the api with the fake provider did not answer /healthz in 30 s')
}

async function sectionModels(ctx) {
	const fake = await startFakeProviderApi()
	const accountId = sql(`select id from accounts where role = 'teacher' and status = 'active'`).rows[0].id
	const original = sql(
		`select chat_models as models, chat_model as model, chat_effort as effort, chat_monthly_cap_usd::text as cap from teacher_settings where account_id = ${quote(accountId)}`
	).rows[0]
	const clearBudget = () => {
		sql(`delete from chat_usage_attempts where account_id = ${quote(accountId)}`)
		return sql(`delete from chat_budget_periods where account_id = ${quote(accountId)}`).rowCount
	}
	try {
		const cookie = await teacherCookie(fake)
		const as = (method, path, body) => send(fake, method, path, { cookie, body })
		const track = (id) => ctx.conversations.push(id)
		console.log(`fixture conversations removed ${removeChats('true')}`)
		console.log(`fixture budget periods removed ${clearBudget()}`)
		const reset = await as('PATCH', '/settings/assistant', { models: null, model: null, effort: null })
		check('the settings start from the defaults', reset.status === 200 && reset.json.settings.model === null)
		const capabilities = async () => (await as('GET', '/settings/assistant')).json.capabilities
		const availableIds = async () =>
			(await capabilities())
				.filter((item) => item.available)
				.map((item) => item.id)
				.join()
		check(
			'with a provider all four default models are available, in the order of the settings',
			(await availableIds()) === `${HAIKU},${SONNET},${OPUS},claude-fable-5-1`,
			await availableIds()
		)

		const created = await as('POST', '/chat/conversations')
		const id = created.json.conversation.id
		track(id)
		const fresh = created.json.conversation
		check(
			'a new conversation shows the teacher default and no override',
			created.status === 201 && fresh.model === HAIKU && fresh.effort === 'medium' && fresh.override === false,
			JSON.stringify(fresh)
		)
		const patch = (body) => as('PATCH', `/chat/conversations/${id}/model`, body)
		const choose = await patch({ model: SONNET, effort: 'high', expectedRevision: fresh.revision })
		const chosen = choose.json.conversation
		check(
			'choosing a model and a level saves them with the conversation and bumps the revision',
			choose.status === 200 &&
				chosen.model === SONNET &&
				chosen.effort === 'high' &&
				chosen.override === true &&
				chosen.revision === fresh.revision + 1 &&
				chosen.updatedAt === fresh.updatedAt,
			JSON.stringify(chosen)
		)
		const read = await as('GET', `/chat/conversations/${id}`)
		const listed = (await as('GET', '/chat/conversations')).json.conversations.find((item) => item.id === id)
		check(
			'the read and the list give the same effective values',
			read.json.conversation.model === SONNET &&
				read.json.conversation.effort === 'high' &&
				listed?.model === SONNET &&
				listed.override === true
		)
		const stale = await patch({ model: OPUS, effort: null, expectedRevision: fresh.revision })
		check('a stale revision gives 409 and changes nothing', stale.status === 409)
		const unknown = await patch({ model: INVENTED, effort: null, expectedRevision: chosen.revision })
		check('a model outside the settings gives 400', unknown.status === 400)
		const wrongBody = await patch({ model: SONNET, expectedRevision: chosen.revision })
		check('a body without effort gives 400', wrongBody.status === 400)
		const none = await as('PATCH', `/chat/conversations/${randomUUID()}/model`, {
			model: null,
			effort: null,
			expectedRevision: 1,
		})
		check('an unknown conversation gives 404', none.status === 404)
		const anonymous = await send(fake, 'PATCH', `/chat/conversations/${id}/model`, {
			body: { model: null, effort: null, expectedRevision: chosen.revision },
		})
		check('no session gives 401', anonymous.status === 401)
		check(
			'the override is stored on the conversation row',
			sql(`select model_override as m, effort_override as e from chat_conversations where id = ${quote(id)}`).rows[0]
				.m === SONNET
		)
		const back = await patch({ model: null, effort: null, expectedRevision: chosen.revision })
		check(
			'null and null reset the conversation to the teacher default',
			back.status === 200 &&
				back.json.conversation.model === HAIKU &&
				back.json.conversation.override === false &&
				sql(`select model_override as m from chat_conversations where id = ${quote(id)}`).rows[0].m === null
		)

		const trimmed = (await as('GET', '/settings/assistant')).json.settings.models.map((model) =>
			model.id === HAIKU ? { ...model, efforts: ['low', 'medium', 'high'] } : model
		)
		const withAbsent = [
			...trimmed,
			{
				...trimmed[0],
				id: ABSENT,
				name: 'Absent',
				description: 'Not given to this key',
				efforts: ['low', 'medium'],
				defaultEffort: 'medium',
				recommendedEffort: 'medium',
			},
		]
		const saved = await as('PATCH', '/settings/assistant', { models: withAbsent })
		check('the models with a lower ceiling and an absent one are saved', saved.status === 200)
		const abilities = saved.json.capabilities
		check(
			'a model the provider does not know is listed as unavailable',
			abilities.find((item) => item.id === ABSENT)?.available === false &&
				abilities.find((item) => item.id === HAIKU)?.available === true
		)
		let revision = back.json.conversation.revision
		const toAbsent = await patch({ model: ABSENT, effort: null, expectedRevision: revision })
		check('choosing a model the provider does not give gives 400', toAbsent.status === 400)
		const tooHigh = await patch({ model: HAIKU, effort: 'max', expectedRevision: revision })
		check('a level above the ceiling of the model gives 400', tooHigh.status === 400)
		const lowered = await patch({ model: HAIKU, effort: 'high', expectedRevision: revision })
		check(
			'a level inside the ceiling is accepted',
			lowered.status === 200 && lowered.json.conversation.effort === 'high'
		)
		revision = lowered.json.conversation.revision
		const effortOnly = await patch({ model: null, effort: 'low', expectedRevision: revision })
		check(
			'a level alone applies to the model of the teacher',
			effortOnly.status === 200 &&
				effortOnly.json.conversation.model === HAIKU &&
				effortOnly.json.conversation.effort === 'low' &&
				effortOnly.json.conversation.override === true
		)
		revision = effortOnly.json.conversation.revision

		const toOpus = await patch({ model: OPUS, effort: 'xhigh', expectedRevision: revision })
		revision = toOpus.json.conversation.revision
		const withoutOpus = trimmed.filter((model) => model.id !== OPUS)
		await as('PATCH', '/settings/assistant', { models: withoutOpus })
		const orphan = (await as('GET', `/chat/conversations/${id}`)).json.conversation
		check(
			'a model removed from the settings stays on the conversation and is not replaced',
			orphan.model === OPUS && orphan.override === true,
			JSON.stringify(orphan)
		)
		const orphanChoice = await patch({ model: OPUS, effort: null, expectedRevision: revision })
		check('the removed model cannot be chosen again', orphanChoice.status === 400)
		const orphanSend = await as('POST', `/chat/conversations/${id}/messages`, {
			requestId: randomUUID(),
			text: 'Plan the next lesson',
			mentions: [],
		})
		check(
			'sending with a removed model is refused with model_unavailable and no turn',
			orphanSend.status === 201 &&
				orphanSend.json.turn === null &&
				orphanSend.json.messages[1].blocks[0]?.code === 'model_unavailable',
			JSON.stringify(orphanSend.json?.messages?.[1]?.blocks)
		)
		const release = await patch({ model: null, effort: null, expectedRevision: revision })
		check('a removed model can always be reset', release.status === 200 && release.json.conversation.model === HAIKU)
		await as('PATCH', '/settings/assistant', { models: null, model: null, effort: null })

		const second = await as('POST', '/chat/conversations')
		const secondId = second.json.conversation.id
		track(secondId)
		const third = await as('POST', '/chat/conversations')
		const thirdId = third.json.conversation.id
		track(thirdId)
		const own = await as('PATCH', `/chat/conversations/${thirdId}/model`, {
			model: OPUS,
			effort: 'low',
			expectedRevision: third.json.conversation.revision,
		})
		await as('PATCH', '/settings/assistant', { model: SONNET, effort: 'xhigh' })
		const afterDefault = (await as('GET', '/chat/conversations')).json.conversations
		const plain = afterDefault.find((item) => item.id === secondId)
		const kept = afterDefault.find((item) => item.id === thirdId)
		check(
			'a new default changes the conversations without a choice of their own and not the others',
			own.status === 200 &&
				plain?.model === SONNET &&
				plain.effort === 'xhigh' &&
				plain.override === false &&
				kept?.model === OPUS &&
				kept.effort === 'low',
			JSON.stringify([plain, kept])
		)
		await as('PATCH', '/settings/assistant', { model: null, effort: null })

		const running = await as('POST', '/chat/conversations')
		const runningId = running.json.conversation.id
		track(runningId)
		const picked = await as('PATCH', `/chat/conversations/${runningId}/model`, {
			model: HAIKU,
			effort: 'low',
			expectedRevision: running.json.conversation.revision,
		})
		const hung = await as('POST', `/chat/conversations/${runningId}/messages`, {
			requestId: randomUUID(),
			text: '[fake:hang] think about the next lesson',
			mentions: [],
		})
		const turn = hung.json.turn
		check(
			'an accepted turn keeps the model and the level it was admitted with',
			picked.status === 200 && hung.status === 201 && turn?.model === HAIKU && turn.effort === 'low',
			JSON.stringify(turn)
		)
		const during = await as('PATCH', `/chat/conversations/${runningId}/model`, {
			model: SONNET,
			effort: 'high',
			expectedRevision: picked.json.conversation.revision,
		})
		const sameTurn = await as('GET', `/chat/turns/${turn.id}`)
		check(
			'a change during the turn is saved and the running turn keeps its own model and level',
			during.status === 200 &&
				during.json.conversation.model === SONNET &&
				sameTurn.json.turn.model === HAIKU &&
				sameTurn.json.turn.effort === 'low' &&
				['accepted', 'running'].includes(sameTurn.json.turn.state)
		)
		const busy = await as('POST', `/chat/conversations/${runningId}/messages`, {
			requestId: randomUUID(),
			text: 'And another question',
			mentions: [],
		})
		check('a second message during the turn is still refused as busy', busy.status === 409)
		const stopped = await as('POST', `/chat/turns/${turn.id}/stop`, {})
		check('the turn stops', stopped.status === 200 && stopped.json.turn.state === 'stopped', `${stopped.status}`)
		const next = await as('POST', `/chat/conversations/${runningId}/messages`, {
			requestId: randomUUID(),
			text: '[fake:hang] one more time',
			mentions: [],
		})
		check(
			'the next Send uses the new choice',
			next.status === 201 && next.json.turn?.model === SONNET && next.json.turn.effort === 'high',
			JSON.stringify(next.json?.turn)
		)
		await as('POST', `/chat/turns/${next.json.turn.id}/stop`, {})
		await as('PATCH', '/settings/assistant', { monthlyCapUsd: '0.01' })
		const capped = await as('GET', '/settings/assistant')
		check(
			'a cap below the held reserve is the reached state',
			capped.json.budget.state === 'reached',
			capped.json.budget.state
		)
		const quick = await as('POST', `/chat/conversations/${runningId}/messages`, {
			requestId: randomUUID(),
			text: '/today',
			mentions: [],
		})
		check(
			'a quick form still answers at the cap and is not a refusal',
			quick.status === 201 && quick.json.turn === null && quick.json.messages[1].blocks[0]?.type !== 'refused',
			JSON.stringify(quick.json?.messages?.[1]?.blocks?.[0]?.type)
		)
		const paid = await as('POST', `/chat/conversations/${runningId}/messages`, {
			requestId: randomUUID(),
			text: 'Plan the next lesson',
			mentions: [],
		})
		let ended = paid.json.turn
		for (let attempt = 0; ended && ['accepted', 'running'].includes(ended.state) && attempt < 50; attempt++) {
			await new Promise((resolve) => setTimeout(resolve, 100))
			ended = (await as('GET', `/chat/turns/${ended.id}`)).json.turn
		}
		const answer = (await as('GET', `/chat/conversations/${runningId}`)).json.messages.at(-1)
		check(
			'a paid question at the cap ends without an answer and with a refusal block',
			paid.status === 201 &&
				answer.role === 'assistant' &&
				answer.body === '' &&
				answer.blocks.some((block) => block.type === 'refused'),
			JSON.stringify(answer.blocks.map((block) => block.type))
		)
		check(
			'api log has no key and no fixture name',
			!fake.logs().includes('sk-ant-fake-check') && !fake.logs().includes('Alex Example')
		)
		return 'CHAT_MODELS_OK'
	} finally {
		await fake.stop()
		if (original?.cap)
			sql(`update teacher_settings set chat_monthly_cap_usd = ${original.cap} where account_id = ${quote(accountId)}`)
		sql(
			`update teacher_settings set chat_models = ${original?.models == null ? 'null' : `${quote(JSON.stringify(original.models))}::jsonb`}, chat_model = ${original?.model == null ? 'null' : quote(original.model)}, chat_effort = ${original?.effort == null ? 'null' : quote(original.effort)} where account_id = ${quote(accountId)}`
		)
		console.log(`fixture budget periods removed ${clearBudget()}`)
	}
}

const conversationFacts = (conversationId) =>
	sql(
		`select
			(select count(*)::int from chat_messages where conversation_id = ${quote(conversationId)}) as messages,
			(select count(*)::int from chat_messages where conversation_id = ${quote(conversationId)} and redacted_at is not null) as redacted,
			(select count(*)::int from chat_messages where conversation_id = ${quote(conversationId)} and (body <> '' or mentions <> '[]'::jsonb or blocks <> '[]'::jsonb)) as with_content,
			(select count(*)::int from chat_actions where conversation_id = ${quote(conversationId)}) as actions,
			(select count(*)::int from chat_turns where conversation_id = ${quote(conversationId)}) as turns,
			(select count(*)::int from chat_usage_attempts where conversation_id = ${quote(conversationId)}) as attempts,
			(select coalesce(sum(spent_nano), 0)::text from chat_budget_periods) as spent,
			(select coalesce(sum(held_nano), 0)::text from chat_budget_periods) as held,
			(select title from chat_conversations where id = ${quote(conversationId)}) as title,
			(select deleted_at is not null from chat_conversations where id = ${quote(conversationId)}) as deleted`
	).rows[0]

async function sectionDelete(ctx) {
	const fake = await startFakeProviderApi(DELETE_PORT)
	const accountId = sql(`select id from accounts where role = 'teacher' and status = 'active'`).rows[0].id
	const clearBudget = () => {
		sql(`delete from chat_usage_attempts where account_id = ${quote(accountId)}`)
		return sql(`delete from chat_budget_periods where account_id = ${quote(accountId)}`).rowCount
	}
	try {
		const cookie = await teacherCookie(fake)
		const as = (method, path, body) => send(fake, method, path, { cookie, body })
		const track = (id) => ctx.conversations.push(id)
		console.log(`fixture conversations removed ${removeChats('true')}`)
		console.log(`fixture budget periods removed ${clearBudget()}`)
		const zone = sql(
			`select coalesce((select default_time_zone from teacher_settings where account_id = ${quote(accountId)}), ${quote(VN)}) as zone`
		).rows[0].zone
		const today = core.scheduleToday(new Date(), zone)
		const yesterday = core.addDays(today, -1)
		const name = 'Alex Example 2207'
		const card = await createCard(ctx, name)
		await setOpening(ctx, card, 600, core.addDays(today, -60))
		const lessonId = sql(
			`insert into lessons (student_id, starts_at, duration_minutes, status) values (${quote(card)}, ${quote(core.zonedInstant(yesterday, '09:00', zone).toISOString())}, 60, 'scheduled') returning id`
		).rows[0].id
		const binding = { studentId: card, text: name, start: 1, end: 1 + name.length }
		const created = await as('POST', '/chat/conversations')
		const id = created.json.conversation.id
		track(id)
		const post = (conversationId, body) => as('POST', `/chat/conversations/${conversationId}/messages`, body)
		const remove = async (conversationId) => {
			const read = await as('GET', `/chat/conversations/${conversationId}`)
			return as('DELETE', `/chat/conversations/${conversationId}`, {
				expectedRevision: read.json.conversation.revision,
			})
		}
		const noteText = 'Zeta delete check note'
		const marked = await post(id, { requestId: randomUUID(), text: `@${name} was ${yesterday}`, mentions: [binding] })
		const noted = await post(id, {
			requestId: randomUUID(),
			text: `/note @${name} ${noteText}`,
			mentions: [{ studentId: card, text: name, start: 7, end: 7 + name.length }],
		})
		const markAction = marked.json?.messages?.[1]?.blocks?.[0]
		check(
			'the fixture conversation holds a mark and a note made from chat',
			marked.status === 201 &&
				markAction?.type === 'action_result' &&
				noted.status === 201 &&
				noted.json.messages[1].blocks[0]?.type === 'action_result' &&
				markOf(lessonId)?.kind === 'done',
			`${marked.status} ${noted.status}`
		)
		const noteRows = () =>
			sql(`select count(*)::int as n from student_notes where student_id = ${quote(card)}`).rows[0].n

		const hung = await post(id, {
			requestId: randomUUID(),
			text: '[fake:hang] think about the next lesson',
			mentions: [],
		})
		const turn = hung.json.turn
		check('a turn is running in the conversation', hung.status === 201 && ['accepted', 'running'].includes(turn?.state))
		const duringTurn = await remove(id)
		const afterBusy = conversationFacts(id)
		check(
			'Delete during a running turn: 409 busy and nothing changes',
			duringTurn.status === 409 &&
				duringTurn.json?.error?.code === 'busy' &&
				afterBusy.redacted === 0 &&
				afterBusy.deleted === false &&
				(await as('GET', `/chat/conversations/${id}`)).status === 200,
			`${duringTurn.status} ${JSON.stringify(duringTurn.json)}`
		)
		const live = await as('GET', `/chat/turns/${turn.id}`)
		check(
			'the running turn was not stopped by the refused Delete',
			['accepted', 'running'].includes(live.json.turn.state)
		)
		const stopped = await as('POST', `/chat/turns/${turn.id}/stop`, {})
		check('Stop ends the turn', stopped.status === 200 && stopped.json.turn.state === 'stopped', `${stopped.status}`)

		const assistantMessage = sql(
			`select id from chat_messages where conversation_id = ${quote(id)} and role = 'assistant' order by created_at limit 1`
		).rows[0].id
		const calendarAction = (state, result) =>
			sql(
				`insert into chat_actions (account_id, conversation_id, message_id, kind, state, result) values (${quote(accountId)}, ${quote(id)}, ${quote(assistantMessage)}, 'calendar', ${quote(state)}, ${quote(JSON.stringify(result))}::jsonb) returning id`
			).rows[0].id
		const submitted = calendarAction('submitted', { state: 'pending', commandId: null })
		const calendarBusy = await remove(id)
		check(
			'Delete with an unfinished calendar command: 409 busy',
			calendarBusy.status === 409 && calendarBusy.json?.error?.code === 'busy',
			`${calendarBusy.status}`
		)
		sql(
			`update chat_actions set state = 'applied', result = '{"state":"applied"}'::jsonb, undo_result = '{"undo":"pending"}'::jsonb where id = ${quote(submitted)}`
		)
		const undoBusy = await remove(id)
		check(
			'Delete with an unfinished calendar undo: 409 busy',
			undoBusy.status === 409 && undoBusy.json?.error?.code === 'busy',
			`${undoBusy.status}`
		)
		sql(`update chat_actions set undo_result = '{"undo":"available"}'::jsonb where id = ${quote(submitted)}`)
		const proposed = calendarAction('proposed', { state: 'proposed' })
		sql(
			`update chat_usage_attempts set state = 'unknown' where conversation_id = ${quote(id)} and state in ('reserved', 'dispatched')`
		)
		const unknownAttempts = sql(
			`select count(*)::int as n from chat_usage_attempts where conversation_id = ${quote(id)} and state = 'unknown'`
		).rows[0].n

		const other = await as('POST', '/chat/conversations')
		track(other.json.conversation.id)
		const otherSent = await post(other.json.conversation.id, { requestId: randomUUID(), text: '/today', mentions: [] })
		const renamed = await as('PATCH', `/chat/conversations/${other.json.conversation.id}`, {
			title: 'Kept chat',
			expectedRevision: other.json.conversation.revision,
		})
		const staleDelete = await as('DELETE', `/chat/conversations/${other.json.conversation.id}`, {
			expectedRevision: other.json.conversation.revision,
		})
		check(
			'a stale revision is 409 precondition_failed, not busy, and changes nothing',
			otherSent.status === 201 &&
				renamed.status === 200 &&
				staleDelete.status === 409 &&
				staleDelete.json?.error?.code === 'precondition_failed' &&
				conversationFacts(other.json.conversation.id).redacted === 0
		)

		const before = conversationFacts(id)
		const notesBefore = noteRows()
		const markBefore = markOf(lessonId)
		const actionsBefore = sql(
			`select id, state, result::text as result from chat_actions where conversation_id = ${quote(id)} and id <> ${quote(proposed)} order by id`
		).rows
		check(
			'before Delete the conversation holds text, mentions and blocks',
			before.messages >= 6 &&
				before.with_content > 0 &&
				before.redacted === 0 &&
				before.turns === 1 &&
				before.attempts >= 1,
			JSON.stringify(before)
		)
		const removed = await remove(id)
		check(
			'Delete after the turn ended: 204',
			removed.status === 204,
			`${removed.status} ${JSON.stringify(removed.json)}`
		)
		const after = conversationFacts(id)
		check(
			'the rows stay and every message is redacted: empty text, no mentions, no blocks, redacted_at set',
			after.messages === before.messages &&
				after.redacted === before.messages &&
				after.with_content === 0 &&
				after.title === 'Deleted chat' &&
				after.deleted === true,
			JSON.stringify(after)
		)
		const actionsAfter = sql(
			`select id, state, result::text as result from chat_actions where conversation_id = ${quote(id)} and id <> ${quote(proposed)} order by id`
		).rows
		check(
			'the receipts of the actions stay as they were',
			after.actions === before.actions && isDeepStrictEqual(actionsAfter, actionsBefore)
		)
		const voided = sql(`select state, result::text as result from chat_actions where id = ${quote(proposed)}`).rows[0]
		check(
			'a never confirmed calendar proposal is closed so it cannot be confirmed later',
			voided.state === 'refused' && JSON.parse(voided.result).state === 'stale',
			JSON.stringify(voided)
		)
		const confirmAfter = await as('POST', `/chat/actions/${proposed}/confirm`, {})
		check('confirming that proposal after Delete gives 404', confirmAfter.status === 404, `${confirmAfter.status}`)
		check(
			'turns and usage attempts stay, the unconfirmed attempt too, and the month totals do not change',
			after.turns === before.turns &&
				after.attempts === before.attempts &&
				unknownAttempts >= 1 &&
				sql(
					`select count(*)::int as n from chat_usage_attempts where conversation_id = ${quote(id)} and state = 'unknown'`
				).rows[0].n === unknownAttempts &&
				after.spent === before.spent &&
				after.held === before.held,
			`${JSON.stringify(before)} ${JSON.stringify(after)}`
		)
		check(
			'the note and the mark made from chat stay',
			noteRows() === notesBefore && notesBefore >= 1 && isDeepStrictEqual(markOf(lessonId), markBefore)
		)
		const gone = await as('GET', `/chat/conversations/${id}`)
		const listed = (await as('GET', '/chat/conversations')).json.conversations.map((item) => item.id)
		check(
			'the conversation is gone from the read and the list, the other one stays',
			gone.status === 404 && !listed.includes(id) && listed.includes(other.json.conversation.id)
		)
		const otherRead = await as('GET', `/chat/conversations/${other.json.conversation.id}`)
		check(
			'another conversation keeps its messages',
			otherRead.status === 200 &&
				otherRead.json.messages.length === 2 &&
				conversationFacts(other.json.conversation.id).redacted === 0
		)
		const again = await as('DELETE', `/chat/conversations/${id}`, { expectedRevision: 1 })
		check('Delete of the same conversation again: 404', again.status === 404, `${again.status}`)
		const resend = await post(id, { requestId: randomUUID(), text: 'Hello again', mentions: [] })
		check('Send into the deleted conversation: 404', resend.status === 404, `${resend.status}`)
		check(
			'api log has no note text and no fixture name',
			!fake.logs().includes(noteText) && !fake.logs().includes('Alex Example')
		)
		return 'CHAT_DELETE_OK'
	} finally {
		await fake.stop()
		console.log(`fixture budget periods removed ${clearBudget()}`)
	}
}

async function sectionTitle(ctx) {
	const fake = await startFakeProviderApi(TITLE_PORT, '30')
	const accountId = sql(`select id from accounts where role = 'teacher' and status = 'active'`).rows[0].id
	const original = sql(
		`select chat_models as models, chat_model as model, chat_effort as effort, chat_monthly_cap_usd::text as cap from teacher_settings where account_id = ${quote(accountId)}`
	).rows[0]
	const clearBudget = () => {
		sql(`delete from chat_usage_attempts where account_id = ${quote(accountId)}`)
		return sql(`delete from chat_budget_periods where account_id = ${quote(accountId)}`).rowCount
	}
	const TITLE = 'Fake plan for the next lesson'
	try {
		const cookie = await teacherCookie(fake)
		const as = (method, path, body) => send(fake, method, path, { cookie, body })
		console.log(`fixture conversations removed ${removeChats('true')}`)
		console.log(`fixture budget periods removed ${clearBudget()}`)
		await as('PATCH', '/settings/assistant', { models: null, model: null, effort: null, monthlyCapUsd: '10.00' })
		const name = 'Alex Example 2209 Title'
		const card = await createCard(ctx, name)
		const fresh = async () => {
			const created = await as('POST', '/chat/conversations')
			ctx.conversations.push(created.json.conversation.id)
			return created.json.conversation.id
		}
		const ask = (id, text, mentions = []) =>
			as('POST', `/chat/conversations/${id}/messages`, { requestId: randomUUID(), text, mentions })
		const settle = async (turnId) => {
			const deadline = Date.now() + 20000
			while (Date.now() < deadline) {
				const res = await as('GET', `/chat/turns/${turnId}`)
				if (res.status === 200 && !['accepted', 'running'].includes(res.json.turn.state)) return res.json.turn
				await new Promise((resolve) => setTimeout(resolve, 50))
			}
			throw new Error('turn did not finish in time')
		}
		const outcomeOf = async (turnId) => {
			const deadline = Date.now() + 15000
			while (Date.now() < deadline) {
				for (const line of fake.logs().split('\n')) {
					if (!line.includes('chat title finished') || !line.includes(turnId)) continue
					return JSON.parse(line).outcome
				}
				await new Promise((resolve) => setTimeout(resolve, 50))
			}
			return 'none'
		}
		const row = (id) => sql(`select title, revision from chat_conversations where id = ${quote(id)}`).rows[0] ?? null
		const titleAttempts = (id) =>
			sql(
				`select state, model, cost_nano::text as cost from chat_usage_attempts where conversation_id = ${quote(id)} and turn_id is null order by created_at, id`
			).rows
		const refusedIn = (res) =>
			(res.json?.messages ?? []).some((message) => message.blocks.some((block) => block.type === 'refused'))
		const turnOf = async (id, text, mentions) => {
			const sent = await ask(id, text, mentions)
			const turn = await settle(sent.json.turn.id)
			const read = await as('GET', `/chat/conversations/${id}`)
			return { sent, turn, read }
		}

		const first = await fresh()
		const binding = { studentId: card, text: name, start: 1, end: 1 + name.length }
		const one = await turnOf(first, `@${name} plan the next lesson`, [binding])
		const firstOutcome = await outcomeOf(one.turn.id)
		const listed = (await as('GET', '/chat/conversations')).json.conversations.find((item) => item.id === first)
		const firstTitles = titleAttempts(first)
		check(
			'after the first answered turn the conversation gets a cleaned title and the next revision',
			one.turn.state === 'completed' &&
				one.turn.issue === null &&
				firstOutcome === 'applied' &&
				row(first)?.title === TITLE &&
				row(first)?.revision === 2 &&
				listed?.title === TITLE &&
				listed.revision === 2,
			JSON.stringify({ state: one.turn.state, firstOutcome, row: row(first) })
		)
		check(
			'the title request is one settled attempt of the cheapest model without a turn',
			firstTitles.length === 1 &&
				firstTitles[0].state === 'settled' &&
				firstTitles[0].model === 'claude-haiku-5-5' &&
				BigInt(firstTitles[0].cost) > 0n,
			JSON.stringify(firstTitles)
		)
		const two = await turnOf(first, 'And one idea for homework')
		check(
			'a second turn does not ask for a title again and the title stays',
			two.turn.state === 'completed' &&
				(await outcomeOf(two.turn.id)) === 'titled' &&
				row(first)?.title === TITLE &&
				row(first)?.revision === 2 &&
				titleAttempts(first).length === 1
		)

		const raced = await fresh()
		const slowSent = await ask(raced, '[fake:title-slow] plan the next lesson')
		const slow = await settle(slowSent.json.turn.id)
		const renamed = await as('PATCH', `/chat/conversations/${raced}`, { title: 'Manual name', expectedRevision: 1 })
		const racedOutcome = await outcomeOf(slow.id)
		check(
			'a rename while the title is asked for wins and the title is not applied',
			slow.state === 'completed' &&
				renamed.status === 200 &&
				racedOutcome === 'changed' &&
				row(raced)?.title === 'Manual name' &&
				row(raced)?.revision === 2 &&
				titleAttempts(raced).length === 1,
			JSON.stringify({ racedOutcome, status: renamed.status, row: row(raced) })
		)

		const named = await fresh()
		await as('PATCH', `/chat/conversations/${named}`, { title: 'Named before', expectedRevision: 1 })
		const early = await turnOf(named, 'plan the next lesson')
		check(
			'a conversation renamed before the first turn asks for no title',
			(await outcomeOf(early.turn.id)) === 'titled' &&
				row(named)?.title === 'Named before' &&
				titleAttempts(named).length === 0
		)

		const failing = await fresh()
		const failed = await turnOf(failing, '[fake:title-error] plan the next lesson')
		const failedOutcome = await outcomeOf(failed.turn.id)
		const failedTitles = titleAttempts(failing)
		const after = await turnOf(failing, 'plan the lesson after that')
		check(
			'a provider error keeps New chat, the reply has no error and the title is not asked again',
			failed.turn.state === 'completed' &&
				failed.turn.issue === null &&
				!refusedIn(failed.read) &&
				failedOutcome === 'provider_fault' &&
				failedTitles.length === 1 &&
				failedTitles[0].state === 'settled' &&
				failedTitles[0].cost === '0' &&
				(await outcomeOf(after.turn.id)) === 'not_first' &&
				row(failing)?.title === 'New chat' &&
				row(failing)?.revision === 1 &&
				titleAttempts(failing).length === 1,
			JSON.stringify({ failedOutcome, failedTitles, row: row(failing) })
		)

		const blank = await fresh()
		const empty = await turnOf(blank, '[fake:title-empty] plan the next lesson')
		check(
			'an empty title is not applied',
			(await outcomeOf(empty.turn.id)) === 'empty' && row(blank)?.title === 'New chat' && row(blank)?.revision === 1
		)

		const wordy = await fresh()
		const long = await turnOf(wordy, '[fake:title-long] plan the next lesson')
		check(
			'a long title is cut at a word boundary to 40 characters',
			(await outcomeOf(long.turn.id)) === 'applied' && row(wordy)?.title === 'Fake plan for the next lesson with many',
			JSON.stringify(row(wordy))
		)

		const gone = await fresh()
		const goneSent = await ask(gone, '[fake:title-slow] plan the next lesson')
		const goneTurn = await settle(goneSent.json.turn.id)
		const removed = await as('DELETE', `/chat/conversations/${gone}`, { expectedRevision: 1 })
		check(
			'a conversation deleted while the title is asked for keeps Deleted chat',
			goneTurn.state === 'completed' &&
				removed.status === 204 &&
				(await outcomeOf(goneTurn.id)) === 'changed' &&
				row(gone)?.title === 'Deleted chat'
		)

		const capped = await fresh()
		const cappedSent = await ask(capped, 'plan the next lesson')
		const cappedTurnId = cappedSent.json.turn.id
		const deadline = Date.now() + 10000
		let periodId = null
		while (Date.now() < deadline && periodId === null) {
			periodId =
				sql(`select period_id from chat_usage_attempts where turn_id = ${quote(cappedTurnId)} limit 1`).rows[0]
					?.period_id ?? null
			if (periodId === null) await new Promise((resolve) => setTimeout(resolve, 20))
		}
		const CAP = 10_000_000_000n
		if (periodId !== null)
			sql(`update chat_budget_periods set spent_nano = spent_nano + ${CAP} where id = ${quote(periodId)}`)
		const cappedTurn = await settle(cappedTurnId)
		const cappedRead = await as('GET', `/chat/conversations/${capped}`)
		const cappedOutcome = await outcomeOf(cappedTurnId)
		if (periodId !== null)
			sql(`update chat_budget_periods set spent_nano = spent_nano - ${CAP} where id = ${quote(periodId)}`)
		check(
			'a reached budget after the turn keeps New chat without an error in the chat and without an attempt',
			periodId !== null &&
				cappedTurn.state === 'completed' &&
				cappedTurn.issue === null &&
				!refusedIn(cappedRead) &&
				cappedOutcome === 'budget_reached' &&
				row(capped)?.title === 'New chat' &&
				titleAttempts(capped).length === 0,
			JSON.stringify({ periodId, state: cappedTurn.state, cappedOutcome })
		)

		check(
			'api log has no title text, no message text and no fixture name',
			!fake.logs().includes(TITLE) &&
				!fake.logs().includes('Manual name') &&
				!fake.logs().includes('plan the next lesson') &&
				!fake.logs().includes('Alex Example')
		)
		return 'CHAT_TITLE_OK'
	} finally {
		await fake.stop()
		if (original?.cap)
			sql(`update teacher_settings set chat_monthly_cap_usd = ${original.cap} where account_id = ${quote(accountId)}`)
		sql(
			`update teacher_settings set chat_models = ${original?.models == null ? 'null' : `${quote(JSON.stringify(original.models))}::jsonb`}, chat_model = ${original?.model == null ? 'null' : quote(original.model)}, chat_effort = ${original?.effort == null ? 'null' : quote(original.effort)} where account_id = ${quote(accountId)}`
		)
		console.log(`fixture budget periods removed ${clearBudget()}`)
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
