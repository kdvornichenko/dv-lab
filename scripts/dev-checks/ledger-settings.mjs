import * as core from '../../packages/core/src/index.ts'
import { STUDENT_LOGIN, TEACHER_LOGIN, call, quote, sql, startApi, studentCookie, teacherCookie } from './api.mjs'

const PORT = 4203
let failures = 0

function check(name, ok, detail = '') {
	if (ok) console.log(`PASS ${name}`)
	else {
		failures += 1
		console.log(`FAIL ${name}${detail ? ` ${detail}` : ''}`)
	}
}

function teacherId() {
	const result = sql(
		`select id from accounts where login = ${quote(TEACHER_LOGIN)} and role = 'teacher' and status = 'active'`
	)
	if (result.rows.length !== 1) throw new Error('teacher fixture account not found')
	return result.rows[0].id
}

function removeFixtureRow(accountId) {
	sql(`delete from teacher_settings where account_id = ${quote(accountId)}`)
}

function rowCount(accountId) {
	return sql(`select count(*)::int as n from teacher_settings where account_id = ${quote(accountId)}`).rows[0].n
}

const readValue = async (api, cookie) => {
	const res = await call(api, 'GET', '/settings', { cookie })
	return { status: res.status, value: res.json?.settings?.paysSoonLessons }
}

const save = (api, cookie, body) => call(api, 'PATCH', '/settings', { cookie, body })

async function partOne(api, cookie, accountId) {
	const initial = await readValue(api, cookie)
	check(
		'GET without a row gives the core default',
		initial.status === 200 && initial.value === core.PAYS_SOON_LESSONS_DEFAULT,
		`status ${initial.status} value ${initial.value}`
	)
	console.log(`threshold without row ${initial.value}`)

	const patched = await save(api, cookie, { paysSoonLessons: 5 })
	check(
		'PATCH 5 answers 200 with 5',
		patched.status === 200 && patched.json?.settings?.paysSoonLessons === 5,
		`status ${patched.status}`
	)

	const reread = await readValue(api, cookie)
	check('GET reads the saved value', reread.status === 200 && reread.value === 5, `value ${reread.value}`)
	console.log(`threshold saved ${reread.value}`)

	check('one teacher_settings row for the teacher', rowCount(accountId) === 1, `rows ${rowCount(accountId)}`)
	if (failures === 0) console.log('SETTINGS_PART1_OK')
}

function studentId() {
	const result = sql(`select id from accounts where login = ${quote(STUDENT_LOGIN)} and role = 'student'`)
	if (result.rows.length !== 1) throw new Error('student fixture account not found')
	return result.rows[0].id
}

const foreignRows = (accountId) =>
	sql(`select count(*)::int as n from teacher_settings where account_id <> ${quote(accountId)}`).rows[0].n

async function partTwo(api, cookie, accountId) {
	for (const value of [0, 20]) {
		const res = await save(api, cookie, { paysSoonLessons: value })
		check(
			`PATCH ${value} is accepted`,
			res.status === 200 && res.json?.settings?.paysSoonLessons === value,
			`status ${res.status}`
		)
	}
	await save(api, cookie, { paysSoonLessons: 4 })

	const refusals = [
		['21', { cookie, body: { paysSoonLessons: 21 } }],
		['-1', { cookie, body: { paysSoonLessons: -1 } }],
		['2.5', { cookie, body: { paysSoonLessons: 2.5 } }],
		['string "3"', { cookie, body: { paysSoonLessons: '3' } }],
		['null', { cookie, body: { paysSoonLessons: null } }],
		['empty object', { cookie, body: {} }],
		['null body', { cookie, body: null }],
		['no body', { cookie, headers: { 'content-type': 'application/json' } }],
		['no content type', { cookie }],
	]
	for (const [name, options] of refusals) {
		const res = await call(api, 'PATCH', '/settings', options)
		const reread = await readValue(api, cookie)
		check(
			`PATCH ${name} is refused and nothing is saved`,
			res.status === 400 && res.json?.error?.code === 'invalid_request' && reread.value === 4,
			`status ${res.status} code ${res.json?.error?.code} stored ${reread.value}`
		)
	}

	const student = studentId()
	const withForeign = await save(api, cookie, { paysSoonLessons: 7, accountId: student })
	check(
		'extra accountId in the body is ignored',
		withForeign.status === 200 && withForeign.json?.settings?.paysSoonLessons === 7,
		`status ${withForeign.status}`
	)
	check('no row for another account', foreignRows(accountId) === 0, `rows ${foreignRows(accountId)}`)
	check('still one row for the teacher', rowCount(accountId) === 1, `rows ${rowCount(accountId)}`)

	const studentSession = await studentCookie(api)
	const studentRead = await call(api, 'GET', '/settings', { cookie: studentSession })
	check('student GET is 403', studentRead.status === 403 && studentRead.json?.error?.code === 'forbidden')
	const studentSave = await save(api, studentSession, { paysSoonLessons: 9 })
	check('student PATCH is 403', studentSave.status === 403 && studentSave.json?.error?.code === 'forbidden')
	const afterStudent = await readValue(api, cookie)
	check('student attempts change nothing', afterStudent.value === 7 && foreignRows(accountId) === 0)

	const anonymousRead = await call(api, 'GET', '/settings')
	check('anonymous GET is 401', anonymousRead.status === 401 && anonymousRead.json?.error?.code === 'unauthenticated')
	const anonymousSave = await save(api, undefined, { paysSoonLessons: 9 })
	check('anonymous PATCH is 401', anonymousSave.status === 401 && anonymousSave.json?.error?.code === 'unauthenticated')

	const repeat = await save(api, cookie, { paysSoonLessons: 7 })
	check(
		'repeated save of the same value keeps one row',
		repeat.status === 200 && repeat.json?.settings?.paysSoonLessons === 7 && rowCount(accountId) === 1
	)
	if (failures === 0) console.log('SETTINGS_OK')
}

const api = await startApi({ port: PORT })
let accountId = null
try {
	const cookie = await teacherCookie(api)
	accountId = teacherId()
	removeFixtureRow(accountId)
	await partOne(api, cookie, accountId)
	await partTwo(api, cookie, accountId)
} finally {
	if (accountId !== null) removeFixtureRow(accountId)
	await api.stop()
}

if (failures > 0) {
	console.log(`SETTINGS_FAILED ${failures}`)
	process.exit(1)
}
