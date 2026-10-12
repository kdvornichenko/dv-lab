import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import { parseEnv } from 'node:util'

import { ROOT } from '../../scripts/dev-checks/paths.mjs'
import { integer, list, record, text, uuid } from './input.ts'
import {
	DATABASE_IDENTITY_SQL,
	ENV_FILE,
	FIXTURE_DATABASE,
	HTTPS_TARGET,
	PRIVATE_DIR,
	prelaunchTeacherEnvironment,
} from './target.ts'
import type { TargetBinding } from './target.ts'

export { BASE, FIXTURE_DATABASE, HTTPS_TARGET, PRIVATE_DIR } from './target.ts'
export const RESULTS_DIR = resolve(PRIVATE_DIR, 'results', randomUUID())
export const AUTH_FILE = resolve(PRIVATE_DIR, 'auth.json')
const SETTINGS_FILE = resolve(PRIVATE_DIR, 'settings.json')
const OWNED_FILE = resolve(PRIVATE_DIR, 'owned.json')
const TARGET_FILE = resolve(PRIVATE_DIR, 'target.json')
let targetDatabaseReady = false

function requireTargetDatabase(): void {
	if (HTTPS_TARGET && !targetDatabaseReady) throw new Error('E2E HTTPS target has not passed fixture readiness')
}

export function confirmTargetDatabase(binding: TargetBinding): void {
	const expected = binding.persistenceFingerprint
	const rows = runSql(`begin read only; ${DATABASE_IDENTITY_SQL};`, 'identity')
	if (rows.length !== 1) throw new Error('E2E target persistence identity mismatch')
	const actual =
		FIXTURE_DATABASE === 'prelaunch'
			? text(rows[0]?.persistenceFingerprint)
			: createHash('sha256').update(JSON.stringify(rows[0])).digest('hex')
	if (actual !== expected) throw new Error('E2E target persistence identity mismatch')
	const saved = readPrivate(TARGET_FILE)
	if (saved !== null && text(record(saved).persistenceFingerprint) !== expected)
		throw new Error('E2E fixture state belongs to a different persistence target')
	writePrivate(TARGET_FILE, binding)
	targetDatabaseReady = true
}
export const NAMES = [
	'Alex Example 2182',
	'Alex Example 2183',
	'Alex Example 2184',
	'Alex Example 2185',
	'Alex Example 2186',
	'Alex Example 2187',
	'Alex Example 2188',
	'Alex Example 2189',
] as const
export type FixtureName = (typeof NAMES)[number]
type FixtureLifecycle = 'disposable' | 'retained'
type Owned = { name: FixtureName; id: string | null; lifecycle: FixtureLifecycle }
type SettingsSnapshot = {
	accountId: string
	paysSoonLessons: number | null
	defaultTimeZone: string | null
	updatedAt: string | null
}

export function prepareState(): void {
	process.umask(0o077)
	const path = resolve(PRIVATE_DIR)
	const within = relative(realpathSync(ROOT), path)
	if (within === '' || (!within.startsWith('..') && !isAbsolute(within)))
		throw new Error('E2E artifacts must be outside the repository')
	if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new Error('E2E state directory must not be a symlink')
	mkdirSync(path, { recursive: true, mode: 0o700 })
	if (realpathSync(path) !== path) throw new Error('E2E state path must be canonical')
	chmodSync(path, 0o700)
}

function writePrivate(path: string, value: object | null): void {
	prepareState()
	if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new Error('E2E state file must not be a symlink')
	writeFileSync(path, JSON.stringify(value), { mode: 0o600 })
	chmodSync(path, 0o600)
}

function readPrivate(path: string): unknown {
	if (!existsSync(path)) return null
	if (lstatSync(path).isSymbolicLink()) throw new Error('E2E state file must not be a symlink')
	const value: unknown = JSON.parse(readFileSync(path, 'utf8'))
	return value
}

export function teacherCredentials(): { login: string; password: string } {
	requireTargetDatabase()
	const env =
		FIXTURE_DATABASE === 'prelaunch'
			? prelaunchTeacherEnvironment()
			: parseEnv(readFileSync(resolve(ROOT, FIXTURE_DATABASE === 'dev' ? ENV_FILE : '.env'), 'utf8'))
	const login = env.DEV_TEACHER_LOGIN
	const password = env.DEV_TEACHER_PASSWORD
	if (!login) throw new Error('Set DEV_TEACHER_LOGIN')
	if (!password) throw new Error('Set DEV_TEACHER_PASSWORD')
	return { login, password }
}

export function quote(value: string): string {
	return `'${value.replaceAll("'", "''")}'`
}

export function sql(query: string): Record<string, unknown>[] {
	requireTargetDatabase()
	return runSql(query)
}

function runSql(query: string, operation: 'identity' | 'cleanup' | 'query' = 'query'): Record<string, unknown>[] {
	const guard = `do $$ begin
if current_user <> 'dvlab_migrator' or current_database() !~ '_${FIXTURE_DATABASE}$' then
raise exception 'E2E database guard refused'; end if; end $$;`
	const prelaunch = FIXTURE_DATABASE === 'prelaunch'
	const result = spawnSync(
		process.execPath,
		prelaunch
			? [`${ROOT}/e2e/support/prelaunch-sql.ts`]
			: [`${ROOT}/scripts/dev-checks/sql.mjs`, resolve(ROOT, ENV_FILE), 'migrator', `${guard} ${query}`],
		{
			cwd: ROOT,
			encoding: 'utf8',
			timeout: prelaunch ? 45000 : 20000,
			input: prelaunch ? JSON.stringify({ kind: operation, ...(operation === 'query' ? { query } : {}) }) : undefined,
		}
	)
	if (result.status !== 0 || result.error)
		throw new Error(
			prelaunch
				? 'Prelaunch SQL failed; inspect owned state before retrying an uncertain write'
				: 'E2E SQL failed; database details suppressed'
		)
	const last = result.stdout.trim().split('\n').at(-1)
	if (!last) throw new Error('E2E SQL returned no result')
	try {
		const value: unknown = JSON.parse(last)
		const output = record(value)
		if (output.error) throw new Error('SQL error')
		return list(output.rows).map(record)
	} catch {
		throw new Error('E2E SQL refused; database details suppressed')
	}
}

function fixtureName(value: unknown): FixtureName {
	const name = text(value)
	if (!NAMES.includes(name as FixtureName)) throw new Error('Fixture is outside the owned set')
	return name as FixtureName
}

export function fixtureOwnership(): Owned[] {
	const value = readPrivate(OWNED_FILE)
	if (value === null) return []
	return list(value).map((entry) => {
		const row = record(entry)
		const lifecycle = row.lifecycle === undefined ? 'disposable' : text(row.lifecycle)
		if (lifecycle !== 'disposable' && lifecycle !== 'retained') throw new Error('Invalid fixture lifecycle')
		const id = row.id === null ? null : uuid(row.id)
		if (lifecycle === 'retained' && id === null) throw new Error('Retained fixture identity is missing')
		return { name: fixtureName(row.name), id, lifecycle }
	})
}

export function reserveFixture(name: FixtureName): void {
	fixtureName(name)
	const rows = sql(`select count(*)::int as n from students where display_name = ${quote(name)}`)
	if (integer(rows[0]?.n) !== 0) throw new Error('Fixture name is occupied; unrelated cards are preserved')
	writePrivate(OWNED_FILE, [...fixtureOwnership(), { name, id: null, lifecycle: 'disposable' }])
}

export function registerFixture(name: FixtureName, id: string, lifecycle: FixtureLifecycle = 'disposable'): void {
	fixtureName(name)
	if (lifecycle !== 'disposable' && lifecycle !== 'retained') throw new Error('Invalid fixture lifecycle')
	const identity = uuid(id)
	const entries = fixtureOwnership()
	const previous = entries.find((entry) => entry.name === name)
	if (!previous || (previous.id !== null && previous.id !== identity))
		throw new Error('Fixture registration does not match the reserved identity')
	const retained = previous.lifecycle === 'retained' ? 'retained' : lifecycle
	writePrivate(
		OWNED_FILE,
		entries.map((entry) => (entry.name === name ? { name, id: identity, lifecycle: retained } : entry))
	)
}

function ownedWhere(entries: Owned[]): string {
	return entries
		.map((entry) => {
			const id = entry.id === null ? '' : ` and id = ${quote(entry.id)}::uuid`
			return `(display_name = ${quote(entry.name)} and import_key is null${id})`
		})
		.join(' or ')
}

export function cleanupFixtures(): number {
	const registry = fixtureOwnership()
	const entries = registry.filter((entry) => entry.lifecycle === 'disposable')
	if (entries.length === 0) return 0
	if (FIXTURE_DATABASE === 'prelaunch' && entries.some((entry) => entry.id === null))
		throw new Error('Prelaunch cleanup requires registered fixture IDs; recover pending ownership first')
	const selection = `select id from students where ${ownedWhere(entries)}`
	const rows = sql(`select count(*)::int as n from students where id in (${selection})`)
	const count = integer(rows[0]?.n)
	runSql(
		`begin; delete from lesson_marks where lesson_id in (select id from lessons where student_id in (${selection}))
or series_id in (select id from lesson_series where student_id in (${selection}));
delete from lesson_exceptions where series_id in (select id from lesson_series where student_id in (${selection}));
delete from lessons where student_id in (${selection});
delete from lesson_series where student_id in (${selection});
delete from payments where student_id in (${selection});
delete from students where id in (${selection}); commit`,
		'cleanup'
	)
	if (integer(sql(`select count(*)::int as n from students where id in (${selection})`)[0]?.n) !== 0)
		throw new Error('Owned fixture cleanup is incomplete')
	writePrivate(
		OWNED_FILE,
		registry.filter((entry) => entry.lifecycle === 'retained')
	)
	return count
}

function savedSettings(): SettingsSnapshot | null {
	const value = readPrivate(SETTINGS_FILE)
	if (value === null) return null
	const row = record(value)
	return {
		accountId: uuid(row.accountId),
		paysSoonLessons: row.paysSoonLessons === null ? null : integer(row.paysSoonLessons),
		defaultTimeZone: row.defaultTimeZone === null ? null : text(row.defaultTimeZone),
		updatedAt: row.updatedAt === null ? null : text(row.updatedAt),
	}
}

export function restoreTeacherSettings(accountId: string, keep = false): void {
	const saved = savedSettings()
	if (!saved) return
	if (saved.accountId !== uuid(accountId)) throw new Error('Settings recovery belongs to another teacher')
	if (FIXTURE_DATABASE === 'prelaunch') {
		if (JSON.stringify(readTeacherSettings(accountId)) !== JSON.stringify(saved))
			throw new Error('Teacher settings writes are outside prelaunch synthetic fixture authority')
		if (!keep) writePrivate(SETTINGS_FILE, null)
		return
	}
	const id = quote(saved.accountId)
	if (saved.paysSoonLessons === null) sql(`delete from teacher_settings where account_id = ${id}::uuid`)
	else
		sql(`insert into teacher_settings (account_id, pays_soon_lessons, default_time_zone, updated_at)
values (${id}::uuid, ${saved.paysSoonLessons}, ${quote(text(saved.defaultTimeZone))}, ${quote(text(saved.updatedAt))}::timestamptz)
on conflict (account_id) do update set pays_soon_lessons = excluded.pays_soon_lessons,
default_time_zone = excluded.default_time_zone, updated_at = excluded.updated_at`)
	const current = readTeacherSettings(accountId)
	if (JSON.stringify(current) !== JSON.stringify(saved))
		throw new Error('Settings restoration differs from the saved row')
	if (!keep) writePrivate(SETTINGS_FILE, null)
}

function readTeacherSettings(accountId: string): SettingsSnapshot {
	const rows = sql(
		`select pays_soon_lessons, default_time_zone, updated_at::text as updated_at from teacher_settings where account_id = ${quote(uuid(accountId))}::uuid`
	)
	const row = rows[0]
	return {
		accountId,
		paysSoonLessons: row ? integer(row.pays_soon_lessons) : null,
		defaultTimeZone: row ? text(row.default_time_zone) : null,
		updatedAt: row ? text(row.updated_at) : null,
	}
}

export function saveTeacherSettings(accountId: string): void {
	const saved = savedSettings()
	if (saved) {
		if (saved.accountId !== uuid(accountId)) throw new Error('Settings recovery belongs to another teacher')
		return
	}
	writePrivate(SETTINGS_FILE, readTeacherSettings(accountId))
}

export function settingsRecoveryState(): 'missing' | 'pending' | 'restored' {
	if (!existsSync(SETTINGS_FILE)) return 'missing'
	return savedSettings() === null ? 'restored' : 'pending'
}

export function saveAuth(value: object): void {
	writePrivate(AUTH_FILE, value)
}

export function scrubAuth(): void {
	writePrivate(AUTH_FILE, { cookies: [], origins: [] })
}

export function ownedStudent(id: string): string {
	const identity = uuid(id)
	const found = fixtureOwnership().find((entry) => entry.id === identity)
	if (!found) throw new Error('SQL fixture write is outside the ownership ledger')
	return identity
}

export function retainedStudent(id: string): string {
	const identity = uuid(id)
	const found = fixtureOwnership().find((entry) => entry.id === identity && entry.lifecycle === 'retained')
	if (!found) throw new Error('Provider fixture must be retained before setup or command writes')
	return identity
}
