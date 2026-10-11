import { z } from 'zod'

import { timeZoneIdentity, type CalendarIssue } from '@dv-lab/contracts'
import {
	googleStageAcknowledgement,
	googleUnownedWritable,
	googleProviderMarkers,
	type GoogleStageAcknowledgement,
	type GoogleStageRequest,
} from '@dv-lab/db'

import { CalendarFault } from './gateway.ts'
import { digest } from './journal.ts'
import { parseMaster, type ProviderEvent } from './provider-events.ts'
import { sameRecurrence } from './recurring.ts'

export type WriteRequest = Extract<GoogleStageRequest, { method: 'insert' | 'patch' }>
export type WriteAcknowledgement = Extract<GoogleStageAcknowledgement, { kind: 'event' | 'cancellation' | 'master' }>
export type VerifiedGoogleResult = { generation: number; commandId: string; acknowledgement: WriteAcknowledgement }
export type VerifiedGoogleResponse = VerifiedGoogleResult & { httpStatus: number; recoveryIssue?: CalendarIssue | null }

const marker = googleProviderMarkers
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

export function insertEventBody(request: WriteRequest) {
	const { markers, preserved, ...payload } = request.payload
	return {
		...(request.method === 'insert' ? preserved : {}),
		...(request.method === 'insert' ? { id: request.eventId } : {}),
		...payload,
		extendedProperties: {
			...(request.method === 'insert' ? preserved?.extendedProperties : {}),
			private: {
				...(request.method === 'insert' ? preserved?.extendedProperties?.private : {}),
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
	request: WriteRequest,
	timeZone: string,
	generation: number,
	httpStatus: number,
	conditionalPatch = false
): VerifiedGoogleResponse {
	if (conditionalPatch && request.method === 'patch' && request.payload.status === 'cancelled')
		return verifyCancellation(input, request, generation, httpStatus)
	const markers = identity.safeParse(input)
	const raw = z.record(z.string(), json).safeParse(input)
	if (!raw.success) throw new CalendarFault('invalid_provider_data')
	if (!markers.success) throw new CalendarFault('external_change')
	const actual = parseMaster(input, timeZone)
	const expectedMarkers = insertEventBody(request).extendedProperties.private
	if (canonical(markers.data.extendedProperties.private) !== canonical(expectedMarkers))
		throw new CalendarFault('external_change')
	verifyRecurrence(actual.recurrence, request)
	verifyOwnedFields(actual.event, request)
	const acknowledgement = googleStageAcknowledgement.parse({
		kind: request.payload.markers.entityKind === 'series' ? 'master' : 'event',
		...(request.payload.markers.entityKind === 'series' ? { recurrence: actual.recurrence } : {}),
		event: actual.event,
		checkedAt: new Date().toISOString(),
		ownedDigest: request.digest,
		unownedWritableFingerprint: unownedFingerprint(raw.data),
		unownedWritable: captureUnownedWritable(raw.data),
	})
	if (acknowledgement.kind !== 'event' && acknowledgement.kind !== 'master')
		throw new CalendarFault('invalid_provider_data')
	return { generation, commandId: request.payload.markers.commandId, acknowledgement, httpStatus }
}

function verifyCancellation(
	input: unknown,
	request: Extract<WriteRequest, { method: 'patch' }>,
	generation: number,
	httpStatus: number
): VerifiedGoogleResponse {
	if (httpStatus < 200 || httpStatus >= 300 || !request.ifMatch || !request.cancellationBaseline)
		throw new CalendarFault('invalid_provider_data')
	const acknowledgement = googleStageAcknowledgement.parse({
		kind: 'cancellation',
		provenance: 'conditional_patch',
		response: input,
		httpStatus,
		ifMatch: request.ifMatch,
		checkedAt: new Date().toISOString(),
		ownedDigest: request.digest,
		unownedWritableFingerprint: request.cancellationBaseline.unownedWritableFingerprint,
		unownedWritable: request.cancellationBaseline.unownedWritable ?? null,
		baselineEvent: request.cancellationBaseline.baselineEvent,
	})
	if (acknowledgement.kind !== 'cancellation') throw new CalendarFault('invalid_provider_data')
	verifyStoredCancellation(acknowledgement, request)
	return { generation, commandId: request.payload.markers.commandId, acknowledgement, httpStatus }
}

function verifyOwnedFields(event: ProviderEvent, request: WriteRequest) {
	const expected = request.payload
	if (
		event.eventId !== request.eventId ||
		event.status !== expected.status ||
		event.eventType !== 'default' ||
		(expected.summary !== undefined && event.summary !== expected.summary) ||
		event.recurringEventId ||
		event.originalStartTime
	)
		throw new CalendarFault('external_change')
	for (const field of ['start', 'end'] as const) {
		const actualTime = event[field]
		const expectedTime = expected[field]
		if (!expectedTime) continue
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
	request: WriteRequest,
	generation: number
): VerifiedGoogleResult {
	const parsed = googleStageAcknowledgement.parse(acknowledgement)
	if (parsed.kind === 'cancellation') verifyStoredCancellation(parsed, request)
	else {
		if ((parsed.kind !== 'event' && parsed.kind !== 'master') || parsed.ownedDigest !== request.digest)
			throw new CalendarFault('invalid_provider_data')
		verifyOwnedFields(parsed.event, request)
		verifyRecurrence(parsed.kind === 'master' ? parsed.recurrence : [], request)
	}
	return { generation, commandId: request.payload.markers.commandId, acknowledgement: parsed }
}

function verifyRecurrence(actual: readonly string[], request: WriteRequest) {
	if (request.payload.markers.entityKind === 'series') {
		if (!sameRecurrence(actual, request.payload.recurrence ?? [])) throw new CalendarFault('external_change')
	} else if (actual.length) throw new CalendarFault('external_change')
}

function verifyStoredCancellation(ack: Extract<WriteAcknowledgement, { kind: 'cancellation' }>, request: WriteRequest) {
	if (
		request.method !== 'patch' ||
		request.payload.status !== 'cancelled' ||
		ack.response.id !== request.eventId ||
		ack.ifMatch !== request.ifMatch ||
		ack.ownedDigest !== request.digest
	)
		throw new CalendarFault('external_change')
}

export function cancellationAcknowledgement(ack: GoogleStageAcknowledgement | null | undefined, eventId: string) {
	if (ack?.kind === 'cancellation' && ack.response.id === eventId) return ack
	if (ack?.kind === 'event' && ack.event.eventId === eventId && ack.event.status === 'cancelled') return ack
	return null
}

function unownedValues(input: unknown) {
	const raw = z.record(z.string(), json).parse(input)
	const unowned = Object.fromEntries(writable.filter((key) => key in raw).map((key) => [key, raw[key]]))
	const properties = z
		.object({
			extendedProperties: z
				.object({
					private: z.record(z.string(), z.string()).optional(),
					shared: z.record(z.string(), z.string()).optional(),
				})
				.optional(),
		})
		.parse(input).extendedProperties
	if (properties) {
		const privateFields = Object.fromEntries(
			Object.entries(properties.private ?? {}).filter(([key]) => !Object.hasOwn(marker.shape, key))
		)
		unowned.extendedProperties = { private: privateFields, shared: properties.shared ?? {} }
	}
	return unowned
}

export function unownedFingerprint(input: unknown): string {
	return digest(canonical(unownedValues(input)))
}

function captureUnownedWritable(input: unknown) {
	const parsed = googleUnownedWritable.safeParse(unownedValues(input))
	return parsed.success ? parsed.data : null
}

export function observeGoogleEvent(input: unknown, timeZone: string) {
	const properties = z
		.object({ extendedProperties: z.object({ private: z.record(z.string(), z.string()).optional() }).optional() })
		.parse(input)
	return {
		...parseMaster(input, timeZone),
		unownedWritableFingerprint: unownedFingerprint(input),
		unownedWritable: captureUnownedWritable(input),
		privateProperties: properties.extendedProperties?.private ?? {},
	}
}
