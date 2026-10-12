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
		accountSha256: hash,
		connectionSha256: hash,
		connectionGenerationBefore: generation,
		connectionGenerationAfter: generation,
		credentialGeneration: generation,
		disconnectResolution: z.enum(['none', 'provider_confirmed', 'operator_confirmed']),
	}),
	common.extend({
		event: z.literal('google_calendar_window_read'),
		identity,
		credentialGeneration: generation,
		readRevision: z.string().regex(/^(0|[1-9]\d*)$/),
		requestedAt: utc,
		providerReadAt: utc,
		publishedAt: utc,
		coverage: z.literal('complete'),
		providerAcknowledged: z.literal(true),
	}),
	common.extend({
		event: z.literal('google_public_week_read'),
		surface: z.literal('public-schedule-week'),
		identity,
		credentialGeneration: generation,
		readRevision: z.string().regex(/^(0|[1-9]\d*)$/),
		requestedAt: utc,
		providerReadAt: utc,
		completedAt: utc,
		providerSourceEvent: reference,
		fresh: z.literal(true),
		coverage: z.literal('complete'),
		providerAcknowledged: z.literal(true),
		state: z.literal('connected'),
		reconnectRequired: z.literal(false),
		responseStatus: z.literal(200),
		delivery: z.literal('server-response-finished'),
	}),
	common.extend({
		event: z.literal('google_public_week_read_unverified'),
		surface: z.literal('public-schedule-week'),
		completedAt: utc,
		responseStatus: z.number().int(),
		reason: z.enum([
			'http_error',
			'missing_read_observation',
			'response_replaced',
			'response_interrupted',
			'read_not_confirmed',
			'response_not_confirmed',
		]),
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
		history: () => observations(prefix),
		read() {
			const current = readLog()
			if (!current.startsWith(prefix)) throw new Error('Calendar observation log rotated or changed during the journey')
			return observations(current.slice(prefix.length))
		},
	}
}

function observations(content: string) {
	return content
		.split('\n')
		.filter(Boolean)
		.map(parseLine)
		.flatMap((line) =>
			line.calendarObservation ? [{ requestId: line.requestId, value: line.calendarObservation }] : []
		)
}
