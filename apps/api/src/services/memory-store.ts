import {
	GOOGLE_CALENDAR_REQUIRED_SCOPES,
	type AttendanceRecord,
	type CalendarConnection,
	type CalendarSyncRecord,
	type CreateLessonInput,
	type CreatePaymentInput,
	type CreateStudentInput,
	type Lesson,
	type MarkAttendanceInput,
	type Payment,
	type Student,
	type StudentBalance,
	type UpdateLessonInput,
	type UpdateStudentInput,
} from '@teacher-crm/api-types'
import { calculateStudentBalances } from '@teacher-crm/db'

export type StoreScope = {
	teacherId: string
}

type TeacherStoreState = {
	students: Map<string, Student>
	lessons: Map<string, Lesson>
	attendance: Map<string, AttendanceRecord>
	payments: Map<string, Payment>
	calendarConnection: CalendarConnection
	calendarSyncRecords: Map<string, CalendarSyncRecord>
}

const stores = new Map<string, TeacherStoreState>()

const now = () => new Date().toISOString()
const id = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`
const hasGoogleCalendarGrant = (grantedScopes: readonly string[], tokenAvailable: boolean) =>
	tokenAvailable && GOOGLE_CALENDAR_REQUIRED_SCOPES.every((scope) => grantedScopes.includes(scope))

const todayAt = (hour: number) => {
	const value = new Date()
	value.setHours(hour, 0, 0, 0)
	return value.toISOString()
}

function seedStudents(): Student[] {
	return [
		{
			id: 'stu_anna',
			fullName: 'Anna Petrova',
			email: 'anna@example.com',
			phone: '+1 555 0101',
			level: 'B1',
			status: 'active',
			notes: 'Prefers speaking practice.',
			defaultLessonPrice: 35,
			billingMode: 'per_lesson',
			createdAt: now(),
			updatedAt: now(),
		},
		{
			id: 'stu_max',
			fullName: 'Max Ivanov',
			email: 'max@example.com',
			phone: '+1 555 0102',
			level: 'A2',
			status: 'active',
			notes: 'Exam prep.',
			defaultLessonPrice: 40,
			billingMode: 'per_lesson',
			createdAt: now(),
			updatedAt: now(),
		},
	]
}

function seedLessons(): Lesson[] {
	return [
		{
			id: 'les_today_speaking',
			title: 'Speaking practice',
			startsAt: todayAt(15),
			durationMinutes: 60,
			topic: 'Travel vocabulary',
			notes: '',
			status: 'planned',
			studentIds: ['stu_anna'],
			createdAt: now(),
			updatedAt: now(),
		},
		{
			id: 'les_today_group',
			title: 'Grammar group',
			startsAt: todayAt(18),
			durationMinutes: 90,
			topic: 'Conditionals',
			notes: '',
			status: 'planned',
			studentIds: ['stu_anna', 'stu_max'],
			createdAt: now(),
			updatedAt: now(),
		},
	]
}

function seedPayments(): Payment[] {
	return [
		{
			id: 'pay_anna_1',
			studentId: 'stu_anna',
			amount: 35,
			paidAt: new Date().toISOString(),
			method: 'bank_transfer',
			comment: 'One lesson',
			createdAt: now(),
		},
	]
}

function createStoreState(): TeacherStoreState {
	const students = seedStudents()
	const lessons = seedLessons()
	const payments = seedPayments()

	return {
		students: new Map(students.map((student) => [student.id, student])),
		lessons: new Map(lessons.map((lesson) => [lesson.id, lesson])),
		attendance: new Map<string, AttendanceRecord>(),
		payments: new Map(payments.map((payment) => [payment.id, payment])),
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
	listStudents(scope: StoreScope) {
		return Array.from(stateFor(scope).students.values())
	},

	createStudent(scope: StoreScope, input: CreateStudentInput) {
		const state = stateFor(scope)
		const student: Student = {
			...input,
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
		state.students.set(studentId, updated)
		return updated
	},

	archiveStudent(scope: StoreScope, studentId: string) {
		return this.updateStudent(scope, studentId, { status: 'archived' })
	},

	listLessons(scope: StoreScope) {
		return Array.from(stateFor(scope).lessons.values()).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
	},

	createLesson(scope: StoreScope, input: CreateLessonInput) {
		const state = stateFor(scope)
		const lesson: Lesson = {
			...input,
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

	listPayments(scope: StoreScope) {
		return Array.from(stateFor(scope).payments.values()).sort((a, b) => b.paidAt.localeCompare(a.paidAt))
	},

	listStudentBalances(scope: StoreScope): StudentBalance[] {
		const state = stateFor(scope)
		const charges = Array.from(state.attendance.values()).map((record) => {
			const student = state.students.get(record.studentId)
			return {
				studentId: record.studentId,
				amount: student?.defaultLessonPrice ?? 0,
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
}
