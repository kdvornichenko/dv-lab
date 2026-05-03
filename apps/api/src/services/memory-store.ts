import {
	DEFAULT_CRM_THEME_SETTINGS,
	DEFAULT_LESSON_DURATION_MINUTES,
	DEFAULT_PET_SETTINGS,
	DEFAULT_SIDEBAR_ITEMS,
	GOOGLE_CALENDAR_REQUIRED_SCOPES,
	BILLABLE_ATTENDANCE_STATUSES,
	buildDashboardSummary,
	calculateMonthlyLessonCount,
	calculateMonthlyTotalPrice,
	calculatePackageLessonPriceRub,
	calculatePackageLessonCount,
	calculatePackageTotalPriceRub,
	getLessonDurationUnits,
	type AttendanceStatus,
	type AttendanceRecord,
	type CalendarBlock,
	type CalendarConnection,
	type CalendarSyncRecord,
	type CreateCalendarBlockInput,
	type CreateLessonInput,
	type CreatePaymentInput,
	type CreateStudentInput,
	type CrmErrorLogEntry,
	type CrmThemeSettings,
	type Currency,
	type ListLessonsQuery,
	type ListStudentsQuery,
	type Lesson,
	type LessonOccurrenceException,
	type MarkAttendanceInput,
	type Payment,
	type PetSettings,
	type SaveCrmErrorInput,
	type SidebarItem,
	type Student,
	type StudentBalance,
	type StudentCurrencyBalance,
	type StudentPackage,
	type LessonCharge,
	type UpdateCalendarBlockInput,
	type UpdateLessonInput,
	type UpdateStudentInput,
} from '@teacher-crm/api-types'
import { calculateStudentBalances } from '@teacher-crm/db'

import type { StoreScope } from './store-scope'

type TeacherStoreState = {
	students: Map<string, Student>
	lessons: Map<string, Lesson>
	attendance: Map<string, AttendanceRecord>
	payments: Map<string, Payment>
	packages: Map<string, StudentPackage>
	lessonCharges: Map<string, LessonCharge>
	calendarConnection: CalendarConnection
	calendarSyncRecords: Map<string, CalendarSyncRecord>
	calendarBlocks: Map<string, CalendarBlock>
	occurrenceExceptions: Map<string, LessonOccurrenceException>
	sidebarItems: SidebarItem[]
	errorLogs: Map<string, CrmErrorLogEntry>
	theme: CrmThemeSettings
	petSettings: PetSettings
}

const stores = new Map<string, TeacherStoreState>()

const now = () => new Date().toISOString()
const id = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`
const hasGoogleCalendarGrant = (grantedScopes: readonly string[], tokenAvailable: boolean) =>
	tokenAvailable && GOOGLE_CALENDAR_REQUIRED_SCOPES.every((scope) => grantedScopes.includes(scope))
const isBillableAttendanceStatus = (status: AttendanceStatus) =>
	(BILLABLE_ATTENDANCE_STATUSES as readonly string[]).includes(status)
const lessonUnits = (durationMinutes: number) =>
	getLessonDurationUnits(durationMinutes || DEFAULT_LESSON_DURATION_MINUTES)
const attendanceForLessonStatus = (status: Lesson['status']): Pick<AttendanceRecord, 'status' | 'billable'> => {
	if (status === 'completed') return { status: 'attended', billable: true }
	if (status === 'no_show') return { status: 'no_show', billable: true }
	if (status === 'cancelled') return { status: 'cancelled', billable: false }
	if (status === 'rescheduled') return { status: 'rescheduled', billable: false }
	return { status: 'planned', billable: true }
}
const splitName = (value: string | undefined) => {
	const parts = value?.trim().split(/\s+/).filter(Boolean) ?? []
	return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') }
}
const studentFullName = (student: Pick<Student, 'firstName' | 'lastName' | 'fullName'>) =>
	[student.firstName, student.lastName].filter(Boolean).join(' ').trim() || student.fullName
const studentShortName = (student: Pick<Student, 'firstName' | 'lastName' | 'fullName'>) => {
	const fallbackName = splitName(student.fullName)
	const firstName = student.firstName || fallbackName.firstName || student.fullName
	const lastName = student.lastName || fallbackName.lastName
	const lastInitial = lastName.trim() ? `${lastName.trim()[0]}.` : ''
	return [firstName, lastInitial].filter(Boolean).join(' ')
}
const resolvedPackageLessonCount = (
	student: Pick<Student, 'packageMonths' | 'packageLessonsPerWeek' | 'packageLessonCount'>
) => {
	const derivedLessonCount = calculatePackageLessonCount({
		packageMonths: student.packageMonths,
		packageLessonsPerWeek: student.packageLessonsPerWeek,
	})
	return derivedLessonCount > 0 ? derivedLessonCount : student.packageLessonCount
}
const studentPackageTotal = (
	student: Pick<
		Student,
		| 'defaultLessonPrice'
		| 'defaultLessonDurationMinutes'
		| 'packageMonths'
		| 'packageLessonCount'
		| 'packageLessonPriceOverride'
	>
) =>
	calculatePackageTotalPriceRub({
		defaultLessonPrice: student.defaultLessonPrice,
		defaultLessonDurationMinutes: student.defaultLessonDurationMinutes,
		packageMonths: student.packageMonths,
		packageLessonCount: student.packageLessonCount,
		packageLessonPriceOverride: student.packageLessonPriceOverride,
	})
const studentPackageLessonPrice = (
	student: Pick<
		Student,
		'defaultLessonPrice' | 'defaultLessonDurationMinutes' | 'packageMonths' | 'packageLessonPriceOverride'
	>,
	durationMinutes = student.defaultLessonDurationMinutes
) =>
	calculatePackageLessonPriceRub({
		defaultLessonPrice: student.defaultLessonPrice,
		defaultLessonDurationMinutes: durationMinutes,
		packageMonths: student.packageMonths,
		packageLessonPriceOverride: student.packageLessonPriceOverride,
	})
const studentPackageUnits = (student: Pick<Student, 'packageLessonCount' | 'defaultLessonDurationMinutes'>) =>
	student.packageLessonCount * lessonUnits(student.defaultLessonDurationMinutes)
const studentMonthlyLessonCount = (student: Pick<Student, 'packageLessonsPerWeek'>) =>
	calculateMonthlyLessonCount({ lessonsPerWeek: student.packageLessonsPerWeek })
const studentMonthlyTotal = (
	student: Pick<
		Student,
		'defaultLessonPrice' | 'defaultLessonDurationMinutes' | 'packageLessonsPerWeek' | 'packageLessonPriceOverride'
	>
) =>
	calculateMonthlyTotalPrice({
		defaultLessonPrice: student.defaultLessonPrice,
		defaultLessonDurationMinutes: student.defaultLessonDurationMinutes,
		lessonsPerWeek: student.packageLessonsPerWeek,
		packageLessonPriceOverride: student.packageLessonPriceOverride,
	})
const paymentDate = (value: string) => value.slice(0, 10)

function createStoreState(): TeacherStoreState {
	return {
		students: new Map<string, Student>(),
		lessons: new Map<string, Lesson>(),
		attendance: new Map<string, AttendanceRecord>(),
		payments: new Map<string, Payment>(),
		packages: new Map<string, StudentPackage>(),
		lessonCharges: new Map<string, LessonCharge>(),
		calendarConnection: {
			id: 'cal_google',
			provider: 'google',
			email: null,
			status: 'not_connected',
			requiredScopes: [...GOOGLE_CALENDAR_REQUIRED_SCOPES],
			grantedScopes: [],
			tokenAvailable: false,
			selectedCalendarId: null,
			selectedCalendarName: null,
			connectedAt: null,
			updatedAt: now(),
		},
		calendarSyncRecords: new Map<string, CalendarSyncRecord>(),
		calendarBlocks: new Map<string, CalendarBlock>(),
		occurrenceExceptions: new Map<string, LessonOccurrenceException>(),
		sidebarItems: DEFAULT_SIDEBAR_ITEMS.map((item) => ({ ...item })),
		errorLogs: new Map<string, CrmErrorLogEntry>(),
		theme: {
			radius: DEFAULT_CRM_THEME_SETTINGS.radius,
			headingFont: DEFAULT_CRM_THEME_SETTINGS.headingFont,
			bodyFont: DEFAULT_CRM_THEME_SETTINGS.bodyFont,
			numberFont: DEFAULT_CRM_THEME_SETTINGS.numberFont,
			fontSizes: { ...DEFAULT_CRM_THEME_SETTINGS.fontSizes },
			colors: { ...DEFAULT_CRM_THEME_SETTINGS.colors },
		},
		petSettings: { ...DEFAULT_PET_SETTINGS },
	}
}

function storeKey(scope: StoreScope) {
	return `${scope.storeNamespace ?? 'default'}:${scope.teacherId}`
}

export function resetMemoryStore(storeNamespace?: string) {
	const prefix = `${storeNamespace ?? 'default'}:`
	for (const key of stores.keys()) {
		if (key.startsWith(prefix)) stores.delete(key)
	}
}

function stateFor(scope: StoreScope) {
	const key = storeKey(scope)
	const existing = stores.get(key)
	if (existing) return existing

	const created = createStoreState()
	stores.set(key, created)
	return created
}

function packageConsumedUnits(state: TeacherStoreState, packageId: string) {
	return Array.from(state.lessonCharges.values())
		.filter((charge) => charge.packageId === packageId && !charge.voidedAt)
		.reduce((sum, charge) => sum + charge.lessonUnits, 0)
}

function findPackageForCharge(state: TeacherStoreState, student: Student, lesson: Lesson) {
	if (student.billingMode !== 'package') return undefined
	const requiredUnits = lessonUnits(lesson.durationMinutes)

	return Array.from(state.packages.values())
		.filter((studentPackage) => {
			if (studentPackage.studentId !== student.id) return false
			if (studentPackage.currency !== student.currency) return false
			if (studentPackage.status === 'cancelled') return false
			if (studentPackage.startsAt > paymentDate(lesson.startsAt)) return false
			return studentPackage.purchasedLessonUnits - packageConsumedUnits(state, studentPackage.id) >= requiredUnits
		})
		.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.createdAt.localeCompare(b.createdAt))[0]
}

function chargeAmount(student: Student, lesson: Lesson) {
	const packagePrice = studentPackageLessonPrice(student, lesson.durationMinutes)
	if (student.billingMode === 'package' && packagePrice > 0) return packagePrice
	return student.defaultLessonPrice * lessonUnits(lesson.durationMinutes)
}

function packageProgress(
	state: TeacherStoreState,
	student: Student,
	relatedLessons: Lesson[],
	nowDate = new Date()
): StudentBalance['packageProgress'] {
	if (student.billingMode !== 'package') return undefined
	const candidate = Array.from(state.packages.values())
		.filter(
			(studentPackage) =>
				studentPackage.studentId === student.id &&
				studentPackage.currency === student.currency &&
				studentPackage.status !== 'cancelled'
		)
		.map((studentPackage) => {
			const consumedUnits = packageConsumedUnits(state, studentPackage.id)
			return {
				studentPackage,
				consumedUnits,
				remainingUnits: Math.max(studentPackage.purchasedLessonUnits - consumedUnits, 0),
			}
		})
		.filter((item) => item.remainingUnits > 0)
		.sort((a, b) => a.studentPackage.startsAt.localeCompare(b.studentPackage.startsAt))[0]

	if (!candidate) return undefined

	let scheduledUnits = 0
	let projectedPaymentDate: string | undefined
	let projectedPaymentLessonId: string | undefined
	const futureLessons = relatedLessons
		.filter((lesson) => lesson.status === 'planned' && new Date(lesson.startsAt).getTime() >= nowDate.getTime())
		.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
	for (const lesson of futureLessons) {
		scheduledUnits += lessonUnits(lesson.durationMinutes)
		if (scheduledUnits >= candidate.remainingUnits) {
			projectedPaymentDate = lesson.startsAt
			projectedPaymentLessonId = lesson.id
			break
		}
	}
	if (!projectedPaymentDate && candidate.studentPackage.lessonsPerWeek > 0) {
		const weeklyUnits = candidate.studentPackage.lessonsPerWeek * lessonUnits(student.defaultLessonDurationMinutes)
		const estimated = new Date(futureLessons.at(-1)?.startsAt ?? nowDate)
		estimated.setDate(
			estimated.getDate() + Math.ceil(Math.max(candidate.remainingUnits - scheduledUnits, 0) / weeklyUnits) * 7
		)
		projectedPaymentDate = estimated.toISOString()
	}

	return {
		packageId: candidate.studentPackage.id,
		status: candidate.remainingUnits <= 0 ? 'exhausted' : candidate.studentPackage.status,
		totalUnits: candidate.studentPackage.purchasedLessonUnits,
		consumedUnits: candidate.consumedUnits,
		remainingUnits: candidate.remainingUnits,
		projectedPaymentDate,
		projectedPaymentLessonId,
		completedLessonIds: Array.from(state.lessonCharges.values())
			.filter((charge) => charge.packageId === candidate.studentPackage.id && !charge.voidedAt)
			.map((charge) => charge.lessonId),
	}
}

function nextPayment(
	student: Student,
	relatedLessons: Lesson[],
	balance: Omit<StudentBalance, 'packageProgress' | 'nextPayment'>,
	progress: StudentBalance['packageProgress']
) {
	if (balance.overdue) {
		return {
			status: 'due_now' as const,
			dueNow: true,
			amount: Math.abs(balance.balance),
			currency: balance.currency as Currency,
		}
	}
	if (student.billingMode === 'package') {
		const amount = studentPackageTotal(student)
		if (student.packageLessonCount <= 0 || student.packageLessonsPerWeek <= 0) {
			return { status: 'not_configured' as const, dueNow: false, amount: 0, currency: student.currency }
		}
		if (!progress || progress.remainingUnits <= 0) {
			return { status: 'due_now' as const, dueNow: true, amount, currency: student.currency }
		}
		if (progress.projectedPaymentDate) {
			return {
				status: progress.projectedPaymentLessonId ? ('after_projected_lesson' as const) : ('estimated_after' as const),
				dueNow: false,
				projectedDate: progress.projectedPaymentDate,
				amount,
				currency: student.currency,
			}
		}
		return { status: 'not_scheduled' as const, dueNow: false, amount, currency: student.currency }
	}
	if (student.billingMode === 'monthly') {
		const amount = studentMonthlyTotal(student)
		const requiredUnits = studentMonthlyLessonCount(student) * lessonUnits(student.defaultLessonDurationMinutes)
		if (amount <= 0 || requiredUnits <= 0) {
			return { status: 'not_configured' as const, dueNow: false, amount: 0, currency: student.currency }
		}

		let scheduledUnits = 0
		const futureLessons = relatedLessons
			.filter((lesson) => lesson.status === 'planned' && new Date(lesson.startsAt).getTime() >= Date.now())
			.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
		for (const lesson of futureLessons) {
			scheduledUnits += lessonUnits(lesson.durationMinutes)
			if (scheduledUnits >= requiredUnits) {
				return {
					status: 'after_projected_lesson' as const,
					dueNow: false,
					projectedDate: lesson.startsAt,
					amount,
					currency: student.currency,
				}
			}
		}

		const weeklyUnits = student.packageLessonsPerWeek * lessonUnits(student.defaultLessonDurationMinutes)
		if (weeklyUnits > 0) {
			const estimated = new Date(futureLessons.at(-1)?.startsAt ?? new Date())
			estimated.setDate(estimated.getDate() + Math.ceil(Math.max(requiredUnits - scheduledUnits, 0) / weeklyUnits) * 7)
			return {
				status: 'estimated_after' as const,
				dueNow: false,
				projectedDate: estimated.toISOString(),
				amount,
				currency: student.currency,
			}
		}

		return { status: 'not_scheduled' as const, dueNow: false, amount, currency: student.currency }
	}
	const nextLesson = relatedLessons
		.filter((lesson) => lesson.status === 'planned' && new Date(lesson.startsAt).getTime() >= Date.now())
		.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0]
	return nextLesson
		? {
				status: 'after_next_lesson' as const,
				dueNow: false,
				projectedDate: nextLesson.startsAt,
				amount: chargeAmount(student, nextLesson),
				currency: student.currency,
			}
		: { status: 'not_scheduled' as const, dueNow: false, amount: 0, currency: student.currency }
}

function normalizeCurrencyBalance(balance: {
	studentId: string
	currency: string
	charged: number
	paid: number
	balance: number
	unpaidLessonCount: number
	overdue: boolean
}): StudentCurrencyBalance {
	return { ...balance, currency: balance.currency as Currency }
}

export const memoryStore = {
	listStudents(scope: StoreScope, filters: ListStudentsQuery = { status: 'all', search: '' }) {
		const search = filters.search.trim().toLocaleLowerCase()
		return Array.from(stateFor(scope).students.values())
			.filter((student) => filters.status === 'all' || student.status === filters.status)
			.filter((student) => {
				if (!search) return true
				return [student.firstName, student.lastName, student.fullName, student.level, student.special, student.notes]
					.filter(Boolean)
					.some((value) => value!.toLocaleLowerCase().includes(search))
			})
			.sort((a, b) => a.fullName.localeCompare(b.fullName))
	},

	createStudent(scope: StoreScope, input: CreateStudentInput) {
		const state = stateFor(scope)
		const fallbackName = splitName(input.fullName)
		const firstName = input.firstName || fallbackName.firstName
		const lastName = input.lastName || fallbackName.lastName
		const packageLessonCount = resolvedPackageLessonCount(input)
		const student: Student = {
			...input,
			firstName,
			lastName,
			fullName: [firstName, lastName].filter(Boolean).join(' ').trim() || input.fullName,
			special: input.special ?? '',
			birthday: input.birthday ?? null,
			currency: input.currency,
			defaultLessonDurationMinutes: input.defaultLessonDurationMinutes ?? DEFAULT_LESSON_DURATION_MINUTES,
			packageLessonCount,
			packageLessonPriceOverride: input.packageLessonPriceOverride ?? null,
			packageTotalPrice: studentPackageTotal({
				defaultLessonPrice: input.defaultLessonPrice,
				defaultLessonDurationMinutes: input.defaultLessonDurationMinutes ?? DEFAULT_LESSON_DURATION_MINUTES,
				packageMonths: input.packageMonths,
				packageLessonCount,
				packageLessonPriceOverride: input.packageLessonPriceOverride ?? null,
			}),
			id: id('stu'),
			createdAt: now(),
			updatedAt: now(),
		}
		state.students.set(student.id, student)
		return student
	},

	updateStudent(scope: StoreScope, studentId: string, input: UpdateStudentInput) {
		const state = stateFor(scope)
		const existing = state.students.get(studentId)
		if (!existing) return null
		const updated: Student = { ...existing, ...input, updatedAt: now() }
		updated.fullName = studentFullName(updated)
		updated.birthday = updated.birthday ?? null
		updated.packageLessonPriceOverride = updated.packageLessonPriceOverride ?? null
		updated.packageLessonCount = resolvedPackageLessonCount(updated)
		updated.packageTotalPrice = studentPackageTotal(updated)
		state.students.set(studentId, updated)
		if (input.firstName !== undefined || input.lastName !== undefined || input.fullName !== undefined) {
			for (const lesson of state.lessons.values()) {
				if (!lesson.studentIds.includes(studentId)) continue
				state.lessons.set(lesson.id, {
					...lesson,
					title: studentShortName(updated),
					updatedAt: now(),
				})
			}
		}
		return updated
	},

	deleteStudent(scope: StoreScope, studentId: string) {
		const state = stateFor(scope)
		const existing = state.students.get(studentId)
		if (!existing) return null

		state.students.delete(studentId)
		for (const [paymentId, payment] of state.payments) {
			if (payment.studentId === studentId) state.payments.delete(paymentId)
		}
		for (const [attendanceKey, attendance] of state.attendance) {
			if (attendance.studentId === studentId) state.attendance.delete(attendanceKey)
		}
		for (const [chargeId, charge] of state.lessonCharges) {
			if (charge.studentId === studentId) state.lessonCharges.delete(chargeId)
		}
		for (const [packageId, studentPackage] of state.packages) {
			if (studentPackage.studentId === studentId) state.packages.delete(packageId)
		}
		for (const lesson of state.lessons.values()) {
			if (lesson.studentIds.includes(studentId)) {
				state.lessons.set(lesson.id, {
					...lesson,
					studentIds: lesson.studentIds.filter((id) => id !== studentId),
					updatedAt: now(),
				})
			}
		}

		return existing
	},

	listLessons(
		scope: StoreScope,
		filters: ListLessonsQuery = { status: 'all', studentId: '', dateFrom: '', dateTo: '' }
	) {
		return Array.from(stateFor(scope).lessons.values())
			.filter((lesson) => filters.status === 'all' || lesson.status === filters.status)
			.filter((lesson) => !filters.studentId || lesson.studentIds.includes(filters.studentId))
			.filter((lesson) => !filters.dateFrom || lesson.startsAt >= `${filters.dateFrom}T00:00:00.000Z`)
			.filter((lesson) => !filters.dateTo || lesson.startsAt <= `${filters.dateTo}T23:59:59.999Z`)
			.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
	},

	createLesson(scope: StoreScope, input: CreateLessonInput) {
		const state = stateFor(scope)
		const lesson: Lesson = {
			...input,
			repeatWeekly: input.repeatWeekly,
			id: id('les'),
			createdAt: now(),
			updatedAt: now(),
		}
		state.lessons.set(lesson.id, lesson)
		const attendancePatch = attendanceForLessonStatus(lesson.status)
		for (const studentId of lesson.studentIds) {
			const key = `${lesson.id}:${studentId}`
			state.attendance.set(key, {
				id: state.attendance.get(key)?.id ?? id('att'),
				lessonId: lesson.id,
				studentId,
				status: attendancePatch.status,
				billable: attendancePatch.billable,
				note: state.attendance.get(key)?.note ?? '',
				updatedAt: now(),
			})
		}
		this.syncLessonChargesForLesson(scope, lesson.id)
		return lesson
	},

	updateLesson(scope: StoreScope, lessonId: string, input: UpdateLessonInput) {
		const state = stateFor(scope)
		const existing = state.lessons.get(lessonId)
		if (!existing) return null
		const updated: Lesson = { ...existing, ...input, updatedAt: now() }
		state.lessons.set(lessonId, updated)
		if (input.studentIds !== undefined) {
			const studentIds = new Set(updated.studentIds)
			for (const [attendanceKey, attendance] of state.attendance) {
				if (attendance.lessonId === lessonId && !studentIds.has(attendance.studentId)) {
					state.attendance.delete(attendanceKey)
					for (const [chargeId, charge] of state.lessonCharges) {
						if (charge.attendanceRecordId === attendance.id) state.lessonCharges.delete(chargeId)
					}
				}
			}
		}
		if (input.status !== undefined || input.studentIds !== undefined) {
			const attendancePatch = attendanceForLessonStatus(updated.status)
			for (const studentId of updated.studentIds) {
				const key = `${lessonId}:${studentId}`
				state.attendance.set(key, {
					id: state.attendance.get(key)?.id ?? id('att'),
					lessonId,
					studentId,
					status: attendancePatch.status,
					billable: attendancePatch.billable,
					note: state.attendance.get(key)?.note ?? '',
					updatedAt: now(),
				})
			}
		}
		this.syncLessonChargesForLesson(scope, lessonId)
		this.ensureCalendarSyncRecord(scope, lessonId, 'not_synced')
		return updated
	},

	deleteLesson(scope: StoreScope, lessonId: string) {
		const state = stateFor(scope)
		const existing = state.lessons.get(lessonId)
		if (!existing) return null

		state.lessons.delete(lessonId)
		for (const [attendanceKey, attendance] of state.attendance) {
			if (attendance.lessonId === lessonId) state.attendance.delete(attendanceKey)
		}
		for (const [chargeId, charge] of state.lessonCharges) {
			if (charge.lessonId === lessonId) state.lessonCharges.delete(chargeId)
		}
		for (const [syncKey, syncRecord] of state.calendarSyncRecords) {
			if (syncRecord.lessonId === lessonId) state.calendarSyncRecords.delete(syncKey)
		}
		for (const [exceptionKey, exception] of state.occurrenceExceptions) {
			if (exception.lessonId === lessonId || exception.replacementLessonId === lessonId) {
				state.occurrenceExceptions.delete(exceptionKey)
			}
		}

		return existing
	},

	listLessonOccurrenceExceptions(scope: StoreScope) {
		return Array.from(stateFor(scope).occurrenceExceptions.values())
	},

	upsertLessonOccurrenceException(
		scope: StoreScope,
		input: {
			lessonId: string
			occurrenceStartsAt: string
			replacementLessonId?: string
			reason: LessonOccurrenceException['reason']
		}
	) {
		const state = stateFor(scope)
		const key = `${input.lessonId}:${input.occurrenceStartsAt}`
		const existing = state.occurrenceExceptions.get(key)
		const exception: LessonOccurrenceException = {
			id: existing?.id ?? id('exc'),
			lessonId: input.lessonId,
			occurrenceStartsAt: input.occurrenceStartsAt,
			replacementLessonId: input.replacementLessonId,
			reason: input.reason,
			createdAt: existing?.createdAt ?? now(),
		}
		state.occurrenceExceptions.set(key, exception)
		return exception
	},

	markAttendance(scope: StoreScope, input: MarkAttendanceInput) {
		const state = stateFor(scope)
		const updated: AttendanceRecord[] = []
		for (const record of input.records) {
			const key = `${input.lessonId}:${record.studentId}`
			const nextRecord: AttendanceRecord = {
				id: state.attendance.get(key)?.id ?? id('att'),
				lessonId: input.lessonId,
				studentId: record.studentId,
				status: record.status,
				billable: record.billable,
				note: record.note,
				updatedAt: now(),
			}
			state.attendance.set(key, nextRecord)
			updated.push(nextRecord)
		}
		this.syncLessonChargesForLesson(scope, input.lessonId)
		return updated
	},

	listAttendance(scope: StoreScope) {
		return Array.from(stateFor(scope).attendance.values())
	},

	createPackageForPayment(scope: StoreScope, student: Student, paidAt: string) {
		const studentPackage: StudentPackage = {
			id: id('pkg'),
			studentId: student.id,
			status: 'active',
			startsAt: paymentDate(paidAt),
			paidAt: paymentDate(paidAt),
			packageMonths: student.packageMonths,
			lessonsPerWeek: student.packageLessonsPerWeek,
			purchasedLessonCount: student.packageLessonCount,
			purchasedLessonUnits: studentPackageUnits(student),
			lessonPrice: studentPackageLessonPrice(student),
			totalPrice: studentPackageTotal(student),
			currency: student.currency,
			createdAt: now(),
		}
		stateFor(scope).packages.set(studentPackage.id, studentPackage)
		return studentPackage
	},

	syncLessonChargesForLesson(scope: StoreScope, lessonId?: string) {
		const state = stateFor(scope)
		const records = Array.from(state.attendance.values()).filter((record) => !lessonId || record.lessonId === lessonId)
		for (const record of records) {
			const student = state.students.get(record.studentId)
			const lesson = state.lessons.get(record.lessonId)
			const existingCharge = Array.from(state.lessonCharges.values()).find(
				(charge) => charge.attendanceRecordId === record.id
			)
			if (!student || !lesson) continue
			if (!record.billable || !isBillableAttendanceStatus(record.status)) {
				if (existingCharge && !existingCharge.voidedAt) {
					state.lessonCharges.set(existingCharge.id, { ...existingCharge, voidedAt: now(), updatedAt: now() })
				}
				continue
			}
			const existingPackage = existingCharge?.packageId ? state.packages.get(existingCharge.packageId) : undefined
			const studentPackage =
				existingPackage && existingPackage.status !== 'cancelled' && existingPackage.currency === student.currency
					? existingPackage
					: findPackageForCharge(state, student, lesson)
			const charge: LessonCharge = {
				id: existingCharge?.id ?? id('chg'),
				lessonId: lesson.id,
				studentId: student.id,
				attendanceRecordId: record.id,
				packageId: studentPackage?.id,
				amount: existingCharge?.amount ?? chargeAmount(student, lesson),
				currency: existingCharge?.currency ?? student.currency,
				lessonUnits: existingCharge?.lessonUnits ?? lessonUnits(lesson.durationMinutes),
				attendanceStatus: record.status,
				voidedAt: undefined,
				createdAt: existingCharge?.createdAt ?? now(),
				updatedAt: now(),
			}
			state.lessonCharges.set(charge.id, charge)
		}
	},

	createPayment(scope: StoreScope, input: CreatePaymentInput) {
		const state = stateFor(scope)
		if (input.idempotencyKey) {
			const existing = Array.from(state.payments.values()).find(
				(payment) => payment.idempotencyKey === input.idempotencyKey
			)
			if (existing) return existing
		}

		const student = state.students.get(input.studentId)
		if (!student) throw new Error('Student not found for payment')
		const studentPackage =
			input.packagePurchase && student.billingMode === 'package'
				? this.createPackageForPayment(scope, student, input.paidAt)
				: undefined
		const payment: Payment = {
			studentId: input.studentId,
			amount: input.amount,
			currency:
				input.packagePurchase && student.billingMode === 'package'
					? student.currency
					: (input.currency ?? student.currency),
			paidAt: input.paidAt,
			method: input.method,
			comment: input.comment,
			correctionOfPaymentId: input.correctionOfPaymentId,
			packageId: studentPackage?.id,
			idempotencyKey: input.idempotencyKey,
			id: id('pay'),
			createdAt: now(),
		}
		state.payments.set(payment.id, payment)
		return payment
	},

	deletePayment(scope: StoreScope, paymentId: string) {
		const state = stateFor(scope)
		const payment = state.payments.get(paymentId)
		if (!payment || payment.voidedAt) return null
		const voidedPayment: Payment = { ...payment, voidedAt: now() }
		state.payments.set(paymentId, voidedPayment)
		if (payment.packageId) this.cancelPackage(scope, payment.packageId)
		return voidedPayment
	},

	cancelPackage(scope: StoreScope, packageId: string) {
		const state = stateFor(scope)
		const studentPackage = state.packages.get(packageId)
		if (!studentPackage) return null
		const cancelled: StudentPackage = {
			...studentPackage,
			status: 'cancelled',
			exhaustedAt: now(),
		}
		state.packages.set(packageId, cancelled)
		for (const [chargeId, charge] of state.lessonCharges) {
			if (charge.packageId === packageId) {
				state.lessonCharges.set(chargeId, { ...charge, packageId: undefined, updatedAt: now() })
			}
		}
		return cancelled
	},

	listPayments(scope: StoreScope) {
		return Array.from(stateFor(scope).payments.values())
			.filter((payment) => !payment.voidedAt)
			.sort((a, b) => b.paidAt.localeCompare(a.paidAt))
	},

	listStudentBalances(scope: StoreScope): StudentBalance[] {
		const state = stateFor(scope)
		this.syncLessonChargesForLesson(scope)
		const charges = Array.from(state.lessonCharges.values()).map((charge) => ({
			studentId: charge.studentId,
			amount: charge.amount,
			currency: charge.currency,
			billable: !charge.voidedAt,
		}))
		const payments = Array.from(state.payments.values()).flatMap((payment) => {
			if (payment.voidedAt) return []
			if (!payment.studentId || typeof payment.amount !== 'number') return []
			return [{ studentId: payment.studentId, amount: payment.amount, currency: payment.currency }]
		})

		const balances = calculateStudentBalances(charges, payments)
		const balanceKey = (studentId: string, currency: string) => `${studentId}:${currency}`
		const balancesByStudentCurrency = new Map(
			balances.map((balance) => [balanceKey(balance.studentId, balance.currency), balance])
		)
		return Array.from(state.students.values()).map((student) => {
			const relatedLessons = Array.from(state.lessons.values()).filter((lesson) =>
				lesson.studentIds.includes(student.id)
			)
			const base = balancesByStudentCurrency.get(balanceKey(student.id, student.currency)) ?? {
				studentId: student.id,
				currency: student.currency,
				charged: 0,
				paid: 0,
				balance: 0,
				unpaidLessonCount: 0,
				overdue: false,
			}
			const normalizedBase = normalizeCurrencyBalance(base)
			const otherCurrencyBalances = balances
				.filter((balance) => balance.studentId === student.id && balance.currency !== student.currency)
				.map(normalizeCurrencyBalance)
			const nextPaymentBalance =
				[normalizedBase, ...otherCurrencyBalances].find((balance) => balance.overdue) ?? normalizedBase
			const progress = packageProgress(state, student, relatedLessons)
			return {
				...normalizedBase,
				packageProgress: progress,
				nextPayment: nextPayment(student, relatedLessons, nextPaymentBalance, progress),
				otherCurrencyBalances,
			}
		})
	},

	getDashboardSummary(scope: StoreScope) {
		const state = stateFor(scope)
		return buildDashboardSummary({
			students: this.listStudents(scope),
			lessons: this.listLessons(scope),
			attendance: Array.from(state.attendance.values()),
			payments: this.listPayments(scope),
			balances: this.listStudentBalances(scope),
		})
	},

	getCalendarConnection(scope: StoreScope) {
		return stateFor(scope).calendarConnection
	},

	connectCalendar(
		scope: StoreScope,
		email: string,
		authorization: { grantedScopes?: readonly string[]; tokenAvailable?: boolean } = {}
	) {
		const connection = stateFor(scope).calendarConnection
		const grantedScopes = [...(authorization.grantedScopes ?? [])]
		const tokenAvailable = authorization.tokenAvailable ?? false
		const isAuthorized = hasGoogleCalendarGrant(grantedScopes, tokenAvailable)

		connection.email = email
		connection.requiredScopes = [...GOOGLE_CALENDAR_REQUIRED_SCOPES]
		connection.grantedScopes = grantedScopes
		connection.tokenAvailable = tokenAvailable
		connection.status = isAuthorized ? 'connected' : 'authorization_required'
		connection.selectedCalendarId = isAuthorized
			? (connection.selectedCalendarId ?? 'primary')
			: connection.selectedCalendarId
		connection.selectedCalendarName = isAuthorized
			? (connection.selectedCalendarName ?? 'Primary')
			: connection.selectedCalendarName
		connection.connectedAt = isAuthorized ? now() : connection.connectedAt
		connection.updatedAt = now()
		return connection
	},

	selectCalendar(scope: StoreScope, calendarId: string, calendarName: string) {
		const connection = stateFor(scope).calendarConnection
		connection.selectedCalendarId = calendarId
		connection.selectedCalendarName = calendarName
		connection.updatedAt = now()
		return connection
	},

	ensureCalendarSyncRecord(scope: StoreScope, lessonId: string, status: CalendarSyncRecord['status'] = 'not_synced') {
		const state = stateFor(scope)
		const existing = state.calendarSyncRecords.get(lessonId)
		const record: CalendarSyncRecord = {
			id: existing?.id ?? id('sync'),
			lessonId,
			provider: 'google',
			externalEventId: existing?.externalEventId ?? null,
			status,
			lastSyncedAt: existing?.lastSyncedAt ?? null,
			lastError: null,
			updatedAt: now(),
		}
		state.calendarSyncRecords.set(lessonId, record)
		return record
	},

	deleteCalendarSyncRecord(scope: StoreScope, lessonId: string) {
		const state = stateFor(scope)
		const existing = state.calendarSyncRecords.get(lessonId) ?? null
		state.calendarSyncRecords.delete(lessonId)
		return existing
	},

	syncLessonToCalendar(scope: StoreScope, lessonId: string) {
		const state = stateFor(scope)
		const lesson = state.lessons.get(lessonId)
		if (!lesson) return null
		if (
			state.calendarConnection.status !== 'connected' ||
			!hasGoogleCalendarGrant(state.calendarConnection.grantedScopes, state.calendarConnection.tokenAvailable)
		) {
			return this.ensureCalendarSyncRecord(scope, lessonId, 'failed')
		}
		const existing = state.calendarSyncRecords.get(lessonId)
		const record: CalendarSyncRecord = {
			id: existing?.id ?? id('sync'),
			lessonId,
			provider: 'google',
			externalEventId: existing?.externalEventId ?? `google_${lessonId}`,
			status: 'synced',
			lastSyncedAt: now(),
			lastError: null,
			updatedAt: now(),
		}
		state.calendarSyncRecords.set(lessonId, record)
		return record
	},

	listCalendarSyncRecords(scope: StoreScope) {
		return Array.from(stateFor(scope).calendarSyncRecords.values())
	},

	listCalendarBlocks(scope: StoreScope) {
		return Array.from(stateFor(scope).calendarBlocks.values()).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
	},

	createCalendarBlock(scope: StoreScope, input: CreateCalendarBlockInput) {
		const state = stateFor(scope)
		const canSync =
			state.calendarConnection.status === 'connected' &&
			hasGoogleCalendarGrant(state.calendarConnection.grantedScopes, state.calendarConnection.tokenAvailable)
		const block: CalendarBlock = {
			id: id('blk'),
			title: input.title,
			startsAt: input.startsAt,
			durationMinutes: input.durationMinutes,
			externalEventId: canSync ? `google_block_${id('evt')}` : null,
			externalCalendarId: canSync ? (state.calendarConnection.selectedCalendarId ?? 'primary') : null,
			syncStatus: canSync ? 'synced' : 'not_synced',
			lastError: null,
			createdAt: now(),
			updatedAt: now(),
		}
		state.calendarBlocks.set(block.id, block)
		return block
	},

	updateCalendarBlock(scope: StoreScope, blockId: string, input: UpdateCalendarBlockInput) {
		const state = stateFor(scope)
		const existing = state.calendarBlocks.get(blockId)
		if (!existing) return null
		const canSync =
			state.calendarConnection.status === 'connected' &&
			hasGoogleCalendarGrant(state.calendarConnection.grantedScopes, state.calendarConnection.tokenAvailable)
		const updated: CalendarBlock = {
			...existing,
			...input,
			externalEventId: canSync ? (existing.externalEventId ?? `google_block_${id('evt')}`) : existing.externalEventId,
			externalCalendarId: canSync
				? (existing.externalCalendarId ?? state.calendarConnection.selectedCalendarId ?? 'primary')
				: existing.externalCalendarId,
			syncStatus: canSync ? 'synced' : existing.syncStatus,
			lastError: canSync ? null : existing.lastError,
			updatedAt: now(),
		}
		state.calendarBlocks.set(blockId, updated)
		return updated
	},

	deleteCalendarBlock(scope: StoreScope, blockId: string) {
		const state = stateFor(scope)
		const existing = state.calendarBlocks.get(blockId)
		if (!existing) return null
		state.calendarBlocks.delete(blockId)
		return existing
	},

	listSidebarItems(scope: StoreScope) {
		return stateFor(scope).sidebarItems.map((item) => ({ ...item }))
	},

	saveSidebarItems(scope: StoreScope, items: SidebarItem[]) {
		const state = stateFor(scope)
		state.sidebarItems = items.map((item) => ({ ...item }))
		return this.listSidebarItems(scope)
	},

	listCrmErrors(scope: StoreScope) {
		return Array.from(stateFor(scope).errorLogs.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
	},

	saveCrmError(scope: StoreScope, input: SaveCrmErrorInput) {
		const state = stateFor(scope)
		const entry: CrmErrorLogEntry = {
			id: id('err'),
			source: input.source,
			message: input.message,
			createdAt: now(),
		}
		state.errorLogs.set(entry.id, entry)
		return entry
	},

	deleteCrmError(scope: StoreScope, errorId: string) {
		const state = stateFor(scope)
		const entry = state.errorLogs.get(errorId)
		if (!entry) return null
		state.errorLogs.delete(errorId)
		return entry
	},

	clearCrmErrors(scope: StoreScope) {
		stateFor(scope).errorLogs.clear()
	},

	getTheme(scope: StoreScope) {
		const theme = stateFor(scope).theme
		return {
			...theme,
			fontSizes: { ...theme.fontSizes },
			colors: { ...theme.colors },
		}
	},

	saveTheme(scope: StoreScope, theme: CrmThemeSettings) {
		stateFor(scope).theme = {
			...theme,
			fontSizes: { ...theme.fontSizes },
			colors: { ...theme.colors },
		}
		return this.getTheme(scope)
	},

	getPetSettings(scope: StoreScope) {
		return { ...stateFor(scope).petSettings }
	},

	savePetSettings(scope: StoreScope, settings: PetSettings) {
		stateFor(scope).petSettings = { ...settings }
		return this.getPetSettings(scope)
	},
}
