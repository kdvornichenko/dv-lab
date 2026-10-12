import { spawnSync } from 'node:child_process'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

import { ROOT, SYNTHETIC_CALENDAR_ID, calendarSql, startCalendarApi, targetEnvFile } from './calendar-env.mjs'

const PORT = 4106
if (process.env.CALENDAR_PUSH_OFFLINE !== '1') {
	const child = spawnSync(
		process.execPath,
		['--import', `${ROOT}/scripts/dev-checks/calendar-offline.mjs`, new URL(import.meta.url).pathname],
		{ cwd: ROOT, stdio: 'inherit', env: { ...process.env, CALENDAR_PUSH_OFFLINE: '1' } }
	)
	process.exit(child.status ?? 1)
}

const { createDb, resolveDatabaseUrl, googleSyncState } = await import(`${ROOT}/packages/db/src/index.ts`)
const { eq } = await import('drizzle-orm')
const { createCalendarWatch } = await import(`${ROOT}/apps/api/src/calendar/watch.ts`)

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const short = (value) => sha256(String(value)).slice(0, 12)
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

function fail(check, message) {
	throw new Error(`${check}: ${message}`)
}

function rows(text) {
	return calendarSql('test', 'migrator', text).rows
}

function seed(...args) {
	const result = spawnSync(process.execPath, [`${ROOT}/scripts/dev-checks/calendar-seed.mjs`, ...args], {
		cwd: ROOT,
		encoding: 'utf8',
		timeout: 120000,
	})
	if (result.status !== 0)
		throw new Error(
			`calendar-seed ${args.join(' ')} exited ${result.status}: ${(result.stdout ?? '').trim().split('\n').pop()}`
		)
	return result.stdout ?? ''
}

function syncRow(connectionId) {
	const [row] = rows(
		`select requested_seq::int as requested, channel_id, channel_resource_id, channel_token_hash, channel_expires_at,
retiring_channel_id, retiring_resource_id, watch_issue, to_jsonb(s)::text as whole
from google_sync_state s where connection_id = ${quote(connectionId)}`
	)
	return row
}

async function notify(base, headers) {
	const response = await fetch(`${base}/google/notifications`, { method: 'POST', headers })
	await response.arrayBuffer()
	return response.status
}

function stubSource(behaviour) {
	const calls = { watch: [], stop: [] }
	return {
		calls,
		async watch(_token, _calendarId, request) {
			calls.watch.push(request)
			if (behaviour.watchFails) throw new Error('synthetic watch failure')
			return { resourceId: `synthetic-resource-${randomUUID()}`, expiresAt: new Date(Date.now() + 7 * 86400000) }
		},
		async stopChannel(_token, pair) {
			calls.stop.push(pair)
			if (behaviour.stopFails) throw new Error('synthetic stop failure')
		},
	}
}

async function httpChecks(connection) {
	const channel = randomUUID()
	const token = randomBytes(32).toString('base64url')
	rows(`update google_sync_state set channel_id = ${quote(channel)}, channel_token_hash = ${quote(sha256(token))},
channel_expires_at = now() + interval '3 days' where connection_id = ${quote(connection.id)}`)
	const retired = randomUUID()
	const retiredChannel = randomUUID()
	const retiredToken = randomBytes(32).toString('base64url')
	rows(`begin;
insert into google_connections (id, account_id, calendar_id, calendar_label, calendar_time_zone, history_cutover_at, generation,
credential_generation, state, created_at, retired_at) values (${quote(retired)}, ${quote(connection.account_id)},
${quote(`${SYNTHETIC_CALENDAR_ID}-retired`)}, 'Synthetic retired', ${quote(connection.calendar_time_zone)}, now() - interval '2 days', 1, 1,
'not_connected', now() - interval '2 days', now() - interval '1 day');
insert into google_sync_state (connection_id, account_id, calendar_id, window_start, window_end, next_poll_at, next_full_at,
claimed_until, channel_id, channel_resource_id, channel_token_hash, channel_expires_at) values (${quote(retired)},
${quote(connection.account_id)}, ${quote(`${SYNTHETIC_CALENDAR_ID}-retired`)}, now() - interval '8 weeks', now() + interval '53 weeks',
timestamptz '2999-01-01 00:00:00+00', timestamptz '2999-01-01 00:00:00+00', timestamptz '2999-01-01 00:00:00+00',
${quote(retiredChannel)}, 'synthetic-resource-retired', ${quote(sha256(retiredToken))}, now() + interval '3 days');
commit;`)

	const api = await startCalendarApi({ port: PORT, envFile: '.env.test' })
	try {
		const base = api.base
		const headers = (id, secret, state = 'exists') => ({
			'X-Goog-Channel-ID': id,
			'X-Goog-Channel-Token': secret,
			'X-Goog-Resource-State': state,
			'X-Goog-Resource-ID': 'synthetic-resource',
			'X-Goog-Message-Number': '2',
		})
		const start = syncRow(connection.id).requested
		const unknown = await notify(base, headers(randomUUID(), token))
		const afterUnknown = syncRow(connection.id).requested
		const wrong = await notify(base, headers(channel, randomBytes(32).toString('base64url')))
		const afterWrong = syncRow(connection.id).requested
		console.log(
			`push 1 unknown channel ${unknown} requested +${afterUnknown - start}; wrong token ${wrong} requested +${afterWrong - afterUnknown}`
		)
		if (unknown !== 404 || wrong !== 404 || afterWrong !== start)
			fail('push 1', 'an unknown channel or wrong token was accepted')

		const accepted = await notify(base, headers(channel, token))
		const afterAccepted = syncRow(connection.id).requested
		const syncState = await notify(base, headers(channel, token, 'sync'))
		const afterSync = syncRow(connection.id).requested
		console.log(
			`push 2 right token ${accepted} requested +${afterAccepted - afterWrong}; state sync ${syncState} requested +${afterSync - afterAccepted}`
		)
		if (accepted !== 204 || afterAccepted !== afterWrong + 1 || syncState !== 204 || afterSync !== afterAccepted)
			fail('push 2', 'a valid notification did not raise requested_seq exactly once')

		await sleep(1100)
		const statuses = []
		for (let index = 0; index < 20; index += 1) statuses.push(await notify(base, headers(channel, token)))
		const afterFlood = syncRow(connection.id).requested
		console.log(
			`push 3 twenty rapid posts: statuses ${[...new Set(statuses)].join(',')} requested +${afterFlood - afterSync}`
		)
		if (statuses.some((status) => status !== 204) || afterFlood - afterSync < 1 || afterFlood - afterSync > 3)
			fail('push 3', 'the per-channel limit did not hold')

		const retiredBefore = syncRow(retired).requested
		const retiredStatus = await notify(base, headers(retiredChannel, retiredToken))
		const retiredAfter = syncRow(retired).requested
		console.log(`push 4 retired connection channel ${retiredStatus} requested +${retiredAfter - retiredBefore}`)
		if (retiredStatus !== 404 || retiredAfter !== retiredBefore)
			fail('push 4', 'a retired connection channel was accepted')

		const logs = api.logs()
		const leaked = [token, retiredToken, channel].some((value) => logs.includes(value)) || /x-goog/i.test(logs)
		console.log(`push 5 api log: notification headers present ${leaked}`)
		if (leaked) fail('push 5', 'the api log carries notification headers')
	} finally {
		await api.stop()
	}
}

async function maintainChecks(db, connection) {
	const logger = { info() {}, warn() {} }
	const read = async () => {
		const [row] = await db.select().from(googleSyncState).where(eq(googleSyncState.connectionId, connection.id))
		return row
	}
	rows(`update google_sync_state set channel_id = null, channel_resource_id = null, channel_token_hash = null, channel_expires_at = null,
retiring_channel_id = null, retiring_resource_id = null, watch_issue = null where connection_id = ${quote(connection.id)}`)

	const plain = stubSource({})
	const local = createCalendarWatch({ db, source: plain, appOrigin: `http://localhost:${PORT}`, logger })
	const localOutcome = await local.maintain(await read(), 'synthetic')
	console.log(`watch 1 http origin: ${localOutcome} register_calls ${plain.calls.watch.length}`)
	if (localOutcome !== 'insecure' || plain.calls.watch.length) fail('watch 1', 'an http origin registered a channel')

	const secure = stubSource({})
	const watch = createCalendarWatch({ db, source: secure, appOrigin: 'https://calendar.example.test', logger })
	const registered = await watch.maintain(await read(), 'synthetic')
	const first = syncRow(connection.id)
	const request = secure.calls.watch[0]
	const hashOnly =
		first.channel_id === request?.id &&
		first.channel_token_hash === sha256(request.token) &&
		!first.whole.includes(request.token) &&
		request.address === 'https://calendar.example.test/api/google/notifications' &&
		request.ttlSeconds === 604800
	console.log(`watch 2 https origin: ${registered} channel ${short(first.channel_id)} hash_only ${hashOnly}`)
	if (registered !== 'registered' || !hashOnly) fail('watch 2', 'registration did not store only the token hash')

	rows(
		`update google_sync_state set channel_expires_at = now() + interval '1 hour' where connection_id = ${quote(connection.id)}`
	)
	const renewed = await watch.maintain(await read(), 'synthetic')
	const second = syncRow(connection.id)
	const stoppedOld = secure.calls.stop.some(
		(pair) => pair.id === first.channel_id && pair.resourceId === first.channel_resource_id
	)
	console.log(
		`watch 3 renewal: ${renewed} new_channel ${second.channel_id !== first.channel_id} old_stopped ${stoppedOld} retiring_cleared ${second.retiring_channel_id === null}`
	)
	if (
		renewed !== 'renewed' ||
		second.channel_id === first.channel_id ||
		!stoppedOld ||
		second.retiring_channel_id !== null
	)
		fail('watch 3', 'renewal did not move and stop the old channel')

	rows(
		`update google_sync_state set channel_expires_at = now() + interval '1 hour' where connection_id = ${quote(connection.id)}`
	)
	const stubborn = stubSource({ stopFails: true })
	const failing = createCalendarWatch({ db, source: stubborn, appOrigin: 'https://calendar.example.test', logger })
	const kept = await failing.maintain(await read(), 'synthetic')
	const third = syncRow(connection.id)
	const [state] = rows(`select state from google_connections where id = ${quote(connection.id)}`)
	console.log(
		`watch 4 failed stop: ${kept} retiring_kept ${third.retiring_channel_id === second.channel_id} watch_issue ${third.watch_issue} connection ${state.state}`
	)
	if (
		third.retiring_channel_id !== second.channel_id ||
		third.watch_issue !== 'stop_failed' ||
		state.state !== 'connected'
	)
		fail('watch 4', 'a failed stop changed more than the watch issue')

	rows(`update google_sync_state set channel_id = null, channel_resource_id = null, channel_token_hash = null, channel_expires_at = null,
retiring_channel_id = null, retiring_resource_id = null, watch_issue = null where connection_id = ${quote(connection.id)}`)
	const broken = createCalendarWatch({
		db,
		source: stubSource({ watchFails: true }),
		appOrigin: 'https://calendar.example.test',
		logger,
	})
	const refused = await broken.maintain(await read(), 'synthetic')
	const fourth = syncRow(connection.id)
	const [after] = rows(`select state from google_connections where id = ${quote(connection.id)}`)
	console.log(`watch 5 failed register: ${refused} watch_issue ${fourth.watch_issue} connection ${after.state}`)
	if (fourth.watch_issue !== 'watch_failed' || after.state !== 'connected')
		fail('watch 5', 'a failed registration changed the connection')
}

function caddyCheck() {
	const which = spawnSync('caddy', ['version'], { encoding: 'utf8' })
	if (which.error || which.status !== 0) {
		console.log('caddy: binary not available locally, CI runs caddy validate')
		return
	}
	const result = spawnSync('caddy', ['validate', '--config', 'deploy/caddy/Caddyfile', '--adapter', 'caddyfile'], {
		cwd: ROOT,
		encoding: 'utf8',
	})
	console.log(`caddy validate exit ${result.status}`)
	if (result.status !== 0) fail('caddy', 'caddy validate failed')
}

let db = null
let exitCode = 0
try {
	const up = seed('up', 'test', 'week')
	if (!up.includes('SEED_UP')) throw new Error('calendar-seed up printed no result')
	const [connection] = rows(
		`select id, account_id, calendar_id, calendar_time_zone from google_connections where calendar_id = ${quote(SYNTHETIC_CALENDAR_ID)} and retired_at is null`
	)
	await httpChecks(connection)
	const fileEnv = parseEnv(readFileSync(targetEnvFile('test'), 'utf8'))
	db = createDb(resolveDatabaseUrl('app', { ...fileEnv, NODE_ENV: 'test' }))
	await maintainChecks(db.db, connection)
	caddyCheck()
	console.log('CALENDAR_PUSH_OK')
} catch (error) {
	const message = error instanceof Error ? error.message : 'unexpected failure'
	console.log(`CALENDAR_PUSH_FAILED ${message.replace(/postgres(ql)?:\/\/\S+/g, '<redacted>')}`)
	exitCode = 1
} finally {
	if (db) await db.pool.end()
	try {
		seed('down', 'test')
	} catch (error) {
		console.log(`cleanup failed: ${error instanceof Error ? error.message : 'unexpected failure'}`)
		exitCode = 1
	}
}
process.exit(exitCode)
