import { z } from 'zod'

import { googleEventFact, googleUnownedWritable } from './calendar-values.ts'

const id = z.string().min(1).max(1024)
const instant = z.iso.datetime({ offset: true })
const hash = z.string().regex(/^[0-9a-f]{64}$/)

export const googleObservedResource = z.strictObject({
	event: z.lazy(() => googleEventFact),
	recurrence: z.array(z.string()),
	privateProperties: z.record(z.string(), z.string()),
	unownedWritableFingerprint: hash,
	unownedWritable: z.lazy(() => googleUnownedWritable).nullable(),
})

export const googleFamilyPage = z.object({
	nextPageToken: z.string().min(1).optional(),
	items: z
		.array(
			z.object({
				id,
				recurringEventId: id.optional(),
				originalStartTime: z.object({ dateTime: instant, timeZone: z.string().optional() }).optional(),
			})
		)
		.optional(),
})

export const googleCutPlan = z.strictObject({
	studentId: z.uuid(),
	cutoff: z.iso.date(),
	master: googleObservedResource,
	prefix: z.array(googleObservedResource),
	tail: z.array(googleObservedResource),
	familyIds: z.array(id),
	preparedMarks: z.array(z.strictObject({ originalOn: z.iso.date(), kind: z.enum(['done', 'no_show', 'none']) })),
})

const observations = z.array(googleObservedResource)
export const googleCutAcknowledgements = [
	z.strictObject({
		kind: z.literal('cut_capture'),
		checkedAt: instant,
		master: googleObservedResource,
		prefix: observations,
		tail: observations,
	}),
	z.strictObject({ kind: z.literal('cut_observation'), checkedAt: instant, resource: googleObservedResource }),
	z.strictObject({
		kind: z.literal('cut_inactive'),
		checkedAt: instant,
		master: googleObservedResource.nullable(),
		tail: observations,
		cancellationStageId: z.uuid().nullable(),
	}),
	z.strictObject({
		kind: z.literal('cut_complete'),
		checkedAt: instant,
		planDigest: hash,
		stageIds: z.array(z.uuid()).min(1),
		master: googleObservedResource.nullable(),
		cancellationStageId: z.uuid().nullable(),
		oldTail: observations,
		representations: observations,
		prefix: observations,
	}),
] as const

export type GoogleObservedResource = z.infer<typeof googleObservedResource>
export type GoogleCutPlan = z.infer<typeof googleCutPlan>
export type GoogleCutCompletion = z.infer<(typeof googleCutAcknowledgements)[3]>
