import { z } from 'zod'

import {
	calendarDate,
	calendarEditScope,
	calendarEventColor,
	calendarInstant,
	calendarRevision,
	calendarTimeZone,
	calendarVersion,
	hexColor,
} from './calendar.ts'

export {
	assignCalendarEventRequest,
	calendarEditScope,
	calendarEventColor,
	calendarEventSuggestion,
	createCalendarEventRequest,
	deleteCalendarEventRequest,
	hexColor,
	updateCalendarEventRequest,
	type AssignCalendarEventRequest,
	type CalendarEditScope,
	type CalendarEventColor,
	type CalendarEventSuggestion,
	type CreateCalendarEventRequest,
	type DeleteCalendarEventRequest,
	type UpdateCalendarEventRequest,
} from './calendar.ts'

const eventKey = z.string().min(1).max(1024)
const colorId = z.string().min(1).max(64)
const eventDescription = z.string().max(8192)
const eventLocation = z.string().max(1024)
const generation = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)

export const calendarSyncState = z.enum(['idle', 'running', 'failed', 'off'])
export type CalendarSyncState = z.infer<typeof calendarSyncState>

export const googleSyncSnapshot = z.strictObject({
	state: calendarSyncState,
	revision: calendarRevision,
	lastCheckedAt: calendarInstant.nullable(),
	windowStart: calendarDate.nullable(),
	windowEnd: calendarDate.nullable(),
})
export type GoogleSyncSnapshot = z.infer<typeof googleSyncSnapshot>

export const googlePaletteColor = z.strictObject({ id: colorId, background: hexColor, foreground: hexColor })
export type GooglePaletteColor = z.infer<typeof googlePaletteColor>

export const googleEventPalette = z.strictObject({
	calendarColor: hexColor.nullable(),
	colors: z.array(googlePaletteColor),
})
export type GoogleEventPalette = z.infer<typeof googleEventPalette>

export const calendarEventRepeat = z.discriminatedUnion('kind', [
	z.strictObject({ kind: z.literal('once') }),
	z.strictObject({ kind: z.literal('weekly'), weekday: z.literal([1, 2, 3, 4, 5, 6, 7]) }),
	z.strictObject({
		kind: z.literal('other'),
		frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly', 'custom']),
		interval: z.number().int().positive(),
	}),
])
export type CalendarEventRepeat = z.infer<typeof calendarEventRepeat>

export const DESCRIPTION_BLOCKS_LIMIT = 4096
export const DESCRIPTION_RUNS_LIMIT = 8192
export const DESCRIPTION_ITEMS_LIMIT = 4096
export const DESCRIPTION_TEXT_LIMIT = 8192
export const DESCRIPTION_HREF_LIMIT = 2048

export const eventLinkHref = z
	.string()
	.max(DESCRIPTION_HREF_LIMIT)
	.regex(/^(?:https?:\/\/|mailto:|tel:)[^\s\u0000-\u001f\u007f-\u009f]+$/)

const runText = z.string().min(1).max(DESCRIPTION_TEXT_LIMIT)
const runMarks = { bold: z.boolean(), italic: z.boolean(), underline: z.boolean() }

export const eventTextRun = z.discriminatedUnion('kind', [
	z.strictObject({ kind: z.literal('text'), text: runText, ...runMarks }),
	z.strictObject({ kind: z.literal('link'), text: runText, href: eventLinkHref, ...runMarks }),
	z.strictObject({ kind: z.literal('break') }),
])
export type EventTextRun = z.infer<typeof eventTextRun>

const eventTextRuns = z.array(eventTextRun).min(1).max(DESCRIPTION_RUNS_LIMIT)

export const eventDescriptionBlock = z.discriminatedUnion('kind', [
	z.strictObject({ kind: z.literal('paragraph'), runs: eventTextRuns }),
	z.strictObject({
		kind: z.literal('list'),
		ordered: z.boolean(),
		items: z.array(eventTextRuns).min(1).max(DESCRIPTION_ITEMS_LIMIT),
	}),
	z.strictObject({ kind: z.literal('divider') }),
])
export type EventDescriptionBlock = z.infer<typeof eventDescriptionBlock>

export const eventDescriptionBlocks = z.array(eventDescriptionBlock).max(DESCRIPTION_BLOCKS_LIMIT)

export const calendarEventDetails = z.strictObject({
	eventKey,
	version: calendarVersion,
	title: z.string().nullable(),
	description: eventDescription.nullable(),
	descriptionBlocks: eventDescriptionBlocks,
	descriptionFormatted: z.boolean(),
	location: eventLocation.nullable(),
	color: calendarEventColor,
	repeat: calendarEventRepeat,
	scopes: z.strictObject({
		edit: z.array(calendarEditScope),
		delete: z.array(calendarEditScope),
		reason: z.string().nullable(),
	}),
})
export type CalendarEventDetails = z.infer<typeof calendarEventDetails>

export const ignoreCalendarEventRequest = z.strictObject({
	requestId: z.uuid(),
	expectedVersion: calendarVersion,
})
export type IgnoreCalendarEventRequest = z.infer<typeof ignoreCalendarEventRequest>

export const chooseGoogleCalendarRequest = z.strictObject({
	requestId: z.uuid(),
	calendarId: z.string().min(1).max(1024),
	expectedGeneration: generation,
})
export type ChooseGoogleCalendarRequest = z.infer<typeof chooseGoogleCalendarRequest>

export const googleCalendarList = z.strictObject({
	calendars: z.array(
		z.strictObject({
			id: z.string().min(1).max(1024),
			label: z.string(),
			timeZone: calendarTimeZone,
			primary: z.boolean(),
			current: z.boolean(),
			color: hexColor.nullable(),
		})
	),
})
export type GoogleCalendarList = z.infer<typeof googleCalendarList>

export const googleEventKeyParams = z.strictObject({ eventKey })

function isPlaceBreak(c: number) {
	return (
		c <= 0x20 ||
		(c >= 0x7f && c <= 0xa0) ||
		c === 0x1680 ||
		(c >= 0x2000 && c <= 0x200a) ||
		c === 0x2028 ||
		c === 0x2029 ||
		c === 0x202f ||
		c === 0x205f ||
		c === 0x3000 ||
		c === 0xfeff
	)
}

function placeScheme(value: string) {
	for (const prefix of ['https://', 'http://']) {
		if (value.length < prefix.length) continue
		let same = true
		for (let i = 0; i < prefix.length && same; i += 1) {
			const c = value.charCodeAt(i)
			same = (c >= 65 && c <= 90 ? c + 32 : c) === prefix.charCodeAt(i)
		}
		if (same) return prefix.length
	}
	return 0
}

function firstOf(value: string, from: number, stops: string) {
	for (let i = from; i < value.length; i += 1) if (stops.includes(value[i] ?? '')) return i
	return value.length
}

export function placeView(
	location: string | null
): { kind: 'address'; href: string; label: string } | { kind: 'text'; text: string } | null {
	if (location === null) return null
	let start = 0
	let end = location.length
	while (start < end && isPlaceBreak(location.charCodeAt(start))) start += 1
	while (end > start && isPlaceBreak(location.charCodeAt(end - 1))) end -= 1
	if (start === end) return null
	const value = location.slice(start, end)
	const scheme = placeScheme(value)
	let clean = scheme > 0
	for (let i = 0; i < value.length && clean; i += 1) clean = !isPlaceBreak(value.charCodeAt(i))
	if (clean) {
		const hostEnd = firstOf(value, scheme, '/?#')
		const authority = value.slice(scheme, hostEnd)
		const host = authority.slice(authority.lastIndexOf('@') + 1)
		if (host) {
			const path = value[hostEnd] === '/' ? value.slice(hostEnd, firstOf(value, hostEnd, '?#')) : ''
			return { kind: 'address', href: value, label: path === '/' ? host : host + path }
		}
	}
	return { kind: 'text', text: location }
}
export type PlaceView = ReturnType<typeof placeView>
