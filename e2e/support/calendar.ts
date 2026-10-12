import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { confirmTargetDatabase, HTTPS_TARGET, prepareState, PRIVATE_DIR } from './data.ts'
import { targetBinding, verifyTargetHealth } from './target.ts'

let readiness: Promise<void> | undefined

export default function ensureCalendarTarget(): Promise<void> {
	if (!HTTPS_TARGET) return Promise.resolve()
	readiness ??= verifyTarget()
	return readiness
}

async function verifyTarget(): Promise<void> {
	const binding = targetBinding()
	await verifyTargetHealth(binding)
	confirmTargetDatabase(binding)
	prepareState()
	writeFileSync(
		resolve(PRIVATE_DIR, `readiness-${process.pid}.json`),
		JSON.stringify({ ...binding, status: 'passed', checkedAt: new Date().toISOString() }),
		{ mode: 0o600, flag: 'wx' }
	)
}
