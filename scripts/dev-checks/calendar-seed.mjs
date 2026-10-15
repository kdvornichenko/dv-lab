import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

import {
	ROOT,
	SYNTHETIC_CALENDAR_ID,
	assertTarget,
	calendarSql,
	googleDateTime,
	syntheticTokenConfig,
	targetEnvFile,
} from './calendar-env.mjs'

const { addDays, mondayOf, scheduleToday, startOfZonedDay, zonedInstant } = await import(
	`${ROOT}/packages/core/src/index.ts`
)
const { opaqueVersion } = await import(`${ROOT}/apps/api/src/calendar/read-state.ts`)
const { createTokenEnvelope } = await import(`${ROOT}/apps/api/src/calendar/token-envelope.ts`)

const TEST_TEACHER = 'teacher.fixture@example.test'
const CARD_NAME = 'Alex Example 0001'
const CARD_KEY = 'calendar-seed:alex-example-0001'
const SYNTHETIC_MATCH = `like '${SYNTHETIC_CALENDAR_ID}%'`
const FAR = "timestamptz '2999-01-01 00:00:00+00'"
const CALENDAR_COLOR = '#5484ed'
const INK = '#1d1d1d'
const PALETTE = [
	'#a4bdfc',
	'#7ae7bf',
	'#dbadff',
	'#ff887c',
	'#fbd75b',
	'#ffb878',
	'#46d6db',
	'#e1e1e1',
	'#5484ed',
	'#51b749',
	'#dc2127',
].map((background, index) => ({ id: String(index + 1), background, foreground: INK }))

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`
const literal = (value) => (value === null || value === undefined ? 'null' : quote(value))
const json = (value) => (value === null || value === undefined ? 'null' : `${quote(JSON.stringify(value))}::jsonb`)
const instant = (value) =>
	value === null || value === undefined ? 'null' : `${quote(value.toISOString())}::timestamptz`
const hash = (value) => createHash('sha256').update(String(value)).digest('hex').slice(0, 12)
const iso = (date) => date.toISOString().replace('.000Z', 'Z')
const stamp = (date) => iso(date).replaceAll('-', '').replaceAll(':', '')

function fail(message) {
	console.log(`FAIL ${message}`)
	process.exit(1)
}

function rows(target, role, text) {
	return calendarSql(target, role, text).rows
}

async function testTeacher() {
	const found = rows(
		'test',
		'migrator',
		`select id from accounts where login = ${quote(TEST_TEACHER)} and role = 'teacher' and status = 'active'`
	)
	if (found.length === 1) return found[0].id
	const { startApi, teacherCookie } = await import('./api.mjs')
	const api = await startApi({ port: 4190 + Math.floor(Math.random() * 10) })
	try {
		await teacherCookie(api)
	} finally {
		await api.stop()
	}
	const created = rows(
		'test',
		'migrator',
		`select id from accounts where login = ${quote(TEST_TEACHER)} and role = 'teacher' and status = 'active'`
	)
	if (created.length !== 1) fail('test fixture teacher is missing after bootstrap')
	return created[0].id
}

function devTeacher() {
	const login = parseEnv(readFileSync(targetEnvFile('dev'), 'utf8')).DEV_TEACHER_LOGIN
	if (!login) fail('DEV_TEACHER_LOGIN is not set in .env')
	const found = rows(
		'dev',
		'migrator',
		`select id from accounts where login = lower(btrim(${quote(login)})) and role = 'teacher' and status = 'active'`
	)
	if (found.length !== 1) fail('dev teacher account not found')
	return found[0].id
}

const teacher = (target) => (target === 'test' ? testTeacher() : devTeacher())

function teacherZone(target, accountId) {
	const [row] = rows(
		target,
		'migrator',
		`select coalesce((select default_time_zone from teacher_settings where account_id = ${quote(accountId)}), 'Asia/Ho_Chi_Minh') as zone`
	)
	return row.zone
}

function syntheticConnection(target) {
	return rows(
		target,
		'migrator',
		`select c.id, c.account_id, c.calendar_id, c.calendar_time_zone from google_connections c
where c.calendar_id ${SYNTHETIC_MATCH} and c.retired_at is null order by c.created_at desc`
	)
}

const timed = (date, time, minutes, zone) => {
	const start = zonedInstant(date, time, zone)
	const end = new Date(start.getTime() + minutes * 60000)
	return {
		start: { dateTime: googleDateTime(start, zone), timeZone: zone },
		end: { dateTime: googleDateTime(end, zone), timeZone: zone },
		startsAt: start,
		endsAt: end,
		allDay: false,
	}
}

const allDay = (date, days, zone) => ({
	start: { date, timeZone: zone },
	end: { date: addDays(date, days), timeZone: zone },
	startsAt: startOfZonedDay(date, zone),
	endsAt: startOfZonedDay(addDays(date, days), zone),
	allDay: true,
})

function weekScenario(monday, zone) {
	const day = (offset) => addDays(monday, offset)
	const title = (n) => `Synthetic event ${String(n).padStart(2, '0')}`
	const one = (n, when, extra = {}) => ({
		eventId: `dvseed${String(n).padStart(2, '0')}`,
		rowKind: 'single',
		summary: title(n),
		status: 'confirmed',
		eventType: 'default',
		transparency: 'opaque',
		colorId: null,
		...when,
		...extra,
	})
	const list = []
	for (let n = 1; n <= 5; n += 1) list.push(one(n, timed(day(n - 1), '09:00', 60, zone), { colorId: String(n) }))
	list.push(one(6, timed(day(0), '11:00', 60, zone)))
	list.push(one(7, timed(day(1), '11:00', 60, zone), { colorId: '12' }))
	list.push(one(8, timed(day(2), '11:00', 60, zone), { status: 'tentative', colorId: '7' }))
	list.push(one(9, timed(day(3), '11:00', 60, zone), { status: 'cancelled' }))
	list.push(one(10, allDay(day(1), 1, zone), { transparency: 'transparent', colorId: '10' }))
	list.push(one(11, allDay(day(2), 2, zone), { transparency: 'transparent' }))

	const weekly = 'dvseed12'
	const weeklyFirst = timed(day(2 - 28), '15:00', 60, zone)
	list.push(
		one(12, weeklyFirst, {
			eventId: weekly,
			rowKind: 'master',
			colorId: '9',
			recurrenceKind: 'weekly',
			recurrenceWeekday: 3,
			recurrenceFrequency: 'weekly',
			recurrenceInterval: 1,
		})
	)
	for (const week of [-1, 0, 1]) {
		const when = timed(day(2 + week * 7), '15:00', 60, zone)
		list.push(
			one(12, when, {
				eventId: `${weekly}_${stamp(when.startsAt)}`,
				rowKind: 'instance',
				colorId: '9',
				recurringEventId: weekly,
				originalStart: when.start,
			})
		)
	}

	const other = 'dvseed13'
	list.push(
		one(13, timed(day(4 - 14), '15:00', 60, zone), {
			eventId: other,
			rowKind: 'master',
			recurrenceKind: 'other',
			recurrenceFrequency: 'weekly',
			recurrenceInterval: 2,
		})
	)
	const otherNow = timed(day(4), '15:00', 60, zone)
	list.push(
		one(13, otherNow, {
			eventId: `${other}_${stamp(otherNow.startsAt)}`,
			rowKind: 'instance',
			recurringEventId: other,
			originalStart: otherNow.start,
		})
	)

	list.push(one(14, timed(day(3), '13:00', 60, zone), { eventType: 'focusTime' }))
	list.push(
		one(15, timed(day(4), '11:00', 90, zone), {
			location: 'Synthetic room 1',
			description: 'Synthetic description for a seeded event.',
			colorId: '6',
		})
	)
	list.push(one(16, timed(day(4), '13:00', 60, zone), { summary: CARD_NAME }))
	return list
}

function eventInsert(connection, row, now, index) {
	return `insert into google_calendar_events (account_id, connection_id, calendar_id, event_id, event_key, row_kind, etag,
recurring_event_id, original_start, status, event_type, start, "end", starts_at, ends_at, all_day, summary, description,
location, color_id, transparency, recurrence_kind, recurrence_weekday, recurrence_frequency, recurrence_interval,
recurrence_until, google_updated_at, seen_epoch) values (${quote(connection.accountId)}, ${quote(connection.id)},
${quote(SYNTHETIC_CALENDAR_ID)}, ${quote(row.eventId)}, ${quote(opaqueVersion([connection.id, row.eventId]))},
${quote(row.rowKind)}, ${quote(`"${now.getTime()}${String(index).padStart(3, '0')}"`)}, ${literal(row.recurringEventId)},
${json(row.originalStart)}, ${quote(row.status)}, ${quote(row.eventType)}, ${json(row.start)}, ${json(row.end)},
${instant(row.startsAt)}, ${instant(row.endsAt)}, ${row.allDay}, ${literal(row.summary)}, ${literal(row.description)},
${literal(row.location)}, ${literal(row.colorId)}, ${quote(row.transparency)}, ${literal(row.recurrenceKind)},
${row.recurrenceWeekday ?? 'null'}, ${literal(row.recurrenceFrequency)}, ${row.recurrenceInterval ?? 'null'},
${literal(row.recurrenceUntil)}, ${instant(now)}, 0);`
}

function down(target) {
	assertTarget(target)
	const scope = `(select id from google_connections where calendar_id ${SYNTHETIC_MATCH})`
	const [before] = rows(
		target,
		'migrator',
		`select (select count(*)::int from google_connections where calendar_id ${SYNTHETIC_MATCH}) as connections,
(select count(*)::int from google_calendar_events where connection_id in ${scope}) as events,
(select count(*)::int from students where import_key = ${quote(CARD_KEY)}) as cards`
	)
	rows(
		target,
		'migrator',
		`begin;
delete from google_command_stages where connection_id in ${scope};
delete from google_read_events where connection_id in ${scope};
delete from google_read_windows where connection_id in ${scope};
delete from google_next_lessons where connection_id in ${scope};
delete from google_event_mappings where connection_id in ${scope};
delete from google_commands where connection_id in ${scope};
delete from google_oauth_flows where connection_id in ${scope};
delete from google_calendar_events where connection_id in ${scope};
delete from google_event_ignores where connection_id in ${scope};
delete from google_sync_state where connection_id in ${scope};
delete from google_connections where id in ${scope};
delete from student_sections where student_id in (select id from students where import_key = ${quote(CARD_KEY)});
delete from students where import_key = ${quote(CARD_KEY)};
commit;`
	)
	const [after] = rows(
		target,
		'migrator',
		`select (select count(*)::int from google_connections where calendar_id ${SYNTHETIC_MATCH}) as connections,
(select count(*)::int from google_calendar_events where calendar_id ${SYNTHETIC_MATCH}) as events,
(select count(*)::int from students where import_key = ${quote(CARD_KEY)}) as cards`
	)
	if (after.connections !== 0 || after.events !== 0 || after.cards !== 0) fail(`${target} synthetic rows remain`)
	console.log(
		`SEED_DOWN ${target} connections ${before.connections} events ${before.events} cards ${before.cards} removed`
	)
}

async function up(target, scenario) {
	if (scenario !== 'week') fail(`unknown scenario ${scenario}`)
	assertTarget(target)
	const accountId = await teacher(target)
	const current = rows(
		target,
		'migrator',
		`select calendar_id from google_connections where account_id = ${quote(accountId)} and retired_at is null`
	)
	if (current.some((row) => !(row.calendar_id ?? '').startsWith(SYNTHETIC_CALENDAR_ID)))
		fail(`${target} teacher already has a current Google connection that is not synthetic`)
	if (current.length > 0 || syntheticConnection(target).length > 0) down(target)

	const zone = teacherZone(target, accountId)
	const now = new Date()
	const monday = mondayOf(scheduleToday(now, zone))
	const connection = { id: randomUUID(), accountId }
	const envelope = createTokenEnvelope(syntheticTokenConfig()).seal(`synthetic-refresh-${randomUUID()}`, {
		accountId,
		connectionId: connection.id,
		generation: 1,
		purpose: 'refresh',
	})
	const windowStart = startOfZonedDay(addDays(monday, -56), zone)
	const windowEnd = startOfZonedDay(addDays(monday, 371), zone)
	const tokenHash = createHash('sha256').update(randomBytes(32)).digest('hex')
	const events = weekScenario(monday, zone)
	const statements = [
		'begin;',
		`insert into google_connections (id, account_id, calendar_id, calendar_label, calendar_time_zone, history_cutover_at,
generation, credential_generation, state, encrypted_refresh_token, credential_mode) values (${quote(connection.id)},
${quote(accountId)}, ${quote(SYNTHETIC_CALENDAR_ID)}, 'Synthetic calendar', ${quote(zone)}, ${instant(now)}, 1, 1,
'connected', ${json(envelope)}, 'active');`,
		`insert into google_sync_state (connection_id, account_id, calendar_id, sync_token, epoch, window_start, window_end,
revision, claimed_until, next_poll_at, next_full_at, last_incremental_at, last_full_at, palette, palette_fetched_at,
calendar_color, channel_id, channel_resource_id, channel_token_hash, channel_expires_at) values (${quote(connection.id)},
${quote(accountId)}, ${quote(SYNTHETIC_CALENDAR_ID)}, ${quote(`synthetic-sync-${randomUUID()}`)}, 0, ${instant(windowStart)},
${instant(windowEnd)}, 1, ${FAR}, ${FAR}, ${FAR}, ${instant(now)}, ${instant(now)}, ${json(PALETTE)}, ${instant(now)},
${quote(CALENDAR_COLOR)}, ${quote(randomUUID())}, ${quote(`synthetic-resource-${randomUUID()}`)}, ${quote(tokenHash)}, ${FAR});`,
		...events.map((row, index) => eventInsert(connection, row, now, index)),
		`insert into students (display_name, status, import_key) values (${quote(CARD_NAME)}, 'active', ${quote(CARD_KEY)});`,
		'commit;',
	]
	rows(target, 'migrator', statements.join('\n'))
	const [check] = rows(
		target,
		'migrator',
		`select (select count(*)::int from google_calendar_events where connection_id = ${quote(connection.id)}) as events,
(select count(*)::int from google_sync_state where connection_id = ${quote(connection.id)}) as sync_rows,
(select count(*)::int from students where import_key = ${quote(CARD_KEY)} and status = 'active') as cards`
	)
	if (check.events !== events.length || check.sync_rows !== 1 || check.cards !== 1)
		fail(`${target} seed counts differ: events ${check.events} of ${events.length}`)
	for (const row of events)
		console.log(`event ${row.eventId} ${row.rowKind} ${row.status} ${row.allDay ? 'all_day' : 'timed'}`)
	console.log(
		`SEED_UP ${target} week events ${events.length} sync_rows 1 cards 1 connection ${hash(connection.id)} monday ${monday}`
	)
}

function requireSynthetic(target) {
	assertTarget(target)
	const found = syntheticConnection(target)
	if (found.length !== 1) fail(`${target} has ${found.length} current synthetic connections, expected 1`)
	return found[0].id
}

function bump(target, eventId) {
	if (!eventId) fail('bump needs an event id')
	const connectionId = requireSynthetic(target)
	const [row] = rows(
		target,
		'migrator',
		`select starts_at, ends_at, start ->> 'timeZone' as zone from google_calendar_events where connection_id = ${quote(connectionId)}
and event_id = ${quote(eventId)} and all_day = false and start ? 'dateTime' and starts_at is not null and ends_at is not null`
	)
	if (!row) fail(`${target} has no timed synthetic event ${eventId}`)
	const later = { start: row.starts_at, '"end"': row.ends_at }
	const moved = (column) =>
		`jsonb_set(${column}, '{dateTime}', to_jsonb(${quote(googleDateTime(new Date(later[column]).getTime() + 3600000, row.zone))}::text))`
	rows(
		target,
		'migrator',
		`begin;
update google_calendar_events set etag = ${quote(`"${Date.now()}"`)}, start = ${moved('start')}, "end" = ${moved('"end"')},
starts_at = starts_at + interval '1 hour', ends_at = ends_at + interval '1 hour', google_updated_at = now(), updated_at = now()
where connection_id = ${quote(connectionId)} and event_id = ${quote(eventId)};
update google_sync_state set revision = revision + 1, updated_at = now() where connection_id = ${quote(connectionId)};
commit;`
	)
	const [after] = rows(
		target,
		'migrator',
		`select revision::text as revision from google_sync_state where connection_id = ${quote(connectionId)}`
	)
	console.log(`SEED_BUMP ${target} ${eventId} revision ${after.revision}`)
}

function state(target, value) {
	const connectionId = requireSynthetic(target)
	const changes = {
		idle: 'full_started_at = null, issue = null, last_incremental_at = now()',
		running: 'full_started_at = now(), issue = null',
		failed: "full_started_at = null, issue = 'provider_unavailable'",
	}[value]
	if (!changes) fail(`unknown state ${value}, expected idle, running or failed`)
	rows(
		target,
		'migrator',
		`update google_sync_state set ${changes}, updated_at = now() where connection_id = ${quote(connectionId)}`
	)
	console.log(`SEED_STATE ${target} ${value}`)
}

const [command, target, argument] = process.argv.slice(2)
if (target !== 'test' && target !== 'dev') {
	console.log('usage: node scripts/dev-checks/calendar-seed.mjs up|down|bump|state test|dev [scenario|eventId|state]')
	process.exit(2)
}
if (command === 'up') await up(target, argument ?? 'week')
else if (command === 'down') down(target)
else if (command === 'bump') bump(target, argument)
else if (command === 'state') state(target, argument)
else fail(`unknown command ${command}`)
