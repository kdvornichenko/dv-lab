import { z } from 'zod'

import { PERMISSION_KEYS, ROLE_KEYS, type PermissionKey, type RoleKey } from '@teacher-crm/rbac'

export const idSchema = z.string().uuid()
export const crmRouteIdSchema = z
	.string()
	.trim()
	.min(1)
	.max(120)
	.regex(/^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[a-z][a-z0-9]*_[a-z0-9_-]+)$/i, {
		message: 'Invalid CRM resource id',
	})
export const studentIdParamSchema = z.object({ studentId: crmRouteIdSchema })
export const lessonIdParamSchema = z.object({ lessonId: crmRouteIdSchema })
export const paymentIdParamSchema = z.object({ paymentId: crmRouteIdSchema })
export const errorIdParamSchema = z.object({ errorId: crmRouteIdSchema })
export const calendarBlockIdParamSchema = z.object({ blockId: crmRouteIdSchema })
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
export const isoDateTimeSchema = z.string().datetime({ offset: true })

export const studentStatusSchema = z.enum(['active', 'paused', 'archived'])
export const LESSON_STATUSES = ['planned', 'completed', 'cancelled', 'rescheduled', 'no_show'] as const
export const ATTENDANCE_STATUSES = ['planned', 'attended', 'absent', 'cancelled', 'rescheduled', 'no_show'] as const
export const BILLABLE_ATTENDANCE_STATUSES = ['attended', 'no_show'] as const
export const lessonStatusSchema = z.enum(LESSON_STATUSES)
export const attendanceStatusSchema = z.enum(ATTENDANCE_STATUSES)
export const paymentMethodSchema = z.enum(['cash', 'bank_transfer', 'card', 'other'])
export const currencySchema = z.enum(['RUB', 'KZT'])
export const currencyTotalsSchema = z.object({
	RUB: z.number().nonnegative().default(0),
	KZT: z.number().nonnegative().default(0),
})
export const packageInstanceStatusSchema = z.enum(['active', 'exhausted', 'cancelled'])
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
export const DEFAULT_LESSON_DURATION_MINUTES = 60
export const DEFAULT_PACKAGE_WEEKS_PER_MONTH = 4
export const SUPPORTED_PACKAGE_MONTHS = [0, 3, 5] as const
export const PACKAGE_DISCOUNT_RUB = {
	3: 200,
	5: 400,
} as const
export type SupportedPackageMonths = (typeof SUPPORTED_PACKAGE_MONTHS)[number]

export function isSupportedPackageMonths(value: number): value is SupportedPackageMonths {
	return SUPPORTED_PACKAGE_MONTHS.includes(value as SupportedPackageMonths)
}

export function getPackageDiscountRub(packageMonths: number) {
	if (packageMonths === 3) return PACKAGE_DISCOUNT_RUB[3]
	if (packageMonths === 5) return PACKAGE_DISCOUNT_RUB[5]
	return 0
}

export function getLessonDurationUnits(durationMinutes: number) {
	return Number.isFinite(durationMinutes) ? Math.max(durationMinutes, 0) / DEFAULT_LESSON_DURATION_MINUTES : 0
}

export function calculatePackageLessonCount(input: { packageMonths: number; packageLessonsPerWeek: number }) {
	if (!Number.isInteger(input.packageMonths) || input.packageMonths <= 0) return 0
	if (!Number.isFinite(input.packageLessonsPerWeek) || input.packageLessonsPerWeek <= 0) return 0
	return input.packageMonths * DEFAULT_PACKAGE_WEEKS_PER_MONTH * input.packageLessonsPerWeek
}

export function calculateMonthlyLessonCount(input: { lessonsPerWeek: number }) {
	if (!Number.isFinite(input.lessonsPerWeek) || input.lessonsPerWeek <= 0) return 0
	return DEFAULT_PACKAGE_WEEKS_PER_MONTH * input.lessonsPerWeek
}

export function calculateMonthlyTotalPrice(input: {
	defaultLessonPrice: number
	defaultLessonDurationMinutes: number
	lessonsPerWeek: number
	packageLessonPriceOverride?: number | null
}) {
	const lessonCount = calculateMonthlyLessonCount({ lessonsPerWeek: input.lessonsPerWeek })
	const basePrice =
		input.packageLessonPriceOverride !== null &&
		input.packageLessonPriceOverride !== undefined &&
		Number.isFinite(input.packageLessonPriceOverride)
			? input.packageLessonPriceOverride
			: Number.isFinite(input.defaultLessonPrice)
				? input.defaultLessonPrice
				: 0
	return basePrice * getLessonDurationUnits(input.defaultLessonDurationMinutes) * lessonCount
}

export function calculatePackageLessonPriceRub(input: {
	defaultLessonPrice: number
	defaultLessonDurationMinutes: number
	packageMonths: number
	packageLessonPriceOverride?: number | null
}) {
	const basePrice =
		input.packageLessonPriceOverride !== null &&
		input.packageLessonPriceOverride !== undefined &&
		Number.isFinite(input.packageLessonPriceOverride)
			? input.packageLessonPriceOverride
			: Number.isFinite(input.defaultLessonPrice)
				? input.defaultLessonPrice
				: 0
	if (input.packageLessonPriceOverride !== null && input.packageLessonPriceOverride !== undefined) {
		return Math.max(basePrice, 0) * getLessonDurationUnits(input.defaultLessonDurationMinutes)
	}
	const discountedBasePrice = Math.max(basePrice - getPackageDiscountRub(input.packageMonths), 0)
	return discountedBasePrice * getLessonDurationUnits(input.defaultLessonDurationMinutes)
}

export function calculatePackageTotalPriceRub(input: {
	defaultLessonPrice: number
	defaultLessonDurationMinutes: number
	packageMonths: number
	packageLessonCount: number
	packageLessonPriceOverride?: number | null
}) {
	if (
		!Number.isInteger(input.packageMonths) ||
		input.packageMonths === 0 ||
		!Number.isFinite(input.packageLessonCount) ||
		input.packageLessonCount <= 0
	) {
		return 0
	}

	return (
		calculatePackageLessonPriceRub({
			defaultLessonPrice: input.defaultLessonPrice,
			defaultLessonDurationMinutes: input.defaultLessonDurationMinutes,
			packageMonths: input.packageMonths,
			packageLessonPriceOverride: input.packageLessonPriceOverride,
		}) * input.packageLessonCount
	)
}
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
		title: 'Settings',
		href: '/settings',
		icon: 'Settings',
		visible: true,
		locked: true,
	},
] as const satisfies SidebarItem[]

export const updateSidebarSettingsSchema = z.object({
	items: z.array(sidebarItemSchema).min(1),
})

export const petSettingsSchema = z.object({
	enabled: z.boolean().default(true),
	soundEnabled: z.boolean().default(false),
	activityLevel: z.enum(['reduced', 'normal', 'playful']).default('normal'),
})
export type PetSettings = z.infer<typeof petSettingsSchema>
export const DEFAULT_PET_SETTINGS = {
	enabled: true,
	soundEnabled: false,
	activityLevel: 'normal',
} as const satisfies PetSettings

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

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/)
export const crmThemeFontSchema = z.enum([
	'geist',
	'inter',
	'manrope',
	'nunito',
	'roboto',
	'ibm-plex',
	'system',
	'serif',
	'playfair',
	'merriweather',
	'mono',
	'jetbrains-mono',
	'roboto-mono',
])
export const crmThemeRadiusSchema = z.enum(['none', 'sm', 'default', 'lg', 'xl'])
export const crmThemeColorsSchema = z.object({
	background: hexColorSchema,
	foreground: hexColorSchema,
	card: hexColorSchema.default('#ffffff'),
	surfaceMuted: hexColorSchema.default('#f1f5f9'),
	primary: hexColorSchema,
	accent: hexColorSchema,
	success: hexColorSchema,
	warning: hexColorSchema,
	danger: hexColorSchema,
	chart: hexColorSchema,
})
export const crmThemeFontSizesSchema = z.object({
	body: z.coerce.number().min(12).max(20).default(14),
	heading: z.coerce.number().min(14).max(28).default(18),
	small: z.coerce.number().min(10).max(16).default(12),
})

export const crmThemeSettingsSchema = z.object({
	radius: crmThemeRadiusSchema,
	headingFont: crmThemeFontSchema,
	bodyFont: crmThemeFontSchema,
	numberFont: crmThemeFontSchema,
	fontSizes: crmThemeFontSizesSchema.default({ body: 14, heading: 18, small: 12 }),
	colors: crmThemeColorsSchema,
})

export const DEFAULT_CRM_THEME_SETTINGS = {
	radius: 'default',
	headingFont: 'geist',
	bodyFont: 'geist',
	numberFont: 'mono',
	colors: {
		background: '#f8fafc',
		foreground: '#0f172a',
		card: '#ffffff',
		surfaceMuted: '#f1f5f9',
		primary: '#2f6f5e',
		accent: '#d97706',
		success: '#059669',
		warning: '#d97706',
		danger: '#dc2626',
		chart: '#64748b',
	},
	fontSizes: {
		body: 14,
		heading: 18,
		small: 12,
	},
} as const satisfies z.infer<typeof crmThemeSettingsSchema>

export const nullableIsoDateSchema = isoDateSchema.nullable().optional().default(null)

export const studentSchema = z.object({
	id: z.string(),
	firstName: z.string(),
	lastName: z.string(),
	fullName: z.string().min(1),
	email: z.string().email().optional().or(z.literal('')),
	phone: z.string().optional(),
	level: z.string().optional(),
	special: z.string().optional(),
	status: studentStatusSchema,
	birthday: z.string().nullable(),
	notes: z.string().optional(),
	defaultLessonPrice: z.number().nonnegative(),
	defaultLessonDurationMinutes: z.number().int().positive(),
	packageMonths: z.number().int().nonnegative(),
	packageLessonsPerWeek: z.number().int().nonnegative(),
	packageLessonCount: z.number().int().nonnegative(),
	packageTotalPrice: z.number().nonnegative(),
	packageLessonPriceOverride: z.number().nonnegative().nullable(),
	currency: currencySchema,
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
		firstName: z.string().trim().optional().default(''),
		lastName: z.string().trim().optional().default(''),
		fullName: z.string().trim().optional().default(''),
		special: z.string().trim().optional().default(''),
		birthday: nullableIsoDateSchema,
		defaultLessonPrice: z.coerce.number().nonnegative().default(LESSON_PRICE_RUB.default),
		defaultLessonDurationMinutes: z.coerce.number().int().positive().default(DEFAULT_LESSON_DURATION_MINUTES),
		currency: currencySchema.default('RUB'),
		packageMonths: z.coerce.number().int().nonnegative().default(0),
		packageLessonsPerWeek: z.coerce.number().int().nonnegative().default(0),
		packageLessonCount: z.coerce.number().int().nonnegative().default(0),
		packageTotalPrice: z.coerce.number().nonnegative().default(0),
		packageLessonPriceOverride: z.coerce.number().nonnegative().nullable().optional().default(null),
	})
	.refine((input) => Boolean(input.firstName.trim() || input.fullName.trim()), {
		path: ['firstName'],
		message: 'First name is required',
	})
	.refine((input) => input.packageLessonPriceOverride !== null || isSupportedPackageMonths(input.packageMonths), {
		path: ['packageMonths'],
		message: 'Package length must be 0, 3, 5, or custom with a custom lesson price',
	})

export const updateStudentSchema = createStudentBaseSchema
	.extend({
		firstName: z.string().trim(),
		lastName: z.string().trim(),
		fullName: z.string().trim(),
		special: z.string().trim().optional(),
		birthday: nullableIsoDateSchema,
		defaultLessonPrice: z.coerce.number().nonnegative(),
		defaultLessonDurationMinutes: z.coerce.number().int().positive(),
		currency: currencySchema,
		packageMonths: z.coerce.number().int().nonnegative(),
		packageLessonsPerWeek: z.coerce.number().int().nonnegative(),
		packageLessonCount: z.coerce.number().int().nonnegative(),
		packageTotalPrice: z.coerce.number().nonnegative(),
		packageLessonPriceOverride: z.coerce.number().nonnegative().nullable(),
	})
	.partial()
	.refine((input) => Object.keys(input).length > 0, {
		message: 'At least one student field must be provided',
	})
	.refine(
		(input) =>
			input.packageMonths === undefined ||
			input.packageLessonPriceOverride !== undefined ||
			isSupportedPackageMonths(input.packageMonths),
		{
			path: ['packageMonths'],
			message: 'Package length must be 0, 3, 5, or custom with a custom lesson price',
		}
	)

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
	repeatWeekly: z.boolean(),
	topic: z.string().optional(),
	notes: z.string().optional(),
	status: lessonStatusSchema,
	studentIds: z
		.array(z.string())
		.min(1)
		.refine((studentIds) => new Set(studentIds).size === studentIds.length, {
			message: 'Student ids must be unique',
		}),
	createdAt: z.string(),
	updatedAt: z.string(),
})

export const lessonOccurrenceExceptionSchema = z.object({
	id: z.string(),
	lessonId: z.string(),
	occurrenceStartsAt: z.string(),
	replacementLessonId: z.string().optional(),
	reason: z.enum(['moved', 'deleted']),
	createdAt: z.string(),
})

export const createLessonSchema = lessonSchema
	.omit({
		id: true,
		createdAt: true,
		updatedAt: true,
	})
	.extend({
		durationMinutes: z.coerce.number().int().positive(),
		repeatWeekly: z.boolean().optional().default(false),
		repeatCount: z.coerce.number().int().min(1).max(50).optional().default(1),
	})

export const updateLessonSchema = createLessonSchema
	.extend({ applyToFuture: z.boolean().optional(), occurrenceStartsAt: isoDateTimeSchema.optional() })
	.partial()

export const deleteLessonQuerySchema = z.object({
	scope: z.enum(['current', 'series']).optional().default('series'),
	occurrenceStartsAt: isoDateTimeSchema.optional(),
})

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
	currency: currencySchema,
	paidAt: z.string(),
	method: paymentMethodSchema,
	comment: z.string().optional(),
	correctionOfPaymentId: z.string().optional(),
	packageId: z.string().optional(),
	idempotencyKey: z.string().trim().min(8).max(120).optional(),
	voidedAt: z.string().optional(),
	createdAt: z.string(),
})

export const createPaymentSchema = z.object({
	studentId: z.string(),
	amount: z.coerce.number().positive(),
	currency: currencySchema.optional(),
	paidAt: z.string(),
	method: paymentMethodSchema,
	comment: z.string().trim().optional(),
	correctionOfPaymentId: z.string().optional(),
	idempotencyKey: z.string().trim().min(8).max(120).optional(),
	packagePurchase: z.boolean().optional().default(false),
})

export const studentPackageSchema = z.object({
	id: z.string(),
	studentId: z.string(),
	status: packageInstanceStatusSchema,
	startsAt: z.string(),
	paidAt: z.string().optional(),
	packageMonths: z.number().int().nonnegative(),
	lessonsPerWeek: z.number().int().nonnegative(),
	purchasedLessonCount: z.number().int().nonnegative(),
	purchasedLessonUnits: z.number().nonnegative(),
	lessonPrice: z.number().nonnegative(),
	totalPrice: z.number().nonnegative(),
	currency: currencySchema,
	exhaustedAt: z.string().optional(),
	createdAt: z.string(),
})

export const lessonChargeSchema = z.object({
	id: z.string(),
	lessonId: z.string(),
	studentId: z.string(),
	attendanceRecordId: z.string(),
	packageId: z.string().optional(),
	amount: z.number().nonnegative(),
	currency: currencySchema,
	lessonUnits: z.number().nonnegative(),
	attendanceStatus: attendanceStatusSchema,
	voidedAt: z.string().optional(),
	createdAt: z.string(),
	updatedAt: z.string(),
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

export const calendarBlockSchema = z.object({
	id: z.string(),
	title: z.string().min(1),
	startsAt: z.string(),
	durationMinutes: z.number().int().positive(),
	externalEventId: z.string().nullable(),
	externalCalendarId: z.string().nullable(),
	syncStatus: calendarSyncStatusSchema,
	lastError: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
})

export const createCalendarBlockSchema = z.object({
	title: z.string().trim().min(1).max(160),
	startsAt: isoDateTimeSchema,
	durationMinutes: z.coerce.number().int().positive(),
})

export const updateCalendarBlockSchema = createCalendarBlockSchema
	.partial()
	.refine((input) => Object.keys(input).length > 0, {
		message: 'At least one calendar block field must be provided',
	})

export const calendarListEntrySchema = z.object({
	id: z.string(),
	name: z.string(),
	primary: z.boolean(),
	accessRole: z.string(),
})

export const calendarUpsertLessonEventSchema = z.object({
	lessonId: z.string(),
	syncPolicy: z.enum(['sync', 'skip']).default('sync'),
})

export const calendarBusyQuerySchema = z.object({
	startsAt: isoDateTimeSchema,
	durationMinutes: z.coerce.number().int().positive(),
	repeatWeekly: z.boolean().optional().default(false),
	repeatCount: z.coerce.number().int().min(1).max(50).optional().default(1),
	excludeLessonId: z.string().optional(),
})

export const calendarBusyIntervalSchema = z.object({
	calendarId: z.string(),
	calendarName: z.string(),
	title: z.string(),
	startsAt: z.string(),
	endsAt: z.string(),
})

export const dashboardSummarySchema = z.object({
	activeStudents: z.number().int().nonnegative(),
	todayLessonCount: z.number().int().nonnegative(),
	missingAttendanceCount: z.number().int().nonnegative(),
	overdueStudentCount: z.number().int().nonnegative(),
	monthIncomeRub: z.number().nonnegative().optional(),
	monthIncome: z.number().nonnegative(),
	monthIncomeByCurrency: currencyTotalsSchema.default({ RUB: 0, KZT: 0 }),
})

export { buildDashboardSummary, type DashboardSummaryInput } from './dashboard-policy'

export const studentCurrencyBalanceSchema = z.object({
	studentId: z.string(),
	currency: currencySchema,
	charged: z.number(),
	paid: z.number(),
	balance: z.number(),
	unpaidLessonCount: z.number().int().nonnegative(),
	overdue: z.boolean(),
})

export const studentBalanceSchema = studentCurrencyBalanceSchema.extend({
	packageProgress: z
		.object({
			packageId: z.string(),
			status: packageInstanceStatusSchema,
			totalUnits: z.number().nonnegative(),
			consumedUnits: z.number().nonnegative(),
			remainingUnits: z.number().nonnegative(),
			projectedPaymentDate: z.string().optional(),
			projectedPaymentLessonId: z.string().optional(),
			completedLessonIds: z.array(z.string()),
		})
		.optional(),
	nextPayment: z.object({
		status: z.enum([
			'due_now',
			'after_projected_lesson',
			'estimated_after',
			'after_next_lesson',
			'not_scheduled',
			'not_configured',
		]),
		dueNow: z.boolean(),
		projectedDate: z.string().optional(),
		amount: z.number().nonnegative(),
		currency: currencySchema,
	}),
	otherCurrencyBalances: z.array(studentCurrencyBalanceSchema).optional(),
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
		requestId: z.string().optional(),
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
	occurrenceExceptions: z.array(lessonOccurrenceExceptionSchema).default([]),
})

export const lessonMutationResponseSchema = z.object({
	ok: z.literal(true),
	lesson: lessonSchema,
})

export const attendanceMutationResponseSchema = z.object({
	ok: z.literal(true),
	attendance: z.array(attendanceRecordSchema),
})

export const paymentsResponseSchema = z.object({
	ok: z.literal(true),
	payments: z.array(paymentSchema),
	balances: z.array(studentBalanceSchema),
})

export const paymentMutationResponseSchema = z.object({
	ok: z.literal(true),
	payment: paymentSchema,
})

export const calendarResponseSchema = z.object({
	ok: z.literal(true),
	connection: calendarConnectionSchema,
	syncRecords: z.array(calendarSyncRecordSchema),
	blocks: z.array(calendarBlockSchema).default([]),
})

export const calendarConnectionResponseSchema = z.object({
	ok: z.literal(true),
	connection: calendarConnectionSchema,
})

export const calendarListResponseSchema = z.object({
	ok: z.literal(true),
	calendars: z.array(calendarListEntrySchema),
})

export const calendarBusyResponseSchema = z.object({
	ok: z.literal(true),
	busy: z.array(calendarBusyIntervalSchema),
})

export const calendarImportResponseSchema = z.object({
	ok: z.literal(true),
	checked: z.number().int().nonnegative(),
	updated: z.number().int().nonnegative(),
})

export const calendarProviderTokenResponseSchema = z.object({
	ok: z.literal(true),
	connection: calendarConnectionSchema,
})

export const calendarSyncResponseSchema = z.object({
	ok: z.literal(true),
	sync: calendarSyncRecordSchema,
})

export const calendarBlocksResponseSchema = z.object({
	ok: z.literal(true),
	blocks: z.array(calendarBlockSchema),
})

export const calendarBlockMutationResponseSchema = z.object({
	ok: z.literal(true),
	block: calendarBlockSchema,
})

export const dashboardResponseSchema = z.object({
	ok: z.literal(true),
	summary: dashboardSummarySchema,
})

export const sidebarSettingsResponseSchema = z.object({
	ok: z.literal(true),
	items: z.array(sidebarItemSchema),
})

export const themeSettingsResponseSchema = z.object({
	ok: z.literal(true),
	theme: crmThemeSettingsSchema,
})

export const petSettingsResponseSchema = z.object({
	ok: z.literal(true),
	settings: petSettingsSchema,
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
export type Currency = z.infer<typeof currencySchema>
export type PackageInstanceStatus = z.infer<typeof packageInstanceStatusSchema>
export type CalendarConnectionStatus = z.infer<typeof calendarConnectionStatusSchema>
export type CalendarSyncStatus = z.infer<typeof calendarSyncStatusSchema>
export type { PermissionKey, RoleKey }
export type Student = z.infer<typeof studentSchema>
export type CreateStudentInput = z.infer<typeof createStudentSchema>
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>
export type Lesson = z.infer<typeof lessonSchema>
export type LessonOccurrenceException = z.infer<typeof lessonOccurrenceExceptionSchema>
export type CreateLessonInput = z.infer<typeof createLessonSchema>
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>
export type DeleteLessonQuery = z.infer<typeof deleteLessonQuerySchema>
export type ListLessonsQuery = z.infer<typeof listLessonsQuerySchema>
export type AttendanceRecord = z.infer<typeof attendanceRecordSchema>
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>
export type Payment = z.infer<typeof paymentSchema>
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>
export type StudentPackage = z.infer<typeof studentPackageSchema>
export type LessonCharge = z.infer<typeof lessonChargeSchema>
export type CalendarConnection = z.infer<typeof calendarConnectionSchema>
export type CalendarSyncRecord = z.infer<typeof calendarSyncRecordSchema>
export type CalendarBlock = z.infer<typeof calendarBlockSchema>
export type CreateCalendarBlockInput = z.infer<typeof createCalendarBlockSchema>
export type UpdateCalendarBlockInput = z.infer<typeof updateCalendarBlockSchema>
export type CalendarListEntry = z.infer<typeof calendarListEntrySchema>
export type CalendarUpsertLessonEventInput = z.infer<typeof calendarUpsertLessonEventSchema>
export type CalendarBusyQuery = z.infer<typeof calendarBusyQuerySchema>
export type CalendarBusyInterval = z.infer<typeof calendarBusyIntervalSchema>
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>
export type StudentCurrencyBalance = z.infer<typeof studentCurrencyBalanceSchema>
export type StudentBalance = z.infer<typeof studentBalanceSchema>
export type UpdateSidebarSettingsInput = z.infer<typeof updateSidebarSettingsSchema>
export type CrmThemeColors = z.infer<typeof crmThemeColorsSchema>
export type CrmThemeSettings = z.infer<typeof crmThemeSettingsSchema>
export type CrmErrorLogEntry = z.infer<typeof crmErrorLogEntrySchema>
export type SaveCrmErrorInput = z.infer<typeof saveCrmErrorSchema>
export type ValidationIssue = z.infer<typeof validationIssueSchema>
export type ValidationErrorDetails = z.infer<typeof validationErrorDetailsSchema>
export type StudentIdParam = z.infer<typeof studentIdParamSchema>
export type LessonIdParam = z.infer<typeof lessonIdParamSchema>
export type PaymentIdParam = z.infer<typeof paymentIdParamSchema>
export type ErrorIdParam = z.infer<typeof errorIdParamSchema>
export type CalendarBlockIdParam = z.infer<typeof calendarBlockIdParamSchema>
export type ApiErrorResponse = z.infer<typeof apiErrorSchema>
export type AuthMeResponse = z.infer<typeof authMeResponseSchema>
export type ListStudentsResponse = z.infer<typeof listStudentsResponseSchema>
export type StudentMutationResponse = z.infer<typeof studentMutationResponseSchema>
export type LessonsResponse = z.infer<typeof lessonsResponseSchema>
export type LessonMutationResponse = z.infer<typeof lessonMutationResponseSchema>
export type AttendanceMutationResponse = z.infer<typeof attendanceMutationResponseSchema>
export type PaymentsResponse = z.infer<typeof paymentsResponseSchema>
export type PaymentMutationResponse = z.infer<typeof paymentMutationResponseSchema>
export type CalendarResponse = z.infer<typeof calendarResponseSchema>
export type CalendarConnectionResponse = z.infer<typeof calendarConnectionResponseSchema>
export type CalendarListResponse = z.infer<typeof calendarListResponseSchema>
export type CalendarBusyResponse = z.infer<typeof calendarBusyResponseSchema>
export type CalendarImportResponse = z.infer<typeof calendarImportResponseSchema>
export type CalendarProviderTokenResponse = z.infer<typeof calendarProviderTokenResponseSchema>
export type CalendarSyncResponse = z.infer<typeof calendarSyncResponseSchema>
export type CalendarBlocksResponse = z.infer<typeof calendarBlocksResponseSchema>
export type CalendarBlockMutationResponse = z.infer<typeof calendarBlockMutationResponseSchema>
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>
export type SidebarSettingsResponse = z.infer<typeof sidebarSettingsResponseSchema>
export type ThemeSettingsResponse = z.infer<typeof themeSettingsResponseSchema>
export type PetSettingsResponse = z.infer<typeof petSettingsResponseSchema>
export type CrmErrorLogResponse = z.infer<typeof crmErrorLogResponseSchema>
export type CrmErrorLogMutationResponse = z.infer<typeof crmErrorLogMutationResponseSchema>
