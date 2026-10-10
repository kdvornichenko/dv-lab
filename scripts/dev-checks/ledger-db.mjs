import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'

import { ENV_TEST, ROOT, quote, sql } from './api.mjs'

const MIGRATIONS = `${ROOT}/packages/db/drizzle`
const CARD = 'Alex Example 2101'
const LOGIN = 'ledger.probe.2101@example.test'
const PRIVILEGES = {
	lesson_marks: { select: true, insert: true, update: true, delete: false, truncate: false },
	teacher_settings: { select: true, insert: true, update: true },
}

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

function single(names, suffix) {
	const found = names.filter((name) => name.endsWith(suffix))
	if (found.length !== 1) fail(`${suffix} migration folders ${found.length}, expected 1`)
	return found[0]
}

function checkMigrationFiles() {
	const names = readdirSync(MIGRATIONS, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
	const marks = single(names, '_lesson_marks')
	const revoke = single(names, '_lesson_marks_revoke_delete')
	const text = readFileSync(`${MIGRATIONS}/${marks}/migration.sql`, 'utf8')
	const required = [
		'CREATE TABLE "lesson_marks"',
		'CREATE TABLE "teacher_settings"',
		'"no_show_deducts" boolean DEFAULT true NOT NULL',
		'"pays_soon_lessons" integer NOT NULL',
		'lesson_marks_ref_ck',
		'teacher_settings_pays_soon_ck',
	]
	for (const needle of required) {
		if (!text.includes(needle)) fail(`${marks} lacks ${needle}`)
	}
	const threshold = text.split('\n').find((line) => line.includes('"pays_soon_lessons"')) ?? ''
	if (threshold.includes('DEFAULT')) fail('pays_soon_lessons has a database default')
	const revokeText = readFileSync(`${MIGRATIONS}/${revoke}/migration.sql`, 'utf8')
	if (!revokeText.includes('REVOKE DELETE, TRUNCATE ON "lesson_marks" FROM "dvlab_app";')) {
		fail(`${revoke} lacks the REVOKE`)
	}
	for (const [name, body] of [
		[marks, text],
		[revoke, revokeText],
	]) {
		for (const word of [/\bDROP\b/, /\bRENAME\b/, /CREATE EXTENSION/]) {
			if (word.test(body)) fail(`${name} contains ${word.source}`)
		}
	}
	console.log(`PASS migration files ${marks} ${revoke}`)
}

function runProbes() {
	const student = randomUUID()
	const series = randomUUID()
	const lesson = randomUUID()
	const account = randomUUID()
	const monday = '2026-10-12'
	const card = `insert into students (id, display_name) values (${quote(student)}, ${quote(CARD)});`
	const seriesRow = `insert into lesson_series (id, student_id, weekday, start_time, duration_minutes, starts_on) values (${quote(series)}, ${quote(student)}, 1, '18:00', 60, date '${monday}');`
	const lessonRow = `insert into lessons (id, student_id, starts_at, duration_minutes) values (${quote(lesson)}, ${quote(student)}, timestamptz '2026-10-13 10:00+00', 60);`
	const base = [card, seriesRow, lessonRow]
	const mark = (seriesId, originalOn, lessonId, kind = 'done') =>
		`insert into lesson_marks (series_id, original_on, lesson_id, kind) values (${seriesId}, ${originalOn}, ${lessonId}, '${kind}');`
	const seriesMark = (kind) => mark(quote(series), `date '${monday}'`, 'null', kind)
	const lessonMark = (kind) => mark('null', 'null', quote(lesson), kind)
	const accountRow = `insert into accounts (id, login, display_name, role, status, password_hash) values (${quote(account)}, ${quote(LOGIN)}, ${quote(CARD)}, 'teacher', 'deactivated', 'probe');`
	const settings = (value) =>
		`insert into teacher_settings (account_id, pays_soon_lessons) values (${quote(account)}, ${value});`
	const tx = (...statements) => `begin; ${statements.join(' ')} rollback;`

	const probes = [
		['series occurrence mark', 'ok', tx(...base, seriesMark('done'))],
		['single lesson mark', 'ok', tx(...base, lessonMark('no_show'))],
		['mark kind none', 'ok', tx(...base, seriesMark('none'))],
		['mark with both keys', '23514', tx(...base, mark(quote(series), `date '${monday}'`, quote(lesson)))],
		['mark with no key', '23514', tx(...base, mark('null', 'null', 'null'))],
		['series_id without original_on', '23514', tx(...base, mark(quote(series), 'null', 'null'))],
		['original_on without series_id', '23514', tx(...base, mark('null', `date '${monday}'`, quote(lesson)))],
		['mark kind held', '23514', tx(...base, seriesMark('held'))],
		['second mark for the same occurrence', '23505', tx(...base, seriesMark('done'), seriesMark('no_show'))],
		['second mark for the same lesson', '23505', tx(...base, lessonMark('done'), lessonMark('none'))],
		[
			'delete a lesson that has a mark',
			'23001',
			tx(...base, lessonMark('done'), `delete from lessons where id = ${quote(lesson)};`),
		],
		[
			'delete a series that has a mark',
			'23001',
			tx(...base, seriesMark('done'), `delete from lesson_series where id = ${quote(series)};`),
		],
		['teacher_settings pays_soon_lessons 21', '23514', tx(accountRow, settings(21))],
		['teacher_settings pays_soon_lessons -1', '23514', tx(accountRow, settings(-1))],
		['teacher_settings pays_soon_lessons 0', 'ok', tx(accountRow, settings(0))],
		['teacher_settings pays_soon_lessons 20', 'ok', tx(accountRow, settings(20))],
		[
			'teacher_settings without pays_soon_lessons',
			'23502',
			tx(accountRow, `insert into teacher_settings (account_id) values (${quote(account)});`),
		],
		['second teacher_settings row for the account', '23505', tx(accountRow, settings(2), settings(3))],
		[
			'new card gets no_show_deducts true',
			'ok',
			tx(
				card,
				`do $$ begin if (select no_show_deducts from students where id = ${quote(student)}) is not true then raise exception 'no_show_deducts default' using errcode = 'P0001'; end if; end $$;`
			),
		],
	]
	for (const [name, expected, text] of probes) {
		const { code, constraint } = probeCode(text)
		if (code !== expected) fail(`probe "${name}" gave ${code}, expected ${expected}`)
		console.log(`PASS probe ${name}: ${code}${constraint ? ` ${constraint}` : ''}`)
	}
	const leftover = sql(
		`select (select count(*)::int from students where display_name = ${quote(CARD)}) + (select count(*)::int from accounts where login = ${quote(LOGIN)}) as n`
	)
	if (leftover.rows[0].n !== 0) fail(`fixture rows left behind: ${leftover.rows[0].n}`)
}

function checkPrivileges() {
	const columns = []
	for (const [table, expected] of Object.entries(PRIVILEGES)) {
		for (const privilege of Object.keys(expected)) {
			columns.push(`has_table_privilege('dvlab_app', 'public.${table}', '${privilege}') as "${table}.${privilege}"`)
		}
	}
	const row = sql(`select ${columns.join(', ')}`).rows[0]
	for (const [table, expected] of Object.entries(PRIVILEGES)) {
		for (const [privilege, want] of Object.entries(expected)) {
			const got = row[`${table}.${privilege}`]
			if (got !== want) fail(`dvlab_app ${privilege} on ${table} is ${got}, expected ${want}`)
		}
	}
	console.log('PASS privileges dvlab_app lesson_marks select insert update, no delete, no truncate')
	console.log('PASS privileges dvlab_app teacher_settings select insert update')
}

function catalog() {
	checkMigrationFiles()
	runProbes()
	checkPrivileges()
	console.log('LEDGER_DB_OK')
}

function migrate() {
	const result = spawnSync(process.execPath, [`${ROOT}/scripts/dev-checks/schedule-db.mjs`, 'migrate'], {
		cwd: ROOT,
		stdio: 'inherit',
	})
	process.exit(result.status ?? 1)
}

const mode = process.argv[2] ?? 'catalog'
if (mode === 'catalog') catalog()
else if (mode === 'migrate') migrate()
else fail(`unknown mode ${mode}`)
