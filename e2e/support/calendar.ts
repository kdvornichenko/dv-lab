import { lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'

import { ROOT } from '../../scripts/dev-checks/paths.mjs'
import { BASE, confirmTargetDatabase, HTTPS_TARGET, prepareState, PRIVATE_DIR } from './data.ts'
import { record, text } from './input.ts'

type TargetBinding = { origin: string; apiBuildSha: string; persistenceFingerprint: string }
let readiness: Promise<void> | undefined

export default function ensureCalendarTarget(): Promise<void> {
	if (!HTTPS_TARGET) return Promise.resolve()
	readiness ??= verifyTarget()
	return readiness
}

function targetBinding(): TargetBinding {
	const file = process.env.E2E_TARGET_ATTESTATION
	if (!file) throw new Error('E2E HTTPS requires an operator-provided E2E_TARGET_ATTESTATION before fixtures')
	let value: unknown
	try {
		const path = realpathSync(file)
		const within = relative(realpathSync(ROOT), path)
		const stat = lstatSync(file)
		if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) throw new Error('Invalid private file')
		if (within === '' || (within !== '..' && !within.startsWith('../') && !isAbsolute(within)))
			throw new Error('Attestation must be outside the repository')
		value = JSON.parse(readFileSync(path, 'utf8')) as unknown
	} catch {
		throw new Error('E2E target attestation must be a private JSON file outside the repository')
	}
	const binding = record(value)
	const origin = text(binding.origin)
	const apiBuildSha = text(binding.apiBuildSha)
	const persistenceFingerprint = text(binding.persistenceFingerprint)
	if (origin !== BASE || binding.fixtureWritesAuthorized !== true)
		throw new Error('E2E fixture authority does not match the HTTPS target')
	if (!/^[0-9a-f]{40}$/.test(apiBuildSha) || !/^[0-9a-f]{64}$/.test(persistenceFingerprint))
		throw new Error('E2E target attestation needs an exact API build and persistence fingerprint')
	return { origin, apiBuildSha, persistenceFingerprint }
}

async function verifyTarget(): Promise<void> {
	const binding = targetBinding()
	const health = await readHealth()
	if (health.status !== 'ok' || health.db !== 'ok' || health.sha !== binding.apiBuildSha)
		throw new Error('E2E target API build or readiness mismatch')
	confirmTargetDatabase(binding.persistenceFingerprint)
	prepareState()
	writeFileSync(
		resolve(PRIVATE_DIR, `readiness-${process.pid}.json`),
		JSON.stringify({ ...binding, status: 'passed', checkedAt: new Date().toISOString() }),
		{ mode: 0o600, flag: 'wx' }
	)
}

async function readHealth(): Promise<Record<string, unknown>> {
	try {
		const response = await fetch(`${BASE}/api/healthz`, {
			redirect: 'error',
			signal: AbortSignal.timeout(10000),
		})
		if (!response.ok) throw new Error('Unhealthy target')
		const value: unknown = await response.json()
		return record(value)
	} catch {
		throw new Error('E2E HTTPS health check failed; target details suppressed')
	}
}
