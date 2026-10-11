import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { z } from 'zod'

import { ROOT } from '../../scripts/dev-checks/paths.mjs'
import {
	calendarFaultIdentity,
	faultManifest,
	faultObservation,
	faultRule,
	readFaultJson,
	type CalendarFaultOperation,
	type CalendarFaultRule,
} from './calendar-fault-protocol.ts'
import { executeCalendarFault } from './calendar-fault-ssh.ts'
import { FIXTURE_DATABASE, HTTPS_TARGET, PRIVATE_DIR, targetBinding } from './target.ts'

export type { CalendarFaultRule, CalendarFaultManifest } from './calendar-fault-protocol.ts'

function localOperation(operation: CalendarFaultOperation) {
	const file = process.env.E2E_CALENDAR_FAULTS
	if (!HTTPS_TARGET || !file || file !== resolve(PRIVATE_DIR, 'calendar-faults.json'))
		throw new Error('Local calendar faults require the owned HTTPS private control')
	const manifest = faultManifest.parse(readFaultJson(file, ROOT))
	const binding = targetBinding()
	if (
		manifest.runtimeRoot !== ROOT ||
		manifest.origin !== binding.origin ||
		manifest.apiBuildSha !== binding.apiBuildSha ||
		manifest.persistenceFingerprint !== binding.persistenceFingerprint
	)
		throw new Error('Local calendar fault target mismatch')
	const result = spawnSync('node', [resolve(ROOT, 'apps/api/dist/calendar-fault-operator.mjs')], {
		input: JSON.stringify({
			runId: manifest.runId,
			identitySha256: calendarFaultIdentity(manifest),
			binding,
			operation,
		}),
		encoding: 'utf8',
		timeout: 30000,
		maxBuffer: 1048576,
	})
	if (result.status !== 0 || result.error)
		throw new Error('Local calendar fault outcome uncertain; inspect owned state before retrying')
	const input: unknown = JSON.parse(result.stdout)
	return z
		.strictObject({
			schema: z.literal('dv-lab-calendar-fault-result-v1'),
			runId: z.literal(manifest.runId),
			identitySha256: z.literal(calendarFaultIdentity(manifest)),
			ruleId: z.uuid().nullable(),
			observations: z.array(faultObservation).max(1000),
		})
		.parse(input)
}

function execute(operation: CalendarFaultOperation) {
	return FIXTURE_DATABASE === 'prelaunch' ? executeCalendarFault(operation) : localOperation(operation)
}

export function armCalendarFault(input: Omit<CalendarFaultRule, 'id'>): string {
	const rule = faultRule.parse({ ...input, id: randomUUID() })
	const result = execute({ action: 'arm', rule })
	if (result.ruleId !== rule.id) throw new Error('Calendar fault arm result mismatch')
	return rule.id
}

export function disarmCalendarFault(ruleId: string): void {
	const result = execute({ action: 'disarm', ruleId })
	if (result.ruleId !== null) throw new Error('Calendar fault disarm result mismatch')
}

export function calendarFaultEvidence(ruleId: string) {
	return execute({ action: 'evidence', ruleId }).observations
}
