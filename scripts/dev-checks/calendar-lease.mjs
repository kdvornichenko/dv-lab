import { randomBytes, randomInt, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'
import { parseEnv } from 'node:util'

import { ENV_TEST, ROOT, quote, sql } from './api.mjs'

const { createDb, resolveDatabaseUrl } = await import(`${ROOT}/packages/db/src/index.ts`)
const { createConnectionLease } = await import(`${ROOT}/apps/api/src/calendar/lease.ts`)
const { createCredentials, credentialBinding, findConnection } = await import(
	`${ROOT}/apps/api/src/calendar/google-access.ts`
)
const { createTokenEnvelope } = await import(`${ROOT}/apps/api/src/calendar/token-envelope.ts`)
const { CalendarFault } = await import(`${ROOT}/apps/api/src/calendar/gateway.ts`)

const fileEnv = parseEnv(readFileSync(ENV_TEST, 'utf8'))
const url = resolveDatabaseUrl('app', { ...fileEnv, NODE_ENV: 'test' })
if (!new URL(url).pathname.slice(1).endsWith('_test')) {
	console.log('refused: calendar-lease runs only against a database ending with _test')
	process.exit(2)
}

const LEASE_KEY = 24
const envelope = createTokenEnvelope({ activeKeyId: 'synthetic', keyring: { synthetic: randomBytes(32) } })
const stub = { calls: 0, mode: 'ok', beforeReturn: null }
const gateway = {
	async refresh() {
		stub.calls += 1
		await delay(200)
		if (stub.mode === 'reject') throw new CalendarFault('reconnect_required')
		if (stub.beforeReturn) {
			const hook = stub.beforeReturn
			stub.beforeReturn = null
			await hook()
		}
		return { access_token: `synthetic-access-${stub.calls}`, expiry_date: Date.now() + 3600000 }
	},
}
const observation = { accessRefreshed() {} }

const app = createDb(url)
const side = createDb(url)
const lease = createConnectionLease(app.pool)
const credentials = createCredentials({ db: app.db, lease, envelope, gateway, observation })

const suffix = String(randomInt(1000, 10000))
const login = `lease.check.${suffix}`
const connectionId = randomUUID()
let accountId = null
let sessionB = null

function fail(step, message) {
	throw new Error(`step ${step}: ${message}`)
}

async function connectionState() {
	const result = await side.pool.query('select state, credential_generation from google_connections where id = $1', [
		connectionId,
	])
	return result.rows[0]
}

async function advisoryHolders() {
	const result = await side.pool.query(
		`select l.pid, l.granted from pg_locks l, (select hashtextextended($1, ${LEASE_KEY}) as k) h
		 where l.locktype = 'advisory' and l.objsubid = 1
		   and l.classid = ((h.k >> 32) & 4294967295)::oid and l.objid = (h.k & 4294967295)::oid`,
		[accountId]
	)
	return result.rows
}

async function setup() {
	const created = sql(
		`insert into accounts (login, display_name, role, password_hash) values (${quote(login)}, ${quote(`Alex Example ${suffix}`)}, 'student', 'synthetic') returning id`,
		'app'
	)
	accountId = created.rows[0].id
	const row = { accountId, id: connectionId, credentialGeneration: 0 }
	const sealed = envelope.seal(`synthetic-refresh-${suffix}`, credentialBinding(row))
	await side.pool.query(
		`insert into google_connections (id, account_id, calendar_id, calendar_label, calendar_time_zone, history_cutover_at,
		   generation, credential_generation, state, encrypted_refresh_token, credential_mode)
		 values ($1, $2, 'synthetic-calendar', 'Synthetic', 'UTC', now(), 1, 0, 'connected', $3::jsonb, 'active')`,
		[connectionId, accountId, JSON.stringify(sealed)]
	)
}

async function stepOne() {
	sessionB = await side.pool.connect()
	const pid = (await sessionB.query('select pg_backend_pid() as pid')).rows[0].pid
	await sessionB.query(`select pg_advisory_lock(hashtextextended($1, ${LEASE_KEY}))`, [accountId])
	credentials.evict(accountId)
	const started = Date.now()
	const access = await credentials.accessToken(accountId)
	const elapsed = Date.now() - started
	if (elapsed >= 1000) fail(1, `accessToken took ${elapsed} ms under the lease of session B`)
	if (access.connection.state !== 'connected') fail(1, 'accessToken returned a connection that is not connected')
	const holders = await advisoryHolders()
	if (holders.length !== 1 || holders[0].pid !== pid || holders[0].granted !== true)
		fail(1, `advisory lock rows ${holders.length}, held by session B ${holders[0]?.pid === pid}`)
	await sessionB.query(`select pg_advisory_unlock(hashtextextended($1, ${LEASE_KEY}))`, [accountId])
	sessionB.release()
	sessionB = null
	console.log(`step 1 ok: accessToken resolved in ${elapsed} ms while session B held the lease; advisory holders 1`)
}

async function stepTwo() {
	credentials.evict(accountId)
	const before = stub.calls
	const results = await Promise.all(Array.from({ length: 5 }, () => credentials.accessToken(accountId)))
	const refreshes = stub.calls - before
	if (refreshes !== 1) fail(2, `five concurrent callers caused ${refreshes} refreshes`)
	if (new Set(results.map((item) => item.accessToken)).size !== 1) fail(2, 'concurrent callers got different tokens')
	const generations = new Set(results.map((item) => item.connection.credentialGeneration))
	if (generations.size !== 1) fail(2, 'concurrent callers got different credential generations')
	console.log('step 2 ok: five concurrent callers, one refresh')
}

async function stepThree() {
	credentials.evict(accountId)
	const current = await findConnection(app.db, accountId)
	const bumped = current.credentialGeneration + 1
	const before = stub.calls
	let winnerRows = 0
	stub.beforeReturn = async () => {
		const sealed = envelope.seal(`synthetic-refresh-${suffix}`, {
			...credentialBinding(current),
			generation: bumped,
		})
		const winner = await side.pool.query(
			'update google_connections set credential_generation = $2, encrypted_refresh_token = $3::jsonb, updated_at = now() where id = $1 and credential_generation = $4',
			[connectionId, bumped, JSON.stringify(sealed), current.credentialGeneration]
		)
		winnerRows = winner.rowCount
	}
	let access
	try {
		access = await credentials.accessToken(accountId)
	} catch (error) {
		fail(3, `accessToken threw ${error instanceof CalendarFault ? error.code : 'an unexpected error'} after a lost CAS`)
	}
	if (winnerRows !== 1) fail(3, 'the other session did not bump credential_generation before the CAS')
	if (stub.calls - before !== 1) fail(3, `lost CAS caused ${stub.calls - before} refreshes`)
	const row = await connectionState()
	if (row.state !== 'connected') fail(3, `row moved to ${row.state} after a lost CAS`)
	if (Number(row.credential_generation) !== bumped) fail(3, 'row credential generation is not the winner value')
	if (access.connection.credentialGeneration !== bumped) fail(3, 'returned connection is not the re-read row')
	console.log('step 3 ok: lost CAS re-read the row, no fault, row stays connected')
}

async function stepFour() {
	credentials.evict(accountId)
	stub.mode = 'reject'
	let code = null
	try {
		await credentials.accessToken(accountId)
	} catch (error) {
		code = error instanceof CalendarFault ? error.code : 'unexpected'
	}
	stub.mode = 'ok'
	if (code !== 'reconnect_required') fail(4, `rejected refresh gave ${code}`)
	const rejected = await connectionState()
	if (rejected.state !== 'reconnect_required') fail(4, `rejected refresh left the row ${rejected.state}`)
	await side.pool.query("update google_connections set state = 'connected', issue = null where id = $1", [connectionId])

	let inner = null
	try {
		await credentials.withAccessToken(accountId, async () => {
			throw new CalendarFault('permission_required')
		})
	} catch (error) {
		inner = error instanceof CalendarFault ? error.code : 'unexpected'
	}
	if (inner !== 'permission_required') fail(4, `operation fault surfaced as ${inner}`)
	const after = await connectionState()
	if (after.state !== 'connected') fail(4, `provider 403 inside an operation moved the row to ${after.state}`)
	console.log(
		'step 4 ok: token endpoint rejection sets reconnect_required; provider 403 in an operation keeps connected'
	)
}

let exitCode = 0
try {
	await setup()
	await stepOne()
	await stepTwo()
	await stepThree()
	await stepFour()
	console.log('CALENDAR_LEASE_OK')
} catch (error) {
	const message = error instanceof Error ? error.message : 'unexpected failure'
	console.log(`CALENDAR_LEASE_FAILED ${message.replace(/postgres(ql)?:\/\/\S+/g, '<redacted>')}`)
	exitCode = 1
} finally {
	if (sessionB) sessionB.release()
	await credentials.close()
	await lease.close()
	if (accountId) {
		sql(`delete from google_connections where account_id = ${quote(accountId)}`)
		sql(`delete from accounts where id = ${quote(accountId)}`)
	}
	await app.pool.end()
	await side.pool.end()
}
process.exit(exitCode)
