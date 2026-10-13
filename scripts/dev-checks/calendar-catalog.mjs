import { assertTarget, calendarSql } from './calendar-env.mjs'

const TABLES = ['google_calendar_events', 'google_sync_state', 'google_event_ignores']
const FOREIGN_KEYS = [
	'google_calendar_events_calendar_fk',
	'google_sync_state_calendar_fk',
	'google_event_ignores_calendar_fk',
]
const DELETABLE = new Set(['google_calendar_events'])
const CHECKS = [
	'google_calendar_events_kind_ck',
	'google_calendar_events_time_ck',
	'google_calendar_events_range_ck',
	'google_calendar_events_identity_ck',
	'google_calendar_events_text_ck',
	'google_calendar_events_recurrence_ck',
	'google_sync_state_counters_ck',
	'google_sync_state_window_ck',
	'google_sync_state_channel_ck',
	'google_sync_state_issue_ck',
	'google_sync_state_color_ck',
	'google_event_ignores_event_ck',
]
const KEYS = [
	['google_calendar_events_pk', 'p'],
	['google_calendar_events_key_uq', 'u'],
	['google_event_ignores_event_uq', 'u'],
	['google_event_ignores_request_uq', 'u'],
]

const list = (values) => values.map((value) => `'${value}'`).join(', ')

function fail(message) {
	console.log(`FAIL ${message}`)
	process.exit(1)
}

function check(target) {
	assertTarget(target)
	const query = (text) => calendarSql(target, 'migrator', text).rows
	const tables = query(
		`select tablename from pg_tables where schemaname = 'public' and tablename in (${list(TABLES)}) and tableowner = 'dvlab_migrator'`
	)
	if (tables.length !== TABLES.length)
		fail(`${target} has ${tables.length} of ${TABLES.length} tables owned by the migrator`)
	const keys = query(
		`select conname, confdeltype from pg_constraint where contype = 'f' and conname in (${list(FOREIGN_KEYS)})
and confrelid = 'public.google_connections'::regclass`
	)
	if (keys.length !== FOREIGN_KEYS.length) fail(`${target} has ${keys.length} of ${FOREIGN_KEYS.length} foreign keys`)
	const loose = keys.find((row) => row.confdeltype !== 'r')
	if (loose) fail(`${target} ${loose.conname} is not ON DELETE RESTRICT`)
	for (const table of TABLES) {
		const [row] = query(`select has_table_privilege('dvlab_app', 'public.${table}', 'SELECT') as s,
has_table_privilege('dvlab_app', 'public.${table}', 'INSERT') as i,
has_table_privilege('dvlab_app', 'public.${table}', 'UPDATE') as u,
has_table_privilege('dvlab_app', 'public.${table}', 'DELETE') as d,
has_table_privilege('dvlab_app', 'public.${table}', 'TRUNCATE') as t`)
		if (!row.s || !row.i || !row.u) fail(`${target} dvlab_app lacks select, insert or update on ${table}`)
		if (row.d !== DELETABLE.has(table)) fail(`${target} dvlab_app delete on ${table} is ${row.d}`)
		if (row.t) fail(`${target} dvlab_app can truncate ${table}`)
	}
	const checks = query(`select conname from pg_constraint where contype = 'c' and conname in (${list(CHECKS)})`)
	if (checks.length !== CHECKS.length) {
		const found = new Set(checks.map((row) => row.conname))
		fail(`${target} lacks check ${CHECKS.find((name) => !found.has(name))}`)
	}
	const unique = query(
		`select conname, contype from pg_constraint where conname in (${list(KEYS.map(([name]) => name))})`
	)
	for (const [name, type] of KEYS) {
		if (!unique.some((row) => row.conname === name && row.contype === type)) fail(`${target} lacks key ${name}`)
	}
	console.log(
		`PASS ${target} tables ${TABLES.length}, restrict keys ${keys.length}, checks ${checks.length}, delete only on google_calendar_events`
	)
}

for (const target of ['test', 'dev']) check(target)
console.log('CALENDAR_CATALOG_OK')
