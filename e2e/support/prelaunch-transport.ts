import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import type { Client } from 'pg'

import { NAMES } from './data.ts'
import { list, record, text } from './input.ts'
import { DATABASE_IDENTITY_SQL, PRELAUNCH_SCOPE, readPrivateJson } from './target.ts'
import type { TargetBinding } from './target.ts'

export const INSERTS = {
	lesson: `insert into lessons (student_id, starts_at, duration_minutes, time_zone)
values ($1::uuid, $2::timestamptz, $3, $4) returning id`,
	series: `insert into lesson_series (student_id, weekday, start_time, duration_minutes, starts_on, time_zone)
values ($1::uuid, $2, $3, 60, $4, $5) returning id`,
	exception: `insert into lesson_exceptions (series_id, original_on, kind, starts_at, duration_minutes)
select id, $1::date, 'moved', $2::timestamptz, 60 from lesson_series where id = $3::uuid and student_id = $4::uuid`,
}

type Statement = { text: string; values: (string | number)[] }
export type OwnedFixture = { id: string; name: string }
export type InsertOperation = { kind: keyof typeof INSERTS; studentId: string; statement: Statement }
type Operation = InsertOperation | { kind: 'identity' } | { kind: 'cleanup' } | { kind: 'read'; statement: Statement }
type Operator = { sshAlias: string; environmentScript: string; apiContainer: string }

function operator(): Operator {
	const file = process.env.E2E_PRELAUNCH_SQL_OPERATOR_FILE
	if (!file || !isAbsolute(file) || resolve(file) !== file)
		throw new Error('Prelaunch requires an absolute canonical E2E_PRELAUNCH_SQL_OPERATOR_FILE')
	const input = record(readPrivateJson(file))
	if (input.schema !== 'dv-lab-prelaunch-sql-ssh-v1') throw new Error('Invalid SSH operator configuration')
	const sshAlias = text(input.sshAlias)
	const apiContainer = text(input.apiContainer)
	const environmentScript = text(input.environmentScript)
	if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(sshAlias) || !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(apiContainer))
		throw new Error('Invalid SSH operator target')
	if (environmentScript.includes('\0')) throw new Error('Invalid SSH environment script')
	return { sshAlias, apiContainer, environmentScript }
}

function quoteShell(value: string): string {
	return `'${value.replaceAll("'", "'\\''")}'`
}

export function executePrelaunch(binding: TargetBinding, operation: Operation, owned: OwnedFixture[]): void {
	const config = operator()
	const program = `import pg from 'pg'; import { readFileSync } from 'node:fs'; import { createHash } from 'node:crypto';\n(${remoteSql.toString()})(pg.Client, ${JSON.stringify(INSERTS)}, ${JSON.stringify(NAMES)}, ${JSON.stringify(DATABASE_IDENTITY_SQL)}, ${JSON.stringify(PRELAUNCH_SCOPE)}).catch(() => { process.stderr.write('Prelaunch SQL refused\\n'); process.exitCode = 1; });`
	const script = `${config.environmentScript}\nexec docker exec -i -e MIGRATOR_DATABASE_URL ${quoteShell(config.apiContainer)} node --input-type=module -e ${quoteShell(program)}`
	const result = spawnSync(
		'ssh',
		[
			'-T',
			'-o',
			'BatchMode=yes',
			'-o',
			'UseKeychain=yes',
			'-o',
			'AddKeysToAgent=no',
			'-o',
			'ConnectTimeout=8',
			'-o',
			'ClearAllForwardings=yes',
			config.sshAlias,
			`sudo -n bash -c ${quoteShell(script)}`,
		],
		{ input: JSON.stringify({ binding, operation, owned }), encoding: 'utf8', timeout: 30000 }
	)
	if (result.status !== 0 || result.error)
		throw new Error('SSH SQL failed; inspect owned state before retrying an uncertain write')
	const response: unknown = JSON.parse(result.stdout)
	const rows = list(record(response).rows).map(record)
	process.stdout.write(JSON.stringify({ rows }))
}

async function remoteSql(
	PgClient: typeof Client,
	inserts: typeof INSERTS,
	names: readonly string[],
	identitySql: string,
	authorizationScope: string
): Promise<void> {
	function object(value: unknown): Record<string, unknown> {
		if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid object')
		return value as Record<string, unknown>
	}

	function string(value: unknown): string {
		if (typeof value !== 'string' || value.length === 0) throw new Error('Invalid string')
		return value
	}

	function uuid(value: unknown): string {
		const id = string(value)
		if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
			throw new Error('Invalid fixture ID')
		return id
	}

	function fixtures(value: unknown): OwnedFixture[] {
		if (!Array.isArray(value)) throw new Error('Invalid ledger')
		const entries: unknown[] = value
		return entries.map((entry) => {
			const fixture = object(entry)
			const name = string(fixture.name)
			if (!names.includes(name)) throw new Error('Invalid fixture name')
			return { id: uuid(fixture.id), name }
		})
	}

	function statement(value: unknown): Statement {
		const input = object(value)
		if (!Array.isArray(input.values)) throw new Error('Invalid SQL values')
		const values: unknown[] = input.values
		return {
			text: string(input.text),
			values: values.map((item) => {
				if (typeof item !== 'string' && (typeof item !== 'number' || !Number.isInteger(item)))
					throw new Error('Invalid SQL value')
				return item
			}),
		}
	}

	function insert(input: Record<string, unknown>): InsertOperation {
		const kind = input.kind
		if (kind !== 'lesson' && kind !== 'series' && kind !== 'exception') throw new Error('Invalid fixture operation')
		const sql = statement(input.statement)
		const studentId = uuid(input.studentId)
		const ownerIndex = kind === 'exception' ? 3 : 0
		const length = kind === 'series' ? 5 : 4
		if (sql.text !== inserts[kind] || sql.values.length !== length || sql.values[ownerIndex] !== studentId)
			throw new Error('SQL write is outside the fixture allowlist')
		return { kind, studentId, statement: sql }
	}

	function operation(value: unknown): Operation {
		const input = object(value)
		if (input.kind === 'identity' || input.kind === 'cleanup') return { kind: input.kind }
		if (input.kind !== 'read') return insert(input)
		const sql = statement(input.statement)
		if (!/^select\b/i.test(sql.text) || /;|--|\/\*/.test(sql.text) || sql.values.length !== 0)
			throw new Error('Invalid read-only query')
		return { kind: 'read', statement: sql }
	}

	function targetFingerprint(value: unknown): string {
		const input = object(value)
		if (
			input.origin !== 'https://dv-lab.dev' ||
			input.origin !== process.env.APP_ORIGIN ||
			input.apiBuildSha !== process.env.GIT_SHA ||
			input.authorizationScope !== authorizationScope
		)
			throw new Error('Remote target differs from the authorized binding')
		const apiBuildSha = string(input.apiBuildSha)
		const persistenceFingerprint = string(input.persistenceFingerprint)
		if (!/^[0-9a-f]{40}$/.test(apiBuildSha) || !/^[0-9a-f]{64}$/.test(persistenceFingerprint))
			throw new Error('Invalid target fingerprint')
		return persistenceFingerprint
	}

	async function identity(client: Client, expectedFingerprint: string): Promise<string> {
		const role = await client.query<{ role: string }>('select current_user as role')
		if (role.rows[0]?.role !== 'dvlab_migrator') throw new Error('E2E database role mismatch')
		const result = await client.query<Record<string, unknown>>(identitySql)
		if (result.rows.length !== 1 || /_(dev|test)$/.test(string(result.rows[0]?.database)))
			throw new Error('E2E prelaunch persistence is invalid')
		const fingerprint = createHash('sha256').update(JSON.stringify(result.rows[0])).digest('hex')
		if (fingerprint !== expectedFingerprint) throw new Error('E2E persistence identity mismatch')
		return fingerprint
	}

	async function lockFixture(client: Client, fixture: OwnedFixture): Promise<void> {
		const result = await client.query<{ id: string }>(
			'select id from students where id = $1::uuid and display_name = $2 and import_key is null for update',
			[fixture.id, fixture.name]
		)
		if (result.rows.length !== 1) throw new Error('Fixture ownership differs from persistence')
	}

	async function cleanup(client: Client, owned: OwnedFixture[]): Promise<[]> {
		for (const fixture of owned) await lockFixture(client, fixture)
		const ids = owned.map((fixture) => fixture.id)
		await client.query<never>(
			`delete from lesson_marks where lesson_id in (select id from lessons where student_id = any($1::uuid[]))
or series_id in (select id from lesson_series where student_id = any($1::uuid[]))`,
			[ids]
		)
		await client.query<never>(
			'delete from lesson_exceptions where series_id in (select id from lesson_series where student_id = any($1::uuid[]))',
			[ids]
		)
		for (const table of ['lessons', 'lesson_series', 'payments'])
			await client.query<never>(`delete from ${table} where student_id = any($1::uuid[])`, [ids])
		await client.query<never>('delete from students where id = any($1::uuid[])', [ids])
		return []
	}

	async function execute(
		client: Client,
		action: Exclude<Operation, { kind: 'identity' }>,
		owned: OwnedFixture[]
	): Promise<Record<string, unknown>[]> {
		if (action.kind === 'cleanup') return cleanup(client, owned)
		if (action.kind === 'read') return (await client.query<Record<string, unknown>>(action.statement)).rows
		const fixture = owned.find((item) => item.id === action.studentId)
		if (!fixture) throw new Error('Fixture write is outside the ownership ledger')
		await lockFixture(client, fixture)
		return (await client.query<Record<string, unknown>>(action.statement)).rows
	}

	const value: unknown = JSON.parse(readFileSync(0, 'utf8'))
	const request = object(value)
	const expectedFingerprint = targetFingerprint(request.binding)
	const action = operation(request.operation)
	const owned = fixtures(request.owned)
	const connectionString = string(process.env.MIGRATOR_DATABASE_URL)
	const url = new URL(connectionString)
	if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.username !== 'dvlab_migrator')
		throw new Error('Invalid E2E database role')
	const client = new PgClient({ connectionString, connectionTimeoutMillis: 5000 })
	client.on('error', () => {
		process.exitCode = 1
	})
	try {
		await client.connect()
		await client.query<never>(action.kind === 'identity' || action.kind === 'read' ? 'begin read only' : 'begin')
		await client.query<never>("set local statement_timeout = '10s'")
		await client.query<never>("set local lock_timeout = '5s'")
		const fingerprint = await identity(client, expectedFingerprint)
		const rows =
			action.kind === 'identity' ? [{ persistenceFingerprint: fingerprint }] : await execute(client, action, owned)
		await client.query<never>('commit')
		process.stdout.write(JSON.stringify({ rows }))
	} catch {
		await client.query<never>('rollback').catch(() => {})
		throw new Error('Prelaunch transaction failed')
	} finally {
		await client.end().catch(() => {})
	}
}
