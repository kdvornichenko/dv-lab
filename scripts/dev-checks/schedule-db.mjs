import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

import { ENV_TEST, ROOT, quote, sql } from './api.mjs'

const MIGRATIONS = `${ROOT}/packages/db/drizzle`
const EXPECTED_FOLDERS = 7
const TABLES = ['lesson_series', 'lesson_exceptions', 'lessons']
const PRIVILEGES = { select: true, insert: true, update: true, delete: false, truncate: false }

const folders = () =>
	readdirSync(MIGRATIONS, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort()

function fail(message) {
	console.log(`FAIL ${message}`)
	process.exit(1)
}

function probeCode(text) {
	const result = spawnSync(process.execPath, [`${ROOT}/scripts/dev-checks/sql.mjs`, ENV_TEST, 'migrator', text], {
		encoding: 'utf8',
	})
	const line = (result.stdout ?? '').trim().split('\n').pop() ?? ''
	let out
	try {
		out = JSON.parse(line)
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
}

function runProbes() {
	const student = randomUUID()
	const series = randomUUID()
	const monday = '2026-10-12'
	const card = `insert into students (id, display_name) values (${quote(student)}, 'Alex Example 2001');`
	const seriesRow = `insert into lesson_series (id, student_id, weekday, start_time, duration_minutes, starts_on) values (${quote(series)}, ${quote(student)}, 1, '18:00', 60, date '${monday}');`
	const seriesWith = (columns, values) =>
		`insert into lesson_series (student_id, weekday, start_time, duration_minutes, starts_on${columns}) values (${quote(student)}, ${values});`
	const exception = (kind, startsAt, minutes) =>
		`insert into lesson_exceptions (series_id, original_on, kind, starts_at, duration_minutes) values (${quote(series)}, date '${monday}', '${kind}', ${startsAt}, ${minutes});`
	const tx = (...statements) => `begin; ${statements.join(' ')} rollback;`

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
	const columns = []
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
	runProbes()
	checkPrivileges()
	console.log('SCHEDULE_DB_OK')
}

function migrate() {
	const count = folders().length
	const targets = [
		{ file: '.env', database: 'dvlab_dev', nodeEnv: undefined },
		{ file: '.env.test', database: 'dvlab_test', nodeEnv: 'test' },
	]
	for (const target of targets) {
		let database = ''
		try {
			const url = parseEnv(readFileSync(`${ROOT}/${target.file}`, 'utf8')).MIGRATOR_DATABASE_URL
			database = decodeURIComponent(new URL(url).pathname.slice(1))
		} catch {
			fail(`${target.file} has no readable MIGRATOR_DATABASE_URL`)
		}
		if (database !== target.database) fail(`${target.file} points to ${database}, expected ${target.database}`)
		const env = { ...process.env }
		delete env.DATABASE_URL
		delete env.MIGRATOR_DATABASE_URL
		delete env.NODE_ENV
		if (target.nodeEnv) env.NODE_ENV = target.nodeEnv
		const result = spawnSync(process.execPath, [`--env-file=${target.file}`, 'apps/api/src/migrate.ts'], {
			cwd: ROOT,
			env,
			encoding: 'utf8',
		})
		let applied = null
		for (const line of (result.stdout ?? '').split('\n')) {
			try {
				const parsed = JSON.parse(line)
				if (typeof parsed.migrations === 'number') applied = parsed.migrations
			} catch {}
		}
		if (result.status !== 0 || applied === null) fail(`${target.file} migrate exited ${result.status} without a count`)
		console.log(`${target.file} ${database} ${applied} ${count}`)
		if (applied !== count) fail(`${target.file} journal ${applied} differs from folders ${count}`)
	}
	console.log('MIGRATE_OK')
}

const mode = process.argv[2] ?? 'catalog'
if (mode === 'catalog') catalog()
else if (mode === 'migrate') migrate()
else fail(`unknown mode ${mode}`)
