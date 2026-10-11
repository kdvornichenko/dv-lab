import { z } from 'zod'

import type { StudentAccount } from './auth.ts'
import { isDisplayNameLength, normalizeDisplayName } from './identity.ts'

export const SECTION_KINDS = [
	'general_info',
	'interests',
	'level',
	'goals',
	'typical_mistakes',
	'lesson_ideas',
] as const

export type SectionKind = (typeof SECTION_KINDS)[number]

export const CURRENCIES = ['RUB', 'KZT', 'USD', 'EUR'] as const

export type Currency = (typeof CURRENCIES)[number]

export const STUDENT_STATUSES = ['active', 'archived'] as const

export type StudentStatus = (typeof STUDENT_STATUSES)[number]

export const PAYMENT_SOURCES = ['manual', 'vault'] as const

export type PaymentSource = (typeof PAYMENT_SOURCES)[number]

export const LESSON_MINUTES_MIN = 15
export const LESSON_MINUTES_MAX = 240
export const LESSON_MINUTES_DEFAULT = 60
export const STUDENT_TEXT_MAX_LENGTH = 200
export const TIME_ZONE_MAX_LENGTH = 64
export const SECTION_BODY_MAX_LENGTH = 20000
export const TERM_MAX_LENGTH = 200
export const TERM_NOTE_MAX_LENGTH = 2000
export const PAYMENT_NOTE_MAX_LENGTH = 500
export const AMOUNT_MINOR_MAX = 2000000000
export const LESSONS_HUNDREDTHS_MAX = 9999999

export function isTimeZone(value: string): boolean {
	try {
		new Intl.DateTimeFormat('en-US', { timeZone: value })
		return true
	} catch {
		return false
	}
}

export function isIsoDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
	const year = Number(value.slice(0, 4))
	const month = Number(value.slice(5, 7))
	const day = Number(value.slice(8, 10))
	if (year < 1) return false
	const date = new Date(0)
	date.setUTCFullYear(year, month - 1, day)
	return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

const textLength = (value: string) => Array.from(value).length

const optionalText = (max: number) =>
	z
		.string()
		.nullish()
		.transform((value) => {
			if (value === undefined || value === null) return null
			const trimmed = value.trim()
			return trimmed === '' ? null : trimmed
		})
		.refine((value) => value === null || textLength(value) <= max)

const isoDate = z.string().refine(isIsoDate)

const lessonsHundredths = z.number().int().min(0).max(LESSONS_HUNDREDTHS_MAX)

const amountMinor = z.number().int().min(1).max(AMOUNT_MINOR_MAX)

const currency = z.enum(CURRENCIES)

export const saveStudentRequest = z
	.object({
		displayName: z.string().transform(normalizeDisplayName).refine(isDisplayNameLength),
		rateMinor: amountMinor.nullable(),
		currency: currency.nullable(),
		defaultLessonMinutes: z.number().int().min(LESSON_MINUTES_MIN).max(LESSON_MINUTES_MAX),
		parent: optionalText(STUDENT_TEXT_MAX_LENGTH),
		level: optionalText(STUDENT_TEXT_MAX_LENGTH),
		goals: optionalText(STUDENT_TEXT_MAX_LENGTH),
		timeZone: optionalText(TIME_ZONE_MAX_LENGTH).refine((value) => value === null || isTimeZone(value)),
		noShowDeducts: z.boolean().optional(),
	})
	.refine((value) => (value.rateMinor === null) === (value.currency === null))

export const openingBalanceRequest = z.object({
	lessonsHundredths,
	on: isoDate,
})

export const saveSectionRequest = z.object({
	body: z.string().refine((body) => textLength(body) <= SECTION_BODY_MAX_LENGTH),
})

export const addTermRequest = z.object({
	term: z
		.string()
		.transform(normalizeDisplayName)
		.refine((term) => textLength(term) >= 1 && textLength(term) <= TERM_MAX_LENGTH),
	note: optionalText(TERM_NOTE_MAX_LENGTH),
})

export const updateTermNoteRequest = z.object({
	note: optionalText(TERM_NOTE_MAX_LENGTH),
})

export const recordPaymentRequest = z.object({
	studentId: z.uuid(),
	paidOn: isoDate,
	amountMinor,
	currency,
	lessonsHundredths: lessonsHundredths.nullable(),
	note: optionalText(PAYMENT_NOTE_MAX_LENGTH),
})

export const assignPaymentRequest = z.object({
	studentId: z.uuid(),
	currency: currency.nullable(),
	lessonsHundredths: lessonsHundredths.nullable(),
})

export const linkStudentAccountRequest = z.object({
	accountId: z.uuid(),
})

export const deactivateStudentAccountRequest = z.object({
	accountId: z.uuid(),
})

export type StudentRow = {
	id: string
	displayName: string
	status: StudentStatus
	rateMinor: number | null
	currency: Currency | null
	defaultLessonMinutes: number
	balanceMinutes: number | null
	nextLessonAt: string | null
}

export type StudentsResponse = { students: StudentRow[]; unassignedPayments: number }

export type StudentDetail = StudentRow & {
	parent: string | null
	level: string | null
	goals: string | null
	timeZone: string | null
	openingBalance: { minutes: number; on: string } | null
	noShowDeducts: boolean
	archivedAt: string | null
	account: StudentAccount | null
}

export type StudentResponse = { student: StudentDetail }

export type StudentSection = { kind: SectionKind; body: string; updatedAt: string | null }

export type StudentSectionsResponse = { sections: StudentSection[] }

export type StudentSectionResponse = { section: StudentSection }

export type StudentTerm = { id: string; term: string; note: string | null; createdAt: string }

export type StudentTermsResponse = { terms: StudentTerm[] }

export type StudentTermResponse = { term: StudentTerm }

export type PaymentRow = {
	id: string
	studentId: string | null
	paidOn: string
	amountMinor: number
	currency: Currency | null
	lessonsHundredths: number | null
	creditedMinutes: number
	note: string | null
	source: PaymentSource
	createdAt: string
}

export type PaymentsResponse = { payments: PaymentRow[] }

export type PaymentResponse = { payment: PaymentRow }
