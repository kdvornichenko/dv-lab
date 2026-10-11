import * as core from '../../../packages/core/src/index.ts'
import {
	call as apiCall,
	sql,
	quote,
	TEACHER_LOGIN,
	STUDENT_LOGIN,
	startApi,
	teacherCookie,
	studentCookie,
} from '../api.mjs'

type ApiExit = { code: number | null; signal: string | null }
type Api = { base: string; port: number; stop: () => Promise<ApiExit | null> }
type Body = { paysSoonLessons?: number | string | null; accountId?: string } | null
type Options = { cookie?: string; body?: Body; headers?: Record<string, string> }
type Json = { settings?: { paysSoonLessons?: number }; error?: { code?: string } }
type Response = { status: number; json: Json | null }
function record(value: unknown): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('invalid settings response')
	return value as Record<string, unknown>
}
function json(value: unknown): Json | null {
	if (value === null) return null
	const raw = record(value)
	const result: Json = {}
	if (raw.settings !== undefined) {
		const settings = record(raw.settings)
		if (settings.paysSoonLessons !== undefined && typeof settings.paysSoonLessons !== 'number')
			throw new Error('invalid settings value')
		result.settings = { paysSoonLessons: settings.paysSoonLessons }
	}
	if (raw.error !== undefined) {
		const error = record(raw.error)
		if (error.code !== undefined && typeof error.code !== 'string') throw new Error('invalid settings error code')
		result.error = { code: error.code }
	}
	return result
}
async function request(api: Api, method: string, path: string, options?: Options): Promise<Response> {
	const response = await apiCall(api, method, path, options)
	return { status: response.status, json: json(response.json) }
}
const readValue = async (api: Api, cookie: string) => {
	const res = await request(api, 'GET', '/settings', { cookie })
	return { status: res.status, value: res.json?.settings?.paysSoonLessons }
}
const save = (api: Api, cookie: string | undefined, body: Body) => request(api, 'PATCH', '/settings', { cookie, body })

type Row = Record<string, unknown>
function readRows(text: string): Row[] {
	const result: unknown = sql(text)
	if (typeof result !== 'object' || result === null || !('rows' in result) || !Array.isArray(result.rows))
		throw new Error('invalid settings SQL result')
	return (result.rows as unknown[]).map((value) => {
		if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('invalid settings SQL row')
		return value as Row
	})
}
function execute(text: string): void {
	sql(text)
}
function teacherId(): string {
	const rows = readRows(
		`select id from accounts where login = ${quote(TEACHER_LOGIN)} and role = 'teacher' and status = 'active'`
	)
	if (rows.length !== 1) throw new Error('teacher fixture account not found')
	const id = rows[0].id
	if (typeof id !== 'string') throw new Error('invalid teacher fixture id')
	return id
}

function removeFixtureRow(accountId: string) {
	execute(`delete from teacher_settings where account_id = ${quote(accountId)}`)
}

function rowCount(accountId: string): number {
	return count(`select count(*)::int as n from teacher_settings where account_id = ${quote(accountId)}`)
}

function studentId(): string {
	const rows = readRows(`select id from accounts where login = ${quote(STUDENT_LOGIN)} and role = 'student'`)
	if (rows.length !== 1) throw new Error('student fixture account not found')
	const id = rows[0].id
	if (typeof id !== 'string') throw new Error('invalid student fixture id')
	return id
}

const foreignRows = (accountId: string) =>
	count(`select count(*)::int as n from teacher_settings where account_id <> ${quote(accountId)}`)

function count(text: string): number {
	const value = readRows(text)[0].n
	if (typeof value !== 'number') throw new Error('invalid settings row count')
	return value
}

type SettingsSnapshot = {
	accountId: string
	row: { paysSoonLessons: number; updatedAt: string } | null
}

function snapshotSettings(accountId: string): SettingsSnapshot {
	const rows = readRows(
		`select pays_soon_lessons, updated_at::text as updated_at from teacher_settings where account_id = ${quote(accountId)}`
	)
	if (rows.length === 0) return { accountId, row: null }
	if (rows.length !== 1) throw new Error('invalid teacher settings snapshot count')
	const row = rows[0]
	if (typeof row.pays_soon_lessons !== 'number' || typeof row.updated_at !== 'string') {
		throw new Error('invalid teacher settings snapshot')
	}
	return { accountId, row: { paysSoonLessons: row.pays_soon_lessons, updatedAt: row.updated_at } }
}

function restoreSettings(snapshot: SettingsSnapshot): void {
	const { accountId, row } = snapshot
	if (row === null) {
		removeFixtureRow(accountId)
		return
	}
	execute(
		`insert into teacher_settings (account_id, pays_soon_lessons, updated_at) values (${quote(accountId)}, ${row.paysSoonLessons}, ${quote(row.updatedAt)}::timestamptz) on conflict (account_id) do update set pays_soon_lessons = excluded.pays_soon_lessons, updated_at = excluded.updated_at`
	)
}

class ApiCloseError extends Error {
	readonly exit: ApiExit | null
	constructor(exit: ApiExit | null) {
		super('settings API close failed')
		this.exit = exit
	}
}

async function closeApi(api: Api): Promise<void> {
	const exit = await api.stop()
	if (exit === null || exit.code !== 0 || exit.signal !== null) throw new ApiCloseError(exit)
}

async function cleanup(api: Api, snapshot: SettingsSnapshot | null, errors: unknown[]): Promise<void> {
	try {
		if (snapshot !== null) restoreSettings(snapshot)
	} catch (error) {
		errors.push(error)
	}
	try {
		await closeApi(api)
	} catch (error) {
		errors.push(error)
	}
}

function failureExit(error: unknown): number {
	if (error instanceof AggregateError) {
		const errors: unknown[] = error.errors
		return failureExit(errors[0])
	}
	if (error instanceof ApiCloseError && error.exit?.code !== null && error.exit?.code !== undefined) {
		return error.exit.code === 0 ? 1 : error.exit.code
	}
	return 1
}

function reportFailure(error: unknown): void {
	process.exitCode = failureExit(error)
	console.error('SETTINGS runtime or cleanup failed')
}

const call = request

let failures = 0

function check(name: string, ok: boolean, detail = '') {
	if (ok) console.log(`PASS ${name}`)
	else {
		failures += 1
		console.log(`FAIL ${name}${detail ? ` ${detail}` : ''}`)
	}
}

const failureCount = () => failures

async function partOne(api: Api, cookie: string, accountId: string): Promise<void> {
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
	if (failureCount() === 0) console.log('SETTINGS_PART1_OK')
}

async function boundaryValues(api: Api, cookie: string): Promise<void> {
	for (const value of [0, 20]) {
		const res = await save(api, cookie, { paysSoonLessons: value })
		check(
			`PATCH ${value} is accepted`,
			res.status === 200 && res.json?.settings?.paysSoonLessons === value,
			`status ${res.status}`
		)
	}
	await save(api, cookie, { paysSoonLessons: 4 })
}

async function refusalVectors(api: Api, cookie: string): Promise<void> {
	const refusals: [string, Options][] = [
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
}

async function isolationVectors(api: Api, cookie: string, accountId: string): Promise<void> {
	const student = studentId()
	const withForeign = await save(api, cookie, { paysSoonLessons: 7, accountId: student })
	check(
		'extra accountId in the body is ignored',
		withForeign.status === 200 && withForeign.json?.settings?.paysSoonLessons === 7,
		`status ${withForeign.status}`
	)
	check('no row for another account', foreignRows(accountId) === 0, `rows ${foreignRows(accountId)}`)
	check('still one row for the teacher', rowCount(accountId) === 1, `rows ${rowCount(accountId)}`)
}

async function accessVectors(api: Api, cookie: string, accountId: string): Promise<void> {
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
}

async function repeatSave(api: Api, cookie: string, accountId: string): Promise<void> {
	const repeat = await save(api, cookie, { paysSoonLessons: 7 })
	check(
		'repeated save of the same value keeps one row',
		repeat.status === 200 && repeat.json?.settings?.paysSoonLessons === 7 && rowCount(accountId) === 1
	)
}

const PORT = 4203

async function run(): Promise<void> {
	const api = await startApi({ port: PORT })
	let snapshot: SettingsSnapshot | null = null
	const errors: unknown[] = []
	try {
		const cookie = await teacherCookie(api)
		const accountId = teacherId()
		snapshot = snapshotSettings(accountId)
		removeFixtureRow(accountId)
		await partOne(api, cookie, accountId)
		await boundaryValues(api, cookie)
		await refusalVectors(api, cookie)
		await isolationVectors(api, cookie, accountId)
		await accessVectors(api, cookie, accountId)
		await repeatSave(api, cookie, accountId)
		if (failureCount() === 0) console.log('SETTINGS_OK')
	} catch (error) {
		errors.push(error)
	} finally {
		await cleanup(api, snapshot, errors)
	}
	if (errors.length === 1) throw errors[0]
	if (errors.length > 1) throw new AggregateError(errors, 'settings acceptance and cleanup failed')
	if (failureCount() > 0) {
		console.log(`SETTINGS_FAILED ${failureCount()}`)
		process.exit(1)
	}
}

export { run, reportFailure }
