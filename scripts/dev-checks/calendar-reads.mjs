import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

import { ENV_TEST, TEACHER_LOGIN, call, quote, teacherCookie } from './api.mjs'
import { ROOT, SYNTHETIC_CALENDAR_ID, calendarSql, probeOffline, startCalendarApi } from './calendar-env.mjs'

const { addDays } = await import(`${ROOT}/packages/core/src/index.ts`)
const { createDb, resolveDatabaseUrl } = await import(`${ROOT}/packages/db/src/index.ts`)
const { opaqueVersion } = await import(`${ROOT}/apps/api/src/calendar/read-state.ts`)

const PORT = 4103
const LEASE_KEY = 24
const CALENDAR_COLOR = '#5484ed'
const CARD_KEY = 'calendar-seed:alex-example-0001'

function fail(check, message) {
	throw new Error(`check ${check}: ${message}`)
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
	const out = result.stdout ?? ''
	if (result.status !== 0)
		throw new Error(`calendar-seed ${args.join(' ')} exited ${result.status}: ${out.trim().split('\n').pop()}`)
	return out
}

async function get(api, cookie, path) {
	const started = Date.now()
	const res = await call(api, 'GET', path, { cookie })
	return { ...res, elapsed: Date.now() - started }
}

async function week(api, cookie, monday, check) {
	const res = await get(api, cookie, `/schedule/week?start=${monday}`)
	if (res.status !== 200) fail(check, `GET /schedule/week answered ${res.status}`)
	return res.json
}

function eventsByKey(connectionId) {
	return new Map(
		rows(
			`select event_id, event_key, etag, event_type from google_calendar_events where connection_id = ${quote(connectionId)}`
		).map((row) => [row.event_key, row])
	)
}

function find(events, known, eventId) {
	return events.find((event) => known.get(event.eventKey)?.event_id === eventId)
}

let api = null
let side = null
let holder = null
let seeded = false
let exitCode = 0
try {
	const up = seed('up', 'test', 'week')
	seeded = true
	const monday = /monday (\d{4}-\d{2}-\d{2})/.exec(up)?.[1]
	if (!monday) throw new Error('calendar-seed up printed no monday')
	const [teacher] = rows(
		`select id from accounts where login = ${quote(TEACHER_LOGIN)} and role = 'teacher' and status = 'active'`
	)
	const [connection] = rows(
		`select id from google_connections where calendar_id like '${SYNTHETIC_CALENDAR_ID}%' and retired_at is null`
	)
	const [card] = rows(`select id from students where import_key = ${quote(CARD_KEY)}`)
	if (!teacher || !connection || !card) throw new Error('seeded teacher, connection or card is missing')

	api = await startCalendarApi({ port: PORT, envFile: '.env.test' })
	const cookie = await teacherCookie(api)

	const first = await week(api, cookie, monday, 1)
	const [expected] = rows(
		`select count(*)::int as n from google_calendar_events where connection_id = ${quote(connection.id)}
and row_kind <> 'master' and starts_at is not null and ends_at is not null
and starts_at < ${quote(first.requestedRange.end)}::timestamptz and ends_at > ${quote(first.requestedRange.start)}::timestamptz`
	)
	const known = eventsByKey(connection.id)
	const events = first.events
	const versions = events.every((event) => {
		const row = known.get(event.eventKey)
		return row && event.version === opaqueVersion([row.event_id, row.etag])
	})
	const palette = find(events, known, 'dvseed01')?.color
	const custom = find(events, known, 'dvseed07')?.color
	const fallback = find(events, known, 'dvseed06')?.color
	const paletteHit = palette?.custom === false && palette.background === '#a4bdfc' && palette.foreground === '#1d1d1d'
	const customFlag = custom?.custom === true && custom.background === CALENDAR_COLOR && custom.foreground === null
	const calendarFallback = fallback?.id === null && fallback.background === CALENDAR_COLOR && fallback.custom === false
	const readOnly = find(events, known, 'dvseed14')?.editBlock === 'read_only_event'
	const plainNull = events
		.filter((event) => known.get(event.eventKey)?.event_type === 'default' && event.binding.kind === 'external')
		.every((event) => event.editBlock === null)
	const place = find(events, known, 'dvseed15')?.location !== null
	const member =
		events.some((event) => known.get(event.eventKey)?.event_id.startsWith('dvseed12_') && event.seriesMember) &&
		find(events, known, 'dvseed01')?.seriesMember === false
	console.log(
		`check 1 week: fresh ${first.read.state === 'fresh'} events ${events.length} expected ${expected.n} versions ${versions} palette ${paletteHit} custom ${customFlag} calendar ${calendarFallback} read_only ${readOnly} plain_null ${plainNull} location ${place} series_member ${member}`
	)
	if (
		first.read.state !== 'fresh' ||
		first.write.state !== 'ready' ||
		events.length !== expected.n ||
		!versions ||
		!paletteHit ||
		!customFlag ||
		!calendarFallback ||
		!readOnly ||
		!plainNull ||
		!place ||
		!member
	)
		fail(1, 'week read does not match the projection')

	const again = await week(api, cookie, monday, 2)
	const idle = await week(api, cookie, monday, 2)
	const before = find(again.events, known, 'dvseed06')
	seed('bump', 'test', 'dvseed06')
	const bumped = await week(api, cookie, monday, 2)
	const moved = find(bumped.events, eventsByKey(connection.id), 'dvseed06')
	const stable = again.read.revision === first.read.revision && idle.read.revision === first.read.revision
	const plusOne = BigInt(bumped.read.revision) === BigInt(first.read.revision) + 1n
	const shifted =
		before?.when.kind === 'timed' &&
		moved?.when.kind === 'timed' &&
		Date.parse(moved.when.startsAt) - Date.parse(before.when.startsAt) === 3600000 &&
		moved.version !== before.version
	console.log(`check 2 revision: idle_stable ${stable} bump_plus_one ${plusOne} moved_start ${shifted}`)
	if (!stable || !plusOne || !shifted) fail(2, 'revision or moved event is wrong')

	const far = addDays(monday, 420)
	const outside = await week(api, cookie, far, 3)
	const outsideOk =
		outside.read.state === 'last_known' &&
		outside.read.reason === 'outside_sync_window' &&
		outside.write.state === 'blocked' &&
		outside.write.reason === 'outside_sync_window'
	console.log(`check 3 outside window: ${outsideOk}`)
	if (!outsideOk) fail(3, 'a week 60 weeks ahead is not read-only with outside_sync_window')

	const today = await get(api, cookie, '/today')
	const list = await get(api, cookie, '/students')
	const detail = await get(api, cookie, `/students/${card.id}`)
	const listed = list.json?.students?.find((student) => student.id === card.id)
	const noneFresh = listed?.nextLesson.result === 'none' && detail.json?.student?.nextLesson.result === 'none'
	console.log(
		`check 4 pages: today ${today.status} students ${list.status} card ${detail.status} next_none_fresh ${noneFresh}`
	)
	if (today.status !== 200 || list.status !== 200 || detail.status !== 200 || !noneFresh)
		fail(4, 'page reads failed or next lesson is not none while fresh')
	const states = []
	for (const state of ['failed', 'running', 'idle']) {
		seed('state', 'test', state)
		const sync = await get(api, cookie, '/google/sync')
		const card = await get(api, cookie, `/students/${detail.json.student.id}`)
		states.push({ state, sync: sync.json?.state, next: card.json?.student?.nextLesson.result })
	}
	const failedOk = states[0].sync === 'failed' && states[0].next === 'unknown'
	const runningOk = states[1].sync === 'running'
	const idleOk = states[2].sync === 'idle' && states[2].next === 'none'
	console.log(`check 4 sync: failed ${failedOk} running ${runningOk} idle ${idleOk}`)
	if (!failedOk || !runningOk || !idleOk) fail(4, `sync states ${JSON.stringify(states)}`)

	const colors = await get(api, cookie, '/google/colors')
	const colorsOk =
		colors.status === 200 && colors.json?.colors?.length === 11 && colors.json?.calendarColor === CALENDAR_COLOR
	console.log(`check 5 colors: ${colorsOk} count ${colors.json?.colors?.length ?? 0}`)
	if (!colorsOk) fail(5, 'palette is not served')

	const fileEnv = parseEnv(readFileSync(ENV_TEST, 'utf8'))
	side = createDb(resolveDatabaseUrl('app', { ...fileEnv, NODE_ENV: 'test' }))
	holder = await side.pool.connect()
	const holderPid = (await holder.query('select pg_backend_pid() as pid')).rows[0].pid
	await holder.query(`select pg_advisory_lock(hashtextextended($1, ${LEASE_KEY}))`, [teacher.id])
	const timings = []
	for (let index = 0; index < 10; index += 1) {
		const res = await get(api, cookie, `/schedule/week?start=${monday}`)
		if (res.status !== 200) fail(6, `GET /schedule/week answered ${res.status} under the lease`)
		timings.push(res.elapsed)
	}
	const locks = await holder.query(
		`select count(*)::int as n from pg_locks where locktype = 'advisory' and pid <> $1
		 and database = (select oid from pg_database where datname = current_database())`,
		[holderPid]
	)
	await holder.query(`select pg_advisory_unlock(hashtextextended($1, ${LEASE_KEY}))`, [teacher.id])
	const slowest = Math.max(...timings)
	console.log(
		`check 6 lease: reads 10 slowest_ms ${slowest} under_1s ${slowest < 1000} other_advisory_locks ${locks.rows[0].n}`
	)
	if (slowest >= 1000 || locks.rows[0].n !== 0) fail(6, 'reads waited for the lease or took an advisory lock')

	const offline = probeOffline()
	console.log(`check 7 offline: ${offline ? 'OFFLINE_OK' : 'Google resolves'}`)
	if (!offline) fail(7, 'Google hosts resolve under the offline preload')
} catch (error) {
	const message = error instanceof Error ? error.message : 'unexpected failure'
	console.log(`CALENDAR_READS_FAILED ${message.replace(/postgres(ql)?:\/\/\S+/g, '<redacted>')}`)
	exitCode = 1
} finally {
	if (holder) holder.release()
	if (side) await side.pool.end()
	if (api) await api.stop()
	if (seeded) {
		try {
			seed('down', 'test')
		} catch (error) {
			console.log(`seed down failed: ${error instanceof Error ? error.message : 'unexpected failure'}`)
			exitCode = 1
		}
	}
}
if (exitCode === 0) console.log('CALENDAR_READS_OK')
process.exit(exitCode)
