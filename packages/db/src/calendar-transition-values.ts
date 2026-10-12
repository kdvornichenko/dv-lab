import { z } from 'zod'

import { googleEventFact, googleUnownedWritable } from './calendar-values.ts'

const id = z.string().min(1).max(1024)
const instant = z.iso.datetime({ offset: true })
const hash = z.string().regex(/^[0-9a-f]{64}$/)

export const googleCancelledEvent = z.object({
	id,
	etag: z.string().min(1).optional(),
	status: z.literal('cancelled').optional(),
})
export const googleCancelledInstance = z.object({
	id,
	recurringEventId: id,
	originalStartTime: z.object({ dateTime: instant, timeZone: z.string().optional() }),
	etag: z.string().min(1).optional(),
	status: z.literal('cancelled').optional(),
	start: z.object({ dateTime: instant, timeZone: z.string().optional() }).optional(),
	end: z.object({ dateTime: instant, timeZone: z.string().optional() }).optional(),
})
const cancelledTail = z.strictObject({
	originalOn: z.iso.date(),
	stageId: z.uuid(),
	current: googleCancelledInstance,
	baselineEvent: z.lazy(() => googleEventFact),
	unownedWritableFingerprint: hash,
	unownedWritable: z.lazy(() => googleUnownedWritable).nullable(),
})

export const googleObservedResource = z.strictObject({
	event: z.lazy(() => googleEventFact),
	recurrence: z.array(z.string()),
	privateProperties: z.record(z.string(), z.string()),
	unownedWritableFingerprint: hash,
	unownedWritable: z.lazy(() => googleUnownedWritable).nullable(),
})

const familyResource = z.object({
	id,
	recurringEventId: id.optional(),
	originalStartTime: z.object({ dateTime: instant, timeZone: z.string().optional() }).optional(),
	status: z.enum(['confirmed', 'tentative', 'cancelled']).optional(),
})
export const googleFamilyPage = z.object({
	nextPageToken: z.string().min(1).optional(),
	items: z.array(familyResource).optional(),
})

export const googleCutPlan = z.strictObject({
	studentId: z.uuid(),
	cutoff: z.iso.date(),
	master: googleObservedResource,
	prefix: z.array(googleObservedResource),
	cancelledPrefix: z.array(cancelledTail),
	tail: z.array(googleObservedResource),
	cancelledTail: z.array(cancelledTail),
	familyIds: z.array(id),
	preparedMarks: z.array(z.strictObject({ originalOn: z.iso.date(), kind: z.enum(['done', 'no_show', 'none']) })),
})

const observations = z.array(googleObservedResource)
export const googleCutAcknowledgements = [
	z.strictObject({
		kind: z.literal('cut_capture'),
		cancelledTail: z.array(cancelledTail),
		cancelledPrefix: z.array(cancelledTail),
		checkedAt: instant,
		master: googleObservedResource,
		prefix: observations,
		tail: observations,
	}),
	z.strictObject({ kind: z.literal('cut_observation'), checkedAt: instant, resource: googleObservedResource }),
	z.strictObject({
		kind: z.literal('cut_inactive'),
		cancelledTail: z.array(googleCancelledInstance),
		checkedAt: instant,
		master: googleObservedResource.nullable(),
		tail: observations,
		cancellationStageId: z.uuid().nullable(),
		cancelledMaster: googleCancelledEvent.nullable(),
		family: z.array(familyResource),
		absentIds: z.array(id),
		complete: z.literal(true),
	}),
	z.strictObject({
		kind: z.literal('cut_complete'),
		credentialGeneration: z.number().int().nonnegative(),
		checkedAt: instant,
		planDigest: hash,
		stageIds: z.array(z.uuid()).min(1),
		master: googleObservedResource.nullable(),
		cancellationStageId: z.uuid().nullable(),
		cancelledMaster: googleCancelledEvent.nullable(),
		oldTail: observations,
		oldCancelledTail: z.array(googleCancelledInstance),
		identityProofs: z.array(
			z.strictObject({
				localEntityId: z.uuid(),
				complete: z.literal(true),
				events: z.array(z.object({ id, status: z.enum(['confirmed', 'tentative', 'cancelled']).optional() })),
			})
		),
		canonicalInstances: observations,
		representations: observations,
		cancelledRepresentations: z.array(
			z.strictObject({ eventId: id, stageId: z.uuid(), current: googleCancelledEvent })
		),
		prefix: observations,
		cancelledPrefix: z.array(googleCancelledInstance),
		family: z.array(familyResource),
		absentIds: z.array(id),
		complete: z.literal(true),
	}),
	z.strictObject({
		kind: z.literal('cut_cancelled_prefix'),
		checkedAt: instant,
		historyStageId: z.uuid(),
		current: googleCancelledInstance,
	}),
] as const

export type GoogleObservedResource = z.infer<typeof googleObservedResource>
export type GoogleCutPlan = z.infer<typeof googleCutPlan>
export type GoogleCutCompletion = z.infer<(typeof googleCutAcknowledgements)[3]>

export type GoogleFamilyResource = z.infer<typeof familyResource>
