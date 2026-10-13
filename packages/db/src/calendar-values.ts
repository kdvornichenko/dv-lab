import { z } from 'zod'

import { googleCutPlan, googleCutAcknowledgements } from './calendar-transition-values.ts'

const instant = z.iso.datetime({ offset: true })
const isoDate = z.iso.date()
const zone = z.string().min(1).max(64)
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const generation = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const digest = z.string().regex(/^[0-9a-f]{64}$/)
const eventId = z.string().min(1).max(1024)
const encoded = z
	.string()
	.min(1)
	.max(32768)
	.regex(/^[A-Za-z0-9_-]+$/)

export const googleCredentialEnvelope = z.strictObject({
	keyId: z.string().min(1).max(128),
	nonce: z
		.string()
		.length(16)
		.regex(/^[A-Za-z0-9_-]+$/),
	tag: z
		.string()
		.length(22)
		.regex(/^[A-Za-z0-9_-]+$/),
	ciphertext: encoded,
	wrappedDek: z
		.string()
		.length(43)
		.regex(/^[A-Za-z0-9_-]+$/),
	wrapNonce: z
		.string()
		.length(16)
		.regex(/^[A-Za-z0-9_-]+$/),
	wrapTag: z
		.string()
		.length(22)
		.regex(/^[A-Za-z0-9_-]+$/),
})

export const googleEventTime = z.union([
	z.strictObject({ date: isoDate, timeZone: zone }),
	z.strictObject({ dateTime: instant, timeZone: zone }),
])

export const googleLocalRef = z.discriminatedUnion('kind', [
	z.strictObject({ kind: z.literal('single'), lessonId: z.uuid() }),
	z.strictObject({ kind: z.literal('series'), seriesId: z.uuid(), originalOn: isoDate }),
])

export const googleSeriesRule = z
	.strictObject({
		weekday: z.literal([1, 2, 3, 4, 5, 6, 7]),
		startTime: clock,
		timeZone: zone,
		durationMinutes: z.number().int().min(1),
		startsOn: isoDate,
		endsOn: isoDate.nullable(),
	})
	.readonly()

const moveInput = z.strictObject({
	date: isoDate,
	startTime: clock,
	durationMinutes: z.number().int().min(1).optional(),
	expectedStartsAt: instant.optional(),
	expectedDefaultTimeZone: zone,
})
const actionInput = z.strictObject({ expectedStartsAt: instant.optional() })
const eventScope = z.enum(['one', 'following', 'all'])
const eventRepeats = z.enum(['once', 'weekly'])
const colorId = z.string().min(1).max(64)
const description = z.string().max(8192)
const location = z.string().max(1024)
const eventChanges = z.strictObject({
	title: z.string().min(1).max(1024).optional(),
	date: isoDate.optional(),
	startTime: clock.optional(),
	durationMinutes: z.number().int().min(1).optional(),
	repeats: eventRepeats.optional(),
	colorId: colorId.nullable().optional(),
	description: description.nullable().optional(),
	location: location.nullable().optional(),
})

export const googleCommandInput = z.discriminatedUnion('operation', [
	z.strictObject({
		operation: z.literal('create'),
		studentId: z.uuid(),
		date: isoDate,
		startTime: clock,
		durationMinutes: z.number().int().min(1),
		repeats: z.enum(['once', 'weekly']),
		expectedDefaultTimeZone: zone,
	}),
	z.strictObject({ operation: z.literal('move'), ref: googleLocalRef, input: moveInput }),
	z.strictObject({ operation: z.literal('cancel'), ref: googleLocalRef, input: actionInput }),
	z.strictObject({ operation: z.literal('restore'), ref: googleLocalRef, input: actionInput }),
	z.strictObject({
		operation: z.literal('move_series'),
		seriesId: z.uuid(),
		from: isoDate,
		weekday: z.literal([1, 2, 3, 4, 5, 6, 7]),
		startTime: clock,
		durationMinutes: z.number().int().min(1).optional(),
		newStartsOn: isoDate.optional(),
		expectedDefaultTimeZone: zone,
	}),
	z.strictObject({
		operation: z.literal('end_series'),
		seriesId: z.uuid(),
		lastOn: isoDate,
		expectedDefaultTimeZone: zone,
	}),
	z.strictObject({
		operation: z.literal('event_create'),
		eventId,
		title: z.string().min(1).max(1024),
		date: isoDate,
		startTime: clock,
		durationMinutes: z.number().int().min(1),
		repeats: eventRepeats,
		colorId: colorId.nullable(),
		description: description.nullable(),
		location: location.nullable(),
		expectedDefaultTimeZone: zone,
	}),
	z.strictObject({
		operation: z.literal('event_update'),
		eventKey: z.string().min(1).max(1024),
		eventId,
		scope: eventScope,
		changes: eventChanges,
	}),
	z.strictObject({
		operation: z.literal('event_delete'),
		eventKey: z.string().min(1).max(1024),
		eventId,
		scope: eventScope,
	}),
	z.strictObject({
		operation: z.literal('assign'),
		eventKey: z.string().min(1).max(1024),
		eventId,
		studentId: z.uuid(),
		scope: z.enum(['event', 'series']),
	}),
])

const reservation = z.strictObject({
	entityKind: z.enum(['single', 'series']),
	localEntityId: z.uuid(),
	representationGeneration: generation,
	eventId: z
		.string()
		.min(5)
		.max(1024)
		.regex(/^[0-9a-v]+$/),
})

const googleInstanceIdentity = z.strictObject({
	masterEventId: eventId,
	originalOn: isoDate,
	originalStartTime: googleEventTime,
	lookupVerified: z.boolean(),
})
const googleInstanceCandidate = z.object({
	id: eventId,
	recurringEventId: eventId,
	originalStartTime: z.object({ dateTime: instant, timeZone: zone.optional() }),
})
export const googleInstancePage = z.object({
	items: z.array(googleInstanceCandidate).optional(),
	nextPageToken: z.string().min(1).optional(),
})
const lineage = z.strictObject({
	from: googleLocalRef,
	to: googleLocalRef,
	startsAt: instant,
	timeZone: zone,
	durationMinutes: z.number().int().min(1),
	beforeStartsAt: instant.optional(),
	beforeDurationMinutes: z.number().int().min(1).optional(),
	beforeStatus: z.enum(['scheduled', 'cancelled', 'moved']).optional(),
	status: z.enum(['scheduled', 'cancelled']).optional(),
})

export const GOOGLE_WRITABLE_FIELDS = [
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
] as const

const OWNABLE_FIELDS = new Set<string>(['colorId', 'description', 'location'])

export function ownedWritableKeys(payload: {
	colorId?: string | null
	description?: string | null
	location?: string | null
}): (typeof GOOGLE_WRITABLE_FIELDS)[number][] {
	return GOOGLE_WRITABLE_FIELDS.filter(
		(key) =>
			OWNABLE_FIELDS.has(key) && Object.hasOwn(payload, key) && payload[key as keyof typeof payload] !== undefined
	)
}

export const googleUnownedWritable = z.strictObject({
	description: z.string().optional(),
	location: z.string().optional(),
	colorId: z.string().optional(),
	guestsCanInviteOthers: z.boolean().optional(),
	guestsCanModify: z.boolean().optional(),
	guestsCanSeeOtherGuests: z.boolean().optional(),
	transparency: z.enum(['opaque', 'transparent']).optional(),
	visibility: z.enum(['default', 'public', 'private', 'confidential']).optional(),
	reminders: z
		.strictObject({
			useDefault: z.boolean(),
			overrides: z
				.array(z.strictObject({ method: z.enum(['email', 'popup']), minutes: z.number().int().min(0).max(40320) }))
				.max(5)
				.optional(),
		})
		.optional(),
	source: z.strictObject({ url: z.url(), title: z.string().optional() }).optional(),
	extendedProperties: z
		.strictObject({ private: z.record(z.string(), z.string()), shared: z.record(z.string(), z.string()) })
		.optional(),
})

const precondition = z.strictObject({
	eventId,
	etag: z.string().min(1),
	unownedWritableFingerprint: digest.nullable(),
	unownedWritable: googleUnownedWritable.nullable().optional(),
})

export const googleCommandPlan = z
	.strictObject({
		version: z.literal(1),
		input: googleCommandInput,
		capturedTimeZone: zone,
		capturedRule: googleSeriesRule.nullable(),
		reservations: z.array(reservation.readonly()).readonly(),
		lineage: z.array(lineage.readonly()).readonly(),
		preconditions: z.array(precondition.readonly()).readonly(),
		affectedRefs: z.array(googleLocalRef.readonly()).readonly(),
		oldEndsOn: isoDate.nullable(),
		newRule: googleSeriesRule.nullable(),
		cut: googleCutPlan.optional(),
	})
	.readonly()

const markers = z.strictObject({
	entityKind: z.enum(['single', 'series', 'occurrence', 'event']),
	localEntityId: z.uuid(),
	representationGeneration: generation,
	commandId: z.uuid(),
	stage: z.number().int().nonnegative(),
	digest,
	schemaVersion: z.literal(1),
})

export const googleProviderMarkers = z.object({
	dvLocalId: z.uuid(),
	dvKind: z.enum(['single', 'series', 'occurrence', 'event']),
	dvGeneration: z.string().regex(/^(0|[1-9]\d*)$/),
	dvCommandId: z.uuid(),
	dvStage: z.string().regex(/^(0|[1-9]\d*)$/),
	dvDigest: digest,
	dvSchema: z.literal('1'),
})

export const googleOwnedPayload = z
	.strictObject({
		summary: z.string().nullable().optional(),
		start: googleEventTime.optional(),
		end: googleEventTime.optional(),
		recurrence: z.array(z.string().min(1).max(4096)).optional(),
		status: z.enum(['confirmed', 'cancelled']).optional(),
		colorId: colorId.nullable().optional(),
		description: description.nullable().optional(),
		location: location.nullable().optional(),
		markers,
		preserved: googleUnownedWritable.nullable().optional(),
	})
	.refine((value) => (value.start === undefined) === (value.end === undefined))

const insertPayload = googleOwnedPayload.safeExtend({
	summary: z.string(),
	start: googleEventTime,
	end: googleEventTime,
	status: z.literal('confirmed'),
})

export const googleEventFact = z
	.strictObject({
		eventId,
		etag: z.string().min(1),
		recurringEventId: eventId.nullable(),
		originalStartTime: googleEventTime.nullable(),
		summary: z.string().nullable(),
		start: googleEventTime.nullable(),
		end: googleEventTime.nullable(),
		status: z.enum(['confirmed', 'tentative', 'cancelled']),
		transparency: z.enum(['opaque', 'transparent']),
		eventType: z.string().min(1),
		colorId: colorId.nullable().optional(),
		description: description.nullable().optional(),
		location: location.nullable().optional(),
	})
	.refine((value) => (value.start === null) === (value.end === null))
	.refine((value) => value.status === 'cancelled' || value.start !== null)

export const googleStageRequest = z
	.discriminatedUnion('method', [
		z.strictObject({ method: z.literal('insert'), eventId, payload: insertPayload, digest }),
		z.strictObject({
			method: z.literal('patch'),
			eventId,
			ifMatch: z.string().min(1),
			payload: googleOwnedPayload,
			digest,
			cancellationBaseline: z
				.strictObject({
					unownedWritableFingerprint: digest,
					unownedWritable: googleUnownedWritable.nullable().optional(),
					baselineEvent: googleEventFact.optional(),
				})
				.optional(),
			instance: googleInstanceIdentity.optional(),
		}),
		z.strictObject({ method: z.literal('get'), eventId }),
		z.strictObject({ method: z.literal('instances'), eventId, originalStartTime: googleEventTime.nullable() }),
		z.strictObject({ method: z.literal('family'), eventId }),
	])
	.readonly()

export const googleStageAcknowledgement = z.discriminatedUnion('kind', [
	...googleCutAcknowledgements,
	z.strictObject({
		kind: z.literal('master'),
		event: googleEventFact,
		recurrence: z.array(z.string().min(1)),
		checkedAt: instant,
		ownedDigest: digest,
		unownedWritableFingerprint: digest,
		unownedWritable: googleUnownedWritable.nullable().optional(),
	}),
	z.strictObject({
		kind: z.literal('cancellation'),
		provenance: z.literal('conditional_patch'),
		response: z.object({ id: eventId, etag: z.string().min(1).optional(), status: z.literal('cancelled').optional() }),
		httpStatus: z.number().int().min(200).max(299),
		ifMatch: z.string().min(1),
		checkedAt: instant,
		ownedDigest: digest,
		unownedWritableFingerprint: digest,
		unownedWritable: googleUnownedWritable.nullable().optional(),
		baselineEvent: googleEventFact.optional(),
		instance: googleInstanceIdentity.optional(),
	}),
	z.strictObject({
		kind: z.literal('event'),
		event: googleEventFact,
		checkedAt: instant,
		ownedDigest: digest,
		unownedWritableFingerprint: digest,
		unownedWritable: googleUnownedWritable.nullable().optional(),
	}),
	z.strictObject({
		kind: z.literal('absence'),
		eventId,
		checkedAt: instant,
		calendarAccessConfirmed: z.literal(true),
		identitySearchComplete: z.literal(true),
	}),
	z.strictObject({
		kind: z.literal('instances'),
		checkedAt: instant,
		complete: z.literal(true),
		events: z.array(googleEventFact),
	}),
	z.strictObject({
		kind: z.literal('instance_lookup'),
		checkedAt: instant,
		complete: z.literal(true),
		masterEventId: eventId,
		originalStartTime: googleEventTime,
		eventIds: z.array(eventId),
	}),
])

export const googleStageAttempt = z.strictObject({
	attemptId: z.uuid(),
	generation,
	startedAt: instant,
	finishedAt: instant.nullable(),
	outcome: z.enum(['dispatching', 'unknown', 'rejected', 'acknowledged']),
	ifMatch: z.string().min(1).nullable(),
	requestDigest: digest,
	httpStatus: z.number().int().min(100).max(599).nullable(),
	errorCode: z
		.enum(['transport', 'timeout', 'permission', 'reconnect', 'precondition', 'rate_limit', 'invalid_data'])
		.nullable(),
	retryAfterSeconds: z.number().int().min(0).nullable().optional(),
})

export type GoogleCredentialEnvelope = z.infer<typeof googleCredentialEnvelope>
export type GoogleEventTime = z.infer<typeof googleEventTime>
export type GoogleLocalRef = z.infer<typeof googleLocalRef>
export type GoogleCommandPlan = z.infer<typeof googleCommandPlan>
export type GoogleStageRequest = z.infer<typeof googleStageRequest>
export type GoogleStageAcknowledgement = z.infer<typeof googleStageAcknowledgement>
export type GoogleStageAttempt = z.infer<typeof googleStageAttempt>
