import { lstatSync, readFileSync, realpathSync } from 'node:fs'
import { isAbsolute, relative } from 'node:path'
import { z } from 'zod'

import { ROOT, STATE_DIR } from '../../scripts/dev-checks/paths.mjs'

const hash = z.string().regex(/^[a-f0-9]{64}$/)
const generation = z.number().int().nonnegative()
const utc = z.iso.datetime({ precision: 3 })
const identity = z.strictObject({ connectionSha256: hash, grantSha256: hash, connectionGeneration: generation })
const reference = z.strictObject({ observerSha256: hash, sequence: z.number().int().positive() })
const access = z.strictObject({
	identity,
	credentialGeneration: generation,
	issuedAt: utc,
	expiresAt: utc,
	sourceEvent: reference,
})
const common = z.strictObject({
	version: z.literal(1),
	observerSha256: hash,
	sequence: z.number().int().positive(),
	deployedCommit: z.string().regex(/^[a-f0-9]{40}$/),
	capturedAt: utc,
	clock: z.literal('system-utc'),
})
const observation = z.discriminatedUnion('event', [
	common.extend({
		event: z.literal('google_consent_started'),
		connectionSha256: hash,
		connectionGeneration: generation,
	}),
	common.extend({
		event: z.literal('google_consent_accepted'),
		identity,
		acceptedAt: utc,
		access,
		generationCasCommitted: z.literal(true),
	}),
	common.extend({
		event: z.literal('google_access_refreshed'),
		identity,
		credentialGenerationBefore: generation,
		credentialGenerationAfter: generation,
		priorAccess: access.nullable(),
		startedAt: utc,
		providerSucceededAt: utc,
		committedAt: utc,
		expiresAt: utc,
		providerSuccess: z.literal(true),
		generationCasCommitted: z.literal(true),
	}),
	common.extend({
		event: z.enum(['google_disconnect_started', 'google_disconnect_failed', 'google_disconnect_resolved']),
		connectionSha256: hash,
		connectionGenerationBefore: generation,
		connectionGenerationAfter: generation,
		credentialGeneration: generation,
		disconnectResolution: z.enum(['none', 'provider_confirmed', 'operator_confirmed']),
	}),
])
const envelope = z.object({ requestId: z.string().optional(), calendarObservation: observation.optional() })

function readLog(): string {
	try {
		const file = process.env.E2E_CALENDAR_OBSERVATIONS
		if (!file) throw new Error('Missing log')
		const path = realpathSync(file)
		const insideState = relative(realpathSync(STATE_DIR), path)
		const insideRepo = relative(realpathSync(ROOT), path)
		const stat = lstatSync(file)
		if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) throw new Error('Invalid log')
		if (!insideState || insideState.startsWith('..') || isAbsolute(insideState)) throw new Error('Invalid location')
		if (!insideRepo.startsWith('..') && !isAbsolute(insideRepo)) throw new Error('Repository log')
		const content = readFileSync(path, 'utf8')
		return content.slice(0, content.lastIndexOf('\n') + 1)
	} catch {
		throw new Error('Calendar observations require an existing private JSONL log inside STATE_DIR and outside Git')
	}
}

function parseLine(line: string) {
	try {
		const value: unknown = JSON.parse(line)
		const parsed = envelope.safeParse(value)
		if (!parsed.success) throw new Error('Invalid observation')
		return parsed.data
	} catch {
		throw new Error('Calendar observation schema failed; log contents suppressed')
	}
}

export function calendarEvidence() {
	const prefix = readLog()
	return {
		read() {
			const current = readLog()
			if (!current.startsWith(prefix)) throw new Error('Calendar observation log rotated or changed during the journey')
			return current
				.slice(prefix.length)
				.split('\n')
				.filter(Boolean)
				.map(parseLine)
				.flatMap((line) =>
					line.calendarObservation ? [{ requestId: line.requestId, value: line.calendarObservation }] : []
				)
		},
	}
}
