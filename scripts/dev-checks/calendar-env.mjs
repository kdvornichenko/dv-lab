import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ROOT, STATE_DIR } from './paths.mjs'

export { ROOT, STATE_DIR }

export const SYNTHETIC_KEY_ID = 'synthetic'
export const SYNTHETIC_CALENDAR_ID = 'synthetic-calendar'
const KEYRING_FILE = `${STATE_DIR}/calendar-keyring.json`
const OFFLINE = `${ROOT}/scripts/dev-checks/calendar-offline.mjs`
const ENV_FILES = { test: '.env.test', dev: '.env' }
const DATABASES = { test: /_test$/, dev: /_dev$/ }

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

function readKeyring() {
	try {
		const parsed = JSON.parse(readFileSync(KEYRING_FILE, 'utf8'))
		const value = parsed?.[SYNTHETIC_KEY_ID]
		if (typeof value === 'string' && Buffer.from(value, 'base64').length === 32) return value
	} catch {}
	return null
}

function keyringValue() {
	const existing = readKeyring()
	if (existing) return existing
	const value = randomBytes(32).toString('base64')
	try {
		writeFileSync(KEYRING_FILE, JSON.stringify({ [SYNTHETIC_KEY_ID]: value }), { mode: 0o600, flag: 'wx' })
		return value
	} catch (err) {
		if (err.code !== 'EEXIST') throw err
	}
	const raced = readKeyring()
	if (!raced) throw new Error('synthetic keyring file is unreadable')
	return raced
}

export function calendarEnv() {
	return {
		GOOGLE_CALENDAR_ENABLED: 'true',
		GOOGLE_CLIENT_ID: 'synthetic-client.example.test',
		GOOGLE_CLIENT_SECRET: 'synthetic-client-secret',
		GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/google/callback',
		GOOGLE_TOKEN_KEY_ID: SYNTHETIC_KEY_ID,
		GOOGLE_TOKEN_KEYRING: JSON.stringify({ [SYNTHETIC_KEY_ID]: keyringValue() }),
	}
}

export function syntheticTokenConfig() {
	const env = calendarEnv()
	return {
		enabled: true,
		clientId: env.GOOGLE_CLIENT_ID,
		clientSecret: env.GOOGLE_CLIENT_SECRET,
		redirectUri: env.GOOGLE_REDIRECT_URI,
		activeKeyId: SYNTHETIC_KEY_ID,
		keyring: { [SYNTHETIC_KEY_ID]: Buffer.from(keyringValue(), 'base64') },
	}
}

export function targetEnvFile(target) {
	const file = ENV_FILES[target]
	if (!file) throw new Error(`unknown target ${target}, expected test or dev`)
	return `${ROOT}/${file}`
}

export function calendarSql(target, role, text) {
	const result = spawnSync(
		process.execPath,
		[`${ROOT}/scripts/dev-checks/sql.mjs`, targetEnvFile(target), role, text],
		{
			cwd: ROOT,
			encoding: 'utf8',
			timeout: 60000,
		}
	)
	const line = (result.stdout ?? '').trim().split('\n').pop() ?? ''
	let out
	try {
		out = JSON.parse(line)
	} catch {
		throw new Error(`sql helper gave no JSON for ${target} (exit ${result.status})`)
	}
	if (out.error) throw new Error(`sql helper error on ${target}: ${JSON.stringify(out.error)}`)
	return out
}

export function assertTarget(target) {
	const [row] = calendarSql(target, 'migrator', 'select current_database() as name').rows
	if (!DATABASES[target].test(row.name)) throw new Error(`refused: ${target} database has the wrong suffix`)
}

function portFree(port) {
	return new Promise((done) => {
		const socket = net.connect(port, '127.0.0.1')
		socket.once('connect', () => {
			socket.destroy()
			done(false)
		})
		socket.once('error', (err) => done(err.code === 'ECONNREFUSED'))
	})
}

function healthz(port) {
	return new Promise((done) => {
		const req = http.request({ host: '127.0.0.1', port, method: 'GET', path: '/healthz' }, (res) => {
			res.resume()
			res.on('end', () => done(res.statusCode))
		})
		req.setTimeout(5000, () => req.destroy())
		req.on('error', () => done(null))
		req.end()
	})
}

const redact = (text) => text.replace(/postgres(ql)?:\/\/\S+/g, '<redacted>')

export async function startCalendarApi({ port, envFile, appOrigin }) {
	if (envFile !== '.env' && envFile !== '.env.test') throw new Error('envFile must be .env or .env.test')
	if (appOrigin !== undefined && !/^http:\/\/localhost:\d+$/.test(appOrigin))
		throw new Error('appOrigin must be a http://localhost origin')
	if (!(await portFree(port))) throw new Error(`port ${port} is busy`)
	const base = `http://localhost:${port}`
	const env = {
		...process.env,
		...calendarEnv(),
		NODE_ENV: envFile === '.env.test' ? 'test' : 'development',
		PORT: String(port),
		APP_ORIGIN: appOrigin ?? base,
		LOG_LEVEL: 'info',
	}
	delete env.DATABASE_URL
	delete env.MIGRATOR_DATABASE_URL
	const child = spawn(
		process.execPath,
		['--import', './scripts/dev-checks/calendar-offline.mjs', `--env-file=${envFile}`, 'apps/api/src/server.ts'],
		{ cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] }
	)
	let output = ''
	let exit = null
	child.stdout.on('data', (chunk) => (output += chunk))
	child.stderr.on('data', (chunk) => (output += chunk))
	const exited = new Promise((done) =>
		child.on('exit', (code, signal) => {
			exit = { code, signal }
			done(exit)
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
	const deadline = Date.now() + 30000
	while (Date.now() < deadline) {
		if (exit) throw new Error(`api exited early ${JSON.stringify(exit)}; log tail: ${redact(output.slice(-1500))}`)
		if ((await healthz(port)) === 200) return { base, port, logs: () => redact(output), stop }
		await sleep(200)
	}
	await stop()
	throw new Error(`api did not answer /healthz with 200 in 30 s; log tail: ${redact(output.slice(-1500))}`)
}

export function probeOffline() {
	const script = `import('node:dns').then((dns) => dns.promises.lookup('oauth2.googleapis.com')).then(() => process.exit(0), (err) => process.exit(err && err.code === 'ENOTFOUND' && String(err.message).includes('calendar-offline') ? 3 : 4))`
	const result = spawnSync(process.execPath, ['--import', OFFLINE, '-e', script], {
		cwd: ROOT,
		encoding: 'utf8',
		timeout: 30000,
	})
	return result.status === 3
}

const direct = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (direct) {
	const command = process.argv[2]
	if (command === 'probe') {
		if (probeOffline()) {
			console.log('OFFLINE_OK')
		} else {
			console.log('FAIL Google hosts still resolve under the offline preload')
			process.exit(1)
		}
	} else {
		console.log('usage: node scripts/dev-checks/calendar-env.mjs probe')
		process.exit(2)
	}
}
