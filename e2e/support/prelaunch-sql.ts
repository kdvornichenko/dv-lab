import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'
import { Client } from 'pg'

import { ROOT } from '../../scripts/dev-checks/paths.mjs'
import { NAMES } from './data.ts'
import { list, record, text, uuid } from './input.ts'
import {
	DATABASE_IDENTITY_SQL,
	ENV_FILE,
	FIXTURE_DATABASE,
	PRIVATE_DIR,
	readPrivateJson,
	targetBinding,
	verifyTargetHealth,
} from './target.ts'
import type { TargetBinding } from './target.ts'

type OwnedFixture = { id: string; name: string }
type Statement = { text: string; values: (string | number | string[])[] }
type Insert = { studentId: string; statement: Statement }
type FixtureOperation = { kind: 'cleanup' } | { kind: 'query'; query: string }
type Request = { kind: 'identity' } | FixtureOperation

function request(): Request {
	const value: unknown = JSON.parse(readFileSync(0, 'utf8'))
	const input = record(value)
	if (input.kind === 'identity' || input.kind === 'cleanup') return { kind: input.kind }
	if (input.kind === 'query') return { kind: input.kind, query: text(input.query).trim() }
	throw new Error('Invalid E2E database operation')
}

function connectionString(): string {
	const env = parseEnv(readFileSync(resolve(ROOT, ENV_FILE), 'utf8'))
	const value = text(env.MIGRATOR_DATABASE_URL)
	const url = new URL(value)
	if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.username !== 'dvlab_migrator')
		throw new Error('Invalid E2E database role')
	if (/_(dev|test)$/.test(decodeURIComponent(url.pathname.slice(1))))
		throw new Error('Prelaunch mode cannot replace dev or test mode')
	return value
}

function ownedFixtures(): OwnedFixture[] {
	return list(readPrivateJson(resolve(PRIVATE_DIR, 'owned.json'))).map((value) => {
		const row = record(value)
		const name = text(row.name)
		if (!NAMES.some((item) => item === name)) throw new Error('Fixture is outside the owned set')
		return { id: uuid(row.id), name }
	})
}

function requireBoundTarget(binding: TargetBinding, operation: Request): void {
	if (operation.kind === 'identity') return
	const saved = record(readPrivateJson(resolve(PRIVATE_DIR, 'target.json')))
	if (
		saved.origin !== binding.origin ||
		saved.apiBuildSha !== binding.apiBuildSha ||
		saved.persistenceFingerprint !== binding.persistenceFingerprint
	)
		throw new Error('E2E prelaunch target has changed since fixture readiness')
}

async function lockFixture(client: Client, fixture: OwnedFixture): Promise<void> {
	const result = await client.query<{ id: string }>(
		`select id from students where id = $1::uuid and display_name = $2 and import_key is null for update`,
		[fixture.id, fixture.name]
	)
	if (result.rows.length !== 1) throw new Error('Fixture ownership differs from persistence')
}

async function insertFixture(client: Client, insert: Insert): Promise<Record<string, unknown>[]> {
	const fixture = ownedFixtures().find((item) => item.id === insert.studentId)
	if (!fixture) throw new Error('Fixture write is outside the ownership ledger')
	await lockFixture(client, fixture)
	return (await client.query<Record<string, unknown>>(insert.statement)).rows
}

function lessonInsert(query: string): Insert | null {
	const match = query.match(
		/^insert into lessons \(student_id, starts_at, duration_minutes, time_zone\)\s+values \('([0-9a-f-]{36})'::uuid, '([0-9T:.+Z-]+)'::timestamptz, (\d+), '([A-Za-z0-9_+./-]+)'\) returning id$/i
	)
	if (!match) return null
	const studentId = uuid(match[1])
	return {
		studentId,
		statement: {
			text: `insert into lessons (student_id, starts_at, duration_minutes, time_zone)
values ($1::uuid, $2::timestamptz, $3, $4) returning id`,
			values: [studentId, text(match[2]), Number(match[3]), text(match[4])],
		},
	}
}

function seriesInsert(query: string): Insert | null {
	const match = query.match(
		/^insert into lesson_series \(student_id, weekday, start_time, duration_minutes, starts_on, time_zone\)\s+values \('([0-9a-f-]{36})'::uuid, ([1-7]), '(\d{2}:\d{2})', 60, '(\d{4}-\d{2}-\d{2})', '([A-Za-z0-9_+./-]+)'\) returning id$/i
	)
	if (!match) return null
	const studentId = uuid(match[1])
	return {
		studentId,
		statement: {
			text: `insert into lesson_series (student_id, weekday, start_time, duration_minutes, starts_on, time_zone)
values ($1::uuid, $2, $3, 60, $4, $5) returning id`,
			values: [studentId, Number(match[2]), text(match[3]), text(match[4]), text(match[5])],
		},
	}
}

function exceptionInsert(query: string): Insert | null {
	const match = query.match(
		/^insert into lesson_exceptions \(series_id, original_on, kind, starts_at, duration_minutes\)\s+select id, '(\d{4}-\d{2}-\d{2})', 'moved', '([0-9T:.+Z-]+)', 60 from lesson_series\s+where id = '([0-9a-f-]{36})'::uuid and student_id = '([0-9a-f-]{36})'::uuid$/i
	)
	if (!match) return null
	const studentId = uuid(match[4])
	return {
		studentId,
		statement: {
			text: `insert into lesson_exceptions (series_id, original_on, kind, starts_at, duration_minutes)
select id, $1::date, 'moved', $2::timestamptz, 60 from lesson_series where id = $3::uuid and student_id = $4::uuid`,
			values: [text(match[1]), text(match[2]), uuid(match[3]), studentId],
		},
	}
}

async function cleanup(client: Client): Promise<[]> {
	const fixtures = ownedFixtures()
	for (const fixture of fixtures) await lockFixture(client, fixture)
	const ids = fixtures.map((fixture) => fixture.id)
	await client.query<never>(
		`delete from lesson_marks where lesson_id in (select id from lessons where student_id = any($1::uuid[]))
or series_id in (select id from lesson_series where student_id = any($1::uuid[]))`,
		[ids]
	)
	await client.query<never>(
		`delete from lesson_exceptions where series_id in (select id from lesson_series where student_id = any($1::uuid[]))`,
		[ids]
	)
	for (const table of ['lessons', 'lesson_series', 'payments'])
		await client.query<never>(`delete from ${table} where student_id = any($1::uuid[])`, [ids])
	await client.query<never>(`delete from students where id = any($1::uuid[])`, [ids])
	return []
}

async function execute(client: Client, operation: FixtureOperation): Promise<Record<string, unknown>[]> {
	if (operation.kind === 'cleanup') return cleanup(client)
	const query = operation.query
	if (/^select\b/i.test(query) && !/;|--|\/\*/.test(query)) {
		await client.query<never>('set transaction read only')
		return (await client.query<Record<string, unknown>>(query)).rows
	}
	const insert = lessonInsert(query) ?? seriesInsert(query) ?? exceptionInsert(query)
	if (!insert) throw new Error('SQL write is outside the supported E2E fixture operations')
	return insertFixture(client, insert)
}

async function run(): Promise<void> {
	if (FIXTURE_DATABASE !== 'prelaunch') throw new Error('E2E prelaunch mode is required')
	const binding = targetBinding()
	const operation = request()
	requireBoundTarget(binding, operation)
	await verifyTargetHealth(binding)
	const client = new Client({ connectionString: connectionString(), connectionTimeoutMillis: 5000 })
	client.on('error', () => {
		process.exitCode = 1
	})
	try {
		await client.connect()
		const role = await client.query<{ role: string }>('select current_user as role')
		if (role.rows[0]?.role !== 'dvlab_migrator') throw new Error('E2E database role mismatch')
		const identity = await client.query<Record<string, unknown>>(DATABASE_IDENTITY_SQL)
		if (identity.rows.length !== 1 || /_(dev|test)$/.test(text(identity.rows[0]?.database)))
			throw new Error('E2E prelaunch persistence is invalid')
		const fingerprint = createHash('sha256').update(JSON.stringify(identity.rows[0])).digest('hex')
		if (fingerprint !== binding.persistenceFingerprint) throw new Error('E2E persistence identity mismatch')
		await client.query<never>('begin')
		await client.query<never>("set local statement_timeout = '10s'")
		await client.query<never>("set local lock_timeout = '5s'")
		const rows =
			operation.kind === 'identity' ? [{ persistenceFingerprint: fingerprint }] : await execute(client, operation)
		await client.query<never>('commit')
		process.stdout.write(JSON.stringify({ rows }))
	} finally {
		await client.end().catch(() => {})
	}
}

await run().catch(() => {
	process.stderr.write('E2E prelaunch SQL refused; target and database details suppressed\n')
	process.exitCode = 1
})
