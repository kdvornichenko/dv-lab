import { Auth, google } from 'googleapis'
import { z } from 'zod'

import type { CalendarIssue } from '@dv-lab/contracts'
import type { GoogleStageRequest } from '@dv-lab/db'

import type { CalendarConfig } from '../config.ts'
import { insertEventBody, verifyGoogleResult } from './command-result.ts'
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
	constructor(status: number | null) {
		super(status === 401 ? 'reconnect_required' : status === 403 ? 'permission_required' : 'provider_unavailable')
		this.httpStatus = status
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
	return {
		authorizationUrl(state: string, challenge: string): string {
			return client(new AbortController().signal).generateAuthUrl({
				access_type: 'offline',
				prompt: 'consent',
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
			return verifyGoogleResult(response.data, request, timeZone, generation)
		},
		async confirmedEvent(
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
					.events.get({ calendarId, eventId: request.eventId }, { retry: false })
			)
			return verifyGoogleResult(response.data, request, timeZone, generation)
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
		if (response?.status === 403) throw new CalendarFault('permission_required')
		throw new CalendarFault('provider_unavailable')
	}
}

export type GoogleGateway = ReturnType<typeof createGoogleGateway>

async function writeCall<T>(operation: () => Promise<T>): Promise<T> {
	try {
		return await operation()
	} catch (error) {
		const parsed = providerFailure.safeParse(error)
		throw new GoogleWriteFault(parsed.success ? (parsed.data.response?.status ?? null) : null)
	}
}
