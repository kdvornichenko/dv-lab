import { z } from 'zod'

import {
	calendarDate,
	calendarEventColor,
	calendarInstant,
	calendarRevision,
	calendarTimeZone,
	calendarVersion,
	hexColor,
} from './calendar.ts'
import { CLOCK_TIME_PATTERN, REPEATS } from './schedule.ts'
import { LESSON_MINUTES_MIN } from './students.ts'

export { calendarEventColor, hexColor, type CalendarEventColor } from './calendar.ts'

const eventKey = z.string().min(1).max(1024)
const colorId = z.string().min(1).max(64)
const clockTime = z.string().regex(CLOCK_TIME_PATTERN)
const eventMinutes = z.number().int().min(LESSON_MINUTES_MIN)
const eventTitle = z.string().trim().min(1).max(1024)
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

export const calendarEditScope = z.enum(['one', 'following', 'all'])
export type CalendarEditScope = z.infer<typeof calendarEditScope>

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

export const calendarEventSuggestion = z.strictObject({
	studentId: z.uuid(),
	scope: z.enum(['event', 'series']),
})
export type CalendarEventSuggestion = z.infer<typeof calendarEventSuggestion>

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

export const createCalendarEventRequest = z.strictObject({
	requestId: z.uuid(),
	title: eventTitle,
	date: calendarDate,
	startTime: clockTime,
	durationMinutes: eventMinutes,
	repeats: z.enum(REPEATS),
	colorId: colorId.nullable(),
	description: eventDescription.nullable(),
	location: eventLocation.nullable(),
	expectedDefaultTimeZone: calendarTimeZone,
})
export type CreateCalendarEventRequest = z.infer<typeof createCalendarEventRequest>

export const updateCalendarEventRequest = z.strictObject({
	requestId: z.uuid(),
	expectedVersion: calendarVersion,
	scope: calendarEditScope,
	changes: z
		.strictObject({
			title: eventTitle.optional(),
			date: calendarDate.optional(),
			startTime: clockTime.optional(),
			durationMinutes: eventMinutes.optional(),
			repeats: z.enum(REPEATS).optional(),
			colorId: colorId.nullable().optional(),
			description: eventDescription.nullable().optional(),
			location: eventLocation.nullable().optional(),
		})
		.refine((changes) => Object.values(changes).some((value) => value !== undefined)),
})
export type UpdateCalendarEventRequest = z.infer<typeof updateCalendarEventRequest>

export const deleteCalendarEventRequest = z.strictObject({
	requestId: z.uuid(),
	expectedVersion: calendarVersion,
	scope: calendarEditScope,
})
export type DeleteCalendarEventRequest = z.infer<typeof deleteCalendarEventRequest>

export const assignCalendarEventRequest = z.strictObject({
	requestId: z.uuid(),
	expectedVersion: calendarVersion,
	studentId: z.uuid(),
})
export type AssignCalendarEventRequest = z.infer<typeof assignCalendarEventRequest>

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
