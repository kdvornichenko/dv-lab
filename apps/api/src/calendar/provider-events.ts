import { z } from 'zod'

import { isTimeZone } from '@dv-lab/contracts'
import { googleEventFact, type GoogleEventTime } from '@dv-lab/db'

import { CalendarFault } from './gateway.ts'

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
