import { z } from 'zod'

import {
	AMOUNT_MINOR_MAX,
	CURRENCIES,
	LESSON_MINUTES_MAX,
	LESSON_MINUTES_MIN,
	PAYMENT_NOTE_MAX_LENGTH,
	SECTION_BODY_MAX_LENGTH,
	SECTION_KINDS,
	TERM_MAX_LENGTH,
	TERM_NOTE_MAX_LENGTH,
	isDisplayNameLength,
	isIsoDate,
	normalizeDisplayName,
} from '@dv-lab/contracts'

const textLength = (value: string) => Array.from(value).length

const text = (min: number, max: number) =>
	z.string().refine((value) => textLength(value) >= min && textLength(value) <= max)

const amountMinor = z.number().int().min(1).max(AMOUNT_MINOR_MAX)

const payment = z.object({
	key: z.string().regex(/^[0-9a-f]{64}$/),
	paidOn: z.string().refine(isIsoDate),
	amountMinor,
	currency: z.enum(CURRENCIES).nullable(),
	note: text(1, PAYMENT_NOTE_MAX_LENGTH).nullable(),
})

const student = z.object({
	key: text(1, 200),
	displayName: z.string().transform(normalizeDisplayName).refine(isDisplayNameLength),
	rate: z
		.object({
			amountMinor,
			currency: z.enum(CURRENCIES),
			lessonMinutes: z.number().int().min(LESSON_MINUTES_MIN).max(LESSON_MINUTES_MAX),
		})
		.nullable(),
	sections: z.array(
		z.object({
			kind: z.enum(SECTION_KINDS),
			body: text(1, SECTION_BODY_MAX_LENGTH),
		})
	),
	terms: z.array(
		z.object({
			term: text(1, TERM_MAX_LENGTH).refine((value) => value === value.trim()),
			note: text(1, TERM_NOTE_MAX_LENGTH).nullable(),
		})
	),
	payments: z.array(payment),
})

export const importPacket = z.object({
	version: z.literal(1),
	students: z.array(student).refine((students) => new Set(students.map((entry) => entry.key)).size === students.length),
	unmatched: z.array(payment),
})

export type ImportPacket = z.infer<typeof importPacket>
