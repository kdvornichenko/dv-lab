import { createHash } from 'node:crypto'
import { constants, closeSync, fstatSync, openSync, readFileSync, realpathSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import { parseEnv } from 'node:util'

import { ROOT, STATE_DIR } from '../../scripts/dev-checks/paths.mjs'
import { record, text } from './input.ts'

export const PRELAUNCH_SCOPE = 'prelaunch-main-synthetic-fixtures-test-google-primary'
export const FIXTURE_DATABASE = fixtureDatabase()
export const ENV_FILE = FIXTURE_DATABASE === 'test' ? '.env.test' : '.env'
export const BASE = targetOrigin()
export const HTTPS_TARGET = BASE !== 'http://localhost:3000'
export const PRIVATE_DIR = resolve(
	realpathSync(STATE_DIR),
	`${HTTPS_TARGET ? `calendar-e2e-${createHash('sha256').update(BASE).digest('hex').slice(0, 16)}` : 'phase21-e2e'}${FIXTURE_DATABASE === 'dev' ? '' : `-${FIXTURE_DATABASE}`}`
)
export const DATABASE_IDENTITY_SQL = `select current_database() as database,
inet_server_addr()::text as address, inet_server_port() as port,
(select oid::text from pg_database where datname = current_database()) as oid`

export type TargetBinding = {
	origin: string
	apiBuildSha: string
	persistenceFingerprint: string
	authorizationScope: typeof PRELAUNCH_SCOPE | null
}

function fixtureDatabase(): 'dev' | 'test' | 'prelaunch' {
	const value = process.env.E2E_FIXTURE_DATABASE ?? 'dev'
	if (value !== 'dev' && value !== 'test' && value !== 'prelaunch')
		throw new Error('E2E fixture database must be dev, test or prelaunch')
	return value
}

function targetOrigin(): string {
	const value = process.env.E2E_TARGET_ORIGIN ?? 'http://localhost:3000'
	let url: URL
	try {
		url = new URL(value)
	} catch {
		throw new Error('E2E target must be an HTTPS origin or the default local origin')
	}
	if (url.origin !== value || (value !== 'http://localhost:3000' && url.protocol !== 'https:'))
		throw new Error('E2E target must be an HTTPS origin without credentials, path, query or fragment')
	if (FIXTURE_DATABASE === 'prelaunch' && value !== 'https://dv-lab.dev')
		throw new Error('Prelaunch fixtures require the authorized HTTPS origin')
	return value
}

function readPrivateText(file: string): string {
	let descriptor: number | undefined
	try {
		const path = resolve(file)
		if (realpathSync(path) !== path) throw new Error('Noncanonical private file')
		const within = relative(realpathSync(ROOT), path)
		if (within === '' || (within !== '..' && !within.startsWith('../') && !isAbsolute(within)))
			throw new Error('Private file is inside the repository')
		descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW)
		const stat = fstatSync(descriptor)
		if (!stat.isFile() || (stat.mode & 0o777) !== 0o600) throw new Error('Invalid private file')
		return readFileSync(descriptor, 'utf8')
	} catch {
		throw new Error('E2E requires a canonical private 0600 file outside the repository')
	} finally {
		if (descriptor !== undefined) closeSync(descriptor)
	}
}

export function readPrivateJson(file: string): unknown {
	try {
		return JSON.parse(readPrivateText(file)) as unknown
	} catch {
		throw new Error('E2E requires a canonical private 0600 JSON file outside the repository')
	}
}

export function prelaunchTeacherEnvironment(): Record<string, string | undefined> {
	const file = process.env.E2E_PRELAUNCH_ENV_FILE
	if (FIXTURE_DATABASE !== 'prelaunch' || !file || !isAbsolute(file) || resolve(file) !== file)
		throw new Error('Prelaunch requires an absolute canonical E2E_PRELAUNCH_ENV_FILE')
	const env = parseEnv(readPrivateText(file))
	if ('DATABASE_URL' in env || 'MIGRATOR_DATABASE_URL' in env)
		throw new Error('Prelaunch teacher credentials must not contain database connection strings')
	return { DEV_TEACHER_LOGIN: env.DEV_TEACHER_LOGIN, DEV_TEACHER_PASSWORD: env.DEV_TEACHER_PASSWORD }
}

export function targetBinding(): TargetBinding {
	const file = process.env.E2E_TARGET_ATTESTATION
	if (!file) throw new Error('E2E HTTPS requires an operator-provided E2E_TARGET_ATTESTATION before fixtures')
	const binding = record(readPrivateJson(file))
	const origin = text(binding.origin)
	const apiBuildSha = text(binding.apiBuildSha)
	const persistenceFingerprint = text(binding.persistenceFingerprint)
	if (origin !== BASE || binding.fixtureWritesAuthorized !== true)
		throw new Error('E2E fixture authority does not match the HTTPS target')
	if (!/^[0-9a-f]{40}$/.test(apiBuildSha) || !/^[0-9a-f]{64}$/.test(persistenceFingerprint))
		throw new Error('E2E target attestation needs an exact API build and persistence fingerprint')
	const authorizationScope = binding.authorizationScope === PRELAUNCH_SCOPE ? PRELAUNCH_SCOPE : null
	if (FIXTURE_DATABASE === 'prelaunch' && authorizationScope === null)
		throw new Error('Prelaunch fixtures require explicit main database and TEST Google PRIMARY authority')
	return { origin, apiBuildSha, persistenceFingerprint, authorizationScope }
}

export async function verifyTargetHealth(binding: TargetBinding): Promise<void> {
	let health: Record<string, unknown>
	try {
		const response = await fetch(`${binding.origin}/api/healthz`, {
			redirect: 'error',
			cache: 'no-store',
			signal: AbortSignal.timeout(10000),
		})
		if (!response.ok) throw new Error('Unhealthy target')
		const value: unknown = await response.json()
		health = record(value)
	} catch {
		throw new Error('E2E HTTPS health check failed; target details suppressed')
	}
	if (health.status !== 'ok' || health.db !== 'ok' || health.sha !== binding.apiBuildSha)
		throw new Error('E2E target API build or readiness mismatch')
}
