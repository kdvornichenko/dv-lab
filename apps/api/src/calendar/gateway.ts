import { Auth, google } from 'googleapis'
import { z } from 'zod'

import { calendarIssue, type CalendarIssue } from '@dv-lab/contracts'
import { googleInstancePage, type GoogleStageRequest } from '@dv-lab/db'

import type { CalendarConfig } from '../config.ts'
import { insertEventBody, observeGoogleEvent, verifyGoogleResult, type WriteRequest } from './command-result.ts'
import { calendarReadMethods } from './gateway-reads.ts'
import { calendarSyncMethods } from './gateway-sync.ts'
import { parseEventPage, parseMaster, type EventQuery } from './provider-events.ts'

export const CALENDAR_SCOPES = [
	'https://www.googleapis.com/auth/calendar.events',
	'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
] as const
export const GOOGLE_REQUEST_TIMEOUT_MS = 10000

export type CalendarFaultCode = CalendarIssue | 'invalid_state' | 'denied' | 'missing_refresh_token' | 'wrong_primary'

export class CalendarFault extends Error {
	readonly code: CalendarFaultCode
	constructor(code: CalendarFaultCode) {
		super(code)
		this.code = code
		this.name = 'CalendarFault'
	}
}

export class GoogleWriteFault extends CalendarFault {
	readonly httpStatus: number | null
	readonly outcome: 'rejected' | 'conflict' | 'unknown' | 'missing'
	readonly retryAfterMs: number | null
	readonly rateLimited: boolean
	constructor(status: number | null, retryAfterMs: number | null = null, rateLimited = status === 429) {
		super(
			status === 401
				? 'reconnect_required'
				: status === 403 && !rateLimited
					? 'permission_required'
					: 'provider_unavailable'
		)
		this.httpStatus = status
		this.retryAfterMs = retryAfterMs
		this.rateLimited = rateLimited
		this.outcome =
			status === 409
				? 'conflict'
				: status === 404
					? 'missing'
					: status !== null && [400, 401, 403, 412, 429].includes(status)
						? 'rejected'
						: 'unknown'
	}
}

const tokenData = z.object({
	access_token: z.string().min(1).max(32768),
	refresh_token: z.string().min(1).max(32768).nullish(),
	expiry_date: z
		.number()
		.finite()
		.refine((value) => value > Date.now()),
	scope: z.string().optional(),
	token_type: z.literal('Bearer').optional(),
})
const providerFailure = z.object({
	response: z
		.object({
			status: z.number(),
			data: z.object({ error: z.union([z.string(), z.object({ code: z.number().optional() })]) }).optional(),
		})
		.optional(),
})
const TEMPORARY_FORBIDDEN = new Set([
	'rateLimitExceeded',
	'userRateLimitExceeded',
	'quotaExceeded',
	'dailyLimitExceeded',
	'backendError',
])
const failureReasons = z.object({
	response: z.object({
		data: z.object({ error: z.object({ errors: z.array(z.object({ reason: z.string().optional() })) }) }),
	}),
})

function rateLimited(status: number | undefined, error: unknown) {
	if (status === 429) return true
	if (status !== 403) return false
	const parsed = failureReasons.safeParse(error)
	return (
		parsed.success &&
		parsed.data.response.data.error.errors.some(
			(item) => item.reason !== undefined && TEMPORARY_FORBIDDEN.has(item.reason)
		)
	)
}

const calendarEntry = z.object({
	id: z.string().min(1),
	summary: z.string().optional(),
	summaryOverride: z.string().optional(),
	timeZone: z
		.string()
		.min(1)
		.refine((value) => {
			try {
				new Intl.DateTimeFormat('en', { timeZone: value })
				return true
			} catch {
				return false
			}
		}),
	primary: z.boolean().optional(),
	deleted: z.boolean().optional(),
	accessRole: z.enum(['freeBusyReader', 'reader', 'writer', 'owner']),
})
const calendarPage = z.object({
	items: z.array(calendarEntry).optional(),
	nextPageToken: z.string().min(1).optional(),
})
const identityPage = z.object({
	items: z
		.array(
			z.object({
				id: z.string().min(1),
				status: z.enum(['confirmed', 'tentative', 'cancelled']).optional(),
				extendedProperties: z.object({ private: z.record(z.string(), z.string()).optional() }).optional(),
			})
		)
		.optional(),
	nextPageToken: z.string().min(1).optional(),
})
export type GoogleTokens = z.infer<typeof tokenData>
export type PrimaryCalendar = { id: string; label: string; timeZone: string }

class OAuthClient extends google.auth.OAuth2 {
	async refreshGrant(token: string) {
		const response = await this.refreshToken(token)
		return response.tokens
	}
}

export function createGoogleGateway(config: Extract<CalendarConfig, { enabled: true }>) {
	function client(signal: AbortSignal) {
		const oauth = new OAuthClient({
			clientId: config.clientId,
			clientSecret: config.clientSecret,
			redirectUri: config.redirectUri,
		})
		oauth.transporter.interceptors.request.add({
			resolved: async (options) => {
				options.retry = false
				options.retryConfig = { retry: 0 }
				options.timeout = GOOGLE_REQUEST_TIMEOUT_MS
				options.signal = AbortSignal.any([signal, AbortSignal.timeout(GOOGLE_REQUEST_TIMEOUT_MS)])
				return options
			},
		})
		return oauth
	}
	async function primary(accessToken: string, signal: AbortSignal): Promise<PrimaryCalendar> {
		const oauth = client(AbortSignal.any([signal, AbortSignal.timeout(30000)]))
		oauth.setCredentials({ access_token: accessToken })
		const api = google.calendar({ version: 'v3', auth: oauth })
		const pages = new Set<string>()
		let pageToken: string | undefined
		let target: PrimaryCalendar | undefined
		do {
			const response = await safeCall(() =>
				api.calendarList.list({ showHidden: true, maxResults: 250, pageToken }, { retry: false })
			)
			const parsed = calendarPage.safeParse(response.data)
			if (!parsed.success) throw new CalendarFault('invalid_provider_data')
			target = selectPrimary(parsed.data.items ?? [], target)
			pageToken = parsed.data.nextPageToken
			if (pageToken && (pages.has(pageToken) || pages.size >= 1000)) throw new CalendarFault('invalid_provider_data')
			if (pageToken) pages.add(pageToken)
		} while (pageToken)
		if (!target) throw new CalendarFault('wrong_primary')
		return target
	}
	async function identitySearch(
		accessToken: string,
		calendarId: string,
		localEntityId: string,
		signal: AbortSignal,
		cancelledIds: readonly string[] = []
	) {
		const oauth = client(signal)
		oauth.setCredentials({ access_token: accessToken })
		const pages = new Set<string>()
		const ids = new Set<string>()
		const events: NonNullable<z.infer<typeof identityPage>['items']> = []
		let pageToken: string | undefined
		do {
			const response = await writeCall(() =>
				google.calendar({ version: 'v3', auth: oauth }).events.list(
					{
						calendarId,
						showDeleted: true,
						singleEvents: false,
						maxResults: 2500,
						pageToken,
						privateExtendedProperty: [`dvLocalId=${localEntityId}`],
						fields: 'nextPageToken,items(id,status,extendedProperties/private)',
					},
					{ retry: false }
				)
			)
			const parsed = identityPage.safeParse(response.data)
			if (!parsed.success) throw new CalendarFault('invalid_provider_data')
			for (const event of parsed.data.items ?? []) {
				const marker = event.extendedProperties?.private?.dvLocalId
				const knownTombstone =
					cancelledIds.includes(event.id) &&
					marker === undefined &&
					(event.status === undefined || event.status === 'cancelled')
				if (ids.has(event.id) || (marker !== localEntityId && !knownTombstone))
					throw new CalendarFault('invalid_provider_data')
				ids.add(event.id)
				events.push(event)
			}
			pageToken = parsed.data.nextPageToken
			if (pageToken && (pages.has(pageToken) || pages.size >= 1000)) throw new CalendarFault('invalid_provider_data')
			if (pageToken) pages.add(pageToken)
		} while (pageToken)
		return events
	}
	async function verifyReplacementIdentity(
		accessToken: string,
		calendarId: string,
		request: WriteRequest,
		signal: AbortSignal
	): Promise<CalendarIssue | null> {
		if (request.method !== 'insert' || request.payload.markers.representationGeneration === 0) return null
		try {
			const events = await identitySearch(accessToken, calendarId, request.payload.markers.localEntityId, signal)
			const active = events.filter((event) => event.status !== 'cancelled')
			if (active.length !== 1 || active[0].id !== request.eventId) throw new CalendarFault('external_change')
			return null
		} catch (error) {
			const issue = calendarIssue.safeParse(error instanceof CalendarFault ? error.code : 'provider_unavailable')
			return issue.success ? issue.data : 'provider_unavailable'
		}
	}
	return {
		...calendarReadMethods(client, writeCall),
		...calendarSyncMethods(client, writeCall),
		identityEvents: identitySearch,
		async canonicalInstance(
			accessToken: string,
			calendarId: string,
			masterEventId: string,
			originalStart: string,
			signal: AbortSignal
		) {
			const oauth = client(signal)
			oauth.setCredentials({ access_token: accessToken })
			const ids = new Set<string>()
			const tokens = new Set<string>()
			let pageToken: string | undefined
			do {
				signal.throwIfAborted()
				const response = await writeCall(() =>
					google.calendar({ version: 'v3', auth: oauth }).events.instances(
						{
							calendarId,
							eventId: masterEventId,
							originalStart,
							showDeleted: true,
							maxResults: 2500,
							pageToken,
							fields: 'nextPageToken,items(id,recurringEventId,originalStartTime)',
						},
						{ retry: false }
					)
				)
				const page = googleInstancePage.parse(response.data)
				for (const item of page.items ?? []) {
					if (
						item.recurringEventId !== masterEventId ||
						Date.parse(item.originalStartTime.dateTime) !== Date.parse(originalStart) ||
						ids.has(item.id)
					)
						throw new CalendarFault('invalid_provider_data')
					ids.add(item.id)
				}
				pageToken = page.nextPageToken
				if (pageToken && (tokens.has(pageToken) || tokens.size >= 1000))
					throw new CalendarFault('invalid_provider_data')
				if (pageToken) tokens.add(pageToken)
			} while (pageToken)
			return ids.size === 1
				? { kind: 'found' as const, eventId: [...ids][0] }
				: { kind: ids.size === 0 ? ('missing' as const) : ('ambiguous' as const) }
		},
		authorizationUrl(state: string, challenge: string): string {
			return client(new AbortController().signal).generateAuthUrl({
				access_type: 'offline',
				prompt: 'select_account consent',
				scope: [...CALENDAR_SCOPES],
				include_granted_scopes: false,
				state,
				code_challenge: challenge,
				code_challenge_method: Auth.CodeChallengeMethod.S256,
			})
		},
		async exchange(code: string, verifier: string, signal: AbortSignal): Promise<GoogleTokens> {
			const response = await safeCall(() =>
				client(signal).getToken({ code, codeVerifier: verifier, redirect_uri: config.redirectUri })
			)
			return validateTokens(response.tokens, true)
		},
		async refresh(token: string, signal: AbortSignal): Promise<GoogleTokens> {
			const response = await safeCall(() => client(signal).refreshGrant(token))
			return validateTokens(response, false)
		},
		primary,
		async insert(
			accessToken: string,
			calendarId: string,
			request: Extract<GoogleStageRequest, { method: 'insert' }>,
			timeZone: string,
			generation: number,
			signal: AbortSignal
		) {
			const oauth = client(signal)
			oauth.setCredentials({ access_token: accessToken })
			const response = await writeCall(() =>
				google
					.calendar({ version: 'v3', auth: oauth })
					.events.insert({ calendarId, sendUpdates: 'none', requestBody: insertEventBody(request) }, { retry: false })
			)
			const result = verifyGoogleResult(response.data, request, timeZone, generation, response.status)
			return { ...result, recoveryIssue: await verifyReplacementIdentity(accessToken, calendarId, request, signal) }
		},
		async confirmedEvent(
			accessToken: string,
			calendarId: string,
			request: WriteRequest,
			timeZone: string,
			generation: number,
			signal: AbortSignal
		) {
			const oauth = client(signal)
			oauth.setCredentials({ access_token: accessToken })
			const response = await writeCall(() =>
				google
					.calendar({ version: 'v3', auth: oauth })
					.events.get({ calendarId, eventId: request.eventId }, { retry: false })
			)
			const result = verifyGoogleResult(response.data, request, timeZone, generation, response.status)
			return { ...result, recoveryIssue: await verifyReplacementIdentity(accessToken, calendarId, request, signal) }
		},
		async observeEvent(
			accessToken: string,
			calendarId: string,
			eventId: string,
			timeZone: string,
			signal: AbortSignal
		) {
			const oauth = client(signal)
			oauth.setCredentials({ access_token: accessToken })
			const response = await writeCall(() =>
				google.calendar({ version: 'v3', auth: oauth }).events.get({ calendarId, eventId }, { retry: false })
			)
			return observeGoogleEvent(response.data, timeZone)
		},
		async patch(
			accessToken: string,
			calendarId: string,
			request: Extract<GoogleStageRequest, { method: 'patch' }>,
			timeZone: string,
			generation: number,
			privateProperties: Record<string, string>,
			signal: AbortSignal
		) {
			const oauth = client(signal)
			oauth.setCredentials({ access_token: accessToken })
			const body = insertEventBody(request)
			const response = await writeCall(() =>
				google.calendar({ version: 'v3', auth: oauth }).events.patch(
					{
						calendarId,
						eventId: request.eventId,
						sendUpdates: 'none',
						fields: request.payload.status === 'cancelled' ? 'id' : undefined,
						requestBody: {
							...body,
							extendedProperties: {
								...body.extendedProperties,
								private: { ...privateProperties, ...body.extendedProperties.private },
							},
						},
					},
					{ retry: false, headers: { 'If-Match': request.ifMatch } }
				)
			)
			return verifyGoogleResult(response.data, request, timeZone, generation, response.status, true)
		},
		async identityAbsent(
			accessToken: string,
			calendarId: string,
			localEntityId: string,
			signal: AbortSignal,
			missingEventId?: string
		) {
			const events = await identitySearch(accessToken, calendarId, localEntityId, signal)
			return events.every((event) => event.status === 'cancelled' && event.id !== missingEventId)
		},
		async events(accessToken: string, query: EventQuery, signal: AbortSignal) {
			const oauth = client(signal)
			oauth.setCredentials({ access_token: accessToken })
			const response = await safeCall(() =>
				google.calendar({ version: 'v3', auth: oauth }).events.list(
					{
						...query,
						singleEvents: true,
						orderBy: 'startTime',
						showDeleted: true,
						maxResults: 2500,
						fields:
							'timeZone,nextPageToken,items(id,etag,summary,start,end,status,transparency,eventType,recurringEventId,originalStartTime)',
					},
					{ retry: false }
				)
			)
			return parseEventPage(response.data)
		},
		async eventTitles(accessToken: string, query: EventQuery & { timeMax: string }, signal: AbortSignal) {
			const oauth = client(signal)
			oauth.setCredentials({ access_token: accessToken })
			const response = await safeCall(() =>
				google.calendar({ version: 'v3', auth: oauth }).events.list(
					{
						...query,
						singleEvents: true,
						showDeleted: false,
						maxResults: 2500,
						fields: 'nextPageToken,items(status,summary,start)',
					},
					{ retry: false }
				)
			)
			return response.data
		},
		async master(accessToken: string, calendarId: string, eventId: string, timeZone: string, signal: AbortSignal) {
			const oauth = client(signal)
			oauth.setCredentials({ access_token: accessToken })
			const response = await safeCall(() =>
				google.calendar({ version: 'v3', auth: oauth }).events.get(
					{
						calendarId,
						eventId,
						fields:
							'id,etag,summary,start,end,status,transparency,eventType,recurringEventId,originalStartTime,recurrence',
					},
					{ retry: false }
				)
			)
			return parseMaster(response.data, timeZone)
		},
		async revoke(token: string, signal: AbortSignal): Promise<void> {
			const response = await safeCall(() => client(signal).revokeToken(token))
			if (response.status !== 200) throw new CalendarFault('disconnect_failed')
		},
	}
}

function selectPrimary(entries: z.infer<typeof calendarEntry>[], current: PrimaryCalendar | undefined) {
	let target = current
	for (const entry of entries) {
		if (!entry.primary || entry.deleted) continue
		if (target || !['owner', 'writer'].includes(entry.accessRole)) throw new CalendarFault('wrong_primary')
		target = { id: entry.id, label: entry.summaryOverride ?? entry.summary ?? entry.id, timeZone: entry.timeZone }
	}
	return target
}

function validateTokens(input: unknown, requireScopes: boolean): GoogleTokens {
	const result = tokenData.safeParse(input)
	if (!result.success) throw new CalendarFault('invalid_provider_data')
	const scopes = result.data.scope?.split(/\s+/).filter(Boolean)
	if (requireScopes && !scopes) throw new CalendarFault('permission_required')
	if (scopes && (scopes.length !== CALENDAR_SCOPES.length || !CALENDAR_SCOPES.every((scope) => scopes.includes(scope))))
		throw new CalendarFault('permission_required')
	return result.data
}

async function safeCall<T>(operation: () => Promise<T>): Promise<T> {
	try {
		return await operation()
	} catch (error) {
		const parsed = providerFailure.safeParse(error)
		const response = parsed.success ? parsed.data.response : undefined
		if (response?.data?.error === 'invalid_grant' || response?.status === 401)
			throw new CalendarFault('reconnect_required')
		if (response?.status === 403 && !rateLimited(response.status, error)) throw new CalendarFault('permission_required')
		throw new CalendarFault('provider_unavailable')
	}
}

export type GoogleGateway = ReturnType<typeof createGoogleGateway>

async function writeCall<T>(operation: () => Promise<T>): Promise<T> {
	try {
		return await operation()
	} catch (error) {
		const parsed = providerFailure.safeParse(error)
		const status = parsed.success ? (parsed.data.response?.status ?? null) : null
		throw new GoogleWriteFault(status, retryAfter(error), rateLimited(status ?? undefined, error))
	}
}

function retryAfter(input: unknown): number | null {
	const headers = z
		.object({
			response: z.object({
				headers: z.union([z.instanceof(Headers), z.record(z.string(), z.union([z.string(), z.array(z.string())]))]),
			}),
		})
		.safeParse(input)
	if (!headers.success) return null
	const value =
		headers.data.response.headers instanceof Headers
			? headers.data.response.headers.get('retry-after')
			: headers.data.response.headers['retry-after']
	if (typeof value !== 'string') return null
	const delay = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value) - Date.now()
	return Number.isSafeInteger(delay) && delay >= 0 ? delay : null
}
