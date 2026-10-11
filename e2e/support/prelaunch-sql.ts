import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { NAMES } from './data.ts'
import { list, record, text, uuid } from './input.ts'
import { executePrelaunch, INSERTS } from './prelaunch-transport.ts'
import type { InsertOperation, OwnedFixture } from './prelaunch-transport.ts'
import { FIXTURE_DATABASE, PRIVATE_DIR, readPrivateJson, targetBinding, verifyTargetHealth } from './target.ts'
import type { TargetBinding } from './target.ts'

type FixtureOperation = { kind: 'cleanup' } | { kind: 'query'; query: string }
type Request = { kind: 'identity' } | FixtureOperation

function request(): Request {
	const value: unknown = JSON.parse(readFileSync(0, 'utf8'))
	const input = record(value)
	if (input.kind === 'identity' || input.kind === 'cleanup') return { kind: input.kind }
	if (input.kind === 'query') return { kind: input.kind, query: text(input.query).trim() }
	throw new Error('Invalid E2E database operation')
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

function lessonInsert(query: string): InsertOperation | null {
	const match = query.match(
		/^insert into lessons \(student_id, starts_at, duration_minutes, time_zone\)\s+values \('([0-9a-f-]{36})'::uuid, '([0-9T:.+Z-]+)'::timestamptz, (\d+), '([A-Za-z0-9_+./-]+)'\) returning id$/i
	)
	if (!match) return null
	const studentId = uuid(match[1])
	return {
		kind: 'lesson',
		studentId,
		statement: {
			text: INSERTS.lesson,
			values: [studentId, text(match[2]), Number(match[3]), text(match[4])],
		},
	}
}

function seriesInsert(query: string): InsertOperation | null {
	const match = query.match(
		/^insert into lesson_series \(student_id, weekday, start_time, duration_minutes, starts_on, time_zone\)\s+values \('([0-9a-f-]{36})'::uuid, ([1-7]), '(\d{2}:\d{2})', 60, '(\d{4}-\d{2}-\d{2})', '([A-Za-z0-9_+./-]+)'\) returning id$/i
	)
	if (!match) return null
	const studentId = uuid(match[1])
	return {
		kind: 'series',
		studentId,
		statement: {
			text: INSERTS.series,
			values: [studentId, Number(match[2]), text(match[3]), text(match[4]), text(match[5])],
		},
	}
}

function exceptionInsert(query: string): InsertOperation | null {
	const match = query.match(
		/^insert into lesson_exceptions \(series_id, original_on, kind, starts_at, duration_minutes\)\s+select id, '(\d{4}-\d{2}-\d{2})', 'moved', '([0-9T:.+Z-]+)', 60 from lesson_series\s+where id = '([0-9a-f-]{36})'::uuid and student_id = '([0-9a-f-]{36})'::uuid$/i
	)
	if (!match) return null
	const studentId = uuid(match[4])
	return {
		kind: 'exception',
		studentId,
		statement: {
			text: INSERTS.exception,
			values: [text(match[1]), text(match[2]), uuid(match[3]), studentId],
		},
	}
}

async function run(): Promise<void> {
	if (FIXTURE_DATABASE !== 'prelaunch') throw new Error('E2E prelaunch mode is required')
	const binding = targetBinding()
	const operation = request()
	requireBoundTarget(binding, operation)
	await verifyTargetHealth(binding)
	if (operation.kind === 'identity') return executePrelaunch(binding, operation, [])
	if (operation.kind === 'cleanup') return executePrelaunch(binding, operation, ownedFixtures())
	const query = operation.query
	if (/^select\b/i.test(query) && !/;|--|\/\*/.test(query))
		return executePrelaunch(binding, { kind: 'read', statement: { text: query, values: [] } }, [])
	const insert = lessonInsert(query) ?? seriesInsert(query) ?? exceptionInsert(query)
	if (!insert) throw new Error('SQL write is outside the supported E2E fixture operations')
	return executePrelaunch(binding, insert, ownedFixtures())
}

await run().catch(() => {
	process.stderr.write('E2E prelaunch SQL refused; target and database details suppressed\n')
	process.exitCode = 1
})
