import { z } from 'zod'

import { PERMISSION_KEYS, ROLE_KEYS, type PermissionKey, type RoleKey } from '@teacher-crm/rbac'

export const idSchema = z.string().uuid()
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
export const isoDateTimeSchema = z.string().datetime({ offset: true })

export const studentStatusSchema = z.enum(['active', 'paused', 'archived'])
export const lessonStatusSchema = z.enum(['planned', 'completed', 'cancelled', 'rescheduled'])
export const attendanceStatusSchema = z.enum(['planned', 'attended', 'absent', 'cancelled', 'rescheduled'])
export const paymentMethodSchema = z.enum(['cash', 'bank_transfer', 'card', 'other'])
export const calendarConnectionStatusSchema = z.enum([
	'not_connected',
	'authorization_required',
	'connected',
	'expired',
	'error',
])
export const calendarSyncStatusSchema = z.enum(['not_synced', 'synced', 'failed', 'disabled'])
export const GOOGLE_CALENDAR_REQUIRED_SCOPES = [
	'https://www.googleapis.com/auth/calendar',
	'https://www.googleapis.com/auth/calendar.events',
] as const
export const roleKeySchema = z.enum(ROLE_KEYS as [RoleKey, ...RoleKey[]])
export const permissionKeySchema = z.enum(PERMISSION_KEYS as [PermissionKey, ...PermissionKey[]])

export const studentSchema = z.object({
	id: z.string(),
	fullName: z.string().min(1),
	email: z.string().email().optional().or(z.literal('')),
	phone: z.string().optional(),
	level: z.string().optional(),
	status: studentStatusSchema,
	notes: z.string().optional(),
	defaultLessonPrice: z.number().nonnegative(),
	billingMode: z.enum(['per_lesson', 'monthly', 'package']),
	createdAt: z.string(),
	updatedAt: z.string(),
})

export const createStudentSchema = studentSchema
	.omit({
		id: true,
		createdAt: true,
		updatedAt: true,
	})
	.extend({
		defaultLessonPrice: z.coerce.number().nonnegative(),
	})

export const updateStudentSchema = createStudentSchema.partial()

export const lessonSchema = z.object({
	id: z.string(),
	title: z.string().min(1),
	startsAt: z.string(),
	durationMinutes: z.number().int().positive(),
	topic: z.string().optional(),
	notes: z.string().optional(),
	status: lessonStatusSchema,
	studentIds: z.array(z.string()).min(1),
	createdAt: z.string(),
	updatedAt: z.string(),
})

export const createLessonSchema = lessonSchema
	.omit({
		id: true,
		createdAt: true,
		updatedAt: true,
	})
	.extend({
		durationMinutes: z.coerce.number().int().positive(),
	})

export const updateLessonSchema = createLessonSchema.partial()

export const attendanceRecordSchema = z.object({
	id: z.string(),
	lessonId: z.string(),
	studentId: z.string(),
	status: attendanceStatusSchema,
	billable: z.boolean(),
	note: z.string().optional(),
	updatedAt: z.string(),
})

export const markAttendanceSchema = z.object({
	lessonId: z.string(),
	records: z.array(
		z.object({
			studentId: z.string(),
			status: attendanceStatusSchema,
			billable: z.boolean().default(true),
			note: z.string().optional(),
		})
	),
})

export const paymentSchema = z.object({
	id: z.string(),
	studentId: z.string(),
	amount: z.number(),
	paidAt: z.string(),
	method: paymentMethodSchema,
	comment: z.string().optional(),
	correctionOfPaymentId: z.string().optional(),
	createdAt: z.string(),
})

export const createPaymentSchema = paymentSchema
	.omit({
		id: true,
		createdAt: true,
	})
	.extend({
		amount: z.coerce.number(),
	})

export const calendarConnectionSchema = z.object({
	id: z.string(),
	provider: z.literal('google'),
	email: z.string().email().nullable(),
	status: calendarConnectionStatusSchema,
	requiredScopes: z.array(z.string()),
	grantedScopes: z.array(z.string()),
	tokenAvailable: z.boolean(),
	selectedCalendarId: z.string().nullable(),
	selectedCalendarName: z.string().nullable(),
	connectedAt: z.string().nullable(),
	updatedAt: z.string(),
})

export const calendarSyncRecordSchema = z.object({
	id: z.string(),
	lessonId: z.string(),
	provider: z.literal('google'),
	externalEventId: z.string().nullable(),
	status: calendarSyncStatusSchema,
	lastSyncedAt: z.string().nullable(),
	lastError: z.string().nullable(),
	updatedAt: z.string(),
})

export const calendarUpsertLessonEventSchema = z.object({
	lessonId: z.string(),
	syncPolicy: z.enum(['sync', 'skip']).default('sync'),
})

export const dashboardSummarySchema = z.object({
	activeStudents: z.number().int().nonnegative(),
	todayLessonCount: z.number().int().nonnegative(),
	missingAttendanceCount: z.number().int().nonnegative(),
	overdueStudentCount: z.number().int().nonnegative(),
	monthIncome: z.number().nonnegative(),
})

export const studentBalanceSchema = z.object({
	studentId: z.string(),
	balance: z.number(),
	unpaidLessonCount: z.number().int().nonnegative(),
	overdue: z.boolean(),
})

export const validationIssueSchema = z.object({
	field: z.string(),
	message: z.string(),
	code: z.string(),
})

export const validationErrorDetailsSchema = z.object({
	issues: z.array(validationIssueSchema),
})

export const apiErrorSchema = z.object({
	ok: z.literal(false),
	error: z.object({
		code: z.string(),
		message: z.string(),
		details: validationErrorDetailsSchema.optional(),
	}),
})

export const authMeResponseSchema = z.discriminatedUnion('ok', [
	z.object({
		ok: z.literal(true),
		user: z.object({
			id: z.string(),
			email: z.string().email().nullable(),
			roles: z.array(roleKeySchema),
			permissions: z.array(permissionKeySchema),
		}),
	}),
	apiErrorSchema,
])

export type StudentStatus = z.infer<typeof studentStatusSchema>
export type LessonStatus = z.infer<typeof lessonStatusSchema>
export type AttendanceStatus = z.infer<typeof attendanceStatusSchema>
export type PaymentMethod = z.infer<typeof paymentMethodSchema>
export type CalendarConnectionStatus = z.infer<typeof calendarConnectionStatusSchema>
export type CalendarSyncStatus = z.infer<typeof calendarSyncStatusSchema>
export type { PermissionKey, RoleKey }
export type Student = z.infer<typeof studentSchema>
export type CreateStudentInput = z.infer<typeof createStudentSchema>
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>
export type Lesson = z.infer<typeof lessonSchema>
export type CreateLessonInput = z.infer<typeof createLessonSchema>
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>
export type AttendanceRecord = z.infer<typeof attendanceRecordSchema>
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>
export type Payment = z.infer<typeof paymentSchema>
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>
export type CalendarConnection = z.infer<typeof calendarConnectionSchema>
export type CalendarSyncRecord = z.infer<typeof calendarSyncRecordSchema>
export type CalendarUpsertLessonEventInput = z.infer<typeof calendarUpsertLessonEventSchema>
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>
export type StudentBalance = z.infer<typeof studentBalanceSchema>
export type ValidationIssue = z.infer<typeof validationIssueSchema>
export type ValidationErrorDetails = z.infer<typeof validationErrorDetailsSchema>
