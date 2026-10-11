import { z } from 'zod'

import { timeZoneIdentity } from '@dv-lab/contracts'
import { googleStageAcknowledgement, type GoogleStageAcknowledgement, type GoogleStageRequest } from '@dv-lab/db'

import { CalendarFault } from './gateway.ts'
import { digest } from './journal.ts'
import { parseMaster, type ProviderEvent } from './provider-events.ts'

type InsertRequest = Extract<GoogleStageRequest, { method: 'insert' }>
type EventAcknowledgement = Extract<GoogleStageAcknowledgement, { kind: 'event' }>
export type VerifiedGoogleResult = { generation: number; commandId: string; acknowledgement: EventAcknowledgement }

const marker = z.object({
	dvLocalId: z.uuid(),
	dvKind: z.literal('single'),
	dvGeneration: z.string().regex(/^(0|[1-9]\d*)$/),
	dvCommandId: z.uuid(),
	dvStage: z.literal('0'),
	dvDigest: z.string().regex(/^[0-9a-f]{64}$/),
	dvSchema: z.literal('1'),
})
const identity = z.object({ extendedProperties: z.object({ private: marker }) })
const json = z.json()
type JsonValue = z.infer<typeof json>
const writable = [
	'description',
	'location',
	'attendees',
	'attachments',
	'colorId',
	'conferenceData',
	'guestsCanInviteOthers',
	'guestsCanModify',
	'guestsCanSeeOtherGuests',
	'reminders',
	'source',
	'transparency',
	'visibility',
]

function canonical(value: JsonValue): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value)
	if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
	return `{${Object.keys(value)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
		.join(',')}}`
}

export function insertEventBody(request: InsertRequest) {
	const { markers, ...payload } = request.payload
	return {
		id: request.eventId,
		...payload,
		extendedProperties: {
			private: {
				dvLocalId: markers.localEntityId,
				dvKind: markers.entityKind,
				dvGeneration: String(markers.representationGeneration),
				dvCommandId: markers.commandId,
				dvStage: String(markers.stage),
				dvDigest: markers.digest,
				dvSchema: String(markers.schemaVersion),
			},
		},
	}
}

export function verifyGoogleResult(
	input: unknown,
	request: InsertRequest,
	timeZone: string,
	generation: number
): VerifiedGoogleResult {
	const markers = identity.safeParse(input)
	const raw = z.record(z.string(), json).safeParse(input)
	if (!markers.success || !raw.success) throw new CalendarFault('invalid_provider_data')
	const actual = parseMaster(input, timeZone)
	const expectedMarkers = insertEventBody(request).extendedProperties.private
	if (canonical(markers.data.extendedProperties.private) !== canonical(expectedMarkers) || actual.recurrence.length)
		throw new CalendarFault('external_change')
	verifyOwnedFields(actual.event, request)
	const unowned = Object.fromEntries(writable.filter((key) => key in raw.data).map((key) => [key, raw.data[key]]))
	const acknowledgement = googleStageAcknowledgement.parse({
		kind: 'event',
		event: actual.event,
		checkedAt: new Date().toISOString(),
		ownedDigest: request.digest,
		unownedWritableFingerprint: digest(canonical(unowned)),
	})
	if (acknowledgement.kind !== 'event') throw new CalendarFault('invalid_provider_data')
	return { generation, commandId: request.payload.markers.commandId, acknowledgement }
}

function verifyOwnedFields(event: ProviderEvent, request: InsertRequest) {
	const expected = request.payload
	if (
		event.eventId !== request.eventId ||
		event.status !== 'confirmed' ||
		event.eventType !== 'default' ||
		event.summary !== expected.summary ||
		event.recurringEventId ||
		event.originalStartTime
	)
		throw new CalendarFault('external_change')
	for (const field of ['start', 'end'] as const) {
		const actualTime = event[field]
		const expectedTime = expected[field]
		if (!actualTime || !('dateTime' in actualTime) || !('dateTime' in expectedTime))
			throw new CalendarFault('invalid_provider_data')
		if (
			Date.parse(actualTime.dateTime) !== Date.parse(expectedTime.dateTime) ||
			timeZoneIdentity(actualTime.timeZone) !== timeZoneIdentity(expectedTime.timeZone)
		)
			throw new CalendarFault('external_change')
	}
}

export function storedGoogleResult(
	acknowledgement: GoogleStageAcknowledgement,
	request: InsertRequest,
	generation: number
): VerifiedGoogleResult {
	const parsed = googleStageAcknowledgement.parse(acknowledgement)
	if (parsed.kind !== 'event' || parsed.ownedDigest !== request.digest) throw new CalendarFault('invalid_provider_data')
	verifyOwnedFields(parsed.event, request)
	return { generation, commandId: request.payload.markers.commandId, acknowledgement: parsed }
}
