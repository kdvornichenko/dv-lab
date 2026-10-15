import { execFileSync, spawn } from 'node:child_process'
import { closeSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { get } from 'node:http'
import { createConnection } from 'node:net'

import { ROOT, STAND_ID, STAND_LAST, STAND_STATE, STATE_DIR } from './paths.mjs'

const usage = 'usage: node scripts/dev-checks/stand.mjs up [--api-port N] [--web-port N] [--git-sha V] | down | status'
const STATE = STAND_STATE
const API_LOG = `${STATE_DIR}/stand-${STAND_ID}-api.log`
const WEB_LOG = `${STATE_DIR}/stand-${STAND_ID}-web.log`
const GENERATED = ['apps/web/AGENTS.md']
const NEXT_LOCK = `${ROOT}/apps/web/.next/dev/lock`

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function option(args, name, fallback) {
	const index = args.indexOf(name)
	if (index === -1) return fallback
	const value = Number(args[index + 1])
	if (!Number.isInteger(value) || value < 1 || value > 65535) {
		console.log(`${name} needs a port number`)
		process.exit(2)
	}
	return value
}

function gitSha(args) {
	const index = args.indexOf('--git-sha')
	if (index === -1) return {}
	const value = args[index + 1] ?? ''
	if (!/^[0-9a-z-]{1,64}$/.test(value)) {
		console.log('--git-sha needs a version made of lowercase letters, digits and dashes')
		process.exit(2)
	}
	return { GIT_SHA: value }
}

function readState() {
	try {
		return JSON.parse(readFileSync(STATE, 'utf8'))
	} catch {
		return null
	}
}

function groupAlive(pgid) {
	try {
		process.kill(-pgid, 0)
		return true
	} catch (error) {
		return error?.code === 'EPERM'
	}
}

function listening(port) {
	return Promise.all(
		['127.0.0.1', '::1'].map(
			(host) =>
				new Promise((resolve) => {
					const socket = createConnection({ port, host })
					socket.setTimeout(1500)
					socket.on('connect', () => {
						socket.destroy()
						resolve(true)
					})
					socket.on('timeout', () => {
						socket.destroy()
						resolve(false)
					})
					socket.on('error', () => resolve(false))
				})
		)
	).then((results) => results.some(Boolean))
}

function owners(port) {
	try {
		const pids = execFileSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' })
			.trim()
			.split('\n')
			.filter(Boolean)
		return pids.map((pid) => {
			const command = execFileSync('ps', ['-o', 'command=', '-p', pid], { encoding: 'utf8' }).trim().slice(0, 160)
			const cwd = execFileSync('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn'], { encoding: 'utf8' })
				.split('\n')
				.find((line) => line.startsWith('n'))
			return `port ${port}: pid ${pid} cwd ${cwd?.slice(1) ?? 'unknown'} command ${command}`
		})
	} catch {
		return [`port ${port}: owner unknown`]
	}
}

function nextLock() {
	try {
		const lock = JSON.parse(readFileSync(NEXT_LOCK, 'utf8'))
		process.kill(lock.pid, 0)
		return lock
	} catch {
		return null
	}
}

function probe(url) {
	return new Promise((resolve) => {
		const request = get(url, (response) => {
			response.resume()
			resolve(response.statusCode)
		})
		request.setTimeout(10000, () => {
			request.destroy()
			resolve(0)
		})
		request.on('error', () => resolve(0))
	})
}

function cleanEnv(extra) {
	const env = { ...process.env, ...extra }
	delete env.DATABASE_URL
	delete env.MIGRATOR_DATABASE_URL
	return env
}

function start(command, args, env, log) {
	const fd = openSync(log, 'w', 0o600)
	const child = spawn(command, args, { cwd: ROOT, env, detached: true, stdio: ['ignore', fd, fd] })
	closeSync(fd)
	child.unref()
	return child.pid
}

function tail(log) {
	try {
		return readFileSync(log, 'utf8').trim().split('\n').slice(-15).join('\n')
	} catch {
		return ''
	}
}

async function waitFor(url, ok, pgid, seconds) {
	const end = Date.now() + seconds * 1000
	while (Date.now() < end) {
		if (!groupAlive(pgid)) return 'exited'
		if (ok(await probe(url))) return 'ok'
		await sleep(1000)
	}
	return 'timeout'
}

async function stopGroups(pgids) {
	for (const pgid of pgids) {
		try {
			process.kill(-pgid, 'SIGTERM')
		} catch {}
	}
	const end = Date.now() + 15000
	while (Date.now() < end && pgids.some(groupAlive)) await sleep(300)
	for (const pgid of pgids.filter(groupAlive)) {
		try {
			process.kill(-pgid, 'SIGKILL')
		} catch {}
	}
}

async function portsFree(ports, seconds) {
	const end = Date.now() + seconds * 1000
	let busy = ports
	while (Date.now() < end) {
		busy = []
		for (const port of ports) if (await listening(port)) busy.push(port)
		if (busy.length === 0) return []
		await sleep(500)
	}
	return busy
}

function tracked(file) {
	try {
		execFileSync('git', ['ls-files', '--error-unmatch', file], { cwd: ROOT, stdio: 'ignore' })
		return true
	} catch {
		return false
	}
}

function removeGenerated() {
	for (const file of GENERATED) {
		if (!tracked(file)) rmSync(`${ROOT}/${file}`, { force: true })
	}
}

function describe(state) {
	return `api http://localhost:${state.apiPort} (pgid ${state.apiPid}) web http://localhost:${state.webPort} (pgid ${state.webPid}) logs ${state.apiLog} ${state.webLog}`
}

async function up(args) {
	const apiPort = option(args, '--api-port', 4100)
	const webPort = option(args, '--web-port', 3000)
	const version = gitSha(args)
	const current = readState()
	if (current && (groupAlive(current.apiPid) || groupAlive(current.webPid))) {
		if (current.apiPort === apiPort && current.webPort === webPort) {
			console.log(`STAND_UP already running: ${describe(current)}`)
			return 0
		}
		console.log(`STAND_UP_FAIL another stand of this worktree runs: ${describe(current)}; run stand.mjs down first`)
		return 1
	}
	const taken = []
	for (const port of [apiPort, webPort]) if (await listening(port)) taken.push(port)
	if (taken.length > 0) {
		console.log(`STAND_UP_FAIL port ${taken.join(', ')} is taken by someone else`)
		for (const port of taken) for (const line of owners(port)) console.log(line)
		return 1
	}
	const lock = nextLock()
	if (lock) {
		console.log(`STAND_UP_FAIL next dev already runs in this worktree: pid ${lock.pid} port ${lock.port}`)
		for (const line of owners(lock.port)) console.log(line)
		return 1
	}
	const origin = `http://localhost:${webPort}`
	const apiUrl = `http://localhost:${apiPort}`
	const apiPid = start(
		process.execPath,
		[`--env-file-if-exists=${ROOT}/.env`, `${ROOT}/apps/api/src/server.ts`],
		cleanEnv({ PORT: String(apiPort), APP_ORIGIN: origin, ...version }),
		API_LOG
	)
	const webPid = start(
		'yarn',
		['workspace', '@dv-lab/web', 'dev', '-p', String(webPort)],
		cleanEnv({ PORT: String(webPort), API_DEV_PROXY_URL: apiUrl, API_INTERNAL_URL: apiUrl, ...version }),
		WEB_LOG
	)
	const state = {
		root: ROOT,
		apiPort,
		webPort,
		apiPid,
		webPid,
		apiLog: API_LOG,
		webLog: WEB_LOG,
		startedAt: new Date().toISOString(),
	}
	writeFileSync(STATE, JSON.stringify(state, null, '\t'), { mode: 0o600 })
	const api = await waitFor(`${apiUrl}/healthz`, (status) => status === 200, apiPid, 60)
	const web =
		api === 'ok' ? await waitFor(`${origin}/login`, (status) => status > 0 && status < 500, webPid, 240) : 'skipped'
	if (api !== 'ok' || web !== 'ok') {
		console.log(`STAND_UP_FAIL api ${api} web ${web}`)
		if (api !== 'ok') console.log(`api log:\n${tail(API_LOG)}`)
		if (web !== 'ok' && web !== 'skipped') console.log(`web log:\n${tail(WEB_LOG)}`)
		await down()
		return 1
	}
	console.log(`STAND_UP ${describe(state)}`)
	return 0
}

async function down() {
	const state = readState()
	if (!state) {
		console.log('STAND_DOWN nothing to stop: no state file for this worktree')
		return 0
	}
	await stopGroups([state.apiPid, state.webPid])
	const busy = await portsFree([state.apiPort, state.webPort], 20)
	removeGenerated()
	if (busy.length > 0) {
		console.log(`STAND_DOWN_FAIL port ${busy.join(', ')} still listening`)
		for (const port of busy) for (const line of owners(port)) console.log(line)
		return 1
	}
	try {
		renameSync(STATE, STAND_LAST)
	} catch {}
	console.log(`STAND_DOWN ports ${state.apiPort} ${state.webPort} free`)
	return 0
}

async function status() {
	const state = readState()
	if (!state) {
		console.log('STAND_STATUS down: no state file for this worktree')
		return 0
	}
	const api = groupAlive(state.apiPid) ? 'alive' : 'gone'
	const web = groupAlive(state.webPid) ? 'alive' : 'gone'
	console.log(`STAND_STATUS api ${api} web ${web} ${describe(state)} started ${state.startedAt}`)
	return 0
}

const [mode, ...rest] = process.argv.slice(2)
if (mode === 'up') process.exit(await up(rest))
if (mode === 'down') process.exit(await down())
if (mode === 'status') process.exit(await status())
console.log(usage)
process.exit(2)
