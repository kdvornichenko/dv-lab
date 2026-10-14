import { z } from 'zod'

import type { StudentAccount } from './auth.ts'
import type { NextLessonRead } from './calendar.ts'
import { isDisplayNameLength, normalizeDisplayName } from './identity.ts'
import type { LessonMarkKind, ScheduleLessonActions, ScheduleLessonOutcome, ScheduleOccurrenceRef } from './schedule.ts'

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

export const GENDERS = ['female', 'male'] as const

export type Gender = (typeof GENDERS)[number]

export const LESSON_MINUTES_MIN = 1
export const LESSON_MINUTES_DEFAULT = 60

export const studentLessonOption = z.strictObject({
	id: z.uuid(),
	displayName: z.string(),
	defaultLessonMinutes: z.number().int().min(LESSON_MINUTES_MIN),
})

export const studentLessonOptionsResponse = z.strictObject({ students: z.array(studentLessonOption) })

export type StudentLessonOption = z.infer<typeof studentLessonOption>
export const STUDENT_TEXT_MAX_LENGTH = 200
export const TIME_ZONE_MAX_LENGTH = 64
export const SECTION_BODY_MAX_LENGTH = 20000
export const TERM_MAX_LENGTH = 200
export const NOTE_MAX_LENGTH = 2000
export const TERM_NOTE_MAX_LENGTH = 2000
export const PAYMENT_NOTE_MAX_LENGTH = 500
export const AMOUNT_MINOR_MAX = 2000000000
export const LESSONS_HUNDREDTHS_MAX = 9999999

export function timeZoneIdentity(value: string): string | null {
	try {
		return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone
	} catch {
		return null
	}
}

const TIME_ZONE_NAME = /^(UTC|[A-Z][A-Za-z_]*(\/[A-Z][A-Za-z0-9_+-]*)+)$/

export function isTimeZone(value: string): boolean {
	return TIME_ZONE_NAME.test(value) && timeZoneIdentity(value) !== null
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

const revision = z.number().int().min(1)

const studentFields = z.object({
	displayName: z.string().transform(normalizeDisplayName).refine(isDisplayNameLength),
	rateMinor: amountMinor.nullable(),
	currency: currency.nullable(),
	defaultLessonMinutes: z.number().int().min(LESSON_MINUTES_MIN),
	parent: optionalText(STUDENT_TEXT_MAX_LENGTH),
	level: optionalText(STUDENT_TEXT_MAX_LENGTH),
	goals: optionalText(STUDENT_TEXT_MAX_LENGTH),
	timeZone: optionalText(TIME_ZONE_MAX_LENGTH).refine((value) => value === null || isTimeZone(value)),
	noShowDeducts: z.boolean().optional(),
	gender: z.enum(GENDERS).nullable().optional(),
})

const ratePair = (value: { rateMinor: number | null; currency: Currency | null }) =>
	(value.rateMinor === null) === (value.currency === null)

export const saveStudentRequest = studentFields.refine(ratePair)

export const updateStudentRequest = studentFields.extend({ expectedRevision: revision.optional() }).refine(ratePair)

export const cardRevisionRequest = z.strictObject({ expectedRevision: revision.optional() })

export const openingBalanceRequest = z.object({
	lessonsHundredths,
	on: isoDate,
	expectedDefaultTimeZone: z.string().refine(isTimeZone),
	expectedRevision: revision.optional(),
})

export const saveSectionRequest = z.object({
	body: z.string().refine((body) => textLength(body) <= SECTION_BODY_MAX_LENGTH),
})

export const appendStudentNoteRequest = z.strictObject({
	sectionKind: z.enum(SECTION_KINDS),
	body: z
		.string()
		.transform((value) => value.trim())
		.refine((value) => {
			const length = textLength(value)
			return length >= 1 && length <= NOTE_MAX_LENGTH && !value.includes('\u0000')
		}),
})

export const retractNoteRequest = z.strictObject({ expectedRevision: z.number().int().min(1) })

const sectionBody = z.string().refine((body) => textLength(body) <= SECTION_BODY_MAX_LENGTH)

export const noteBlock = z.strictObject({
	id: z.uuid(),
	key: z.string(),
	name: z.string(),
	body: z.string(),
	position: z.number().int(),
	revision,
	updatedAt: z.string().nullable(),
	standard: z.boolean(),
})

export type NoteBlock = z.infer<typeof noteBlock>

export const studentBlocksResponse = z.strictObject({
	blocks: z.array(noteBlock),
	reviewedAt: z.string().nullable(),
	reviewRunning: z.strictObject({ conversationId: z.string() }).nullable(),
})

export type StudentBlocksResponse = z.infer<typeof studentBlocksResponse>

export const studentBlockResponse = z.strictObject({ block: noteBlock })

export type StudentBlockResponse = z.infer<typeof studentBlockResponse>

export const saveBlockRequest = z.strictObject({ body: sectionBody, expectedRevision: revision })

export const BLOCK_NAME_MAX_LENGTH = 60

export const BLOCKS_MAX = 200

const blockName = z
	.string()
	.transform((value) => value.trim())
	.refine((value) => {
		const length = textLength(value)
		return length >= 1 && length <= BLOCK_NAME_MAX_LENGTH && !value.includes('\u0000')
	})

export const createBlockRequest = z.strictObject({ name: blockName, body: sectionBody.default('') })

export const renameBlockRequest = z.strictObject({ name: blockName, expectedRevision: revision })

export const blockRevisionRequest = z.strictObject({ expectedRevision: revision })

export const reorderBlocksRequest = z.strictObject({
	blocks: z
		.array(z.strictObject({ id: z.uuid(), expectedRevision: revision }))
		.min(1)
		.max(BLOCKS_MAX)
		.refine((blocks) => new Set(blocks.map((block) => block.id)).size === blocks.length),
})

export const reorderBlocksResponse = z.strictObject({ blocks: z.array(noteBlock) })

export type ReorderBlocksResponse = z.infer<typeof reorderBlocksResponse>

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
	expectedDefaultTimeZone: z.string().refine(isTimeZone),
	amountMinor,
	currency,
	lessonsHundredths: lessonsHundredths.nullable(),
	note: optionalText(PAYMENT_NOTE_MAX_LENGTH),
})

export const updatePaymentRequest = z.object({
	paidOn: isoDate,
	expectedDefaultTimeZone: z.string().refine(isTimeZone),
	amountMinor,
	currency,
	lessonsHundredths: lessonsHundredths.nullable(),
	note: optionalText(PAYMENT_NOTE_MAX_LENGTH),
	expectedRevision: revision,
})

export const paymentRevisionRequest = z.strictObject({ expectedRevision: revision.optional() })

export const assignPaymentRequest = z.object({
	studentId: z.uuid(),
	currency: currency.nullable(),
	lessonsHundredths: lessonsHundredths.nullable(),
	expectedRevision: revision.optional(),
})

export const linkStudentAccountRequest = z.object({
	accountId: z.uuid(),
})

export const deactivateStudentAccountRequest = z.object({
	accountId: z.uuid(),
})

export type StudentLastPayment = {
	id: string
	paidOn: string
	amountMinor: number
	currency: Currency | null
	creditedMinutes: number
}

export type StudentRow = {
	id: string
	displayName: string
	status: StudentStatus
	rateMinor: number | null
	currency: Currency | null
	defaultLessonMinutes: number
	balanceMinutes: number | null
	nextLessonAt: string | null
	nextLesson: NextLessonRead
	lastPayment?: StudentLastPayment | null
}

export const STUDENT_LESSONS_DAYS_MAX = 366

const DAY_MS = 86400000

const daySpan = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / DAY_MS + 1

export const studentLessonsQuery = z.union([
	z.object({ range: z.literal('since_payment'), from: z.never().optional(), to: z.never().optional() }),
	z
		.object({ range: z.never().optional(), from: isoDate, to: isoDate })
		.refine(({ from, to }) => to >= from && daySpan(from, to) <= STUDENT_LESSONS_DAYS_MAX),
])

export type StudentLessonsQuery = z.infer<typeof studentLessonsQuery>

export type StudentLessonsCoverage = 'complete' | 'partial' | 'unread'

export type StudentLessonPayment = {
	id: string
	paidOn: string
	amountMinor: number
	currency: Currency | null
	paidAfter: boolean
}

export type StudentLesson = {
	key: string
	ref: ScheduleOccurrenceRef
	date: string
	startsAt: string
	timeZone: string
	durationMinutes: number
	outcome: ScheduleLessonOutcome
	movedFrom: string | null
	movedTo: string | null
	actions: ScheduleLessonActions
	mark: LessonMarkKind | null
	markRevision: number | null
	counted: boolean
	deductedMinutes: number
	balanceAfterMinutes: number | null
	projected: boolean
	payment: StudentLessonPayment | null
	held: boolean
	sinceLastPayment: boolean
}

export type StudentLessonsTotals = {
	planned: number
	done: number
	noShow: number
	cancelled: number
	moved: number
	heldCount: number
	heldMinutes: number
}

export type StudentLessonsResponse = {
	studentId: string
	from: string
	to: string
	clipped: boolean
	coverage: StudentLessonsCoverage
	asOf: string
	defaultTimeZone: string
	defaultLessonMinutes: number
	lastPayment: StudentLastPayment | null
	sinceLastPaymentFrom: string | null
	lessons: StudentLesson[]
	totals: StudentLessonsTotals
}

export type StudentsResponse = {
	students: StudentRow[]
	unassignedPayments: number
	defaultTimeZone: string
	asOf: string
	paysSoonLessons: number
}

export type StudentDetail = StudentRow & {
	parent: string | null
	level: string | null
	goals: string | null
	timeZone: string | null
	openingBalance: { minutes: number; on: string } | null
	noShowDeducts: boolean
	gender: Gender | null
	archivedAt: string | null
	account: StudentAccount | null
	revision: number
}

export type StudentResponse = {
	student: StudentDetail
	defaultTimeZone: string
	asOf: string
	paysSoonLessons: number
}

export type StudentSection = { kind: SectionKind; body: string; updatedAt: string | null }

export type StudentSectionsResponse = { sections: StudentSection[] }

export type StudentSectionResponse = { section: StudentSection }

export type StudentNote = {
	id: string
	sectionKind: SectionKind
	body: string
	revision: number
	createdAt: string
	retractedAt: string | null
}

export type StudentNotesResponse = { notes: StudentNote[] }

export type StudentNoteResponse = { note: StudentNote }

export const TERM_ADDED_BY = ['chat', 'review'] as const

export type TermAddedBy = (typeof TERM_ADDED_BY)[number]

export const TERM_REMOVED_BY = ['chat', 'review', 'teacher'] as const

export type TermRemovedBy = (typeof TERM_REMOVED_BY)[number]

export const TERM_VIEWS = ['words', 'removed'] as const

export type TermView = (typeof TERM_VIEWS)[number]

export const studentTermsQuery = z.object({ view: z.enum(TERM_VIEWS).default('words') })

export type StudentTerm = {
	id: string
	term: string
	note: string | null
	createdAt: string
	addedBy?: TermAddedBy | null
	removedAt?: string | null
	removedBy?: TermRemovedBy | null
}

export const STUDENT_COMMENTS_MAX = 10

export const STUDENT_COMMENTS_DEFAULT = 3

export const studentCommentsQuery = z.object({
	limit: z.coerce.number().int().min(1).max(STUDENT_COMMENTS_MAX).default(STUDENT_COMMENTS_DEFAULT),
})

export const studentComment = z.strictObject({
	id: z.uuid(),
	body: z.string(),
	createdAt: z.string(),
	lesson: z.strictObject({ key: z.string(), date: z.string(), startsAt: z.string().nullable() }),
})

export type StudentComment = z.infer<typeof studentComment>

export const studentCommentsResponse = z.strictObject({ comments: z.array(studentComment).max(STUDENT_COMMENTS_MAX) })

export type StudentCommentsResponse = z.infer<typeof studentCommentsResponse>

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
	revision: number
}

export type PaymentsResponse = { payments: PaymentRow[] }

export type PaymentResponse = { payment: PaymentRow }
