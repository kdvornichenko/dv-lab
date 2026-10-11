import { createHash, randomUUID } from 'node:crypto'
import {
	closeSync,
	constants,
	fstatSync,
	ftruncateSync,
	openSync,
	readdirSync,
	realpathSync,
	writeFileSync,
	writeSync,
} from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'

import { HTTPS_TARGET, PRIVATE_DIR, readPrivateJson, targetBinding } from './target.ts'

const faultRule = z.strictObject({
	id: z.uuid(),
	method: z.enum(['GET', 'POST', 'PATCH']),
	resource: z.enum(['events', 'event', 'calendarList']),
	page: z.enum(['first', 'next', 'any']),
	action: z.enum(['drop_response', 'delay_response', 'stop_before_request', 'stop_after_response']),
	delayMs: z.number().int().min(0).max(15000),
})

const faultManifest = z.strictObject({
	runId: z.uuid(),
	pid: z.number().int().positive(),
	apiBuildSha: z.string().regex(/^[a-f0-9]{40}$/),
	entrySha256: z.string().regex(/^[a-f0-9]{64}$/),
	origin: z.url(),
	persistenceFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
	calendarFaultsAuthorized: z.literal(true),
	exclusiveSyntheticProcess: z.literal(true),
	expiresAt: z.iso.datetime(),
	rule: faultRule.nullable(),
})

const faultObservation = z.strictObject({
	runId: z.uuid(),
	ruleId: z.uuid(),
	pid: z.number().int().positive(),
	apiBuildSha: z.string(),
	entrySha256: z.string(),
	at: z.iso.datetime(),
	phase: z.enum(['request_matched', 'response_held', 'response_released', 'response_dropped', 'process_stopping']),
	status: z.number().int().nullable(),
})

export type CalendarFaultRule = z.infer<typeof faultRule>
export type CalendarFaultManifest = z.infer<typeof faultManifest>
type ObservationPhase = z.infer<typeof faultObservation>['phase']

function controlPath() {
	const file = process.env.E2E_CALENDAR_FAULTS
	if (!file || file !== resolve(PRIVATE_DIR, 'calendar-faults.json') || realpathSync(file) !== file)
		throw new Error('Calendar faults require the existing canonical private control file')
	return file
}

export function readCalendarFaultControl(): CalendarFaultManifest {
	const parsed = faultManifest.safeParse(readPrivateJson(controlPath()))
	if (!parsed.success || !HTTPS_TARGET) throw new Error('Calendar fault control failed validation')
	const manifest = parsed.data
	const binding = targetBinding()
	if (
		manifest.origin !== binding.origin ||
		manifest.apiBuildSha !== binding.apiBuildSha ||
		manifest.persistenceFingerprint !== binding.persistenceFingerprint ||
		Date.parse(manifest.expiresAt) <= Date.now()
	)
		throw new Error('Calendar fault authority does not match the current target')
	return manifest
}

export function calendarFaultIdentity(manifest: CalendarFaultManifest) {
	const { rule: _rule, ...identity } = manifest
	return createHash('sha256').update(JSON.stringify(identity)).digest('hex')
}

function writeControl(manifest: CalendarFaultManifest) {
	const descriptor = openSync(controlPath(), constants.O_WRONLY | constants.O_NOFOLLOW)
	try {
		const stat = fstatSync(descriptor)
		if (!stat.isFile() || (stat.mode & 0o777) !== 0o600) throw new Error('Invalid calendar fault control permissions')
		const value = JSON.stringify(manifest)
		writeSync(descriptor, value, 0, 'utf8')
		ftruncateSync(descriptor, Buffer.byteLength(value))
	} finally {
		closeSync(descriptor)
	}
}

export function armCalendarFault(input: Omit<CalendarFaultRule, 'id'>) {
	const manifest = readCalendarFaultControl()
	if (manifest.rule !== null) throw new Error('Another calendar fault is already armed')
	process.kill(manifest.pid, 0)
	const rule = faultRule.parse({ ...input, id: randomUUID() })
	writeControl({ ...manifest, rule })
	return rule.id
}

export function disarmCalendarFault(ruleId: string) {
	const manifest = readCalendarFaultControl()
	if (manifest.rule?.id !== ruleId) throw new Error('Calendar fault ownership changed')
	writeControl({ ...manifest, rule: null })
}

export function recordCalendarFault(
	manifest: CalendarFaultManifest,
	rule: CalendarFaultRule,
	phase: ObservationPhase,
	status: number | null = null
) {
	const record = {
		runId: manifest.runId,
		ruleId: rule.id,
		pid: manifest.pid,
		apiBuildSha: manifest.apiBuildSha,
		entrySha256: manifest.entrySha256,
		at: new Date().toISOString(),
		phase,
		status,
	}
	writeFileSync(resolve(PRIVATE_DIR, `calendar-fault-${rule.id}-${randomUUID()}.json`), JSON.stringify(record), {
		mode: 0o600,
		flag: 'wx',
	})
}

export function calendarFaultEvidence(ruleId: string) {
	const manifest = readCalendarFaultControl()
	const result: z.infer<typeof faultObservation>[] = []
	for (const file of readdirSync(PRIVATE_DIR).filter((name) => name.startsWith(`calendar-fault-${ruleId}-`))) {
		const parsed = faultObservation.safeParse(readPrivateJson(resolve(PRIVATE_DIR, file)))
		if (
			!parsed.success ||
			parsed.data.runId !== manifest.runId ||
			parsed.data.pid !== manifest.pid ||
			parsed.data.apiBuildSha !== manifest.apiBuildSha ||
			parsed.data.entrySha256 !== manifest.entrySha256
		)
			throw new Error('Calendar fault evidence does not match the owned process')
		result.push(parsed.data)
	}
	return result
}
