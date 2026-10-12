import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, renameSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { z } from 'zod'

import {
	calendarFaultIdentity,
	faultObservation,
	faultRequest,
	readFaultJson,
	readRuntimeControl,
	writeRuntimeControl,
	type CalendarFaultManifest,
	type CalendarFaultObservation,
} from '../../../e2e/support/calendar-fault-protocol.ts'
import { verifyCalendarFaultRuntime } from './calendar-fault-runtime.ts'

function ready(manifest: CalendarFaultManifest): void {
	const file = process.env.E2E_CALENDAR_FAULTS
	if (!file) throw new Error('Missing private control')
	const input = readFaultJson(
		resolve(dirname(file), `calendar-fault-ready-${manifest.runId}.json`),
		manifest.runtimeRoot
	)
	const proof = z.strictObject({ runId: z.uuid(), identitySha256: z.string() }).parse(input)
	if (proof.runId !== manifest.runId || proof.identitySha256 !== calendarFaultIdentity(manifest))
		throw new Error('Runtime loader has not attested this lease')
}

function evidence(manifest: CalendarFaultManifest, ruleId: string): CalendarFaultObservation[] {
	const file = process.env.E2E_CALENDAR_FAULTS
	if (!file) throw new Error('Missing private control')
	const directory = dirname(file)
	const names = readdirSync(directory).filter(
		(name) => name.startsWith(`calendar-fault-${ruleId}-`) && name.endsWith('.json')
	)
	if (names.length > 1000) throw new Error('Evidence limit exceeded')
	return names
		.map((name) => {
			const observation = faultObservation.parse(readFaultJson(resolve(directory, name), manifest.runtimeRoot))
			if (
				observation.runId !== manifest.runId ||
				observation.ruleId !== ruleId ||
				observation.identitySha256 !== calendarFaultIdentity(manifest)
			)
				throw new Error('Evidence ownership mismatch')
			return observation
		})
		.sort((left, right) => left.at.localeCompare(right.at))
}

async function execute(): Promise<void> {
	const input: unknown = JSON.parse(readFileSync(0, 'utf8'))
	const request = faultRequest.parse(input)
	const file = process.env.E2E_CALENDAR_FAULTS
	if (!file) throw new Error('Missing private control')
	readRuntimeControl(false)
	if (request.operation.action === 'evidence' || request.operation.action === 'inspect') return operate(request)
	const lock = `${file}.lock`
	mkdirSync(lock, { mode: 0o700 })
	try {
		await operate(request)
	} finally {
		renameSync(lock, `${lock}.${randomUUID()}.released`)
	}
}

async function operate(request: z.infer<typeof faultRequest>): Promise<void> {
	const manifest = readRuntimeControl(false)
	const identitySha256 = calendarFaultIdentity(manifest)
	if (request.runId !== manifest.runId || request.identitySha256 !== identitySha256)
		throw new Error('Lease ownership mismatch')
	const binding = request.binding
	if (
		binding.origin !== manifest.origin ||
		binding.apiBuildSha !== manifest.apiBuildSha ||
		binding.persistenceFingerprint !== manifest.persistenceFingerprint
	)
		throw new Error('Target attestation mismatch')
	ready(manifest)
	const operation = request.operation
	let observations: CalendarFaultObservation[] = []
	let ruleId: string | null = manifest.rule?.id ?? null
	if (operation.action === 'arm') {
		await verifyCalendarFaultRuntime(manifest, false)
		if (manifest.rule !== null) throw new Error('Another fault is armed')
		if (evidence(manifest, operation.rule.id).length !== 0) throw new Error('Rule ID was already used')
		writeRuntimeControl({ ...manifest, rule: operation.rule })
		ruleId = operation.rule.id
	} else if (operation.action === 'disarm') {
		if (manifest.rule?.id !== operation.ruleId) throw new Error('Fault ownership changed')
		writeRuntimeControl({ ...manifest, rule: null })
		ruleId = null
	} else if (operation.action === 'evidence') {
		observations = evidence(manifest, operation.ruleId)
	}
	process.stdout.write(
		JSON.stringify({
			schema: 'dv-lab-calendar-fault-result-v1',
			runId: manifest.runId,
			identitySha256,
			ruleId,
			observations,
		})
	)
}

execute().catch(() => {
	process.stderr.write('Calendar fault operation refused; inspect owned state before retrying\n')
	process.exitCode = 1
})
