import { spawn, spawnSync } from 'node:child_process'
import { randomBytes, randomInt } from 'node:crypto'
import { closeSync, existsSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import net from 'node:net'

import { ROOT, STATE_DIR } from './paths.mjs'

export { ROOT, STATE_DIR }
export const ENV_TEST = `${ROOT}/.env.test`
export const COOKIE_NAME = '__Host-dvlab_session'
export const TEACHER_LOGIN = 'teacher.fixture@example.test'
export const STUDENT_LOGIN = 'student.fixture'

const TEACHER_SECRET = `${STATE_DIR}/teacher.secret`
const TEACHER_LOCK = `${STATE_DIR}/teacher.lock`
const STUDENT_SECRET = `${STATE_DIR}/student.secret`
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function cleanEnv(extra = {}) {
	const env = { ...process.env, NODE_ENV: 'test', ...extra }
	delete env.DATABASE_URL
	delete env.MIGRATOR_DATABASE_URL
	return env
}

export function sql(text, role = 'migrator') {
	const result = spawnSync(process.execPath, [`${ROOT}/scripts/dev-checks/sql.mjs`, ENV_TEST, role, text], {
		encoding: 'utf8',
	})
	const line = (result.stdout ?? '').trim().split('\n').pop() ?? ''
	let out
	try {
		out = JSON.parse(line)
	} catch {
		throw new Error(`sql helper gave no JSON (exit ${result.status})`)
	}
	if (out.error) throw new Error(`sql helper error ${JSON.stringify(out.error)}`)
	return out
}

export const quote = (value) => `'${String(value).replaceAll("'", "''")}'`

function portFree(port) {
	return new Promise((resolve) => {
		const socket = net.connect(port, '127.0.0.1')
		socket.once('connect', () => {
			socket.destroy()
			resolve(false)
		})
		socket.once('error', (err) => resolve(err.code === 'ECONNREFUSED'))
	})
}

export async function startApi({ port }) {
	if (!(await portFree(port))) throw new Error(`port ${port} is busy`)
	const base = `http://127.0.0.1:${port}`
	const child = spawn(process.execPath, ['--env-file=.env.test', 'apps/api/src/server.ts'], {
		cwd: ROOT,
		env: cleanEnv({ PORT: String(port), APP_ORIGIN: base, LOG_LEVEL: 'info' }),
		stdio: ['ignore', 'pipe', 'pipe'],
	})
	let output = ''
	let exit = null
	child.stdout.on('data', (chunk) => (output += chunk))
	child.stderr.on('data', (chunk) => (output += chunk))
	const exited = new Promise((resolve) =>
		child.on('exit', (code, signal) => {
			exit = { code, signal }
			resolve(exit)
		})
	)
	const stop = async () => {
		if (exit) return exit
		child.kill('SIGTERM')
		const timeout = sleep(15000).then(() => 'timeout')
		if ((await Promise.race([exited, timeout])) === 'timeout') {
			child.kill('SIGKILL')
			await exited
		}
		return exit
	}
	const deadline = Date.now() + 20000
	while (Date.now() < deadline) {
		if (exit) throw new Error(`api exited early ${JSON.stringify(exit)}`)
		try {
			const res = await request(port, 'GET', '/healthz', {})
			if (res.status === 200) return { base, port, logs: () => output, stop }
		} catch {}
		await sleep(200)
	}
	await stop()
	const tail = output.slice(-1500).replace(/postgres(ql)?:\/\/\S+/g, '<redacted>')
	throw new Error(`api did not answer /healthz with 200 in 20 s; log tail: ${tail}`)
}

function request(port, method, path, headers, payload) {
	return new Promise((resolve, reject) => {
		const req = http.request({ host: '127.0.0.1', port, method, path, headers }, (res) => {
			let text = ''
			res.setEncoding('utf8')
			res.on('data', (chunk) => (text += chunk))
			res.on('end', () => {
				const received = new Headers()
				for (const [name, value] of Object.entries(res.headers)) {
					for (const item of Array.isArray(value) ? value : [value]) received.append(name, String(item))
				}
				resolve({ status: res.statusCode, text, headers: received })
			})
		})
		req.setTimeout(30000, () => req.destroy(new Error(`request timed out: ${method} ${path}`)))
		req.on('error', reject)
		if (payload !== undefined) req.write(payload)
		req.end()
	})
}

export async function call(api, method, path, { cookie, body, origin = true, headers = {} } = {}) {
	const sent = { ...headers }
	if (cookie) sent.cookie = `${COOKIE_NAME}=${cookie}`
	if (origin && MUTATING.has(method)) sent.origin = api.base
	if (body !== undefined) sent['content-type'] = 'application/json'
	const res = await request(api.port, method, path, sent, body === undefined ? undefined : JSON.stringify(body))
	let json = null
	try {
		json = JSON.parse(res.text)
	} catch {
		json = null
	}
	return { status: res.status, json, headers: res.headers }
}

const clientIp = () => `198.51.100.${randomInt(1, 255)}`

async function signIn(api, login, password) {
	const res = await call(api, 'POST', '/auth/sign-in', {
		body: { login, password },
		headers: { 'x-forwarded-for': clientIp() },
	})
	if (res.status !== 200) return null
	const line = res.headers.getSetCookie().find((item) => item.startsWith(`${COOKIE_NAME}=`))
	return line ? line.slice(COOKIE_NAME.length + 1).split(';')[0] : null
}

const newPassword = () => randomBytes(12).toString('base64url').slice(0, 16)

function bootstrapTeacher(password) {
	sql(`update accounts set status = 'deactivated', updated_at = now() where role = 'teacher' and status = 'active'`)
	const result = spawnSync(
		process.execPath,
		[
			'--env-file=.env.test',
			'apps/api/src/bootstrap-teacher.ts',
			'--email',
			TEACHER_LOGIN,
			'--name',
			'Test Teacher',
			'--password-stdin',
		],
		{ cwd: ROOT, env: cleanEnv(), input: `${password}\n`, encoding: 'utf8' }
	)
	if (result.status !== 0) throw new Error(`bootstrap-teacher exited with ${result.status}`)
}

async function ensureTeacherSecret() {
	if (existsSync(TEACHER_SECRET)) return
	let lock
	try {
		lock = openSync(TEACHER_LOCK, 'wx')
	} catch (err) {
		if (err.code !== 'EEXIST') throw err
		const deadline = Date.now() + 60000
		while (Date.now() < deadline) {
			if (existsSync(TEACHER_SECRET)) return
			await sleep(500)
		}
		throw new Error('teacher secret did not appear in 60 s')
	}
	try {
		const password = newPassword()
		bootstrapTeacher(password)
		writeFileSync(TEACHER_SECRET, password, { mode: 0o600 })
	} finally {
		closeSync(lock)
		unlinkSync(TEACHER_LOCK)
	}
}

export async function teacherCookie(api) {
	await ensureTeacherSecret()
	const password = readFileSync(TEACHER_SECRET, 'utf8').trim()
	const cookie = await signIn(api, TEACHER_LOGIN, password)
	if (cookie) return cookie
	const active = sql(
		`select count(*)::int as n from accounts where login = ${quote(TEACHER_LOGIN)} and role = 'teacher' and status = 'active'`
	)
	if (active.rows[0].n !== 0) throw new Error('teacher fixture exists but the stored password does not sign in')
	bootstrapTeacher(password)
	const again = await signIn(api, TEACHER_LOGIN, password)
	if (!again) throw new Error('teacher fixture re-created but sign-in failed')
	return again
}

export async function studentCookie(api) {
	if (!existsSync(STUDENT_SECRET)) writeFileSync(STUDENT_SECRET, newPassword(), { mode: 0o600 })
	const password = readFileSync(STUDENT_SECRET, 'utf8').trim()
	const cookie = await signIn(api, STUDENT_LOGIN, password)
	if (cookie) return cookie
	const { hashPassword } = await import(`${ROOT}/apps/api/src/auth/passwords.ts`)
	const hash = quote(await hashPassword(password))
	const updated = sql(
		`update accounts set password_hash = ${hash}, updated_at = now() where login = ${quote(STUDENT_LOGIN)} and role = 'student' and status = 'active'`,
		'app'
	)
	if (updated.rowCount === 0) {
		sql(
			`insert into accounts (login, display_name, role, password_hash) values (${quote(STUDENT_LOGIN)}, 'Student Fixture', 'student', ${hash})`,
			'app'
		)
	}
	const again = await signIn(api, STUDENT_LOGIN, password)
	if (!again) throw new Error('student fixture sign-in failed')
	return again
}
