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

const section = process.argv[2]
const run = SECTIONS[section]

if (section === 'target') {
	const child = spawnSync(process.execPath, [new URL('./chat-target.mjs', import.meta.url).pathname], {
		stdio: 'inherit',
	})
	process.exit(child.status ?? 1)
}

if (!run) {
	console.log(`usage: node scripts/dev-checks/chat-api.mjs ${[...Object.keys(SECTIONS), 'target'].join('|')}`)
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
	if (conversations.length > 0)
		sql(`delete from chat_conversations where id in (${conversations.map(quote).join(', ')})`)
	if (ids.length > 0) removeEntries(`id in (${ids.map(quote).join(', ')}) and import_key is null`)
	if (ids.length > 0) removeCards(`id in (${ids.map(quote).join(', ')}) and import_key is null`)
}

if (failures === 0 && done) console.log(done)
else console.log(`${section} failures ${failures}`)

process.exit(failures === 0 && done ? 0 : 1)
