import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import { parseEnv } from 'node:util'

import { ROOT, STATE_DIR } from '../../scripts/dev-checks/paths.mjs'
import { integer, list, record, text, uuid } from './input.ts'

export const BASE = 'http://localhost:3000'
export const PRIVATE_DIR = resolve(realpathSync(STATE_DIR), 'phase21-e2e')
export const RESULTS_DIR = resolve(PRIVATE_DIR, 'results', randomUUID())
export const AUTH_FILE = resolve(PRIVATE_DIR, 'auth.json')
const SETTINGS_FILE = resolve(PRIVATE_DIR, 'settings.json')
const OWNED_FILE = resolve(PRIVATE_DIR, 'owned.json')
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
type Owned = { name: FixtureName; id: string | null }
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
	const env = parseEnv(readFileSync(resolve(ROOT, '.env'), 'utf8'))
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
	const guard = `do $$ begin
if current_user <> 'dvlab_migrator' or current_database() !~ '_dev$' then
raise exception 'E2E database guard refused'; end if; end $$;`
	const result = spawnSync(
		process.execPath,
		[`${ROOT}/scripts/dev-checks/sql.mjs`, `${ROOT}/.env`, 'migrator', `${guard} ${query}`],
		{ cwd: ROOT, encoding: 'utf8', timeout: 20000 }
	)
	if (result.status !== 0 || result.error) throw new Error('E2E SQL failed; database details suppressed')
	const last = result.stdout.trim().split('\n').at(-1)
	if (!last) throw new Error('E2E SQL returned no result')
	const value: unknown = JSON.parse(last)
	const output = record(value)
	if (output.error) throw new Error('E2E SQL refused; database details suppressed')
	return list(output.rows).map(record)
}

function fixtureName(value: unknown): FixtureName {
	const name = text(value)
	if (!NAMES.includes(name as FixtureName)) throw new Error('Fixture is outside the owned set')
	return name as FixtureName
}

function owned(): Owned[] {
	const value = readPrivate(OWNED_FILE)
	if (value === null) return []
	return list(value).map((entry) => {
		const row = record(entry)
		return { name: fixtureName(row.name), id: row.id === null ? null : uuid(row.id) }
	})
}

export function reserveFixture(name: FixtureName): void {
	fixtureName(name)
	const rows = sql(`select count(*)::int as n from students where display_name = ${quote(name)}`)
	if (integer(rows[0]?.n) !== 0) throw new Error('Fixture name is occupied; unrelated cards are preserved')
	writePrivate(OWNED_FILE, [...owned(), { name, id: null }])
}

export function registerFixture(name: FixtureName, id: string): void {
	writePrivate(
		OWNED_FILE,
		owned().map((entry) => (entry.name === name ? { name, id: uuid(id) } : entry))
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
	const entries = owned()
	if (entries.length === 0) return 0
	const selection = `select id from students where ${ownedWhere(entries)}`
	const rows = sql(`select count(*)::int as n from students where id in (${selection})`)
	const count = integer(rows[0]?.n)
	sql(`begin; delete from lesson_marks where lesson_id in (select id from lessons where student_id in (${selection}))
or series_id in (select id from lesson_series where student_id in (${selection}));
delete from lesson_exceptions where series_id in (select id from lesson_series where student_id in (${selection}));
delete from lessons where student_id in (${selection});
delete from lesson_series where student_id in (${selection});
delete from payments where student_id in (${selection});
delete from students where id in (${selection}); commit`)
	if (integer(sql(`select count(*)::int as n from students where id in (${selection})`)[0]?.n) !== 0)
		throw new Error('Owned fixture cleanup is incomplete')
	writePrivate(OWNED_FILE, [])
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
	const found = owned().find((entry) => entry.id === uuid(id))
	if (!found) throw new Error('SQL fixture write is outside the ownership ledger')
	return uuid(id)
}
