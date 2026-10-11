import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'

import { ENV_TEST, ROOT, quote, sql } from './db-catalog.ts'
import type { MigrationOutput, SqlProbe } from './db-catalog.ts'

const MIGRATIONS = `${ROOT}/packages/db/drizzle`
const EXPECTED_FOLDERS = 8
const TABLES = ['lesson_series', 'lesson_exceptions', 'lessons']
const PRIVILEGES = { select: true, insert: true, update: true, delete: false, truncate: false }
const TARGETS = [
	{ file: '.env.test', database: 'dvlab_test', nodeEnv: 'test' },
	{ file: '.env', database: 'dvlab_dev', nodeEnv: undefined },
] as const
type Target = (typeof TARGETS)[number]
const ZONE_COLUMNS = [
	['lesson_series', 'time_zone'],
	['lessons', 'time_zone'],
	['teacher_settings', 'default_time_zone'],
] as const

const folders = () =>
	readdirSync(MIGRATIONS, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort()

function fail(message: string): never {
	console.log(`FAIL ${message}`)
	process.exit(1)
}

function probeCode(text: string) {
	const result = spawnSync(process.execPath, [`${ROOT}/scripts/dev-checks/sql.mjs`, ENV_TEST, 'migrator', text], {
		encoding: 'utf8',
	})
	const line = (result.stdout ?? '').trim().split('\n').pop() ?? ''
	let out: SqlProbe
	try {
		out = JSON.parse(line) as unknown as SqlProbe
	} catch {
		fail(`sql helper gave no JSON (exit ${result.status})`)
	}
	if (!out.error) return { code: 'ok', constraint: null }
	return { code: out.error.code ?? 'unknown', constraint: out.error.constraint ?? null }
}

function checkMigrationFile() {
	const names = folders()
	if (names.length !== EXPECTED_FOLDERS) fail(`migration folders ${names.length}, expected ${EXPECTED_FOLDERS}`)
	const schedule = names.filter((name) => name.endsWith('_schedule'))
	if (schedule.length !== 1) fail(`schedule migration folders ${schedule.length}, expected 1`)
	const text = readFileSync(`${MIGRATIONS}/${schedule[0]}/migration.sql`, 'utf8')
	const required = [
		'CREATE TABLE "lesson_series"',
		'CREATE TABLE "lesson_exceptions"',
		'CREATE TABLE "lessons"',
		'isodow',
	]
	for (const needle of required) {
		if (!text.includes(needle)) fail(`migration.sql lacks ${needle}`)
	}
	const endsOn = text.split('\n').find((line) => line.includes('"lesson_series_ends_on_ck"')) ?? ''
	if (!endsOn.includes('starts_on" - 1')) fail('lesson_series_ends_on_ck lacks starts_on - 1')
	const moved = text.split('\n').find((line) => line.includes('"lesson_exceptions_moved_idx"')) ?? ''
	if (!/ WHERE "kind" = 'moved'/.test(moved)) fail('lesson_exceptions_moved_idx is not partial')
	for (const word of [/\bDROP\b/, /\bRENAME\b/, /CREATE EXTENSION/]) {
		if (word.test(text)) fail(`migration.sql contains ${word.source}`)
	}
	const revoke = names.filter((name) => name.endsWith('_schedule_revoke_delete'))
	if (revoke.length !== 1) fail(`schedule_revoke_delete migration folders ${revoke.length}, expected 1`)
	const revokeText = readFileSync(`${MIGRATIONS}/${revoke[0]}/migration.sql`, 'utf8')
	if (!/REVOKE DELETE, TRUNCATE ON "lesson_series", "lesson_exceptions", "lessons" FROM "dvlab_app"/.test(revokeText)) {
		fail('schedule_revoke_delete migration lacks the REVOKE')
	}
	console.log(`PASS migration files ${schedule[0]} ${revoke[0]} folders ${names.length}`)
	checkZoneMigration(names)
}

function zoneMigration(): string {
	const names = folders().filter((name) => name.endsWith('_default_time_zone'))
	if (names.length !== 1) fail('expected one default_time_zone migration')
	return readFileSync(`${MIGRATIONS}/${names[0]}/migration.sql`, 'utf8')
}

function checkZoneMigration(names: string[]): void {
	for (const name of names) {
		readFileSync(`${MIGRATIONS}/${name}/migration.sql`, 'utf8')
		JSON.parse(readFileSync(`${MIGRATIONS}/${name}/snapshot.json`, 'utf8')) as unknown
	}
	const statements = zoneMigration()
		.replaceAll('--> statement-breakpoint', '')
		.split(';')
		.map((statement) => statement.trim())
		.filter(Boolean)
	const expected = ZONE_COLUMNS.map(
		([table, column]) => `ALTER TABLE "${table}" ADD COLUMN "${column}" text DEFAULT 'Asia/Ho_Chi_Minh' NOT NULL`
	)
	if (JSON.stringify(statements.sort()) !== JSON.stringify(expected.sort())) fail('zone migration is not additive')
	console.log('PASS generated pairs 8; zone migration adds exactly 3 columns')
}

function object(value: unknown): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) fail('invalid SQL result')
	return value as Record<string, unknown>
}

function targetSql(target: Target, role: 'migrator' | 'app', query: string): Record<string, unknown>[] {
	const guard = `do $$ begin
if current_user <> 'dvlab_${role}' or current_database() <> '${target.database}'
or current_schema() <> 'public'
or (select rolsuper or rolcreatedb or rolcreaterole from pg_roles where rolname = current_user)
then raise exception 'migration database guard refused'; end if; end $$;`
	const result = spawnSync(
		process.execPath,
		[`${ROOT}/scripts/dev-checks/sql.mjs`, `${ROOT}/${target.file}`, role, `${guard} ${query}`],
		{ cwd: ROOT, encoding: 'utf8', timeout: 30000 }
	)
	if (result.status !== 0 || result.error)
		fail(`${target.file} ${role} SQL exited ${result.status}; details suppressed`)
	const parsed: unknown = JSON.parse(result.stdout.trim())
	const output = object(parsed)
	if (!Array.isArray(output.rows)) fail('SQL result has no rows')
	const rows: unknown[] = output.rows
	return rows.map(object)
}

function zoneCatalog(target: Target): void {
	const rows = targetSql(
		target,
		'migrator',
		`select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns where table_schema = 'public'
and (table_name, column_name) in (('lesson_series', 'time_zone'), ('lessons', 'time_zone'),
('teacher_settings', 'default_time_zone'))`
	)
	if (rows.length !== 3) fail(`${target.file} zone column count differs from 3`)
	for (const row of rows) {
		if (row.data_type !== 'text' || row.is_nullable !== 'NO' || row.column_default !== "'Asia/Ho_Chi_Minh'::text")
			fail(`${target.file} zone column contract differs`)
	}
	const [privileges] = targetSql(
		target,
		'app',
		`select bool_and(has_table_privilege(current_user, 'public.' || name, 'SELECT')
and has_table_privilege(current_user, 'public.' || name, 'INSERT')
and has_table_privilege(current_user, 'public.' || name, 'UPDATE')) as dml,
bool_and(name = 'teacher_settings' or (not has_table_privilege(current_user, 'public.' || name, 'DELETE')
and not has_table_privilege(current_user, 'public.' || name, 'TRUNCATE'))) as history_protected,
not has_schema_privilege(current_user, 'public', 'CREATE') as no_ddl
from unnest(array['lesson_series','lessons','lesson_exceptions','lesson_marks','teacher_settings']) as name`
	)
	if (privileges.dml !== true || privileges.history_protected !== true || privileges.no_ddl !== true)
		fail(`${target.file} application privileges changed`)
	console.log(`PASS ${target.file} zone columns 3 NOT NULL/default; roles and privileges`)
}

function migrationState(target: Target): number {
	const [state] = targetSql(
		target,
		'migrator',
		`select (select count(*)::int from drizzle.__drizzle_migrations) as migrations,
(select count(*)::int from pg_tables where schemaname = 'public' and tableowner = 'dvlab_migrator'
and tablename in ('lesson_series','lessons','lesson_exceptions','lesson_marks','teacher_settings')) as owned,
(select count(*)::int from information_schema.columns where table_schema = 'public'
and (table_name, column_name) in (('lesson_series','time_zone'),('lessons','time_zone'),
('teacher_settings','default_time_zone'))) as zones`
	)
	targetSql(target, 'app', 'select 1')
	if (state.owned !== 5) fail(`${target.file} migration table ownership differs`)
	if (state.migrations === 7 && state.zones === 0) return 7
	if (state.migrations === 8 && state.zones === 3) return 8
	return fail(`${target.file} schema does not match the migration journal`)
}

function verifyBackfill(target: Target): void {
	const student = quote(randomUUID())
	const account = quote(randomUUID())
	const series = quote(randomUUID())
	const lesson = quote(randomUUID())
	const snapshot = `select md5(jsonb_build_array(
(select to_jsonb(r) - 'time_zone' from lesson_series r where id = ${series}),
(select to_jsonb(r) - 'time_zone' from lessons r where id = ${lesson}),
(select to_jsonb(r) from lesson_exceptions r where series_id = ${series}),
(select jsonb_agg(to_jsonb(r) order by id) from lesson_marks r where series_id = ${series} or lesson_id = ${lesson}),
(select to_jsonb(r) - 'default_time_zone' from teacher_settings r where account_id = ${account}))::text)`
	const [result] = targetSql(
		target,
		'migrator',
		`begin; set local lock_timeout = '5s'; set local statement_timeout = '15s';
do $probe$ declare before_hash text; after_hash text; begin
insert into students (id, display_name) values (${student}, 'Alex Example 2111');
insert into accounts (id, login, display_name, role, status, password_hash)
values (${account}, 'zone.probe.2111@example.test', 'Alex Example 2111', 'teacher', 'deactivated', 'probe');
insert into teacher_settings (account_id, pays_soon_lessons) values (${account}, 4);
insert into lesson_series (id, student_id, weekday, start_time, duration_minutes, starts_on)
values (${series}, ${student}, 1, '18:00', 60, date '2026-10-12');
insert into lessons (id, student_id, starts_at, duration_minutes)
values (${lesson}, ${student}, timestamptz '2026-10-13 10:00+00', 60);
insert into lesson_exceptions (series_id, original_on, kind, starts_at, duration_minutes)
values (${series}, date '2026-10-12', 'moved', timestamptz '2026-10-13 11:00+00', 60);
insert into lesson_marks (series_id, original_on, kind) values (${series}, date '2026-10-12', 'done');
insert into lesson_marks (lesson_id, kind) values (${lesson}, 'no_show');
${snapshot} into before_hash;
${zoneMigration()}
${snapshot} into after_hash;
if before_hash is distinct from after_hash then raise exception 'history hash changed'; end if;
if (select count(*) from lesson_marks where series_id = ${series} or lesson_id = ${lesson}) <> 2
or (select time_zone from lesson_series where id = ${series}) is distinct from 'Asia/Ho_Chi_Minh'
or (select time_zone from lessons where id = ${lesson}) is distinct from 'Asia/Ho_Chi_Minh'
or (select default_time_zone from teacher_settings where account_id = ${account}) is distinct from 'Asia/Ho_Chi_Minh'
then raise exception 'backfill fixture invariant failed'; end if;
end $probe$; rollback;
select ((select count(*) from students where id = ${student})
+ (select count(*) from accounts where id = ${account}))::int as leftovers`
	)
	if (result.leftovers !== 0) fail(`${target.file} backfill fixture rollback failed`)
	console.log(
		`PASS ${target.file} backfill: synthetic rows 6, marks 2, history MD5 unchanged, zones 3 Vietnam, leftovers 0`
	)
}

function runProbes() {
	const student = randomUUID()
	const series = randomUUID()
	const monday = '2026-10-12'
	const card = `insert into students (id, display_name) values (${quote(student)}, 'Alex Example 2001');`
	const seriesRow = `insert into lesson_series (id, student_id, weekday, start_time, duration_minutes, starts_on) values (${quote(series)}, ${quote(student)}, 1, '18:00', 60, date '${monday}');`
	const seriesWith = (columns: string, values: string) =>
		`insert into lesson_series (student_id, weekday, start_time, duration_minutes, starts_on${columns}) values (${quote(student)}, ${values});`
	const exception = (kind: string, startsAt: string, minutes: string) =>
		`insert into lesson_exceptions (series_id, original_on, kind, starts_at, duration_minutes) values (${quote(series)}, date '${monday}', '${kind}', ${startsAt}, ${minutes});`
	const tx = (...statements: string[]) => `begin; ${statements.join(' ')} rollback;`

	const probes = [
		['series starts_on on a wrong weekday', '23514', tx(card, seriesWith('', `2, '18:00', 60, date '${monday}'`))],
		[
			'series ends_on = starts_on - 1',
			'ok',
			tx(card, seriesWith(', ends_on', `1, '18:00', 60, date '${monday}', date '${monday}' - 1`)),
		],
		[
			'series ends_on = starts_on - 2',
			'23514',
			tx(card, seriesWith(', ends_on', `1, '18:00', 60, date '${monday}', date '${monday}' - 2`)),
		],
		['series start_time with seconds', '23514', tx(card, seriesWith('', `1, '18:00:30', 60, date '${monday}'`))],
		['series duration 10', '23514', tx(card, seriesWith('', `1, '18:00', 10, date '${monday}'`))],
		['series time_zone null', '23502', tx(card, seriesWith(', time_zone', `1, '18:00', 60, date '${monday}', null`))],
		[
			'lesson time_zone null',
			'23502',
			tx(
				card,
				`insert into lessons (student_id, starts_at, duration_minutes, time_zone) values (${quote(student)}, now(), 60, null);`
			),
		],
		[
			'new series and lesson default to Vietnam',
			'ok',
			tx(
				card,
				seriesRow,
				`insert into lessons (student_id, starts_at, duration_minutes) values (${quote(student)}, now(), 60);`,
				`do $$ begin if (select time_zone from lesson_series where id = ${quote(series)}) is distinct from 'Asia/Ho_Chi_Minh'
or (select time_zone from lessons where student_id = ${quote(student)}) is distinct from 'Asia/Ho_Chi_Minh'
then raise exception 'zone defaults differ'; end if; end $$;`
			),
		],
		['moved exception without starts_at', '23514', tx(card, seriesRow, exception('moved', 'null', 'null'))],
		[
			'starts_at without duration_minutes',
			'23514',
			tx(card, seriesRow, exception('cancelled', "timestamptz '2026-10-13 10:00+00'", 'null')),
		],
		[
			'cancelled exception keeps moved time as history',
			'ok',
			tx(card, seriesRow, exception('cancelled', "timestamptz '2026-10-13 10:00+00'", '60')),
		],
		['restored exception without time', 'ok', tx(card, seriesRow, exception('restored', 'null', 'null'))],
		['exception kind skipped', '23514', tx(card, seriesRow, exception('skipped', 'null', 'null'))],
		[
			'second exception for the same occurrence',
			'23505',
			tx(card, seriesRow, exception('cancelled', 'null', 'null'), exception('restored', 'null', 'null')),
		],
		[
			'lesson status done',
			'23514',
			tx(
				card,
				`insert into lessons (student_id, starts_at, duration_minutes, status) values (${quote(student)}, timestamptz '2026-10-13 10:00+00', 60, 'done');`
			),
		],
		[
			'delete a card that has a series',
			'23001',
			tx(card, seriesRow, `delete from students where id = ${quote(student)};`),
		],
	]
	for (const [name, expected, text] of probes) {
		const { code, constraint } = probeCode(text)
		if (code !== expected) fail(`probe "${name}" gave ${code}, expected ${expected}`)
		console.log(`PASS probe ${name}: ${code}${constraint ? ` ${constraint}` : ''}`)
	}
	const leftover = sql(`select count(*)::int as n from students where display_name = 'Alex Example 2001'`)
	if (leftover.rows[0].n !== 0) fail(`fixture cards left behind: ${leftover.rows[0].n}`)
}

function checkPrivileges() {
	const columns: string[] = []
	for (const table of TABLES) {
		for (const privilege of Object.keys(PRIVILEGES)) {
			columns.push(`has_table_privilege('dvlab_app', 'public.${table}', '${privilege}') as "${table}.${privilege}"`)
		}
	}
	const row = sql(`select ${columns.join(', ')}`).rows[0]
	for (const table of TABLES) {
		for (const [privilege, expected] of Object.entries(PRIVILEGES)) {
			const got = row[`${table}.${privilege}`]
			if (got !== expected) fail(`dvlab_app ${privilege} on ${table} is ${got}, expected ${expected}`)
		}
	}
	console.log('PASS privileges dvlab_app select insert update, no delete, no truncate')
}

function catalog() {
	checkMigrationFile()
	for (const target of TARGETS) zoneCatalog(target)
	runProbes()
	checkPrivileges()
	console.log('SCHEDULE_DB_OK')
}

function migrate() {
	checkMigrationFile()
	const count = folders().length
	for (const target of TARGETS) {
		if (migrationState(target) === 7) verifyBackfill(target)
		const env: Record<string, string | undefined> = { ...process.env }
		delete env.DATABASE_URL
		delete env.MIGRATOR_DATABASE_URL
		delete env.NODE_ENV
		if (target.nodeEnv) env.NODE_ENV = target.nodeEnv
		const result = spawnSync(process.execPath, [`--env-file=${target.file}`, 'apps/api/src/migrate.ts'], {
			cwd: ROOT,
			env,
			encoding: 'utf8',
		})
		let applied: number | null = null
		for (const line of (result.stdout ?? '').split('\n')) {
			try {
				const parsed = JSON.parse(line) as unknown as MigrationOutput
				if (typeof parsed.migrations === 'number') applied = parsed.migrations
			} catch {}
		}
		if (result.status !== 0 || applied === null) fail(`${target.file} migrate exited ${result.status} without a count`)
		console.log(`${target.file} ${target.database} ${applied} ${count}`)
		if (applied !== count) fail(`${target.file} journal ${applied} differs from folders ${count}`)
		zoneCatalog(target)
	}
	console.log('MIGRATE_OK')
}

const mode = process.argv[2] ?? 'catalog'
if (mode === 'catalog') catalog()
else if (mode === 'migrate') migrate()
else fail(`unknown mode ${mode}`)
