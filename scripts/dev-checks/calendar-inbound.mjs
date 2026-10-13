import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import dns from 'node:dns'
import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

import { call, teacherCookie } from './api.mjs'
import {
	ROOT,
	SYNTHETIC_CALENDAR_ID,
	calendarSql,
	googleDateTime,
	googleTimes,
	startCalendarApi,
	syntheticTokenConfig,
	targetEnvFile,
} from './calendar-env.mjs'

const SECTIONS = ['resolver', 'assign', 'inbound']
const section = process.argv[2]
if (!SECTIONS.includes(section)) {
	console.log(`usage: node scripts/dev-checks/calendar-inbound.mjs ${SECTIONS.join('|')}`)
	process.exit(2)
}
if (process.env.CALENDAR_INBOUND_OFFLINE !== '1') {
	const child = spawnSync(
		process.execPath,
		['--import', `${ROOT}/scripts/dev-checks/calendar-offline.mjs`, new URL(import.meta.url).pathname, section],
		{ cwd: ROOT, stdio: 'inherit', env: { ...process.env, CALENDAR_INBOUND_OFFLINE: '1' } }
	)
	process.exit(child.status ?? 1)
}

const core = await import(`${ROOT}/packages/core/src/index.ts`)
const { createDb, resolveDatabaseUrl } = await import(`${ROOT}/packages/db/src/index.ts`)
const { createConnectionLease } = await import(`${ROOT}/apps/api/src/calendar/lease.ts`)
const { createCredentials } = await import(`${ROOT}/apps/api/src/calendar/google-access.ts`)
const { createTokenEnvelope } = await import(`${ROOT}/apps/api/src/calendar/token-envelope.ts`)
const { createCalendarCommands } = await import(`${ROOT}/apps/api/src/calendar/commands.ts`)
const { insertEventBody, verifyGoogleResult, observeGoogleEvent } = await import(
	`${ROOT}/apps/api/src/calendar/command-result.ts`
)
const { parseMaster, parseSyncPage } = await import(`${ROOT}/apps/api/src/calendar/provider-events.ts`)
const { GoogleWriteFault } = await import(`${ROOT}/apps/api/src/calendar/gateway.ts`)
const { dispatchCommand } = await import(`${ROOT}/apps/api/src/calendar/dispatch.ts`)
const { readCommand } = await import(`${ROOT}/apps/api/src/calendar/journal.ts`)
const { upsertEventFacts } = await import(`${ROOT}/apps/api/src/calendar/projection.ts`)
const { eventVersion, opaqueVersion } = await import(`${ROOT}/apps/api/src/calendar/read-state.ts`)
const { readCalendarWindow } = await import(`${ROOT}/apps/api/src/calendar/read-model.ts`)
const { ignoreEvent } = await import(`${ROOT}/apps/api/src/calendar/assign.ts`)
const { createCalendarSync } = await import(`${ROOT}/apps/api/src/calendar/sync.ts`)
const { syncEventRead } = await import(`${ROOT}/apps/api/src/calendar/sync-provider.ts`)
const { classifyRecurrence } = await import(`${ROOT}/apps/api/src/calendar/recurring.ts`)
const { listLessonStudents } = await import(`${ROOT}/apps/api/src/cards/cards.ts`)

const PORT = 4109
const SEED_KEY = 'calendar-seed:alex-example-0001'
const FIXTURE_KEY = 'calendar-commands:alex-example-0002'
const TWIN_KEY = 'calendar-inbound:alex-example-0001-twin'
const CARD_NAME = 'Alex Example 0001'
const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`
const hash = (value) => createHash('sha256').update(String(value)).digest('hex').slice(0, 12)
const stamp = (date) => date.toISOString().replace('.000Z', 'Z').replaceAll('-', '').replaceAll(':', '')

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

function counts() {
	const [row] =
		rows(`select (select count(*)::int from lessons) as lessons, (select count(*)::int from lesson_series) as series,
(select count(*)::int from lesson_exceptions) as exceptions, (select count(*)::int from lesson_marks) as marks`)
	return row
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
	const [seedCard] = rows(`select id from students where import_key = ${quote(SEED_KEY)}`)
	const [fixtureCard] = rows(`select id from students where import_key = ${quote(FIXTURE_KEY)}`)
	const [single] = rows(`select id from lessons where student_id = ${quote(fixtureCard.id)}`)
	const [series] = rows(`select id, weekday from lesson_series where student_id = ${quote(fixtureCard.id)}`)
	const mapping = (id) =>
		rows(
			`select event_id, command_id from google_event_mappings where local_entity_id = ${quote(id)} and state = 'active'`
		)[0]
	const [twins] = rows(
		`select count(*)::int as n from students where status = 'active' and lower(display_name) = lower(${quote(CARD_NAME)})`
	)
	if (twins.n !== 1) throw new Error(`expected one active card with the seeded name, found ${twins.n}`)
	return {
		monday,
		zone,
		connection,
		target: { accountId: connection.account_id, connectionId: connection.id, calendarId: connection.calendar_id },
		seedCard: seedCard.id,
		fixtureCard: fixtureCard.id,
		single: single.id,
		singleEvent: mapping(single.id).event_id,
		series: series.id,
		seriesWeekday: Number(series.weekday),
		masterEvent: mapping(series.id).event_id,
		seriesCommand: mapping(series.id).command_id,
	}
}

function openDb() {
	const fileEnv = parseEnv(readFileSync(targetEnvFile('test'), 'utf8'))
	return createDb(resolveDatabaseUrl('app', { ...fileEnv, NODE_ENV: 'test' }))
}

function keyOf(fx, eventId) {
	return opaqueVersion([fx.connection.id, eventId])
}

function projection(fx, eventId) {
	const [row] = rows(
		`select event_id, event_key, etag, status, row_kind, summary, start, "end", starts_at, ends_at, recurring_event_id,
original_start, event_type, transparency, color_id, description, location, recurrence_kind, recurrence_weekday,
recurrence_interval, google_updated_at, inbound_applied_etag from google_calendar_events
where connection_id = ${quote(fx.connection.id)} and event_id = ${quote(eventId)}`
	)
	return row
}

function versionOf(fx, eventId) {
	const row = projection(fx, eventId)
	return eventVersion({ eventId: row.event_id, etag: row.etag })
}

function instanceIn(fx, masterId, monday) {
	const from = core.zonedInstant(monday, '00:00', fx.zone)
	const to = core.zonedInstant(core.addDays(monday, 7), '00:00', fx.zone)
	return rows(
		`select event_id from google_calendar_events where connection_id = ${quote(fx.connection.id)}
and recurring_event_id = ${quote(masterId)} and starts_at >= ${quote(from.toISOString())} and starts_at < ${quote(to.toISOString())}`
	)[0]?.event_id
}

function rename(fx, condition, title) {
	rows(
		`update google_calendar_events set summary = ${quote(title)}, etag = etag || 'r', updated_at = now() where connection_id = ${quote(fx.connection.id)} and (${condition})`
	)
}

async function readWeek(db, fx, monday, students) {
	const range = core.scheduleWeekRange(monday, fx.zone)
	return readCalendarWindow(
		db,
		{ accountId: fx.connection.account_id, now: new Date() },
		{ kind: 'window', ...range, displayTimeZone: fx.zone },
		students
	)
}

function eventOf(fx, week, eventId) {
	return week.events.find((event) => event.eventKey === keyOf(fx, eventId))
}

async function resolverSection(db, fx) {
	const before = counts()
	const api = await startCalendarApi({ port: PORT, envFile: '.env.test' })
	try {
		const cookie = await teacherCookie(api)
		const week = async (monday) => {
			const res = await call(api, 'GET', `/schedule/week?start=${monday}`, { cookie })
			if (res.status !== 200) fail('resolver', `GET /schedule/week answered ${res.status}`)
			return res.json
		}
		const suggestion = (value) => (value ? `${value.scope}:${value.studentId === fx.seedCard}` : 'none')
		let current = await week(fx.monday)
		const single = eventOf(fx, current, 'dvseed16')
		const plain = eventOf(fx, current, 'dvseed06')
		console.log(`resolver 1 single title: ${suggestion(single?.suggestion)} plain ${suggestion(plain?.suggestion)}`)
		if (
			single?.suggestion?.scope !== 'event' ||
			single.suggestion.studentId !== fx.seedCard ||
			plain?.suggestion !== null
		)
			fail('resolver 1', 'the seeded title did not give exactly one event suggestion')

		rename(fx, `event_id = 'dvseed06'`, '  alex   EXAMPLE 0001 ')
		rename(fx, `event_id = 'dvseed07'`, `${CARD_NAME} lesson`)
		rename(fx, `event_id = 'dvseed12' or recurring_event_id = 'dvseed12'`, CARD_NAME)
		rename(fx, `recurring_event_id = 'dvseed13'`, CARD_NAME)
		current = await week(fx.monday)
		const weekly = instanceIn(fx, 'dvseed12', fx.monday)
		const other = instanceIn(fx, 'dvseed13', fx.monday)
		const results = {
			normalized: suggestion(eventOf(fx, current, 'dvseed06')?.suggestion),
			prefix: suggestion(eventOf(fx, current, 'dvseed07')?.suggestion),
			weekly: suggestion(eventOf(fx, current, weekly)?.suggestion),
			other: suggestion(eventOf(fx, current, other)?.suggestion),
		}
		console.log(
			`resolver 2 titles: normalized ${results.normalized} prefix ${results.prefix} weekly_member ${results.weekly} other_rule ${results.other}`
		)
		if (
			results.normalized !== 'event:true' ||
			results.prefix !== 'none' ||
			results.weekly !== 'series:true' ||
			results.other !== 'none'
		)
			fail('resolver 2', 'normalization, prefix or repeat rule gave a wrong suggestion')

		rows(
			`insert into students (display_name, status, import_key) values (${quote(CARD_NAME)}, 'active', ${quote(TWIN_KEY)})`
		)
		current = await week(fx.monday)
		const twin = current.events.filter((event) => event.suggestion !== null).length
		purgeLessons(TWIN_KEY, true)
		console.log(`resolver 3 second card with the same name: suggestions ${twin}`)
		if (twin !== 0) fail('resolver 3', 'two matching cards still gave a suggestion')

		const ignore = (eventId, requestId, version) =>
			call(api, 'POST', `/google/events/${keyOf(fx, eventId)}/ignore`, {
				cookie,
				body: { requestId, expectedVersion: version ?? versionOf(fx, eventId) },
			})
		const requestId = randomUUID()
		const first = await ignore(weekly, requestId)
		const repeat = await ignore(weekly, requestId)
		const stale = await ignore('dvseed06', randomUUID(), 'stale-version')
		const [ignored] = rows(
			`select count(*)::int as n from google_event_ignores where connection_id = ${quote(fx.connection.id)} and event_id = 'dvseed12'`
		)
		current = await week(fx.monday)
		const next = await week(core.addDays(fx.monday, 7))
		const nextWeekly = instanceIn(fx, 'dvseed12', core.addDays(fx.monday, 7))
		const ignoredOk =
			first.status === 204 &&
			repeat.status === 204 &&
			stale.status === 409 &&
			ignored.n === 1 &&
			eventOf(fx, current, weekly)?.suggestion === null &&
			eventOf(fx, next, nextWeekly)?.suggestion === null &&
			eventOf(fx, current, 'dvseed16')?.suggestion?.scope === 'event'
		console.log(
			`resolver 4 ignore master: first ${first.status} repeat ${repeat.status} stale ${stale.status} rows ${ignored.n} member_this_week ${suggestion(eventOf(fx, current, weekly)?.suggestion)} member_next_week ${suggestion(eventOf(fx, next, nextWeekly)?.suggestion)} single_kept ${suggestion(eventOf(fx, current, 'dvseed16')?.suggestion)}`
		)
		if (!ignoredOk) fail('resolver 4', 'Ignore did not hide the series suggestion once and idempotently')

		rows(
			`update google_calendar_events set marker_local_id = ${quote(randomUUID())}, marker_kind = 'single' where connection_id = ${quote(fx.connection.id)} and event_id = 'dvseed06'`
		)
		rows(
			`update google_calendar_events set marker_local_id = ${quote(randomUUID())}, marker_kind = 'event' where connection_id = ${quote(fx.connection.id)} and event_id = 'dvseed16'`
		)
		rows(
			`update google_event_mappings set state = 'retired', retired_at = now() where local_entity_id = ${quote(fx.single)} and state = 'active'`
		)
		rows(
			`update google_calendar_events set marker_local_id = ${quote(fx.single)}, marker_kind = 'single' where connection_id = ${quote(fx.connection.id)} and event_id = 'dvseed15'`
		)
		current = await week(fx.monday)
		const foreign = eventOf(fx, current, 'dvseed06')
		const appEvent = eventOf(fx, current, 'dvseed16')
		const adopted = eventOf(fx, current, 'dvseed15')
		const markerOk =
			foreign?.binding.kind === 'external' &&
			foreign.suggestion?.scope === 'event' &&
			appEvent?.binding.kind === 'external' &&
			appEvent.suggestion === null &&
			adopted?.binding.kind === 'lesson' &&
			adopted.binding.ref.kind === 'single' &&
			adopted.binding.ref.lessonId === fx.single &&
			adopted.binding.studentId === fx.fixtureCard &&
			adopted.editBlock === 'history_only'
		console.log(
			`resolver 5 markers: other_account ${foreign?.binding.kind}/${suggestion(foreign?.suggestion)} app_event ${appEvent?.binding.kind}/${suggestion(appEvent?.suggestion)} existing_lesson ${adopted?.binding.kind}/${adopted?.editBlock}`
		)
		if (!markerOk) fail('resolver 5', 'markers did not resolve as expected')

		const after = counts()
		console.log(`resolver 6 lessons ${before.lessons}->${after.lessons} series ${before.series}->${after.series}`)
		if (after.lessons !== before.lessons || after.series !== before.series)
			fail('resolver 6', 'reading created local lessons')
	} finally {
		await api.stop()
	}
	console.log('RESOLVER_OK')
}

function createStub() {
	const events = new Map()
	const calls = { patch: [], insert: [] }
	let counter = 0
	const etag = () => `"inbound-check-${Date.now()}-${(counter += 1)}"`
	const read = (eventId) => {
		const resource = events.get(eventId)
		if (!resource) throw new GoogleWriteFault(404)
		return structuredClone(resource)
	}
	return {
		events,
		calls,
		async refresh() {
			return { access_token: `synthetic-access-${randomUUID()}`, expiry_date: Date.now() + 3600000 }
		},
		async primary() {
			throw new Error('primary calendar lookup is not expected')
		},
		async insert() {
			throw new Error('insert is not expected')
		},
		async confirmedEvent(_token, _calendarId, request, timeZone, generation) {
			return { ...verifyGoogleResult(read(request.eventId), request, timeZone, generation, 200), recoveryIssue: null }
		},
		async observeEvent(_token, _calendarId, eventId, timeZone) {
			return observeGoogleEvent(read(eventId), timeZone)
		},
		async master(_token, _calendarId, eventId, timeZone) {
			return parseMaster(read(eventId), timeZone)
		},
		async patch(_token, _calendarId, request, timeZone, generation, privateProperties) {
			const resource = read(request.eventId)
			if (resource.etag !== request.ifMatch) throw new GoogleWriteFault(412)
			calls.patch.push(request)
			const body = insertEventBody(request)
			const updated = {
				...resource,
				...body,
				id: resource.id,
				etag: etag(),
				extendedProperties: {
					...body.extendedProperties,
					private: { ...privateProperties, ...body.extendedProperties.private },
				},
			}
			events.set(updated.id, googleTimes(updated, timeZone))
			await new Promise((done) => setTimeout(done, 500))
			return verifyGoogleResult(read(updated.id), request, timeZone, generation, 200, true)
		},
	}
}

function resourceOf(row) {
	const resource = {
		id: row.event_id,
		etag: row.etag,
		status: row.status,
		eventType: row.event_type,
		transparency: row.transparency,
		...(row.summary === null ? {} : { summary: row.summary }),
		start: row.start,
		end: row.end,
		updated: new Date(row.google_updated_at).toISOString(),
		...(row.recurring_event_id ? { recurringEventId: row.recurring_event_id } : {}),
		...(row.original_start ? { originalStartTime: row.original_start } : {}),
		...(row.color_id ? { colorId: row.color_id } : {}),
	}
	if (row.row_kind === 'master') {
		const weekday = WEEKDAYS[(row.recurrence_weekday ?? 3) - 1]
		resource.recurrence =
			row.recurrence_kind === 'weekly'
				? [`RRULE:FREQ=WEEKLY;BYDAY=${weekday}`]
				: [`RRULE:FREQ=WEEKLY;INTERVAL=${row.recurrence_interval ?? 2};BYDAY=${weekday}`]
	}
	return resource
}

function syntheticSource(google) {
	return {
		async page(read, _query, pageToken) {
			const index = pageToken ? Number(pageToken) : 0
			return parseSyncPage(
				{
					timeZone: google.zone,
					items: structuredClone(index === 0 ? google.changes : []),
					nextSyncToken: `synthetic-sync-${randomUUID()}`,
				},
				read.calendarTimeZone
			)
		},
		async master(read, eventId) {
			const raw = google.masters.get(eventId) ?? google.items.get(eventId)
			return syncEventRead(raw ? structuredClone(raw) : null, read.calendarTimeZone)
		},
		async palette() {
			return []
		},
		async calendarColor() {
			return null
		},
	}
}

function createGoogle(zone) {
	let version = 0
	const google = {
		zone,
		items: new Map(),
		masters: new Map(),
		changes: [],
		put(item) {
			version += 1
			const next = googleTimes(
				{ ...item, etag: `"inbound-${version}"`, updated: new Date(Date.now() + version).toISOString() },
				zone
			)
			if (next.recurrence) google.masters.set(next.id, next)
			else google.items.set(next.id, next)
			return next
		},
		cancel(id) {
			const current = google.items.get(id)
			version += 1
			const sparse = {
				id,
				etag: `"inbound-${version}"`,
				status: 'cancelled',
				updated: new Date(Date.now() + version).toISOString(),
				...(current?.recurringEventId
					? { recurringEventId: current.recurringEventId, originalStartTime: current.originalStartTime }
					: {}),
			}
			google.items.set(id, sparse)
			return sparse
		},
		moved(id, startsAt, minutes, extra = {}) {
			const base = google.originals.get(id)
			return google.put({
				...base,
				status: 'confirmed',
				start: { dateTime: startsAt.toISOString(), timeZone: zone },
				end: { dateTime: new Date(startsAt.getTime() + minutes * 60000).toISOString(), timeZone: zone },
				...extra,
			})
		},
		originals: new Map(),
	}
	return google
}

function startSync(db, fx, google, notes, hooks) {
	const credentials = {
		async accessToken(accountId) {
			const [row] = rows(
				`select id, generation::int as generation, calendar_id as "calendarId", account_id as "accountId" from google_connections
where account_id = ${quote(accountId)} and retired_at is null`
			)
			return { accessToken: 'synthetic', connection: row, db }
		},
		evict() {},
	}
	const logger = {
		info: (fields, message) => notes.push({ fields, message }),
		warn: (fields, message) => notes.push({ fields, message }),
		debug: (fields, message) => notes.push({ fields, message }),
	}
	return createCalendarSync({
		db,
		source: syntheticSource(google),
		watch: { async maintain() {} },
		credentials,
		logger,
		isStopping: () => false,
		hooks,
	})
}

function makeDue(fx) {
	rows(`update google_sync_state set requested_seq = requested_seq + 1, claimed_until = null, next_poll_at = now() - interval '1 second',
next_full_at = timestamptz '2999-01-01 00:00:00+00', channel_id = null, channel_resource_id = null, channel_token_hash = null,
channel_expires_at = null, failure_count = 0, issue = null where connection_id = ${quote(fx.connection.id)}`)
}

async function drive(sync, fx, google, notes, changes) {
	google.changes = changes
	const mark = notes.length
	makeDue(fx)
	await sync.wake(fx.connection.id)
	const fresh = notes.slice(mark)
	const pass = fresh.find((note) => note.message === 'Calendar sync pass')
	const inbound = fresh.find((note) => note.message === 'Calendar inbound apply')
	const failed = fresh.find((note) => note.message === 'Calendar inbound apply failed')
	if (!pass) fail('drive', `no committed pass: ${fresh.map((note) => note.message).join(', ')}`)
	return { inbound: inbound?.fields ?? null, failed: Boolean(failed) }
}

async function assignSection(db, fx) {
	const before = counts()
	const fileEnv = parseEnv(readFileSync(targetEnvFile('test'), 'utf8'))
	const app = createDb(resolveDatabaseUrl('app', { ...fileEnv, NODE_ENV: 'test' }))
	const stub = createStub()
	const lease = createConnectionLease(app.pool)
	const credentials = createCredentials({
		db: app.db,
		lease,
		envelope: createTokenEnvelope(syntheticTokenConfig()),
		gateway: stub,
		observation: { accessRefreshed() {} },
	})
	const commands = createCalendarCommands({
		db: app.db,
		credentials,
		gateway: stub,
		wake: async () => undefined,
		resume: async () => undefined,
	})
	const context = { accountId: fx.connection.account_id }
	const refused = async (promise) => {
		try {
			await promise
			return 'accepted'
		} catch (error) {
			return error?.code ?? 'unexpected'
		}
	}
	try {
		rename(fx, `event_id = 'dvseed12' or recurring_event_id = 'dvseed12'`, CARD_NAME)
		for (const row of rows(
			`select event_id from google_calendar_events where connection_id = ${quote(fx.connection.id)} and event_id like 'dvseed%'`
		))
			stub.events.set(row.event_id, resourceOf(projection(fx, row.event_id)))
		const weekly = instanceIn(fx, 'dvseed12', fx.monday)
		const assign = (eventId, studentId = fx.seedCard, version) =>
			commands.submitCalendarCommand(
				{ ...context, now: new Date() },
				{
					operation: 'assign',
					eventKey: keyOf(fx, eventId),
					input: { requestId: randomUUID(), expectedVersion: version ?? versionOf(fx, eventId), studentId },
				}
			)
		const finish = async (receipt, check) => {
			const access = await credentials.accessToken(fx.connection.account_id)
			await dispatchCommand(access, await readCommand(app.db, fx.connection.account_id, receipt.commandId), stub)
			const done = await readCommand(app.db, fx.connection.account_id, receipt.commandId)
			if (done.state !== 'applied') fail(check, `assign ended ${done.state} with ${done.issue}`)
			return done
		}

		const seriesReceipt = await assign(weekly)
		const [stage] = rows(
			`select request from google_command_stages where command_id = ${quote(seriesReceipt.commandId)} and kind = 'write'`
		)
		const payloadKeys = Object.keys(stage.request.payload).sort().join(',')
		const markerOnly =
			stage.request.method === 'patch' &&
			stage.request.eventId === 'dvseed12' &&
			payloadKeys === 'markers' &&
			stage.request.payload.markers.entityKind === 'series'
		console.log(
			`assign 1 admission: method ${stage.request.method} target_master ${stage.request.eventId === 'dvseed12'} payload ${payloadKeys} kind ${stage.request.payload.markers.entityKind}`
		)
		if (!markerOnly) fail('assign 1', 'assign of a series member did not build a marker-only patch on the master')
		await finish(seriesReceipt, 'assign 2')
		const created = rows(
			`select id, weekday, to_char(start_time, 'HH24:MI') as start_time, starts_on::text as starts_on, ends_on from lesson_series
where student_id = ${quote(fx.seedCard)}`
		)
		const [seriesMapping] = rows(
			`select local_entity_id, state from google_event_mappings where connection_id = ${quote(fx.connection.id)} and event_id = 'dvseed12'`
		)
		const google = stub.events.get('dvseed12').extendedProperties.private
		const afterSeries = counts()
		const seriesOk =
			created.length === 1 &&
			created[0].weekday === 3 &&
			created[0].start_time === '15:00' &&
			created[0].starts_on === core.addDays(fx.monday, -26) &&
			seriesMapping?.state === 'active' &&
			seriesMapping.local_entity_id === created[0].id &&
			google.dvLocalId === created[0].id &&
			google.dvKind === 'series' &&
			afterSeries.marks === before.marks &&
			afterSeries.lessons === before.lessons &&
			afterSeries.exceptions === before.exceptions
		console.log(
			`assign 2 applied: series ${created.length} weekday ${created[0]?.weekday} start ${created[0]?.start_time} first_on_master ${created[0]?.starts_on === core.addDays(fx.monday, -26)} mapping ${seriesMapping?.state} marker ${google.dvKind} marks ${before.marks}->${afterSeries.marks}`
		)
		if (!seriesOk) fail('assign 2', 'the applied series assign did not create one series, one mapping and no marks')

		const students = await listLessonStudents(app.db)
		const week = await readWeek(app.db, fx, fx.monday, students)
		const bound = eventOf(fx, week, weekly)
		console.log(
			`assign 3 read: ${bound?.binding.kind} series_ref ${bound?.binding.ref?.seriesId === created[0].id} suggestion ${bound?.suggestion === null ? 'none' : 'set'}`
		)
		if (bound?.binding.kind !== 'lesson' || bound.binding.ref.seriesId !== created[0].id || bound.suggestion !== null)
			fail('assign 3', 'the assigned member is not read as a lesson')

		await finish(await assign('dvseed16'), 'assign 4')
		const singles = rows(
			`select id, starts_at, duration_minutes, status from lessons where student_id = ${quote(fx.seedCard)}`
		)
		const seed16 = projection(fx, 'dvseed16')
		const singleOk =
			singles.length === 1 &&
			new Date(singles[0].starts_at).getTime() === new Date(seed16.starts_at).getTime() &&
			singles[0].duration_minutes === 60 &&
			singles[0].status === 'scheduled'
		console.log(`assign 4 single: lessons ${singles.length} start_matches ${singleOk}`)
		if (!singleOk) fail('assign 4', 'the single assign did not create the lesson at the Google time')

		const refusals = {
			bound: await refused(assign('dvseed16')),
			all_day: await refused(assign('dvseed10')),
			other_rule: await refused(assign(instanceIn(fx, 'dvseed13', fx.monday))),
			focus: await refused(assign('dvseed14')),
			stale: await refused(assign('dvseed06', fx.seedCard, 'stale-version')),
			unknown_student: await refused(assign('dvseed06', randomUUID())),
		}
		console.log(
			`assign 5 refusals: ${Object.entries(refusals)
				.map(([name, code]) => `${name} ${code}`)
				.join(' ')}`
		)
		if (
			refusals.bound !== 'precondition_failed' ||
			refusals.all_day !== 'read_only_event' ||
			refusals.other_rule !== 'unsupported_recurrence' ||
			refusals.focus !== 'read_only_event' ||
			refusals.stale !== 'precondition_failed' ||
			refusals.unknown_student !== 'invalid_request'
		)
			fail('assign 5', 'a refusal code differs')

		const requestId = randomUUID()
		const version = versionOf(fx, 'dvseed06')
		await ignoreEvent(app.db, fx.connection.account_id, keyOf(fx, 'dvseed06'), { requestId, expectedVersion: version })
		await ignoreEvent(app.db, fx.connection.account_id, keyOf(fx, 'dvseed06'), { requestId, expectedVersion: version })
		const [ignored] = rows(
			`select count(*)::int as n from google_event_ignores where connection_id = ${quote(fx.connection.id)} and event_id = 'dvseed06'`
		)
		console.log(`assign 6 ignore twice with one request: rows ${ignored.n}`)
		if (ignored.n !== 1) fail('assign 6', 'a repeated Ignore request stored a second row')

		const google_ = createGoogle(fx.zone)
		const notes = []
		const sync = startSync(db, fx, google_, notes)
		try {
			const result = await drive(sync, fx, google_, notes, [])
			const stamped = rows(
				`select count(*)::int as n from google_calendar_events where connection_id = ${quote(fx.connection.id)}
and (event_id in ('dvseed12', 'dvseed16') or recurring_event_id = 'dvseed12') and inbound_applied_etag = etag`
			)[0].n
			const afterInbound = counts()
			console.log(
				`assign 7 next inbound pass: ${JSON.stringify(result.inbound)} stamped ${stamped} exceptions ${afterSeries.exceptions}->${afterInbound.exceptions}`
			)
			if (
				!result.inbound ||
				result.inbound.applied !== 0 ||
				result.inbound.failed !== 0 ||
				stamped < 2 ||
				afterInbound.exceptions !== afterSeries.exceptions
			)
				fail('assign 7', 'the next inbound pass changed the freshly assigned lessons')
		} finally {
			await sync.close()
		}
	} finally {
		await credentials.close()
		await lease.close()
		await app.pool.end()
	}
	console.log('ASSIGN_OK')
}

async function pastFixtures(db, fx) {
	const today = core.scheduleToday(new Date(), fx.zone)
	const first = core.addDays(today, -22)
	const weekday = core.weekdayOf(first)
	const past = randomUUID()
	const pastSingle = randomUUID()
	const markedSingle = randomUUID()
	const instances = [0, 1, 2, 3, 4, 5].map((week) => {
		const date = core.addDays(first, week * 7)
		const startsAt = core.zonedInstant(date, '10:00', fx.zone)
		return { date, startsAt, id: `dvinbpast_${stamp(startsAt)}` }
	})
	const singleAt = core.zonedInstant(core.addDays(today, -2), '10:00', fx.zone)
	const markedAt = core.zonedInstant(core.addDays(today, -3), '12:00', fx.zone)
	const mapping = (kind, id, eventId) =>
		`insert into google_event_mappings (account_id, connection_id, calendar_id, entity_kind, local_entity_id, student_id, event_id,
representation_generation, command_id, state) values (${quote(fx.connection.account_id)}, ${quote(fx.connection.id)},
${quote(fx.connection.calendar_id)}, '${kind}', ${quote(id)}, ${quote(fx.fixtureCard)}, ${quote(eventId)}, 0, ${quote(fx.seriesCommand)}, 'active');`
	rows(`begin;
insert into lesson_series (id, student_id, weekday, start_time, time_zone, duration_minutes, starts_on) values (${quote(past)},
${quote(fx.fixtureCard)}, ${weekday}, '10:00', ${quote(fx.zone)}, 60, ${quote(first)});
insert into lessons (id, student_id, starts_at, time_zone, duration_minutes, status) values
(${quote(pastSingle)}, ${quote(fx.fixtureCard)}, ${quote(singleAt.toISOString())}, ${quote(fx.zone)}, 60, 'scheduled'),
(${quote(markedSingle)}, ${quote(fx.fixtureCard)}, ${quote(markedAt.toISOString())}, ${quote(fx.zone)}, 60, 'scheduled');
insert into lesson_marks (series_id, original_on, kind) values (${quote(past)}, ${quote(instances[2].date)}, 'done');
insert into lesson_marks (lesson_id, kind) values (${quote(markedSingle)}, 'done');
${mapping('series', past, 'dvinbpast')}
${mapping('single', pastSingle, 'dvinbsingle')}
${mapping('single', markedSingle, 'dvinbmarked')}
commit;`)
	const timed = (startsAt, minutes) => ({
		start: { dateTime: googleDateTime(startsAt, fx.zone), timeZone: fx.zone },
		end: { dateTime: googleDateTime(startsAt.getTime() + minutes * 60000, fx.zone), timeZone: fx.zone },
	})
	const base = { status: 'confirmed', eventType: 'default', transparency: 'opaque', summary: 'Synthetic inbound' }
	const master = {
		...base,
		id: 'dvinbpast',
		etag: '"inbound-master-0"',
		...timed(instances[0].startsAt, 60),
		recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${WEEKDAYS[weekday - 1]}`],
	}
	const resources = [
		...instances.map((item, index) => ({
			...base,
			id: item.id,
			etag: `"inbound-past-${index}"`,
			...timed(item.startsAt, 60),
			recurringEventId: 'dvinbpast',
			originalStartTime: { dateTime: googleDateTime(item.startsAt, fx.zone), timeZone: fx.zone },
		})),
		{ ...base, id: 'dvinbsingle', etag: '"inbound-single-0"', ...timed(singleAt, 60) },
		{ ...base, id: 'dvinbmarked', etag: '"inbound-marked-0"', ...timed(markedAt, 60) },
	]
	const fact = (resource) => ({
		eventId: resource.id,
		etag: resource.etag,
		status: resource.status,
		recurringEventId: resource.recurringEventId ?? null,
		originalStartTime: resource.originalStartTime ?? null,
		summary: resource.summary,
		start: resource.start,
		end: resource.end,
		eventType: 'default',
		transparency: 'opaque',
		factAt: new Date(Date.now() - 60000),
	})
	await db.transaction((tx) =>
		upsertEventFacts(tx, fx.target, [
			...resources.map(fact),
			{ ...fact(master), master: true, recurrence: classifyRecurrence(master.recurrence, fx.zone) },
		])
	)
	return { past, pastSingle, markedSingle, instances, master, resources, first, weekday }
}

async function exclusionFixtures(db, fx) {
	const today = core.scheduleToday(new Date(), fx.zone)
	const first = core.addDays(today, -15)
	const weekday = core.weekdayOf(first)
	const series = randomUUID()
	const instances = [0, 1, 2, 3, 4].map((week) => {
		const date = core.addDays(first, week * 7)
		const startsAt = core.zonedInstant(date, '09:00', fx.zone)
		return { date, startsAt, id: `dvinbexdate_${stamp(startsAt)}` }
	})
	rows(`begin;
insert into lesson_series (id, student_id, weekday, start_time, time_zone, duration_minutes, starts_on) values (${quote(series)},
${quote(fx.fixtureCard)}, ${weekday}, '09:00', ${quote(fx.zone)}, 60, ${quote(first)});
insert into lesson_marks (series_id, original_on, kind) values (${quote(series)}, ${quote(instances[1].date)}, 'done'),
(${quote(series)}, ${quote(instances[3].date)}, 'done');
insert into google_event_mappings (account_id, connection_id, calendar_id, entity_kind, local_entity_id, student_id, event_id,
representation_generation, command_id, state) values (${quote(fx.connection.account_id)}, ${quote(fx.connection.id)},
${quote(fx.connection.calendar_id)}, 'series', ${quote(series)}, ${quote(fx.fixtureCard)}, 'dvinbexdate', 0, ${quote(fx.seriesCommand)}, 'active');
commit;`)
	const timed = (startsAt) => ({
		start: { dateTime: googleDateTime(startsAt, fx.zone), timeZone: fx.zone },
		end: { dateTime: googleDateTime(startsAt.getTime() + 3600000, fx.zone), timeZone: fx.zone },
	})
	const base = { status: 'confirmed', eventType: 'default', transparency: 'opaque', summary: 'Synthetic inbound' }
	const master = {
		...base,
		id: 'dvinbexdate',
		etag: '"inbound-exdate-0"',
		updated: new Date(Date.now() - 60000).toISOString(),
		...timed(instances[0].startsAt),
		recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${WEEKDAYS[weekday - 1]}`],
	}
	const resources = instances.map((item, index) => ({
		...base,
		id: item.id,
		etag: `"inbound-exdate-${index + 1}"`,
		updated: new Date(Date.now() - 60000).toISOString(),
		...timed(item.startsAt),
		recurringEventId: 'dvinbexdate',
		originalStartTime: { dateTime: googleDateTime(item.startsAt, fx.zone), timeZone: fx.zone },
	}))
	const fact = (resource) => ({
		eventId: resource.id,
		etag: resource.etag,
		status: resource.status,
		recurringEventId: resource.recurringEventId ?? null,
		originalStartTime: resource.originalStartTime ?? null,
		summary: resource.summary,
		start: resource.start,
		end: resource.end,
		eventType: 'default',
		transparency: 'opaque',
		factAt: new Date(Date.now() - 60000),
	})
	await db.transaction((tx) =>
		upsertEventFacts(tx, fx.target, [
			...resources.map(fact),
			{ ...fact(master), master: true, recurrence: classifyRecurrence(master.recurrence, fx.zone) },
		])
	)
	return { series, master, resources, instances }
}

async function cutFixtures(db, fx) {
	const today = core.scheduleToday(new Date(), fx.zone)
	const first = core.addDays(today, -7)
	const weekday = core.weekdayOf(first)
	const series = randomUUID()
	const marker = { dvLocalId: series, dvKind: 'series' }
	const instances = [0, 1, 2, 3, 4, 5].map((week) => {
		const date = core.addDays(first, week * 7)
		const startsAt = core.zonedInstant(date, '15:00', fx.zone)
		return { date, startsAt, id: `dvinbcut_${stamp(startsAt)}` }
	})
	rows(`begin;
insert into lesson_series (id, student_id, weekday, start_time, time_zone, duration_minutes, starts_on) values (${quote(series)},
${quote(fx.fixtureCard)}, ${weekday}, '15:00', ${quote(fx.zone)}, 60, ${quote(first)});
insert into google_event_mappings (account_id, connection_id, calendar_id, entity_kind, local_entity_id, student_id, event_id,
representation_generation, command_id, state) values (${quote(fx.connection.account_id)}, ${quote(fx.connection.id)},
${quote(fx.connection.calendar_id)}, 'series', ${quote(series)}, ${quote(fx.fixtureCard)}, 'dvinbcut', 0, ${quote(fx.seriesCommand)}, 'active');
commit;`)
	const timed = (startsAt) => ({
		start: { dateTime: googleDateTime(startsAt, fx.zone), timeZone: fx.zone },
		end: { dateTime: googleDateTime(startsAt.getTime() + 3600000, fx.zone), timeZone: fx.zone },
	})
	const base = {
		status: 'confirmed',
		eventType: 'default',
		transparency: 'opaque',
		summary: 'Synthetic inbound',
		extendedProperties: { private: marker },
	}
	const master = {
		...base,
		id: 'dvinbcut',
		etag: '"inbound-cut-0"',
		updated: new Date(Date.now() - 60000).toISOString(),
		...timed(instances[0].startsAt),
		recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${WEEKDAYS[weekday - 1]}`],
	}
	const resources = instances.map((item, index) => ({
		...base,
		id: item.id,
		etag: `"inbound-cut-${index + 1}"`,
		updated: new Date(Date.now() - 60000).toISOString(),
		...timed(item.startsAt),
		recurringEventId: 'dvinbcut',
		originalStartTime: { dateTime: googleDateTime(item.startsAt, fx.zone), timeZone: fx.zone },
	}))
	const fact = (resource) => ({
		eventId: resource.id,
		etag: resource.etag,
		status: resource.status,
		recurringEventId: resource.recurringEventId ?? null,
		originalStartTime: resource.originalStartTime ?? null,
		summary: resource.summary,
		start: resource.start,
		end: resource.end,
		eventType: 'default',
		transparency: 'opaque',
		markerLocalId: series,
		markerKind: 'series',
		factAt: new Date(Date.now() - 60000),
	})
	await db.transaction((tx) =>
		upsertEventFacts(tx, fx.target, [
			...resources.map(fact),
			{ ...fact(master), master: true, recurrence: classifyRecurrence(master.recurrence, fx.zone) },
		])
	)
	return { series, marker, master, resources, instances, weekday }
}

function localStamp(startsAt, zone) {
	const parts = core.zonedParts(startsAt, zone)
	return `${parts.date.replaceAll('-', '')}T${parts.time.replace(':', '')}00`
}

function loadGoogle(fx, extra, exclusion, cut) {
	const google = createGoogle(fx.zone)
	const bound = rows(
		`select event_id from google_calendar_events where connection_id = ${quote(fx.connection.id)}
and (event_id in (${quote(fx.singleEvent)}, ${quote(fx.masterEvent)}) or recurring_event_id = ${quote(fx.masterEvent)})`
	)
	for (const { event_id: id } of bound) {
		const resource = resourceOf(projection(fx, id))
		if (id === fx.masterEvent) resource.recurrence = [`RRULE:FREQ=WEEKLY;BYDAY=${WEEKDAYS[fx.seriesWeekday - 1]}`]
		if (resource.recurrence) google.masters.set(id, resource)
		else google.items.set(id, resource)
		google.originals.set(id, resource)
	}
	for (const fixture of [extra, exclusion, cut]) {
		google.masters.set(fixture.master.id, fixture.master)
		for (const resource of fixture.resources) {
			google.items.set(resource.id, resource)
			google.originals.set(resource.id, resource)
		}
	}
	return google
}

function exceptionsOf(seriesId) {
	return rows(
		`select original_on::text as original_on, kind, starts_at, duration_minutes from lesson_exceptions
where series_id = ${quote(seriesId)} order by original_on`
	)
}

function lessonOf(id) {
	return rows(`select starts_at, duration_minutes, status from lessons where id = ${quote(id)}`)[0]
}

function seriesOf(id) {
	return rows(
		`select id, weekday, to_char(start_time, 'HH24:MI') as start_time, starts_on::text as starts_on, ends_on::text as ends_on
from lesson_series where id = ${quote(id)}`
	)[0]
}

function stamped(fx, eventId) {
	const row = projection(fx, eventId)
	return row.inbound_applied_etag === row.etag
}

async function inboundSection(db, fx) {
	const extra = await pastFixtures(db, fx)
	const exclusion = await exclusionFixtures(db, fx)
	const cut = await cutFixtures(db, fx)
	const google = loadGoogle(fx, extra, exclusion, cut)
	const notes = []
	let crash = false
	const sync = startSync(db, fx, google, notes, {
		afterPassCommit() {
			if (crash) throw new Error('synthetic crash after the projection commit')
		},
	})
	const baseline = counts()
	const floor = { ...baseline }
	const steady = (check) => {
		const now = counts()
		for (const key of ['lessons', 'series', 'exceptions'])
			if (now[key] < floor[key]) fail(check, `${key} decreased from ${floor[key]} to ${now[key]}`)
		if (now.marks !== baseline.marks) fail(check, `lesson_marks changed from ${baseline.marks} to ${now.marks}`)
		Object.assign(floor, now)
	}
	const fmt = (inbound) =>
		inbound
			? ['applied', 'unchanged', 'skipped_marked', 'skipped_past', 'skipped_pending', 'skipped_locked', 'failed']
					.map((key) => `${key} ${inbound[key]}`)
					.join(' ')
			: 'none'
	try {
		const first = await drive(sync, fx, google, notes, [])
		console.log(`inbound 0 first reconcile: ${fmt(first.inbound)}`)
		if (!first.inbound || first.inbound.applied !== 0 || first.inbound.failed !== 0 || first.inbound.unchanged < 1)
			fail('inbound 0', 'the first reconcile of unchanged rows changed something')
		steady('inbound 0')

		const weekOne = core.addDays(fx.monday, 16)
		const natural = core.zonedInstant(weekOne, '18:00', fx.zone)
		const instance = `${fx.masterEvent}_${stamp(natural)}`
		if (!google.items.has(instance)) fail('inbound 1', 'fixture instance for week one is missing')
		const later = core.zonedInstant(weekOne, '19:30', fx.zone)
		await drive(sync, fx, google, notes, [google.moved(instance, later, 60)])
		let list = exceptionsOf(fx.series)
		const moveOk =
			list.length === 1 &&
			list[0].original_on === weekOne &&
			list[0].kind === 'moved' &&
			new Date(list[0].starts_at).getTime() === later.getTime()
		console.log(`inbound 1 moved instance: exceptions ${list.length} kind ${list[0]?.kind} only_that_date ${moveOk}`)
		if (!moveOk) fail('inbound 1', 'a moved instance did not give exactly one moved exception')
		steady('inbound 1')

		await drive(sync, fx, google, notes, [google.moved(instance, later, 90)])
		list = exceptionsOf(fx.series)
		console.log(`inbound 2 resized instance: duration ${list[0]?.duration_minutes}`)
		if (list[0]?.duration_minutes !== 90) fail('inbound 2', 'the resize did not change the duration')
		steady('inbound 2')

		await drive(sync, fx, google, notes, [google.cancel(instance)])
		list = exceptionsOf(fx.series)
		console.log(`inbound 3 cancelled instance: kind ${list[0]?.kind}`)
		if (list[0]?.kind !== 'cancelled') fail('inbound 3', 'the cancelled instance did not become a cancelled exception')
		steady('inbound 3')

		await drive(sync, fx, google, notes, [google.moved(instance, natural, 60)])
		list = exceptionsOf(fx.series)
		console.log(`inbound 4 back at the natural time: kind ${list[0]?.kind}`)
		if (list[0]?.kind !== 'restored') fail('inbound 4', 'the instance back at its natural time was not restored')
		steady('inbound 4')

		const marked = extra.instances[2]
		const markedMove = await drive(sync, fx, google, notes, [
			google.moved(marked.id, core.zonedInstant(marked.date, '13:00', fx.zone), 60),
		])
		const pastCancel = extra.instances[3]
		const pastResult = await drive(sync, fx, google, notes, [
			google.moved('dvinbsingle', core.zonedInstant(core.addDays(marked.date, 1), '09:00', fx.zone), 60),
			google.cancel(pastCancel.id),
		])
		const pastSingle = lessonOf(extra.pastSingle)
		const pastExceptions = exceptionsOf(extra.past)
		const singleKept = new Date(pastSingle.starts_at).getTime() === Date.parse(extra.resources.at(-2).start.dateTime)
		const unstamped = !stamped(fx, marked.id) && !stamped(fx, 'dvinbsingle') && !stamped(fx, pastCancel.id)
		const frozenOk =
			markedMove.inbound?.skipped_marked >= 2 &&
			pastResult.inbound?.skipped_past >= 2 &&
			pastExceptions.length === 0 &&
			singleKept &&
			pastSingle.status === 'scheduled' &&
			unstamped
		console.log(
			`inbound 5 marked and started: skipped_marked ${markedMove.inbound?.skipped_marked} skipped_past ${pastResult.inbound?.skipped_past} exceptions_on_past_series ${pastExceptions.length} past_single_kept ${singleKept} unstamped ${unstamped}`
		)
		if (!frozenOk) fail('inbound 5', 'a marked or started lesson was changed by Google')
		steady('inbound 5')

		const markedSingle = lessonOf(extra.markedSingle)
		await drive(sync, fx, google, notes, [
			google.moved('dvinbmarked', core.zonedInstant(core.scheduleToday(new Date(), fx.zone), '23:00', fx.zone), 60),
		])
		await drive(sync, fx, google, notes, [google.cancel('dvinbmarked')])
		const markedAfter = lessonOf(extra.markedSingle)
		console.log(
			`inbound 6 marked single moved then cancelled: time_kept ${markedAfter.starts_at === markedSingle.starts_at} status ${markedAfter.status}`
		)
		if (markedAfter.starts_at !== markedSingle.starts_at || markedAfter.status !== 'scheduled')
			fail('inbound 6', 'a marked single lesson took a Google change')
		steady('inbound 6')

		const untilDate = core.addDays(extra.first, 7)
		const untilStamp = stamp(core.zonedInstant(untilDate, '10:00', fx.zone))
		google.put({ ...extra.master, recurrence: [`${extra.master.recurrence[0]};UNTIL=${untilStamp}`] })
		const future = extra.instances[4]
		await drive(sync, fx, google, notes, [google.moved(future.id, future.startsAt, 60)])
		const ended = seriesOf(extra.past)
		const markRow = rows(
			`select count(*)::int as n from lesson_marks where series_id = ${quote(extra.past)} and original_on = ${quote(marked.date)}`
		)[0].n
		const untilOk =
			ended.ends_on !== null && ended.ends_on >= extra.instances[3].date && ended.ends_on < future.date && markRow === 1
		console.log(
			`inbound 7 master UNTIL shortened into the past: ends_on_set ${ended.ends_on !== null} keeps_started ${ended.ends_on >= extra.instances[3].date} drops_future ${ended.ends_on < future.date} mark_kept ${markRow === 1}`
		)
		if (!untilOk) fail('inbound 7', 'a shortened UNTIL cut a started or marked occurrence or kept the future')
		steady('inbound 7')

		const seriesBefore = counts().series
		google.put({
			...extra.master,
			...{
				start: { dateTime: core.zonedInstant(extra.first, '11:00', fx.zone).toISOString(), timeZone: fx.zone },
				end: { dateTime: core.zonedInstant(extra.first, '12:00', fx.zone).toISOString(), timeZone: fx.zone },
			},
		})
		const changed = extra.instances
			.slice(4)
			.map((item) => google.moved(item.id, core.zonedInstant(item.date, '11:00', fx.zone), 60))
		await drive(sync, fx, google, notes, changed)
		const [moved] = rows(
			`select local_entity_id from google_event_mappings where connection_id = ${quote(fx.connection.id)} and event_id = 'dvinbpast'`
		)
		const replacement = seriesOf(moved.local_entity_id)
		const old = seriesOf(extra.past)
		const cutOk =
			counts().series === seriesBefore + 1 &&
			moved.local_entity_id !== extra.past &&
			replacement.start_time === '11:00' &&
			replacement.weekday === extra.weekday &&
			replacement.starts_on === future.date &&
			replacement.ends_on === null &&
			old.ends_on !== null &&
			old.ends_on < future.date &&
			exceptionsOf(moved.local_entity_id).length === 0 &&
			rows(`select count(*)::int as n from lesson_marks where series_id = ${quote(extra.past)}`)[0].n === 1
		console.log(
			`inbound 8 master time changed: series +${counts().series - seriesBefore} mapping_moved ${moved.local_entity_id !== extra.past} new_start ${replacement.start_time} from_first_changeable ${replacement.starts_on === future.date} old_ends ${old.ends_on !== null} mark_kept true`
		)
		if (!cutOk) fail('inbound 8', 'a changed master time did not cut the series into a new row')
		steady('inbound 8')

		const singleBefore = lessonOf(fx.single)
		const singleTarget = core.zonedInstant(core.addDays(fx.monday, 8), '19:00', fx.zone)
		crash = true
		const crashed = await drive(sync, fx, google, notes, [google.moved(fx.singleEvent, singleTarget, 60)])
		crash = false
		const midway = lessonOf(fx.single)
		const projected = projection(fx, fx.singleEvent)
		const recovered = await drive(sync, fx, google, notes, [])
		const afterCrash = lessonOf(fx.single)
		const crashOk =
			crashed.failed &&
			new Date(projected.starts_at).getTime() === singleTarget.getTime() &&
			midway.starts_at === singleBefore.starts_at &&
			new Date(afterCrash.starts_at).getTime() === singleTarget.getTime() &&
			recovered.inbound?.applied >= 1
		console.log(
			`inbound 9 crash after the projection commit: projection_moved ${new Date(projected.starts_at).getTime() === singleTarget.getTime()} lesson_kept_until_next ${midway.starts_at === singleBefore.starts_at} next_pass_moved ${new Date(afterCrash.starts_at).getTime() === singleTarget.getTime()}`
		)
		if (!crashOk) fail('inbound 9', 'the lesson did not converge after a crash between the passes')
		steady('inbound 9')

		await drive(sync, fx, google, notes, [google.cancel(fx.singleEvent)])
		const cancelled = lessonOf(fx.single)
		console.log(`inbound 10 single cancelled in Google: status ${cancelled.status}`)
		if (cancelled.status !== 'cancelled') fail('inbound 10', 'the single cancelled in Google stayed scheduled')
		steady('inbound 10')

		const [command] = rows(
			`select id, confirmed_revision::text as revision from google_commands where id = ${quote(fx.seriesCommand)}`
		)
		rows(`update google_commands set state = 'recovery_required', applied_at = null, confirmed_revision = null,
issue = 'external_change', next_action = 'resume_recovery', updated_at = now() where id = ${quote(command.id)}`)
		const weekTwo = core.addDays(fx.monday, 23)
		const second = `${fx.masterEvent}_${stamp(core.zonedInstant(weekTwo, '18:00', fx.zone))}`
		const pendingTarget = core.zonedInstant(weekTwo, '20:00', fx.zone)
		const held = await drive(sync, fx, google, notes, [google.moved(second, pendingTarget, 60)])
		const heldExceptions = exceptionsOf(fx.series).filter((row) => row.original_on === weekTwo)
		const heldStamped = stamped(fx, second)
		rows(`update google_commands set state = 'applied', applied_at = now(), confirmed_revision = ${command.revision},
issue = null, next_action = 'none', updated_at = now() where id = ${quote(command.id)}`)
		const released = await drive(sync, fx, google, notes, [])
		const releasedExceptions = exceptionsOf(fx.series).filter((row) => row.original_on === weekTwo)
		const pendingOk =
			held.inbound?.skipped_pending >= 1 &&
			heldExceptions.length === 0 &&
			!heldStamped &&
			releasedExceptions.length === 1 &&
			releasedExceptions[0].kind === 'moved' &&
			new Date(releasedExceptions[0].starts_at).getTime() === pendingTarget.getTime() &&
			stamped(fx, second)
		console.log(
			`inbound 11 pending command: skipped_pending ${held.inbound?.skipped_pending} unstamped ${!heldStamped} applied_after_resolve ${releasedExceptions[0]?.kind}`
		)
		if (!pendingOk) fail('inbound 11', 'a pending command did not hold the change or the change was lost')
		steady('inbound 11')

		const splitOn = core.addDays(fx.monday, 30)
		const splitAt = core.zonedInstant(splitOn, '18:00', fx.zone)
		const marker = { dvLocalId: fx.series, dvKind: 'series' }
		const untilBefore = (date) => stamp(new Date(core.startOfZonedDay(date, fx.zone).getTime() - 1000))
		const headMaster = google.masters.get(fx.masterEvent)
		google.put({ ...headMaster, recurrence: [`${headMaster.recurrence[0]};UNTIL=${untilBefore(splitOn)}`] })
		const headTail = `${fx.masterEvent}_${stamp(splitAt)}`
		if (!google.items.has(headTail)) fail('inbound 12', 'fixture instance on the split date is missing')
		google.put({
			id: 'dvinbsplit',
			status: 'confirmed',
			eventType: 'default',
			summary: 'Synthetic inbound',
			start: { dateTime: splitAt.toISOString(), timeZone: fx.zone },
			end: { dateTime: new Date(splitAt.getTime() + 3600000).toISOString(), timeZone: fx.zone },
			recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${WEEKDAYS[fx.seriesWeekday - 1]}`],
			extendedProperties: { private: marker },
		})
		const seriesBeforeSplit = counts().series
		await drive(sync, fx, google, notes, [
			google.cancel(headTail),
			google.put({
				id: `dvinbsplit_${stamp(splitAt)}`,
				status: 'confirmed',
				eventType: 'default',
				summary: 'Synthetic inbound',
				start: { dateTime: splitAt.toISOString(), timeZone: fx.zone },
				end: { dateTime: new Date(splitAt.getTime() + 3600000).toISOString(), timeZone: fx.zone },
				recurringEventId: 'dvinbsplit',
				originalStartTime: { dateTime: splitAt.toISOString(), timeZone: fx.zone },
				extendedProperties: { private: marker },
			}),
		])
		const [splitMapping] = rows(
			`select local_entity_id, state, command_id from google_event_mappings where connection_id = ${quote(fx.connection.id)} and event_id = 'dvinbsplit'`
		)
		const tail = splitMapping ? seriesOf(splitMapping.local_entity_id) : null
		const head = seriesOf(fx.series)
		const splitOk =
			counts().series === seriesBeforeSplit + 1 &&
			splitMapping?.state === 'active' &&
			splitMapping.command_id === fx.seriesCommand &&
			tail?.starts_on === splitOn &&
			tail.start_time === '18:00' &&
			head.ends_on === core.addDays(splitOn, -1) &&
			stamped(fx, `dvinbsplit_${stamp(splitAt)}`)
		console.log(
			`inbound 12 Google split with our marker: series +${counts().series - seriesBeforeSplit} new_master_bound ${splitMapping?.state} tail_from_split ${tail?.starts_on === splitOn} head_ends_before_split ${head.ends_on === core.addDays(splitOn, -1)}`
		)
		if (!splitOk) fail('inbound 12', 'a Google split carrying our marker did not continue the series')
		steady('inbound 12')

		const touch = (item) => google.moved(item.id, core.zonedInstant(item.date, '11:00', fx.zone), 60)
		const pastMaster = google.masters.get('dvinbpast')
		const lastFuture = extra.instances[5]
		const finiteStamp = stamp(core.zonedInstant(lastFuture.date, '11:00', fx.zone))
		google.put({ ...pastMaster, recurrence: [`${pastMaster.recurrence[0]};UNTIL=${finiteStamp}`] })
		await drive(sync, fx, google, notes, [touch(future)])
		const finite = seriesOf(moved.local_entity_id).ends_on
		google.put({ ...pastMaster })
		await drive(sync, fx, google, notes, [touch(future)])
		const reopened = seriesOf(moved.local_entity_id).ends_on
		console.log(
			`inbound 13 UNTIL set then removed on the cut series: ends_on ${finite === lastFuture.date} then_open ${reopened === null}`
		)
		if (finite !== lastFuture.date || reopened !== null) fail('inbound 13', 'UNTIL was not mirrored into ends_on')
		steady('inbound 13')

		google.put({
			...pastMaster,
			recurrence: [pastMaster.recurrence[0].replace('FREQ=WEEKLY', 'FREQ=WEEKLY;INTERVAL=2')],
		})
		await drive(sync, fx, google, notes, [touch(future)])
		const irregular = seriesOf(moved.local_entity_id)
		console.log(
			`inbound 14 master no longer weekly: ends_before_first ${irregular.ends_on === core.addDays(irregular.starts_on, -1)}`
		)
		if (irregular.ends_on !== core.addDays(irregular.starts_on, -1))
			fail('inbound 14', 'a series whose Google rule stopped being weekly kept its future occurrences')
		steady('inbound 14')

		const lessonMaster = google.masters.get(fx.masterEvent)
		google.put({ ...lessonMaster, status: 'cancelled' })
		const weekZero = core.addDays(fx.monday, 9)
		const firstInstance = `${fx.masterEvent}_${stamp(core.zonedInstant(weekZero, '18:00', fx.zone))}`
		await drive(sync, fx, google, notes, [google.cancel(firstInstance)])
		const deleted = seriesOf(fx.series)
		console.log(
			`inbound 15 master deleted in Google: ends_on ${deleted.ends_on === core.addDays(weekZero, -1)} rows_kept ${Boolean(deleted.id)}`
		)
		if (deleted.ends_on !== core.addDays(weekZero, -1))
			fail('inbound 15', 'a deleted master did not end the series at the last past occurrence')
		steady('inbound 15')

		const [, startedEx, markedEx, cancelledEx] = exclusion.instances.slice(1)
		const pastMarkedEx = exclusion.instances[1]
		const exRule = exclusion.master.recurrence[0]
		const exLines = [
			exRule,
			`EXDATE;TZID=${fx.zone}:${localStamp(pastMarkedEx.startsAt, fx.zone)},${localStamp(startedEx.startsAt, fx.zone)}`,
			`EXDATE:${stamp(markedEx.startsAt)}`,
			`EXDATE;TZID=${fx.zone}:${localStamp(cancelledEx.startsAt, fx.zone)}`,
		]
		const kinds = {
			exdate: classifyRecurrence(exLines, fx.zone).recurrenceKind,
			dateOnly: classifyRecurrence([exRule, `EXDATE;VALUE=DATE:${cancelledEx.date.replaceAll('-', '')}`], fx.zone)
				.recurrenceKind,
			rdate: classifyRecurrence([exRule, `RDATE:${stamp(cancelledEx.startsAt)}`], fx.zone).recurrenceKind,
			interval: classifyRecurrence(
				[exRule.replace('FREQ=WEEKLY', 'FREQ=WEEKLY;INTERVAL=2'), `EXDATE:${stamp(cancelledEx.startsAt)}`],
				fx.zone
			).recurrenceKind,
		}
		google.put({ ...exclusion.master, recurrence: exLines })
		const exBefore = seriesOf(exclusion.series)
		const exPass = await drive(sync, fx, google, notes, [
			google.moved(exclusion.instances[0].id, exclusion.instances[0].startsAt, 60),
		])
		const exAfter = seriesOf(exclusion.series)
		const exList = exceptionsOf(exclusion.series)
		const exMaster = projection(fx, 'dvinbexdate')
		const exRow = projection(fx, cancelledEx.id)
		const exMarks = rows(
			`select count(*)::int as n from lesson_marks where series_id = ${quote(exclusion.series)} and kind = 'done'`
		)[0].n
		const exOk =
			kinds.exdate === 'weekly' &&
			kinds.dateOnly === 'other' &&
			kinds.rdate === 'other' &&
			kinds.interval === 'other' &&
			exMaster.recurrence_kind === 'weekly' &&
			exBefore.ends_on === null &&
			exAfter.ends_on === null &&
			exList.length === 1 &&
			exList[0].original_on === cancelledEx.date &&
			exList[0].kind === 'cancelled' &&
			exRow.status === 'cancelled' &&
			exPass.inbound?.skipped_marked >= 1 &&
			!stamped(fx, markedEx.id) &&
			stamped(fx, cancelledEx.id) &&
			exMarks === 2
		console.log(
			`inbound 16 master with EXDATE: kinds exdate ${kinds.exdate} date_only ${kinds.dateOnly} rdate ${kinds.rdate} interval ${kinds.interval} series_alive ${exAfter.ends_on === null} cancelled_only_excluded ${exList.length === 1 && exList[0]?.original_on === cancelledEx.date && exList[0]?.kind === 'cancelled'} marked_frozen ${exPass.inbound?.skipped_marked >= 1 && !stamped(fx, markedEx.id)} marks ${exMarks}`
		)
		if (!exOk) fail('inbound 16', 'an EXDATE on a lesson master did not cancel only the excluded future occurrence')
		steady('inbound 16')

		const timedAt = (date, time) => {
			const startsAt = core.zonedInstant(date, time, fx.zone)
			return {
				start: { dateTime: googleDateTime(startsAt, fx.zone), timeZone: fx.zone },
				end: { dateTime: googleDateTime(startsAt.getTime() + 3600000, fx.zone), timeZone: fx.zone },
			}
		}
		const cutSeriesBefore = counts().series
		google.put({ ...cut.master, ...timedAt(cut.instances[0].date, '16:00') })
		await drive(
			sync,
			fx,
			google,
			notes,
			cut.instances.slice(1).map((item) => google.moved(item.id, core.zonedInstant(item.date, '16:00', fx.zone), 60))
		)
		const [timeCut] = rows(
			`select local_entity_id from google_event_mappings where connection_id = ${quote(fx.connection.id)} and event_id = 'dvinbcut' and state = 'active'`
		)
		const tailOn = cut.instances[4].date
		const tailAt = core.zonedInstant(tailOn, '16:00', fx.zone)
		const skippedOn = core.addDays(tailOn, 7)
		const cutMaster = google.masters.get('dvinbcut')
		google.put({ ...cutMaster, recurrence: [`${cutMaster.recurrence[0]};UNTIL=${untilBefore(tailOn)}`] })
		google.put({
			...cut.master,
			id: 'dvinbcut2',
			...timedAt(tailOn, '16:00'),
			recurrence: [
				`RRULE:FREQ=WEEKLY;BYDAY=${WEEKDAYS[cut.weekday - 1]}`,
				`EXDATE;TZID=${fx.zone}:${localStamp(core.zonedInstant(skippedOn, '16:00', fx.zone), fx.zone)}`,
			],
		})
		await drive(sync, fx, google, notes, [
			google.cancel(cut.instances[4].id),
			google.put({
				...cut.resources[4],
				id: `dvinbcut2_${stamp(tailAt)}`,
				...timedAt(tailOn, '16:00'),
				recurringEventId: 'dvinbcut2',
				originalStartTime: { dateTime: tailAt.toISOString(), timeZone: fx.zone },
			}),
		])
		await drive(sync, fx, google, notes, [])
		const [splitTail] = rows(
			`select local_entity_id, state from google_event_mappings where connection_id = ${quote(fx.connection.id)} and event_id = 'dvinbcut2'`
		)
		const middle = timeCut ? seriesOf(timeCut.local_entity_id) : null
		const last = splitTail ? seriesOf(splitTail.local_entity_id) : null
		const [lastStudent] = splitTail
			? rows(`select student_id from lesson_series where id = ${quote(splitTail.local_entity_id)}`)
			: []
		const lastExceptions = splitTail ? exceptionsOf(splitTail.local_entity_id) : []
		const autoOk =
			Boolean(timeCut) &&
			timeCut.local_entity_id !== cut.series &&
			counts().series === cutSeriesBefore + 2 &&
			splitTail?.state === 'active' &&
			last?.starts_on === tailOn &&
			last.start_time === '16:00' &&
			last.ends_on === null &&
			lastStudent?.student_id === fx.fixtureCard &&
			middle?.ends_on === core.addDays(tailOn, -1) &&
			lastExceptions.length === 1 &&
			lastExceptions[0].original_on === skippedOn &&
			lastExceptions[0].kind === 'cancelled' &&
			stamped(fx, 'dvinbcut2')
		console.log(
			`inbound 17 Google split after a Google time change, marker names the first series: series +${counts().series - cutSeriesBefore} time_cut_moved ${timeCut?.local_entity_id !== cut.series} tail_bound ${splitTail?.state} tail_from_split ${last?.starts_on === tailOn} same_student ${lastStudent?.student_id === fx.fixtureCard} previous_ends ${middle?.ends_on === core.addDays(tailOn, -1)} exdate_cancelled ${lastExceptions.length === 1 && lastExceptions[0]?.original_on === skippedOn}`
		)
		if (!autoOk)
			fail('inbound 17', 'a Google split of a series cut by a Google time change was not bound automatically')
		steady('inbound 17')

		const end = counts()
		console.log(
			`inbound 18 totals: lessons ${baseline.lessons}->${end.lessons} series ${baseline.series}->${end.series} exceptions ${baseline.exceptions}->${end.exceptions} marks ${baseline.marks}->${end.marks}`
		)
	} finally {
		await sync.close()
	}
	console.log('CALENDAR_INBOUND_OK')
}

const handlers = { resolver: resolverSection, assign: assignSection, inbound: inboundSection }

let db = null
let exitCode = 0
try {
	if (!(await offline())) throw new Error('Google hosts resolve: the offline preload is not active')
	const fx = fixtures()
	console.log(
		`FIXTURES connection ${hash(fx.connection.id)} single ${hash(fx.single)} series ${hash(fx.series)} zone ${fx.zone} monday ${fx.monday}`
	)
	db = openDb()
	await handlers[section](db.db, fx)
} catch (error) {
	const message = error instanceof Error ? error.message : 'unexpected failure'
	console.log(`CALENDAR_INBOUND_FAILED ${message.replace(/postgres(ql)?:\/\/\S+/g, '<redacted>')}`)
	exitCode = 1
} finally {
	if (db) await db.pool.end()
	try {
		purgeLessons(SEED_KEY, false)
		runScript('calendar-seed.mjs', 'down', 'test')
		purgeLessons(FIXTURE_KEY, true)
		purgeLessons(TWIN_KEY, true)
	} catch (error) {
		console.log(`cleanup failed: ${error instanceof Error ? error.message : 'unexpected failure'}`)
		exitCode = 1
	}
}
process.exit(exitCode)
