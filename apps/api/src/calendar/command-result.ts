import { z } from 'zod'

import { timeZoneIdentity, type CalendarIssue } from '@dv-lab/contracts'
import {
	GOOGLE_WRITABLE_FIELDS,
	googleStageAcknowledgement,
	googleUnownedWritable,
	googleProviderMarkers,
	ownedWritableKeys,
	type GoogleStageAcknowledgement,
	type GoogleStageRequest,
} from '@dv-lab/db'

import { CalendarFault } from './gateway.ts'
import { digest } from './journal.ts'
import { eventDetails, parseMaster, type ProviderEvent } from './provider-events.ts'
import { sameRecurrence } from './recurring.ts'

export type WriteRequest = Extract<GoogleStageRequest, { method: 'insert' | 'patch' }>
export type WriteAcknowledgement = Extract<GoogleStageAcknowledgement, { kind: 'event' | 'cancellation' | 'master' }>
export type VerifiedGoogleResult = { generation: number; commandId: string; acknowledgement: WriteAcknowledgement }
export type VerifiedGoogleResponse = VerifiedGoogleResult & { httpStatus: number; recoveryIssue?: CalendarIssue | null }
export type OwnedWritable = Parameters<typeof ownedWritableKeys>[0]

const marker = googleProviderMarkers
const identity = z.object({ extendedProperties: z.object({ private: marker }) })
const json = z.json()
type JsonValue = z.infer<typeof json>
const OWNED_DETAILS = ['colorId', 'description', 'location'] as const
const observedInputs = new WeakMap<object, unknown>()

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
		...preserved,
		...(request.method === 'insert' ? { id: request.eventId } : {}),
		...payload,
		extendedProperties: {
			...preserved?.extendedProperties,
			private: {
				...preserved?.extendedProperties?.private,
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
	const event = ownedEvent(actual.event, input, request)
	verifyRecurrence(actual.recurrence, request)
	verifyOwnedFields(event, request)
	const kind = request.payload.markers.entityKind
	const master = kind === 'series' || (kind === 'event' && actual.recurrence.length > 0)
	const acknowledgement = googleStageAcknowledgement.parse({
		kind: master ? 'master' : 'event',
		...(master ? { recurrence: actual.recurrence } : {}),
		event,
		checkedAt: new Date().toISOString(),
		ownedDigest: request.digest,
		unownedWritableFingerprint: unownedFingerprint(raw.data, request.payload),
		unownedWritable: captureUnownedWritable(raw.data, request.payload),
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
		instance: request.instance,
	})
	if (acknowledgement.kind !== 'cancellation') throw new CalendarFault('invalid_provider_data')
	verifyStoredCancellation(acknowledgement, request)
	return { generation, commandId: request.payload.markers.commandId, acknowledgement, httpStatus }
}

function ownedEvent(event: ProviderEvent, input: unknown, request: WriteRequest): ProviderEvent {
	const owned = new Set<string>(ownedWritableKeys(request.payload))
	if (!owned.size) return event
	const details = eventDetails(input)
	return {
		...event,
		...Object.fromEntries(OWNED_DETAILS.filter((key) => owned.has(key)).map((key) => [key, details[key]])),
	}
}

function verifyOwnedDetails(event: ProviderEvent, request: WriteRequest) {
	const owned = new Set<string>(ownedWritableKeys(request.payload))
	for (const key of OWNED_DETAILS) {
		if (!owned.has(key)) continue
		const expected = request.payload[key] || null
		if ((event[key] ?? null) !== expected) throw new CalendarFault('external_change')
	}
}

function verifyOwnedFields(event: ProviderEvent, request: WriteRequest) {
	const expected = request.payload
	verifyOwnedDetails(event, request)
	if (
		event.eventId !== request.eventId ||
		(expected.status !== undefined && event.status !== expected.status) ||
		event.eventType !== 'default' ||
		(expected.summary !== undefined && event.summary !== expected.summary) ||
		((!('instance' in request) || !request.instance) && (event.recurringEventId || event.originalStartTime))
	)
		throw new CalendarFault('external_change')
	verifyInstanceIdentity(event, request)
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

function verifyInstanceIdentity(event: ProviderEvent, request: WriteRequest) {
	if (request.method === 'patch' && request.instance) {
		const original = event.originalStartTime
		const expectedOriginal = request.instance.originalStartTime
		if (
			!request.instance.lookupVerified ||
			event.recurringEventId !== request.instance.masterEventId ||
			!original ||
			!('dateTime' in original) ||
			!('dateTime' in expectedOriginal) ||
			Date.parse(original.dateTime) !== Date.parse(expectedOriginal.dateTime)
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

function sameLines(actual: readonly string[], expected: readonly string[]) {
	if (!actual.length || !expected.length) return actual.length === expected.length
	return sameRecurrence(actual, expected) || canonical([...actual].sort()) === canonical([...expected].sort())
}

function markerOnly(payload: WriteRequest['payload']) {
	const { markers, preserved, ...owned } = payload
	return Object.values(owned).every((value) => value === undefined)
}

function verifyRecurrence(actual: readonly string[], request: WriteRequest) {
	const expected = request.payload.recurrence
	const kind = request.payload.markers.entityKind
	if (expected !== undefined) {
		if (!sameLines(actual, expected)) throw new CalendarFault('external_change')
	} else if (kind === 'single' || kind === 'occurrence') {
		if (actual.length) throw new CalendarFault('external_change')
	} else if (kind === 'series' && !markerOnly(request.payload)) throw new CalendarFault('external_change')
}

function verifyStoredCancellation(ack: Extract<WriteAcknowledgement, { kind: 'cancellation' }>, request: WriteRequest) {
	if (
		request.method === 'patch' &&
		request.instance &&
		(!request.instance.lookupVerified || JSON.stringify(ack.instance) !== JSON.stringify(request.instance))
	)
		throw new CalendarFault('external_change')
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

function unownedValues(input: unknown, payload: OwnedWritable = {}) {
	const raw = z.record(z.string(), json).parse(input)
	const owned = new Set<string>(ownedWritableKeys(payload))
	const unowned = Object.fromEntries(
		GOOGLE_WRITABLE_FIELDS.filter((key) => !owned.has(key) && key in raw).map((key) => [key, raw[key]])
	)
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
	const privateFields = Object.fromEntries(
		Object.entries(properties?.private ?? {}).filter(([key]) => !Object.hasOwn(marker.shape, key))
	)
	unowned.extendedProperties = { private: privateFields, shared: properties?.shared ?? {} }
	return unowned
}

export function unownedFingerprint(input: unknown, payload?: OwnedWritable): string {
	return digest(canonical(unownedValues(input, payload)))
}

function captureUnownedWritable(input: unknown, payload?: OwnedWritable) {
	const parsed = googleUnownedWritable.safeParse(unownedValues(input, payload))
	return parsed.success ? parsed.data : null
}

export function observeGoogleEvent(input: unknown, timeZone: string) {
	const properties = z
		.object({ extendedProperties: z.object({ private: z.record(z.string(), z.string()).optional() }).optional() })
		.parse(input)
	const observation = {
		...parseMaster(input, timeZone),
		unownedWritableFingerprint: unownedFingerprint(input),
		unownedWritable: captureUnownedWritable(input),
		privateProperties: properties.extendedProperties?.private ?? {},
	}
	observedInputs.set(observation, input)
	return observation
}

export function observedBaseline(observation: object, payload: OwnedWritable) {
	const input = observedInputs.get(observation)
	if (input === undefined) throw new CalendarFault('invalid_provider_data')
	return {
		unownedWritableFingerprint: unownedFingerprint(input, payload),
		unownedWritable: captureUnownedWritable(input, payload),
	}
}
