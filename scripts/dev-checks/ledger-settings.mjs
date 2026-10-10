import * as core from '../../packages/core/src/index.ts'
import { TEACHER_LOGIN, call, quote, sql, startApi, teacherCookie } from './api.mjs'

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

const api = await startApi({ port: PORT })
let accountId = null
try {
	const cookie = await teacherCookie(api)
	accountId = teacherId()
	removeFixtureRow(accountId)
	await partOne(api, cookie, accountId)
} finally {
	if (accountId !== null) removeFixtureRow(accountId)
	await api.stop()
}

if (failures > 0) {
	console.log(`SETTINGS_FAILED ${failures}`)
	process.exit(1)
}
