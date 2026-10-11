import { createHash, randomBytes } from 'node:crypto'
import type { Logger } from 'pino'

type Grant = { id: string; generation: number; credentialGeneration: number }
type Identity = { connectionSha256: string; grantSha256: string; connectionGeneration: number }
type Reference = { observerSha256: string; sequence: number }
type Access = {
	identity: Identity
	credentialGeneration: number
	issuedAt: string
	expiresAt: string
	sourceEvent: Reference
}
type Control = Grant & { disconnectResolution: 'none' | 'provider_confirmed' | 'operator_confirmed' }
type Detail =
	| { event: 'google_consent_started'; connectionSha256: string; connectionGeneration: number }
	| {
			event: 'google_consent_accepted'
			identity: Identity
			acceptedAt: string
			access: Access
			generationCasCommitted: true
	  }
	| {
			event: 'google_access_refreshed'
			identity: Identity
			credentialGenerationBefore: number
			credentialGenerationAfter: number
			priorAccess: Access | null
			startedAt: string
			providerSucceededAt: string
			committedAt: string
			expiresAt: string
			providerSuccess: true
			generationCasCommitted: true
	  }
	| {
			event: 'google_disconnect_started' | 'google_disconnect_failed' | 'google_disconnect_resolved'
			connectionSha256: string
			connectionGenerationBefore: number
			connectionGenerationAfter: number
			credentialGeneration: number
			disconnectResolution: Control['disconnectResolution']
	  }

const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const connectionHash = (row: Grant) => digest(`calendar-connection:${row.id}`)
const utc = (value: number) => new Date(value).toISOString()

function identity(row: Grant): Identity {
	return {
		connectionSha256: connectionHash(row),
		grantSha256: digest(`calendar-grant:${row.id}:${row.generation}`),
		connectionGeneration: row.generation,
	}
}

export function createCalendarObservation(deps: { logger: Logger; gitSha: string }) {
	const observerSha256 = randomBytes(32).toString('hex')
	const access = new Map<string, Access>()
	let sequence = 0

	function observe(build: (reference: Reference, capturedAt: string) => Detail): void {
		try {
			const reference = { observerSha256, sequence: ++sequence }
			const capturedAt = new Date().toISOString()
			deps.logger.info(
				{
					calendarObservation: {
						version: 1,
						...reference,
						deployedCommit: deps.gitSha,
						capturedAt,
						clock: 'system-utc',
						...build(reference, capturedAt),
					},
				},
				'calendar observation'
			)
		} catch {}
	}

	function remember(row: Grant, issuedAt: number, expiresAt: number, sourceEvent: Reference): Access {
		const value = {
			identity: identity(row),
			credentialGeneration: row.credentialGeneration,
			issuedAt: utc(issuedAt),
			expiresAt: utc(expiresAt),
			sourceEvent,
		}
		access.set(row.id, value)
		return value
	}

	return {
		consentStarted(row: Grant) {
			observe(() => ({
				event: 'google_consent_started',
				connectionSha256: connectionHash(row),
				connectionGeneration: row.generation,
			}))
		},
		consentAccepted(row: Grant, issuedAt: number, expiresAt: number) {
			observe((reference, acceptedAt) => ({
				event: 'google_consent_accepted',
				identity: identity(row),
				acceptedAt,
				access: remember(row, issuedAt, expiresAt, reference),
				generationCasCommitted: true,
			}))
		},
		accessRefreshed(
			before: Grant,
			after: Grant,
			timing: { startedAt: number; providerSucceededAt: number; expiresAt: number }
		) {
			observe((reference, committedAt) => {
				const previous = access.get(before.id)
				const priorAccess =
					previous?.identity.connectionGeneration === before.generation &&
					previous.credentialGeneration === before.credentialGeneration
						? previous
						: null
				const current = remember(after, timing.providerSucceededAt, timing.expiresAt, reference)
				return {
					event: 'google_access_refreshed',
					identity: current.identity,
					credentialGenerationBefore: before.credentialGeneration,
					credentialGenerationAfter: after.credentialGeneration,
					priorAccess,
					startedAt: utc(timing.startedAt),
					providerSucceededAt: current.issuedAt,
					committedAt,
					expiresAt: current.expiresAt,
					providerSuccess: true,
					generationCasCommitted: true,
				}
			})
		},
		control(
			before: Grant,
			after: Control,
			event: 'google_disconnect_started' | 'google_disconnect_failed' | 'google_disconnect_resolved'
		) {
			observe(() => {
				access.delete(after.id)
				return {
					event,
					connectionSha256: connectionHash(after),
					connectionGenerationBefore: before.generation,
					connectionGenerationAfter: after.generation,
					credentialGeneration: after.credentialGeneration,
					disconnectResolution: after.disconnectResolution,
				}
			})
		},
	}
}

export type CalendarObservation = ReturnType<typeof createCalendarObservation>
