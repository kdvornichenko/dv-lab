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
export const LESSON_PRICE_RUB = {
	default: 2300,
	package3Months: 2100,
	package5Months: 1900,
} as const
export const roleKeySchema = z.enum(ROLE_KEYS as [RoleKey, ...RoleKey[]])
export const permissionKeySchema = z.enum(PERMISSION_KEYS as [PermissionKey, ...PermissionKey[]])

export const sidebarItemSchema = z.object({
	id: z.string().trim().min(1).max(80),
	title: z.string().trim().min(1).max(80),
	href: z.string().trim().min(1).max(240),
	icon: z.string().trim().min(1).max(80),
	visible: z.boolean(),
	locked: z.boolean().optional(),
})
export type SidebarItem = z.infer<typeof sidebarItemSchema>

export const DEFAULT_SIDEBAR_ITEMS = [
	{ id: 'dashboard', title: 'Dashboard', href: '/', icon: 'LayoutDashboard', visible: true, locked: true },
	{ id: 'lessons', title: 'Lessons', href: '/lessons', icon: 'ListChecks', visible: true },
	{ id: 'students', title: 'Students', href: '/students', icon: 'GraduationCap', visible: true },
	{ id: 'payments', title: 'Payments', href: '/payments', icon: 'Banknote', visible: true },
	{ id: 'calendar', title: 'Google Calendar', href: '/calendar', icon: 'CalendarClock', visible: true },
	{ id: 'errors', title: 'Error Log', href: '/errors', icon: 'AlertTriangle', visible: true },
	{
		id: 'settings',
		title: 'Sidebar Settings',
		href: '/settings/sidebar',
		icon: 'Settings',
		visible: true,
		locked: true,
	},
] as const satisfies SidebarItem[]

export const updateSidebarSettingsSchema = z.object({
	items: z.array(sidebarItemSchema).min(1),
})

export const crmErrorLogEntrySchema = z.object({
	id: z.string(),
	source: z.string().min(1),
	message: z.string().min(1),
	createdAt: z.string(),
})

export const saveCrmErrorSchema = z.object({
	source: z.string().trim().min(1).max(160),
	message: z.string().trim().min(1).max(4000),
})

export const studentSchema = z.object({
	id: z.string(),
	fullName: z.string().min(1),
	email: z.string().email().optional().or(z.literal('')),
	phone: z.string().optional(),
	level: z.string().optional(),
	status: studentStatusSchema,
	notes: z.string().optional(),
	defaultLessonPrice: z.number().nonnegative(),
	packageMonths: z.number().int().nonnegative(),
	packageLessonCount: z.number().int().nonnegative(),
	packageTotalPrice: z.number().nonnegative(),
	billingMode: z.enum(['per_lesson', 'monthly', 'package']),
	createdAt: z.string(),
	updatedAt: z.string(),
})

const createStudentBaseSchema = studentSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
})

export const createStudentSchema = studentSchema
	.omit({
		id: true,
		createdAt: true,
		updatedAt: true,
	})
	.extend({
		defaultLessonPrice: z.coerce.number().nonnegative().default(LESSON_PRICE_RUB.default),
		packageMonths: z.coerce.number().int().nonnegative().default(0),
		packageLessonCount: z.coerce.number().int().nonnegative().default(0),
		packageTotalPrice: z.coerce.number().nonnegative().default(0),
	})

export const updateStudentSchema = createStudentBaseSchema
	.extend({
		defaultLessonPrice: z.coerce.number().nonnegative(),
		packageMonths: z.coerce.number().int().nonnegative(),
		packageLessonCount: z.coerce.number().int().nonnegative(),
		packageTotalPrice: z.coerce.number().nonnegative(),
	})
	.partial()
	.refine((input) => Object.keys(input).length > 0, {
		message: 'At least one student field must be provided',
	})

export const listStudentsQuerySchema = z.object({
	status: z
		.union([studentStatusSchema, z.literal('all')])
		.optional()
		.default('all'),
	search: z.string().trim().max(120).optional().default(''),
})

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

export const listLessonsQuerySchema = z.object({
	status: z
		.union([lessonStatusSchema, z.literal('all')])
		.optional()
		.default('all'),
	studentId: z.string().optional().default(''),
	dateFrom: z.string().optional().default(''),
	dateTo: z.string().optional().default(''),
})

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

export const listStudentsResponseSchema = z.object({
	ok: z.literal(true),
	students: z.array(studentSchema),
})

export const studentMutationResponseSchema = z.object({
	ok: z.literal(true),
	student: studentSchema,
})

export const lessonsResponseSchema = z.object({
	ok: z.literal(true),
	lessons: z.array(lessonSchema),
	attendance: z.array(attendanceRecordSchema),
})

export const lessonMutationResponseSchema = z.object({
	ok: z.literal(true),
	lesson: lessonSchema,
})

export const attendanceMutationResponseSchema = z.object({
	ok: z.literal(true),
	attendance: z.array(attendanceRecordSchema),
})

export const sidebarSettingsResponseSchema = z.object({
	ok: z.literal(true),
	items: z.array(sidebarItemSchema),
})

export const crmErrorLogResponseSchema = z.object({
	ok: z.literal(true),
	errors: z.array(crmErrorLogEntrySchema),
})

export const crmErrorLogMutationResponseSchema = z.object({
	ok: z.literal(true),
	error: crmErrorLogEntrySchema,
})

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
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>
export type Lesson = z.infer<typeof lessonSchema>
export type CreateLessonInput = z.infer<typeof createLessonSchema>
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>
export type ListLessonsQuery = z.infer<typeof listLessonsQuerySchema>
export type AttendanceRecord = z.infer<typeof attendanceRecordSchema>
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>
export type Payment = z.infer<typeof paymentSchema>
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>
export type CalendarConnection = z.infer<typeof calendarConnectionSchema>
export type CalendarSyncRecord = z.infer<typeof calendarSyncRecordSchema>
export type CalendarUpsertLessonEventInput = z.infer<typeof calendarUpsertLessonEventSchema>
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>
export type StudentBalance = z.infer<typeof studentBalanceSchema>
export type UpdateSidebarSettingsInput = z.infer<typeof updateSidebarSettingsSchema>
export type CrmErrorLogEntry = z.infer<typeof crmErrorLogEntrySchema>
export type SaveCrmErrorInput = z.infer<typeof saveCrmErrorSchema>
export type ValidationIssue = z.infer<typeof validationIssueSchema>
export type ValidationErrorDetails = z.infer<typeof validationErrorDetailsSchema>
export type ApiErrorResponse = z.infer<typeof apiErrorSchema>
export type AuthMeResponse = z.infer<typeof authMeResponseSchema>
export type ListStudentsResponse = z.infer<typeof listStudentsResponseSchema>
export type StudentMutationResponse = z.infer<typeof studentMutationResponseSchema>
export type LessonsResponse = z.infer<typeof lessonsResponseSchema>
export type LessonMutationResponse = z.infer<typeof lessonMutationResponseSchema>
export type AttendanceMutationResponse = z.infer<typeof attendanceMutationResponseSchema>
export type SidebarSettingsResponse = z.infer<typeof sidebarSettingsResponseSchema>
export type CrmErrorLogResponse = z.infer<typeof crmErrorLogResponseSchema>
export type CrmErrorLogMutationResponse = z.infer<typeof crmErrorLogMutationResponseSchema>
