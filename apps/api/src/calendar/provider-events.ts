import { z } from 'zod'

import { isTimeZone } from '@dv-lab/contracts'
import { googleEventFact, type GoogleEventTime } from '@dv-lab/db'

import { CalendarFault } from './gateway.ts'
import type { EventFact } from './projection.ts'

const eventTime = z
	.object({
		date: z.iso.date().nullish(),
		dateTime: z.iso.datetime({ offset: true }).nullish(),
		timeZone: z.string().refine(isTimeZone).nullish(),
	})
	.refine((value) => Boolean(value.date) !== Boolean(value.dateTime))
const event = z.object({
	id: z.string().min(1).max(1024),
	etag: z.string().min(1),
	status: z.enum(['confirmed', 'tentative', 'cancelled']),
	recurringEventId: z.string().min(1).nullish(),
	originalStartTime: eventTime.nullish(),
	summary: z.string().nullish(),
	start: eventTime.nullish(),
	end: eventTime.nullish(),
	transparency: z.enum(['opaque', 'transparent']).nullish(),
	eventType: z.string().min(1).nullish(),
	recurrence: z.array(z.string().max(4096)).nullish(),
})
const cancelled = z.object({
	id: z.string().min(1).max(1024),
	status: z.literal('cancelled'),
})
const deletedIdentity = z.strictObject({
	id: z.string().min(1).max(1024),
	etag: z.string().nullish(),
	recurringEventId: z.string().min(1).nullish(),
	originalStartTime: eventTime.nullish(),
})
const page = z.object({
	timeZone: z.string().refine(isTimeZone),
	items: z.array(z.unknown()).optional(),
	nextPageToken: z.string().min(1).max(32768).optional(),
})
export type ProviderEvent = z.infer<typeof googleEventFact>
export type ProviderPage = { events: ProviderEvent[]; cancelledIds: string[]; timeZone: string; nextPageToken?: string }
export type ProviderMaster = { event: ProviderEvent; recurrence: readonly string[] }
export type EventQuery = {
	calendarId: string
	timeMin: string
	timeMax?: string
	pageToken?: string
}
type RawEvent = z.infer<typeof event>

function time(value: z.infer<typeof eventTime>, timeZone: string): GoogleEventTime {
	if (value.date) return { date: value.date, timeZone }
	if (!value.dateTime) throw new CalendarFault('invalid_provider_data')
	return { dateTime: value.dateTime, timeZone: value.timeZone ?? timeZone }
}

function normalize(value: RawEvent, timeZone: string): ProviderEvent {
	const result = googleEventFact.safeParse({
		eventId: value.id,
		etag: value.etag,
		recurringEventId: value.recurringEventId ?? null,
		originalStartTime: value.originalStartTime ? time(value.originalStartTime, timeZone) : null,
		summary: value.summary ?? null,
		start: value.start ? time(value.start, timeZone) : null,
		end: value.end ? time(value.end, timeZone) : null,
		status: value.status,
		transparency: value.transparency ?? 'opaque',
		eventType: value.eventType ?? 'default',
	})
	if (!result.success) throw new CalendarFault('invalid_provider_data')
	const normalized = result.data
	if (Boolean(normalized.recurringEventId) !== Boolean(normalized.originalStartTime))
		throw new CalendarFault('invalid_provider_data')
	if (normalized.start && normalized.end) validateInterval(normalized.start, normalized.end)
	return normalized
}

function validateInterval(start: GoogleEventTime, end: GoogleEventTime) {
	const valid =
		'date' in start && 'date' in end
			? start.date < end.date
			: 'dateTime' in start && 'dateTime' in end && Date.parse(start.dateTime) < Date.parse(end.dateTime)
	if (!valid) throw new CalendarFault('invalid_provider_data')
}

export function parseEventPage(input: unknown): ProviderPage {
	const parsed = page.safeParse(input)
	if (!parsed.success) throw new CalendarFault('invalid_provider_data')
	const events: ProviderEvent[] = []
	const cancelledIds: string[] = []
	for (const item of parsed.data.items ?? []) {
		const classified = classify(item, parsed.data.timeZone)
		if (classified.kind === 'event') events.push(classified.event)
		else cancelledIds.push(classified.eventId)
	}
	return { events, cancelledIds, timeZone: parsed.data.timeZone, nextPageToken: parsed.data.nextPageToken }
}

function classify(
	input: unknown,
	timeZone: string
): { kind: 'event'; event: ProviderEvent } | { kind: 'cancelled'; eventId: string } {
	const full = event.safeParse(input)
	if (full.success) {
		try {
			return { kind: 'event', event: normalize(full.data, timeZone) }
		} catch (error) {
			if (full.data.status !== 'cancelled') throw error
		}
	}
	const sparse = z.union([cancelled, deletedIdentity]).safeParse(input)
	if (!sparse.success) throw new CalendarFault('invalid_provider_data')
	return { kind: 'cancelled', eventId: sparse.data.id }
}

export function parseMaster(input: unknown, timeZone: string): ProviderMaster {
	const parsed = event.safeParse(input)
	if (!parsed.success) throw new CalendarFault('invalid_provider_data')
	return { event: normalize(parsed.data, timeZone), recurrence: parsed.data.recurrence ?? [] }
}

export const DESCRIPTION_LIMIT = 8192
export const LOCATION_LIMIT = 1024
const MARKER_KIND = /^[a-z_]{1,32}$/
const looseObject = z.record(z.string(), z.unknown())
const markerId = z.uuid()
const syncPage = z.object({
	timeZone: z.string().refine(isTimeZone).optional(),
	items: z.array(z.unknown()).optional(),
	nextPageToken: z.string().min(1).max(32768).optional(),
	nextSyncToken: z.string().min(1).max(32768).optional(),
})
const tombstone = z.object({
	id: z.string().min(1).max(1024),
	etag: z.string().min(1).nullish(),
	status: z.literal('cancelled'),
	recurringEventId: z.string().min(1).max(1024).nullish(),
	originalStartTime: eventTime.nullish(),
})

export type EventDetails = {
	description: string | null
	location: string | null
	colorId: string | null
	markerLocalId: string | null
	markerKind: string | null
	updatedAt: Date | null
	truncated: boolean
}
export type SyncSkipReason = 'invalid_event' | 'unknown_shape'
export type SyncItem =
	| { kind: 'fact'; fact: EventFact; truncated: boolean; recurrence: readonly string[] }
	| { kind: 'skipped'; reason: SyncSkipReason }
export type SyncPage = {
	facts: EventFact[]
	skipped: number
	truncated: number
	timeZone: string
	nextPageToken?: string
	nextSyncToken?: string
}

function fields(value: unknown): Record<string, unknown> {
	const parsed = looseObject.safeParse(value)
	return parsed.success ? parsed.data : {}
}

function clean(value: string) {
	return value.replaceAll('\u0000', '')
}

function limited(value: unknown, limit: number) {
	if (typeof value !== 'string') return { value: null, cut: false }
	const chars = [...clean(value)]
	if (!chars.length) return { value: null, cut: false }
	return chars.length > limit
		? { value: chars.slice(0, limit).join(''), cut: true }
		: { value: chars.join(''), cut: false }
}

export function eventDetails(input: unknown): EventDetails {
	const raw = fields(input)
	const description = limited(raw.description, DESCRIPTION_LIMIT)
	const location = limited(raw.location, LOCATION_LIMIT)
	const markers = fields(fields(raw.extendedProperties).private)
	const localId = markerId.safeParse(markers.dvLocalId)
	const kind = typeof markers.dvKind === 'string' && MARKER_KIND.test(markers.dvKind) ? markers.dvKind : null
	const marked = localId.success && kind !== null
	const updated = typeof raw.updated === 'string' ? new Date(raw.updated) : null
	const colorId = typeof raw.colorId === 'string' ? raw.colorId : ''
	return {
		description: description.value,
		location: location.value,
		colorId: colorId.length > 0 && colorId.length <= 64 ? colorId : null,
		markerLocalId: marked ? localId.data : null,
		markerKind: marked ? kind : null,
		updatedAt: updated && !Number.isNaN(updated.getTime()) ? updated : null,
		truncated: description.cut || location.cut,
	}
}

export function parseSyncItem(input: unknown, timeZone: string, readAt: Date): SyncItem {
	const full = event.safeParse(input)
	const details = eventDetails(input)
	const factAt = details.updatedAt ?? readAt
	if (full.success && !(full.data.status === 'cancelled' && !full.data.start)) {
		try {
			const normalized = normalize(full.data, timeZone)
			return {
				kind: 'fact',
				fact: {
					...normalized,
					summary: normalized.summary === null ? null : clean(normalized.summary),
					description: details.description,
					location: details.location,
					colorId: details.colorId,
					markerLocalId: details.markerLocalId,
					markerKind: details.markerKind,
					factAt,
				},
				truncated: details.truncated,
				recurrence: full.data.recurrence ?? [],
			}
		} catch {
			if (full.data.status !== 'cancelled') return { kind: 'skipped', reason: 'invalid_event' }
		}
	}
	const sparse = tombstone.safeParse(input)
	if (!sparse.success) return { kind: 'skipped', reason: full.success ? 'invalid_event' : 'unknown_shape' }
	const original = sparse.data.originalStartTime
	return {
		kind: 'fact',
		fact: {
			eventId: sparse.data.id,
			status: 'cancelled',
			factAt,
			...(sparse.data.etag ? { etag: sparse.data.etag } : {}),
			...(sparse.data.recurringEventId ? { recurringEventId: sparse.data.recurringEventId } : {}),
			...(original ? { originalStartTime: time(original, timeZone) } : {}),
		},
		truncated: false,
		recurrence: [],
	}
}

export function parseSyncPage(input: unknown, calendarTimeZone: string, readAt = new Date()): SyncPage {
	const parsed = syncPage.safeParse(input)
	if (!parsed.success) throw new CalendarFault('invalid_provider_data')
	const timeZone = parsed.data.timeZone ?? calendarTimeZone
	const facts: EventFact[] = []
	let skipped = 0
	let truncated = 0
	for (const item of parsed.data.items ?? []) {
		const result = parseSyncItem(item, timeZone, readAt)
		if (result.kind === 'skipped') {
			skipped += 1
			continue
		}
		facts.push(result.fact)
		if (result.truncated) truncated += 1
	}
	return {
		facts,
		skipped,
		truncated,
		timeZone,
		nextPageToken: parsed.data.nextPageToken,
		nextSyncToken: parsed.data.nextSyncToken,
	}
}
