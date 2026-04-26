import {
	DEFAULT_CRM_THEME_SETTINGS,
	DEFAULT_LESSON_DURATION_MINUTES,
	DEFAULT_SIDEBAR_ITEMS,
	GOOGLE_CALENDAR_REQUIRED_SCOPES,
	calculatePackageLessonCount,
	calculatePackageTotalPriceRub,
	type AttendanceRecord,
	type CalendarConnection,
	type CalendarSyncRecord,
	type CreateLessonInput,
	type CreatePaymentInput,
	type CreateStudentInput,
	type CrmErrorLogEntry,
	type CrmThemeSettings,
	type ListLessonsQuery,
	type ListStudentsQuery,
	type Lesson,
	type MarkAttendanceInput,
	type Payment,
	type SaveCrmErrorInput,
	type SidebarItem,
	type Student,
	type StudentBalance,
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
	calendarConnection: CalendarConnection
	calendarSyncRecords: Map<string, CalendarSyncRecord>
	sidebarItems: SidebarItem[]
	errorLogs: Map<string, CrmErrorLogEntry>
	theme: CrmThemeSettings
}

const stores = new Map<string, TeacherStoreState>()

const now = () => new Date().toISOString()
const id = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`
const hasGoogleCalendarGrant = (grantedScopes: readonly string[], tokenAvailable: boolean) =>
	tokenAvailable && GOOGLE_CALENDAR_REQUIRED_SCOPES.every((scope) => grantedScopes.includes(scope))
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
	student: Pick<Student, 'defaultLessonPrice' | 'defaultLessonDurationMinutes' | 'packageMonths' | 'packageLessonCount'>
) =>
	calculatePackageTotalPriceRub({
		defaultLessonPrice: student.defaultLessonPrice,
		defaultLessonDurationMinutes: student.defaultLessonDurationMinutes,
		packageMonths: student.packageMonths,
		packageLessonCount: student.packageLessonCount,
	})

function createStoreState(): TeacherStoreState {
	return {
		students: new Map<string, Student>(),
		lessons: new Map<string, Lesson>(),
		attendance: new Map<string, AttendanceRecord>(),
		payments: new Map<string, Payment>(),
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
		sidebarItems: DEFAULT_SIDEBAR_ITEMS.map((item) => ({ ...item })),
		errorLogs: new Map<string, CrmErrorLogEntry>(),
		theme: {
			radius: DEFAULT_CRM_THEME_SETTINGS.radius,
			headingFont: DEFAULT_CRM_THEME_SETTINGS.headingFont,
			bodyFont: DEFAULT_CRM_THEME_SETTINGS.bodyFont,
			numberFont: DEFAULT_CRM_THEME_SETTINGS.numberFont,
			colors: { ...DEFAULT_CRM_THEME_SETTINGS.colors },
		},
	}
}

function stateFor(scope: StoreScope) {
	const existing = stores.get(scope.teacherId)
	if (existing) return existing

	const created = createStoreState()
	stores.set(scope.teacherId, created)
	return created
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
			defaultLessonDurationMinutes: input.defaultLessonDurationMinutes ?? DEFAULT_LESSON_DURATION_MINUTES,
			packageLessonCount,
			packageTotalPrice: studentPackageTotal({
				defaultLessonPrice: input.defaultLessonPrice,
				defaultLessonDurationMinutes: input.defaultLessonDurationMinutes ?? DEFAULT_LESSON_DURATION_MINUTES,
				packageMonths: input.packageMonths,
				packageLessonCount,
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
		return lesson
	},

	updateLesson(scope: StoreScope, lessonId: string, input: UpdateLessonInput) {
		const state = stateFor(scope)
		const existing = state.lessons.get(lessonId)
		if (!existing) return null
		const updated: Lesson = { ...existing, ...input, updatedAt: now() }
		state.lessons.set(lessonId, updated)
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
		for (const [syncKey, syncRecord] of state.calendarSyncRecords) {
			if (syncRecord.lessonId === lessonId) state.calendarSyncRecords.delete(syncKey)
		}

		return existing
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
		return updated
	},

	listAttendance(scope: StoreScope) {
		return Array.from(stateFor(scope).attendance.values())
	},

	createPayment(scope: StoreScope, input: CreatePaymentInput) {
		const state = stateFor(scope)
		const payment: Payment = {
			...input,
			id: id('pay'),
			createdAt: now(),
		}
		state.payments.set(payment.id, payment)
		return payment
	},

	deletePayment(scope: StoreScope, paymentId: string) {
		const state = stateFor(scope)
		const payment = state.payments.get(paymentId)
		if (!payment) return null
		state.payments.delete(paymentId)
		return payment
	},

	listPayments(scope: StoreScope) {
		return Array.from(stateFor(scope).payments.values()).sort((a, b) => b.paidAt.localeCompare(a.paidAt))
	},

	listStudentBalances(scope: StoreScope): StudentBalance[] {
		const state = stateFor(scope)
		const charges = Array.from(state.attendance.values()).map((record) => {
			const student = state.students.get(record.studentId)
			const lesson = state.lessons.get(record.lessonId)
			const durationMinutes = lesson?.durationMinutes ?? DEFAULT_LESSON_DURATION_MINUTES
			const durationUnits = durationMinutes / DEFAULT_LESSON_DURATION_MINUTES
			const packageLessonPrice =
				student && student.billingMode === 'package'
					? calculatePackageTotalPriceRub({
							defaultLessonPrice: student.defaultLessonPrice,
							defaultLessonDurationMinutes: durationMinutes,
							packageMonths: student.packageMonths,
							packageLessonCount: 1,
						})
					: 0
			return {
				studentId: record.studentId,
				amount:
					student?.billingMode === 'package' && packageLessonPrice > 0
						? packageLessonPrice
						: (student?.defaultLessonPrice ?? 0) * durationUnits,
				billable: record.billable && record.status === 'attended',
			}
		})

		return calculateStudentBalances(charges, Array.from(state.payments.values()))
	},

	getDashboardSummary(scope: StoreScope) {
		const state = stateFor(scope)
		const todayKey = new Date().toISOString().slice(0, 10)
		const startOfMonth = new Date()
		startOfMonth.setDate(1)
		startOfMonth.setHours(0, 0, 0, 0)
		const balances = this.listStudentBalances(scope)

		return {
			activeStudents: this.listStudents(scope).filter((student) => student.status === 'active').length,
			todayLessonCount: this.listLessons(scope).filter((lesson) => lesson.startsAt.slice(0, 10) === todayKey).length,
			missingAttendanceCount: this.listLessons(scope).filter((lesson) => {
				if (lesson.startsAt.slice(0, 10) !== todayKey) return false
				return lesson.studentIds.some((studentId) => !state.attendance.has(`${lesson.id}:${studentId}`))
			}).length,
			overdueStudentCount: balances.filter((balance) => balance.overdue).length,
			monthIncome: this.listPayments(scope)
				.filter((payment) => new Date(payment.paidAt) >= startOfMonth)
				.reduce((sum, payment) => sum + payment.amount, 0),
		}
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
			colors: { ...theme.colors },
		}
	},

	saveTheme(scope: StoreScope, theme: CrmThemeSettings) {
		stateFor(scope).theme = {
			...theme,
			colors: { ...theme.colors },
		}
		return this.getTheme(scope)
	},
}
