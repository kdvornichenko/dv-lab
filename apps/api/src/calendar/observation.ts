import { createHash, randomBytes } from 'node:crypto'
import type { ServerResponse } from 'node:http'
import type { Http2ServerResponse } from 'node:http2'
import type { Logger } from 'pino'

import type { CalendarIssue, GoogleScheduleWindow } from '@dv-lab/contracts'

import type { CalendarReadContext, ReadReceipt } from './read-state.ts'

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
type Control = Grant & { accountId: string; disconnectResolution: 'none' | 'provider_confirmed' | 'operator_confirmed' }
type WindowRead = {
	identity: Identity
	credentialGeneration: number
	readRevision: string
	requestedAt: string
	providerReadAt: string
	publishedAt: string
	sourceEvent: Reference
}
type ReadFailure =
	| 'http_error'
	| 'missing_read_observation'
	| 'response_replaced'
	| 'response_interrupted'
	| 'read_not_confirmed'
	| 'response_not_confirmed'
type PublicResponse = Pick<Response, 'status' | 'headers'> & { readonly body: object | null }
type PublicCandidate = { response: PublicResponse; read: WindowRead | null }
type Outgoing = ServerResponse | Http2ServerResponse
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
			accountSha256: string
			connectionSha256: string
			connectionGenerationBefore: number
			connectionGenerationAfter: number
			credentialGeneration: number
			disconnectResolution: Control['disconnectResolution']
	  }
	| (Omit<WindowRead, 'sourceEvent'> & {
			event: 'google_calendar_window_read'
			coverage: 'complete'
			providerAcknowledged: true
	  })
	| {
			event: 'google_public_week_read'
			surface: 'public-schedule-week'
			identity: Identity
			credentialGeneration: number
			readRevision: string
			requestedAt: string
			providerReadAt: string
			completedAt: string
			providerSourceEvent: Reference
			fresh: true
			coverage: 'complete'
			providerAcknowledged: true
			state: 'connected'
			reconnectRequired: false
			responseStatus: 200
			delivery: 'server-response-finished'
	  }
	| {
			event: 'google_public_week_read_unverified'
			surface: 'public-schedule-week'
			completedAt: string
			responseStatus: number
			reason: ReadFailure
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

function publicResult(
	candidate: PublicCandidate | undefined,
	response: PublicResponse,
	outgoing: Outgoing,
	requestId: string
): WindowRead | ReadFailure {
	if (outgoing.statusCode !== 200 || response.status !== 200) return 'http_error'
	if (!candidate) return 'missing_read_observation'
	if (!candidate.response.body || candidate.response.body !== response.body) return 'response_replaced'
	if (!candidate.read) return 'read_not_confirmed'
	const contentType = response.headers.get('content-type')
	if (
		!outgoing.writableFinished ||
		response.headers.get('x-request-id') !== requestId ||
		typeof contentType !== 'string' ||
		!contentType.startsWith('application/json')
	)
		return 'response_not_confirmed'
	return candidate.read
}

function matchesWindow(read: WindowRead, week: GoogleScheduleWindow): boolean {
	return (
		week.read.state === 'fresh' &&
		week.connection.state === 'connected' &&
		!week.connection.allowedActions.includes('reconnect') &&
		week.connection.generation === read.identity.connectionGeneration &&
		week.read.revision === read.readRevision &&
		(['start', 'end', 'timeZone'] as const).every((key) => week.snapshotRange?.[key] === week.requestedRange[key])
	)
}

export function createCalendarObservation(deps: { logger: Logger; gitSha: string }) {
	const observerSha256 = randomBytes(32).toString('hex')
	const access = new Map<string, Access>()
	const windows = new WeakMap<CalendarReadContext, WindowRead>()
	const responses = new WeakMap<Request, PublicCandidate>()
	let sequence = 0

	function observe(build: (reference: Reference, capturedAt: string) => Detail, requestId?: string): void {
		try {
			const reference = { observerSha256, sequence: ++sequence }
			const capturedAt = new Date().toISOString()
			deps.logger.info(
				{
					...(requestId === undefined ? {} : { requestId }),
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

	function readFailure(responseStatus: number, reason: ReadFailure, requestId: string) {
		observe(
			(_, completedAt) => ({
				event: 'google_public_week_read_unverified',
				surface: 'public-schedule-week',
				completedAt,
				responseStatus,
				reason,
			}),
			requestId
		)
	}

	function finishPublic(
		candidate: PublicCandidate | undefined,
		response: PublicResponse,
		outgoing: Outgoing,
		requestId: string
	) {
		try {
			const read = publicResult(candidate, response, outgoing, requestId)
			if (typeof read === 'string') return readFailure(outgoing.statusCode, read, requestId)
			observe(
				(_, completedAt) => ({
					event: 'google_public_week_read',
					surface: 'public-schedule-week',
					identity: read.identity,
					credentialGeneration: read.credentialGeneration,
					readRevision: read.readRevision,
					requestedAt: read.requestedAt,
					providerReadAt: read.providerReadAt,
					completedAt,
					providerSourceEvent: read.sourceEvent,
					fresh: true,
					coverage: 'complete',
					providerAcknowledged: true,
					state: 'connected',
					reconnectRequired: false,
					responseStatus: 200,
					delivery: 'server-response-finished',
				}),
				requestId
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
		windowRead(
			context: CalendarReadContext,
			row: Grant,
			receipt: ReadReceipt | CalendarIssue | undefined,
			providerReadAt: number
		) {
			if (
				!receipt ||
				typeof receipt === 'string' ||
				receipt.windowId === null ||
				receipt.connectionId !== row.id ||
				receipt.generation !== row.generation
			)
				return
			observe((sourceEvent) => {
				const facts = {
					identity: identity(row),
					credentialGeneration: row.credentialGeneration,
					readRevision: receipt.revision.toString(),
					requestedAt: context.now.toISOString(),
					providerReadAt: utc(providerReadAt),
					publishedAt: receipt.checkedAt.toISOString(),
				}
				windows.set(context, { ...facts, sourceEvent })
				return { event: 'google_calendar_window_read', ...facts, coverage: 'complete', providerAcknowledged: true }
			})
		},
		publicWeek(context: CalendarReadContext, request: Request, response: PublicResponse, week: GoogleScheduleWindow) {
			try {
				const read = windows.get(context)
				windows.delete(context)
				responses.set(request, { response, read: read && matchesWindow(read, week) ? read : null })
			} catch {}
		},
		publicResponse(request: Request, response: PublicResponse, outgoing: Outgoing) {
			try {
				if (request.method !== 'GET' || new URL(request.url).pathname !== '/schedule/week') return
				const candidate = responses.get(request)
				responses.delete(request)
				const requestId = response.headers.get('x-request-id')
				if (!requestId) return
				let settled = false
				outgoing.once('finish', () => {
					if (settled) return
					settled = true
					finishPublic(candidate, response, outgoing, requestId)
				})
				outgoing.once('close', () => {
					if (settled) return
					settled = true
					readFailure(outgoing.statusCode, 'response_interrupted', requestId)
				})
			} catch {}
		},
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
					accountSha256: digest(`calendar-account:${after.accountId}`),
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
