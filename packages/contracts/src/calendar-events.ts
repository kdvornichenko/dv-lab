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

export const calendarEventDetails = z.strictObject({
	eventKey,
	version: calendarVersion,
	title: z.string().nullable(),
	description: eventDescription.nullable(),
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
