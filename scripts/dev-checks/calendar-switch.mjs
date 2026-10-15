import { spawnSync } from 'node:child_process'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import dns from 'node:dns'
import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

import { call, teacherCookie } from './api.mjs'
import {
	ROOT,
	SYNTHETIC_CALENDAR_ID,
	calendarSql,
	startCalendarApi,
	syntheticTokenConfig,
	targetEnvFile,
} from './calendar-env.mjs'

if (process.env.CALENDAR_SWITCH_OFFLINE !== '1') {
	const child = spawnSync(
		process.execPath,
		['--import', `${ROOT}/scripts/dev-checks/calendar-offline.mjs`, new URL(import.meta.url).pathname],
		{ cwd: ROOT, stdio: 'inherit', env: { ...process.env, CALENDAR_SWITCH_OFFLINE: '1' } }
	)
	process.exit(child.status ?? 1)
}

const core = await import(`${ROOT}/packages/core/src/index.ts`)
const { googleCalendarList } = await import(`${ROOT}/packages/contracts/src/index.ts`)
const { createDb, resolveDatabaseUrl } = await import(`${ROOT}/packages/db/src/index.ts`)
const { createConnectionLease } = await import(`${ROOT}/apps/api/src/calendar/lease.ts`)
const { createCredentials, credentialBinding, findConnection } = await import(
	`${ROOT}/apps/api/src/calendar/google-access.ts`
)
const { createTokenEnvelope } = await import(`${ROOT}/apps/api/src/calendar/token-envelope.ts`)
const { createConnection } = await import(`${ROOT}/apps/api/src/calendar/connection.ts`)
const { createConnectionControl } = await import(`${ROOT}/apps/api/src/calendar/connection-control.ts`)
const { calendarSyncMethods } = await import(`${ROOT}/apps/api/src/calendar/gateway-sync.ts`)
const { createCalendarWatch } = await import(`${ROOT}/apps/api/src/calendar/watch.ts`)
const { claim, releaseClaim, requestPass } = await import(`${ROOT}/apps/api/src/calendar/sync-store.ts`)
const { upsertEventFacts } = await import(`${ROOT}/apps/api/src/calendar/projection.ts`)
const { opaqueVersion } = await import(`${ROOT}/apps/api/src/calendar/read-state.ts`)

const PORT = 4111
const SEED_KEY = 'calendar-seed:alex-example-0001'
const FIXTURE_KEY = 'calendar-commands:alex-example-0002'
const PRIMARY = SYNTHETIC_CALENDAR_ID
const WRITER = `${SYNTHETIC_CALENDAR_ID}-writer`
const READER = `${SYNTHETIC_CALENDAR_ID}-reader`
const DELETED = `${SYNTHETIC_CALENDAR_ID}-deleted`
const FAR = "timestamptz '2999-01-01 00:00:00+00'"
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`
const sha256 = (value) => createHash('sha256').update(String(value)).digest('hex')
const hash = (value) => sha256(value).slice(0, 12)

function fail(check, message) {
	throw new Error(`${check}: ${message}`)
}

function rows(text) {
	return calendarSql('test', 'migrator', text).rows
}

function runScript(name, ...args) {
	const result = spawnSync(process.execPath, [`${ROOT}/scripts/dev-checks/${name}`, ...args], {
		cwd: ROOT,
		encoding: 'utf8',
		timeout: 180000,
	})
	const out = result.stdout ?? ''
	if (result.status !== 0)
		throw new Error(`${name} ${args.join(' ')} exited ${result.status}: ${out.trim().split('\n').pop()}`)
	return out
}

function purgeLessons(key, dropStudent) {
	const card = `(select id from students where import_key = ${quote(key)})`
	const series = `(select id from lesson_series where student_id in ${card})`
	const singles = `(select id from lessons where student_id in ${card})`
	rows(`begin;
delete from lesson_marks where series_id in ${series} or lesson_id in ${singles};
delete from lesson_exceptions where series_id in ${series};
delete from lessons where student_id in ${card};
delete from lesson_series where student_id in ${card};
delete from student_sections where student_id in ${card};
${dropStudent ? `delete from students where import_key = ${quote(key)};` : ''}
commit;`)
}

async function offline() {
	try {
		await dns.promises.lookup('www.googleapis.com')
		return false
	} catch (error) {
		return String(error?.message).includes('calendar-offline')
	}
}

function fixtures() {
	purgeLessons(SEED_KEY, false)
	const out = runScript('calendar-commands.mjs', 'fixtures', 'test')
	const monday = /monday (\d{4}-\d{2}-\d{2})/.exec(out)?.[1]
	if (!out.includes('CALENDAR_FIXTURES_OK') || !monday) throw new Error('calendar-commands fixtures did not finish')
	const [connection] = rows(
		`select id, account_id, calendar_id, generation::int as generation from google_connections
where calendar_id like '${SYNTHETIC_CALENDAR_ID}%' and retired_at is null`
	)
	const [{ zone }] = rows(
		`select coalesce((select default_time_zone from teacher_settings where account_id = ${quote(connection.account_id)}), 'Asia/Ho_Chi_Minh') as zone`
	)
	const [card] = rows(`select id from students where import_key = ${quote(FIXTURE_KEY)}`)
	const [single] = rows(`select id from lessons where student_id = ${quote(card.id)}`)
	const [series] = rows(`select id from lesson_series where student_id = ${quote(card.id)}`)
	const [command] = rows(
		`select command_id from google_event_mappings where local_entity_id = ${quote(series.id)} and state = 'active'`
	)
	return { monday, zone, connection, card: card.id, single: single.id, series: series.id, command: command.command_id }
}

function openDb() {
	const fileEnv = parseEnv(readFileSync(targetEnvFile('test'), 'utf8'))
	return createDb(resolveDatabaseUrl('app', { ...fileEnv, NODE_ENV: 'test' }))
}

function listEntries(mode) {
	const primary = {
		id: PRIMARY,
		summary: 'Synthetic primary',
		timeZone: 'UTC',
		primary: true,
		accessRole: 'owner',
		backgroundColor: '#5484ed',
	}
	const writer = { id: WRITER, summary: 'Synthetic writer', timeZone: 'UTC', accessRole: 'writer' }
	const reader = { id: READER, summary: 'Synthetic reader', timeZone: 'UTC', accessRole: 'reader' }
	const deleted = { id: DELETED, summary: 'Synthetic deleted', timeZone: 'UTC', accessRole: 'owner', deleted: true }
	if (mode === 'no_writer') return [{ items: [primary, reader], nextPageToken: 'page-2' }, { items: [deleted] }]
	return [{ items: [primary, reader], nextPageToken: 'page-2' }, { items: [writer, deleted] }]
}

function createStub() {
	const state = { mode: 'full', pages: [], issued: [], stops: [], stopFails: false, listCalls: 0 }
	const methods = calendarSyncMethods(
		() => ({ setCredentials() {} }),
		async () => ({ data: structuredClone(state.pages.shift() ?? { items: [] }) })
	)
	const token = () => {
		const value = `synthetic-access-${randomUUID()}`
		state.issued.push(value)
		return value
	}
	const gateway = {
		async refresh() {
			return { access_token: token(), expiry_date: Date.now() + 3600000 }
		},
		async calendars(accessToken, signal) {
			state.listCalls += 1
			state.pages = listEntries(state.mode)
			return methods.calendars(accessToken, signal)
		},
		async primary() {
			return { id: PRIMARY, label: 'Synthetic primary', timeZone: 'UTC' }
		},
		authorizationUrl(oauthState) {
			return `https://accounts.example.test/o/oauth2/auth?state=${encodeURIComponent(oauthState)}`
		},
		async exchange() {
			return {
				access_token: token(),
				refresh_token: `synthetic-refresh-${randomUUID()}`,
				expiry_date: Date.now() + 3600000,
			}
		},
		async revoke() {},
	}
	const source = {
		async watch() {
			throw new Error('synthetic watch refused')
		},
		async stopChannel(accessToken, pair) {
			state.stops.push({ token: accessToken, pair })
			if (state.stopFails) throw new Error('synthetic stop failure')
		},
	}
	return { state, gateway, source }
}

async function refusal(promise) {
	try {
		await promise
		return 'accepted'
	} catch (error) {
		return error?.code ?? 'unexpected'
	}
}

function connectionRow(id) {
	const [row] = rows(
		`select id, state, calendar_id, generation::int as generation, credential_generation::int as credential_generation,
encrypted_refresh_token is null as no_token, credential_mode, revoke_attempt_id, revoke_started_at, revoke_finished_at,
retired_at is not null as retired from google_connections where id = ${quote(id)}`
	)
	return row
}

function syncRow(id) {
	const [row] = rows(
		`select connection_id, requested_seq::int as requested, channel_id, channel_resource_id, channel_token_hash,
channel_expires_at, retiring_channel_id, retiring_resource_id, claimed_until, sync_token,
next_poll_at <= now() as poll_due, next_full_at <= now() as full_due from google_sync_state where connection_id = ${quote(id)}`
	)
	return row
}

function mappingStates(id) {
	return rows(
		`select state, count(*)::int as n from google_event_mappings where connection_id = ${quote(id)} group by state order by state`
	)
		.map((row) => `${row.state}:${row.n}`)
		.join(',')
}

function marksOf(card) {
	const [row] = rows(
		`select count(*)::int as n from lesson_marks where lesson_id in (select id from lessons where student_id = ${quote(card)})
or series_id in (select id from lesson_series where student_id = ${quote(card)})`
	)
	return row.n
}

function seedChannels(connectionId) {
	const channel = { id: randomUUID(), resourceId: `synthetic-resource-${randomUUID()}` }
	const retiring = { id: randomUUID(), resourceId: `synthetic-resource-${randomUUID()}` }
	const secret = randomBytes(32).toString('base64url')
	rows(`update google_sync_state set channel_id = ${quote(channel.id)}, channel_resource_id = ${quote(channel.resourceId)},
channel_token_hash = ${quote(sha256(secret))}, channel_expires_at = now() + interval '3 days',
retiring_channel_id = ${quote(retiring.id)}, retiring_resource_id = ${quote(retiring.resourceId)}, watch_issue = null
where connection_id = ${quote(connectionId)}`)
	return { channel, retiring, secret }
}

function freeze(connectionId, windowFrom) {
	rows(`update google_sync_state s set sync_token = 'synthetic-sync-frozen', last_full_at = now(), last_incremental_at = now(),
next_poll_at = ${FAR}, next_full_at = ${FAR}, claimed_until = ${FAR}, issue = null, failure_count = 0,
window_start = o.window_start, window_end = o.window_end from google_sync_state o
where s.connection_id = ${quote(connectionId)} and o.connection_id = ${quote(windowFrom)}`)
}

const timed = (startsAt, minutes, zone) => ({
	start: { dateTime: startsAt.toISOString(), timeZone: zone },
	end: { dateTime: new Date(startsAt.getTime() + minutes * 60000).toISOString(), timeZone: zone },
})

function plainFact(eventId, startsAt, zone, extra = {}) {
	return {
		eventId,
		etag: `"switch-${eventId}"`,
		status: 'confirmed',
		recurringEventId: null,
		originalStartTime: null,
		summary: `Synthetic ${eventId}`,
		...timed(startsAt, 60, zone),
		eventType: 'default',
		transparency: 'opaque',
		factAt: new Date(Date.now() - 60000),
		...extra,
	}
}

async function notify(base, channelId, secret) {
	const response = await fetch(`${base}/google/notifications`, {
		method: 'POST',
		headers: {
			'X-Goog-Channel-ID': channelId,
			'X-Goog-Channel-Token': secret,
			'X-Goog-Resource-State': 'exists',
			'X-Goog-Resource-ID': 'synthetic-resource',
			'X-Goog-Message-Number': '2',
		},
	})
	await response.arrayBuffer()
	return response.status
}

async function main(db, fx) {
	const stub = createStub()
	const logger = { info() {}, warn() {}, debug() {} }
	const observation = { consentStarted() {}, consentAccepted() {}, accessRefreshed() {}, control() {} }
	const envelope = createTokenEnvelope(syntheticTokenConfig())
	const lease = createConnectionLease(db.pool)
	const credentials = createCredentials({ db: db.db, lease, envelope, gateway: stub.gateway, observation })
	const watch = createCalendarWatch({
		db: db.db,
		source: stub.source,
		appOrigin: 'https://calendar.example.test',
		logger,
	})
	const wakes = []
	const connection = createConnection({
		db: db.db,
		lease,
		envelope,
		gateway: stub.gateway,
		credentials,
		observation,
		watch,
		wake: (id) => wakes.push(id),
	})
	const accountId = fx.connection.account_id
	const first = fx.connection.id
	let api = null
	try {
		api = await startCalendarApi({ port: PORT, envFile: '.env.test' })
		const cookie = await teacherCookie(api)
		const actor = { accountId, sessionToken: cookie }
		const week = async (monday) => {
			const res = await call(api, 'GET', `/schedule/week?start=${monday}`, { cookie })
			if (res.status !== 200) fail('week', `GET /schedule/week answered ${res.status}`)
			return res.json
		}
		const keys = (data) => new Set(data.events.map((event) => event.eventKey))

		const today = core.scheduleToday(new Date(), fx.zone)
		const markedDay = core.addDays(today, -3)
		const markedMonday = core.mondayOf(markedDay)
		const marked = randomUUID()
		const markedAt = core.zonedInstant(markedDay, '12:00', fx.zone)
		rows(`begin;
insert into lessons (id, student_id, starts_at, time_zone, duration_minutes, status) values (${quote(marked)}, ${quote(fx.card)},
${quote(markedAt.toISOString())}, ${quote(fx.zone)}, 60, 'scheduled');
insert into lesson_marks (lesson_id, kind) values (${quote(marked)}, 'done');
insert into google_event_mappings (account_id, connection_id, calendar_id, entity_kind, local_entity_id, student_id, event_id,
representation_generation, command_id, state) values (${quote(accountId)}, ${quote(first)}, ${quote(PRIMARY)}, 'single',
${quote(marked)}, ${quote(fx.card)}, 'dvswitchmarked', 0, ${quote(fx.command)}, 'active');
commit;`)
		await db.db.transaction((tx) =>
			upsertEventFacts(tx, { accountId, connectionId: first, calendarId: PRIMARY }, [
				plainFact('dvswitchmarked', markedAt, fx.zone),
			])
		)
		const oldMarkedKey = opaqueVersion([first, 'dvswitchmarked'])
		const oldSeedKey = opaqueVersion([first, 'dvseed01'])
		const baseline = { main: keys(await week(fx.monday)), marked: keys(await week(markedMonday)) }
		const marksBefore = marksOf(fx.card)
		console.log(
			`baseline old grid: seed_row ${baseline.main.has(oldSeedKey)} marked_lesson ${baseline.marked.has(oldMarkedKey)} marks ${marksBefore}`
		)
		if (!baseline.main.has(oldSeedKey) || !baseline.marked.has(oldMarkedKey))
			fail('baseline', 'the old calendar rows are not in the grid before the switch')

		const listed = googleCalendarList.parse(await connection.listCalendars(actor))
		const byId = new Map(listed.calendars.map((item) => [item.id, item]))
		const listOk =
			listed.calendars.length === 2 &&
			byId.get(PRIMARY)?.primary === true &&
			byId.get(PRIMARY)?.current === true &&
			byId.get(PRIMARY)?.color === '#5484ed' &&
			byId.get(WRITER)?.primary === false &&
			byId.get(WRITER)?.current === false &&
			!byId.has(READER) &&
			!byId.has(DELETED)
		console.log(
			`switch 1 list: calendars ${listed.calendars.length} primary_current ${byId.get(PRIMARY)?.current} writer ${byId.has(WRITER)} reader ${byId.has(READER)} deleted ${byId.has(DELETED)}`
		)
		if (!listOk) fail('switch 1', 'the list is not exactly the two writable calendars with primary and current')

		const base = connectionRow(first)
		const [command] = rows(
			`select id, confirmed_revision::text as revision from google_commands where id = ${quote(fx.command)}`
		)
		rows(`update google_commands set state = 'recovery_required', applied_at = null, confirmed_revision = null,
issue = 'external_change', next_action = 'resume_recovery', updated_at = now() where id = ${quote(command.id)}`)
		const pending = await refusal(
			connection.chooseCalendar(actor, {
				requestId: randomUUID(),
				calendarId: WRITER,
				expectedGeneration: base.generation,
			})
		)
		rows(`update google_commands set state = 'applied', applied_at = now(), confirmed_revision = ${command.revision},
issue = null, next_action = 'none', updated_at = now() where id = ${quote(command.id)}`)
		const stale = await refusal(
			connection.chooseCalendar(actor, {
				requestId: randomUUID(),
				calendarId: WRITER,
				expectedGeneration: base.generation - 1,
			})
		)
		const unknown = await refusal(
			connection.chooseCalendar(actor, {
				requestId: randomUUID(),
				calendarId: READER,
				expectedGeneration: base.generation,
			})
		)
		const same = await connection.chooseCalendar(actor, {
			requestId: randomUUID(),
			calendarId: PRIMARY,
			expectedGeneration: base.generation,
		})
		const untouched = connectionRow(first)
		console.log(
			`switch 2 refusals: unresolved ${pending} stale_generation ${stale} reader_calendar ${unknown} same_calendar ${same.calendar?.id === PRIMARY && same.generation === base.generation} row_unchanged ${untouched.generation === base.generation && !untouched.retired}`
		)
		if (
			pending !== 'command_pending' ||
			stale !== 'precondition_failed' ||
			unknown !== 'invalid_request' ||
			same.generation !== base.generation ||
			untouched.retired
		)
			fail('switch 2', 'a refused or no-op choice changed the connection')

		const channels = seedChannels(first)
		const accepted = await notify(api.base, channels.channel.id, channels.secret)
		const oldSeq = syncRow(first).requested
		const oldRow = await findConnection(db.db, accountId)
		const refresh = envelope.open(oldRow.encryptedRefreshToken, credentialBinding(oldRow))
		const mappingsBefore = mappingStates(first)
		credentials.evict(accountId)
		stub.state.stopFails = true
		const issuedBefore = stub.state.issued.length
		const switched = await connection.chooseCalendar(actor, {
			requestId: randomUUID(),
			calendarId: WRITER,
			expectedGeneration: base.generation,
		})
		stub.state.stopFails = false
		const preRetire = stub.state.issued[issuedBefore]
		const retired = connectionRow(first)
		const second = await findConnection(db.db, accountId)
		const newSync = syncRow(second.id)
		const oldSync = syncRow(first)
		const opensNew = envelope.open(second.encryptedRefreshToken, credentialBinding(second)) === refresh
		let opensOld = true
		try {
			envelope.open(second.encryptedRefreshToken, credentialBinding({ ...second, id: first }))
		} catch {
			opensOld = false
		}
		const stopped = stub.state.stops.map((item) => item.pair.id)
		const stopTokens = new Set(stub.state.stops.map((item) => item.token))
		const cleared = [
			oldSync.channel_id,
			oldSync.channel_resource_id,
			oldSync.channel_token_hash,
			oldSync.channel_expires_at,
			oldSync.retiring_channel_id,
			oldSync.retiring_resource_id,
		].every((value) => value === null)
		const fresh = await credentials.accessToken(accountId)
		const retiredOk =
			retired.state === 'not_connected' &&
			retired.retired &&
			retired.no_token &&
			retired.credential_mode === null &&
			retired.revoke_attempt_id === null &&
			retired.revoke_started_at === null &&
			retired.revoke_finished_at === null
		const currentOk =
			second.id !== first &&
			second.state === 'connected' &&
			second.calendarId === WRITER &&
			second.generation === base.generation + 1 &&
			switched.calendar?.id === WRITER &&
			switched.generation === second.generation
		const dueOk = newSync?.poll_due && newSync.full_due && newSync.sync_token === null && newSync.claimed_until === null
		const stopOk =
			stub.state.stops.length === 2 &&
			stopped.includes(channels.channel.id) &&
			stopped.includes(channels.retiring.id) &&
			stopTokens.size === 1 &&
			stopTokens.has(preRetire) &&
			fresh.accessToken !== preRetire
		console.log(
			`switch 3 choose writer: old_retired ${retiredOk} new_current ${currentOk} token_moved ${opensNew} old_binding_opens ${opensOld} mappings ${mappingsBefore}->${mappingStates(first)} new_sync_due ${Boolean(dueOk)} old_channels_cleared ${cleared} stops ${stub.state.stops.length} pre_retire_token ${stopTokens.has(preRetire)} failing_stop_switched ${currentOk} wakes ${wakes.filter((id) => id === second.id).length} connection ${hash(second.id)}`
		)
		if (
			!retiredOk ||
			!currentOk ||
			!opensNew ||
			opensOld ||
			mappingStates(first) !== mappingsBefore ||
			!dueOk ||
			!cleared ||
			!stopOk ||
			!wakes.includes(second.id)
		)
			fail('switch 3', 'the switch transaction did not move the connection as expected')

		rows(
			`update google_sync_state set next_poll_at = now() - interval '1 minute', claimed_until = null, failure_count = 0 where connection_id = ${quote(first)}`
		)
		const claimedOld = []
		for (let attempt = 0; attempt < 3; attempt += 1) {
			claimedOld.push(...(await claim(db.db, first)))
			const all = await claim(db.db, null)
			claimedOld.push(...all.filter((item) => item.connectionId === first))
			for (const item of all) await releaseClaim(db.db, item)
		}
		const passOld = await requestPass(db.db, channels.channel.id)
		const passRetiring = await requestPass(db.db, channels.retiring.id)
		const hook = await notify(api.base, channels.channel.id, channels.secret)
		const seqAfter = syncRow(first).requested
		console.log(
			`switch 3a old row: before_switch_webhook ${accepted} claims ${claimedOld.length} request_pass ${passOld}/${passRetiring} webhook ${hook} requested ${oldSeq}->${seqAfter}`
		)
		if (
			accepted !== 204 ||
			claimedOld.length ||
			passOld !== null ||
			passRetiring !== null ||
			hook !== 404 ||
			seqAfter !== oldSeq
		)
			fail('switch 3a', 'the retired sync row was claimed or woken')

		freeze(second.id, first)
		const newFacts = [
			plainFact('dvswitchnew01', core.zonedInstant(core.addDays(fx.monday, 1), '08:00', fx.zone), fx.zone),
			plainFact('dvswitchnew02', core.zonedInstant(core.addDays(fx.monday, 3), '08:00', fx.zone), fx.zone),
		]
		await db.db.transaction((tx) =>
			upsertEventFacts(tx, { accountId, connectionId: second.id, calendarId: WRITER }, newFacts)
		)
		const newKeys = new Set(newFacts.map((fact) => opaqueVersion([second.id, fact.eventId])))
		const main = await week(fx.monday)
		const markedWeek = await week(markedMonday)
		const lessonWeek = await week(core.addDays(fx.monday, 7))
		const mainKeys = keys(main)
		const onlyNew = mainKeys.size === newKeys.size && [...mainKeys].every((key) => newKeys.has(key))
		const singleKey = opaqueVersion([
			first,
			rows(
				`select event_id from google_event_mappings where local_entity_id = ${quote(fx.single)} and state = 'active'`
			)[0].event_id,
		])
		const marksAfter = marksOf(fx.card)
		console.log(
			`switch 4 grid: week_events ${mainKeys.size} only_new ${onlyNew} calendar ${main.connection.calendar?.id === WRITER} marked_lesson_shown ${keys(markedWeek).has(oldMarkedKey)} old_single_shown ${keys(lessonWeek).has(singleKey)} marks ${marksBefore}->${marksAfter}`
		)
		if (
			!onlyNew ||
			main.connection.calendar?.id !== WRITER ||
			keys(markedWeek).has(oldMarkedKey) ||
			keys(lessonWeek).has(singleKey) ||
			marksAfter !== marksBefore
		)
			fail('switch 4', 'the grid shows rows of the previous calendar or marks changed')

		const back = await connection.chooseCalendar(actor, {
			requestId: randomUUID(),
			calendarId: PRIMARY,
			expectedGeneration: second.generation,
		})
		const third = await findConnection(db.db, accountId)
		freeze(third.id, first)
		const singleAt = core.zonedInstant(core.addDays(fx.monday, 8), '18:00', fx.zone)
		await db.db.transaction((tx) =>
			upsertEventFacts(tx, { accountId, connectionId: third.id, calendarId: PRIMARY }, [
				plainFact('dvswitchmarker', singleAt, fx.zone, { markerLocalId: fx.single, markerKind: 'single' }),
			])
		)
		const adopted = (await week(core.addDays(fx.monday, 7))).events.find(
			(event) => event.eventKey === opaqueVersion([third.id, 'dvswitchmarker'])
		)
		const [retiredCount] = rows(
			`select count(*)::int as n from google_connections where account_id = ${quote(accountId)} and retired_at is not null`
		)
		const adoptedOk =
			third.id !== second.id &&
			third.id !== first &&
			third.calendarId === PRIMARY &&
			back.calendar?.id === PRIMARY &&
			retiredCount.n === 2 &&
			adopted?.binding.kind === 'lesson' &&
			adopted.binding.ref.kind === 'single' &&
			adopted.binding.ref.lessonId === fx.single &&
			adopted.editBlock === 'history_only'
		console.log(
			`switch 5 primary again: third_row ${third.id !== first && third.id !== second.id} retired_rows ${retiredCount.n} marker_row ${adopted?.binding.kind}/${adopted?.editBlock}`
		)
		if (!adoptedOk) fail('switch 5', 'choosing the primary again did not give a third row with history_only markers')

		await api.stop()
		api = null

		const fourthSnapshot = await connection.chooseCalendar(actor, {
			requestId: randomUUID(),
			calendarId: WRITER,
			expectedGeneration: third.generation,
		})
		const fourth = await findConnection(db.db, accountId)
		const consent = async () => {
			const { url } = await connection.beginConsent(actor)
			const oauthState = new URL(url).searchParams.get('state')
			return refusal(connection.completeConsent(actor, { state: oauthState, code: 'synthetic-code' }))
		}
		rows(
			`update google_connections set state = 'reconnect_required', issue = 'reconnect_required' where id = ${quote(fourth.id)}`
		)
		stub.state.mode = 'no_writer'
		const lost = await consent()
		const afterLost = connectionRow(fourth.id)
		stub.state.mode = 'full'
		const kept = await consent()
		const afterKept = await findConnection(db.db, accountId)
		const [total] = rows(`select count(*)::int as n from google_connections where account_id = ${quote(accountId)}`)
		const keptOk =
			fourthSnapshot.calendar?.id === WRITER &&
			lost === 'wrong_primary' &&
			afterLost.state === 'reconnect_required' &&
			kept === 'accepted' &&
			afterKept.id === fourth.id &&
			afterKept.state === 'connected' &&
			afterKept.calendarId === WRITER &&
			afterKept.generation === fourth.generation + 1 &&
			total.n === 4
		console.log(
			`switch 6 reconnect: writer_not_writable ${lost} row_state ${afterLost.state}; writer_writable ${kept} same_row ${afterKept.id === fourth.id} calendar_kept ${afterKept.calendarId === WRITER} state ${afterKept.state} rows ${total.n}`
		)
		if (!keptOk) fail('switch 6', 'reconnect did not keep the chosen calendar')

		const control = createConnectionControl({
			db: db.db,
			lease,
			credentials,
			envelope,
			gateway: stub.gateway,
			watch,
			logger,
			observation,
			isStopping: () => false,
		})
		try {
			const disconnectChannels = seedChannels(afterKept.id)
			const stopsBefore = stub.state.stops.length
			const snapshot = await control.disconnect(actor)
			const disconnectStops = stub.state.stops.slice(stopsBefore).map((item) => item.pair.id)
			const after = syncRow(afterKept.id)
			const clearedOnDisconnect = [
				after.channel_id,
				after.channel_token_hash,
				after.retiring_channel_id,
				after.retiring_resource_id,
			].every((value) => value === null)
			console.log(
				`switch 7 disconnect: state ${snapshot.state} stops ${disconnectStops.length} channels_cleared ${clearedOnDisconnect}`
			)
			if (
				snapshot.state !== 'disconnecting' ||
				disconnectStops.length !== 2 ||
				!disconnectStops.includes(disconnectChannels.channel.id) ||
				!disconnectStops.includes(disconnectChannels.retiring.id) ||
				!clearedOnDisconnect
			)
				fail('switch 7', 'disconnect did not stop and clear the channels')
		} finally {
			await control.close()
		}
	} finally {
		if (api) await api.stop()
		await credentials.close()
		await lease.close()
	}
}

let db = null
let exitCode = 0
try {
	if (!(await offline())) throw new Error('Google hosts resolve: the offline preload is not active')
	const fx = fixtures()
	console.log(
		`FIXTURES connection ${hash(fx.connection.id)} single ${hash(fx.single)} zone ${fx.zone} monday ${fx.monday}`
	)
	db = openDb()
	await main(db, fx)
	console.log('CALENDAR_SWITCH_OK')
} catch (error) {
	const message = error instanceof Error ? error.message : 'unexpected failure'
	console.log(`CALENDAR_SWITCH_FAILED ${message.replace(/postgres(ql)?:\/\/\S+/g, '<redacted>')}`)
	exitCode = 1
} finally {
	if (db) await db.pool.end()
	try {
		purgeLessons(SEED_KEY, false)
		runScript('calendar-seed.mjs', 'down', 'test')
		purgeLessons(FIXTURE_KEY, true)
	} catch (error) {
		console.log(`cleanup failed: ${error instanceof Error ? error.message : 'unexpected failure'}`)
		exitCode = 1
	}
}
process.exit(exitCode)
