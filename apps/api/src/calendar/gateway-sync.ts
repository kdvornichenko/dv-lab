import { Auth, google } from 'googleapis'
import { z } from 'zod'

import type { GoogleSyncPaletteColor } from '@dv-lab/db'

import { CalendarFault, GoogleWriteFault } from './gateway.ts'

const ITEM_FIELDS =
	'id,etag,updated,status,summary,description,location,start,end,colorId,transparency,eventType,recurringEventId,originalStartTime,extendedProperties/private'
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/)
const palette = z.object({
	event: z.record(z.string().min(1).max(64), z.object({ background: hex, foreground: hex })).optional(),
})
const calendarEntry = z.object({ backgroundColor: hex.optional() })
const channel = z.object({
	resourceId: z.string().min(1).max(1024),
	expiration: z.union([z.string().regex(/^\d{1,16}$/), z.number().int().positive()]).optional(),
})
const listEntry = z.object({
	id: z.string().min(1).max(1024),
	summary: z.string().optional(),
	summaryOverride: z.string().optional(),
	timeZone: z.string().min(1).optional(),
	primary: z.boolean().optional(),
	deleted: z.boolean().optional(),
	accessRole: z.string().optional(),
	backgroundColor: z.string().optional(),
})
const listPage = z.object({
	items: z.array(z.unknown()).optional(),
	nextPageToken: z.string().min(1).optional(),
})
const LIST_PAGES = 40
const WRITABLE = new Set(['owner', 'writer'])

export class SyncTokenGone extends Error {
	constructor() {
		super('sync_token_gone')
		this.name = 'SyncTokenGone'
	}
}

export type SyncPageQuery = { syncToken: string } | { timeMin: Date; timeMax: Date }
export type ChannelPair = { id: string; resourceId: string }
export type ChannelRequest = { id: string; token: string; address: string; ttlSeconds: number }
export type WritableCalendar = { id: string; label: string; timeZone: string; primary: boolean; color: string | null }

function status(error: unknown) {
	return error instanceof GoogleWriteFault ? error.httpStatus : null
}

function validZone(value: string) {
	try {
		new Intl.DateTimeFormat('en', { timeZone: value })
		return true
	} catch {
		return false
	}
}

function writableEntry(item: unknown): WritableCalendar | null {
	const parsed = listEntry.safeParse(item)
	if (!parsed.success) return null
	const entry = parsed.data
	if (entry.deleted || !entry.accessRole || !WRITABLE.has(entry.accessRole)) return null
	if (!entry.timeZone || !validZone(entry.timeZone)) return null
	return {
		id: entry.id,
		label: entry.summaryOverride ?? entry.summary ?? entry.id,
		timeZone: entry.timeZone,
		primary: entry.primary === true,
		color: entry.backgroundColor && hex.safeParse(entry.backgroundColor).success ? entry.backgroundColor : null,
	}
}

export function calendarSyncMethods(
	client: (signal: AbortSignal) => Auth.OAuth2Client,
	read: <T>(operation: () => Promise<T>) => Promise<T>
) {
	function api(token: string, signal: AbortSignal) {
		const oauth = client(signal)
		oauth.setCredentials({ access_token: token })
		return google.calendar({ version: 'v3', auth: oauth })
	}
	return {
		async syncPage(
			token: string,
			calendarId: string,
			query: SyncPageQuery,
			pageToken: string | undefined,
			signal: AbortSignal
		): Promise<unknown> {
			const range =
				'syncToken' in query
					? { syncToken: query.syncToken }
					: { timeMin: query.timeMin.toISOString(), timeMax: query.timeMax.toISOString() }
			try {
				const response = await read(() =>
					api(token, signal).events.list(
						{
							calendarId,
							...range,
							pageToken,
							singleEvents: true,
							showDeleted: true,
							maxResults: 2500,
							fields: `nextPageToken,nextSyncToken,timeZone,items(${ITEM_FIELDS})`,
						},
						{ retry: false }
					)
				)
				return response.data
			} catch (error) {
				if (status(error) === 410) throw new SyncTokenGone()
				throw error
			}
		},
		async syncEvent(token: string, calendarId: string, eventId: string, signal: AbortSignal): Promise<unknown> {
			try {
				const response = await read(() =>
					api(token, signal).events.get({ calendarId, eventId, fields: `${ITEM_FIELDS},recurrence` }, { retry: false })
				)
				return response.data
			} catch (error) {
				if (status(error) === 404 || status(error) === 410) return null
				throw error
			}
		},
		async colors(token: string, signal: AbortSignal): Promise<GoogleSyncPaletteColor[]> {
			const response = await read(() => api(token, signal).colors.get({ fields: 'event' }, { retry: false }))
			const parsed = palette.safeParse(response.data)
			if (!parsed.success) return []
			return Object.entries(parsed.data.event ?? {})
				.map(([id, color]) => ({ id, background: color.background, foreground: color.foreground }))
				.sort((left, right) => Number(left.id) - Number(right.id) || left.id.localeCompare(right.id))
		},
		async calendars(token: string, signal: AbortSignal): Promise<WritableCalendar[]> {
			const found = new Map<string, WritableCalendar>()
			const pages = new Set<string>()
			let pageToken: string | undefined
			do {
				const response = await read(() =>
					api(token, signal).calendarList.list(
						{
							showHidden: true,
							maxResults: 250,
							pageToken,
							fields:
								'nextPageToken,items(id,summary,summaryOverride,timeZone,primary,deleted,accessRole,backgroundColor)',
						},
						{ retry: false }
					)
				)
				const parsed = listPage.safeParse(response.data)
				if (!parsed.success) throw new CalendarFault('invalid_provider_data')
				for (const item of parsed.data.items ?? []) {
					const entry = writableEntry(item)
					if (entry && !found.has(entry.id)) found.set(entry.id, entry)
				}
				pageToken = parsed.data.nextPageToken
				if (pageToken && (pages.has(pageToken) || pages.size >= LIST_PAGES - 1))
					throw new CalendarFault('invalid_provider_data')
				if (pageToken) pages.add(pageToken)
			} while (pageToken)
			return [...found.values()]
		},
		async calendarColor(token: string, calendarId: string, signal: AbortSignal): Promise<string | null> {
			const response = await read(() =>
				api(token, signal).calendarList.get({ calendarId, fields: 'backgroundColor' }, { retry: false })
			)
			const parsed = calendarEntry.safeParse(response.data)
			return parsed.success ? (parsed.data.backgroundColor ?? null) : null
		},
		async watch(token: string, calendarId: string, request: ChannelRequest, signal: AbortSignal) {
			const response = await read(() =>
				api(token, signal).events.watch(
					{
						calendarId,
						requestBody: {
							id: request.id,
							type: 'web_hook',
							address: request.address,
							token: request.token,
							params: { ttl: String(request.ttlSeconds) },
						},
					},
					{ retry: false }
				)
			)
			const parsed = channel.safeParse(response.data)
			if (!parsed.success) throw new GoogleWriteFault(null)
			const expiration = parsed.data.expiration === undefined ? null : new Date(Number(parsed.data.expiration))
			return {
				resourceId: parsed.data.resourceId,
				expiresAt:
					expiration && !Number.isNaN(expiration.getTime())
						? expiration
						: new Date(Date.now() + request.ttlSeconds * 1000),
			}
		},
		async stopChannel(token: string, pair: ChannelPair, signal: AbortSignal): Promise<void> {
			await read(() =>
				api(token, signal).channels.stop(
					{ requestBody: { id: pair.id, resourceId: pair.resourceId } },
					{ retry: false }
				)
			)
		},
	}
}
