'use client'

import { createClient } from '@/lib/supabase/client'

import {
	GOOGLE_CALENDAR_REQUIRED_SCOPES,
	type ApiErrorResponse,
	type AttendanceMutationResponse,
	type CalendarBusyQuery,
	type CalendarBusyResponse,
	type CalendarConnectionResponse,
	type CalendarConnection,
	type CalendarImportResponse,
	type CalendarListResponse,
	type CalendarProviderTokenResponse,
	type CalendarResponse,
	type CalendarSyncResponse,
	type CreateLessonInput,
	type CreatePaymentInput,
	type CreateStudentInput,
	type CrmErrorLogMutationResponse,
	type CrmErrorLogResponse,
	type CrmThemeSettings,
	type DashboardResponse,
	type DashboardSummary,
	type LessonMutationResponse,
	type LessonsResponse,
	type ListStudentsResponse,
	type MarkAttendanceInput,
	type PaymentMutationResponse,
	type PaymentsResponse,
	type SaveCrmErrorInput,
	type SidebarItem,
	type SidebarSettingsResponse,
	type StudentBalance,
	type StudentMutationResponse,
	type ThemeSettingsResponse,
	type UpdateLessonInput,
	type UpdateStudentInput,
} from '@teacher-crm/api-types'

import type { TeacherCrmState, TeacherCrmSummary } from './types'

const apiBaseUrl = () => '/api'
const isApiErrorResponse = (value: unknown): value is ApiErrorResponse =>
	Boolean(value && typeof value === 'object' && (value as { ok?: unknown }).ok === false)
const requestLabel = (path: string, init: RequestInit) =>
	`${(init.method ?? 'GET').toUpperCase()} ${apiBaseUrl()}${path}`

export type TeacherCrmLoadIssue = {
	source: string
	error: unknown
}

type LoadResult<T> = {
	data: T | null
	issue: TeacherCrmLoadIssue | null
}

const emptyCalendarConnection: CalendarConnection = {
	id: 'cal_empty',
	provider: 'google',
	email: null,
	status: 'not_connected',
	requiredScopes: [...GOOGLE_CALENDAR_REQUIRED_SCOPES],
	grantedScopes: [],
	tokenAvailable: false,
	selectedCalendarId: null,
	selectedCalendarName: null,
	connectedAt: null,
	updatedAt: new Date(0).toISOString(),
}

const emptyCalendarResponse: CalendarResponse = {
	ok: true,
	connection: emptyCalendarConnection,
	syncRecords: [],
}

async function loadResource<T>(source: string, promise: Promise<T>): Promise<LoadResult<T>> {
	try {
		return { data: await promise, issue: null }
	} catch (error) {
		return { data: null, issue: { source, error } }
	}
}

async function accessToken(options: { forceRefresh?: boolean } = {}) {
	const supabase = createClient()
	const sessionResult = options.forceRefresh ? await supabase.auth.refreshSession() : await supabase.auth.getSession()
	let session = sessionResult.data.session

	if (!options.forceRefresh && session?.expires_at && session.expires_at <= Math.floor(Date.now() / 1000) + 60) {
		const refreshResult = await supabase.auth.refreshSession()
		session = refreshResult.data.session ?? session
	}

	return session?.access_token ?? null
}

export async function saveCurrentGoogleCalendarTokens() {
	const supabase = createClient()
	const {
		data: { session },
	} = await supabase.auth.getSession()

	if (!session?.provider_token) return { saved: false as const }

	await apiRequest<CalendarProviderTokenResponse>('/calendar/provider-tokens', {
		method: 'POST',
		body: JSON.stringify({
			email: session.user.email,
			providerToken: session.provider_token,
			providerRefreshToken: session.provider_refresh_token ?? null,
		}),
	})

	return { saved: true as const }
}

export class TeacherCrmApiError extends Error {
	constructor(
		message: string,
		readonly status?: number,
		readonly code?: string
	) {
		super(message)
		this.name = 'TeacherCrmApiError'
	}
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
	const label = requestLabel(path, init)
	const token = await accessToken()
	if (!token) throw new TeacherCrmApiError(`${label}: Authentication session is missing`, 401, 'UNAUTHENTICATED')

	const request = async (accessTokenValue: string) => {
		const headers = new Headers(init.headers)
		headers.set('authorization', `Bearer ${accessTokenValue}`)
		if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json')

		const response = await fetch(`${apiBaseUrl()}${path}`, {
			...init,
			headers,
			cache: 'no-store',
			credentials: 'omit',
		})
		const payload = (await response.json().catch(() => null)) as T | ApiErrorResponse | null

		return { response, payload }
	}

	let { response, payload } = await request(token)

	if (response.status === 401 && isApiErrorResponse(payload) && payload.error.code === 'INVALID_TOKEN') {
		const refreshedToken = await accessToken({ forceRefresh: true })
		if (refreshedToken) {
			const retry = await request(refreshedToken)
			response = retry.response
			payload = retry.payload
		}
	}

	if (!response.ok || !payload || isApiErrorResponse(payload)) {
		const error = isApiErrorResponse(payload) ? payload.error : null
		const message = error?.message ?? 'Teacher CRM API request failed'
		throw new TeacherCrmApiError(`${label}: ${message}`, response.status, error?.code)
	}

	return payload as T
}

function mapSummary(summary: DashboardSummary): TeacherCrmSummary {
	return {
		activeStudents: summary.activeStudents,
		todayLessons: summary.todayLessonCount,
		missingAttendance: summary.missingAttendanceCount,
		overdueStudents: summary.overdueStudentCount,
		monthIncome: summary.monthIncomeRub ?? summary.monthIncome,
		monthIncomeByCurrency: summary.monthIncomeByCurrency ?? { RUB: summary.monthIncome, KZT: 0 },
	}
}

function isBalanceOverdue(balance: StudentBalance) {
	return balance.overdue || Boolean(balance.otherCurrencyBalances?.some((item) => item.overdue))
}

function fallbackSummary(
	students: ListStudentsResponse,
	lessons: LessonsResponse,
	payments: PaymentsResponse
): TeacherCrmSummary {
	const todayKey = new Date().toISOString().slice(0, 10)
	const startOfMonth = new Date()
	startOfMonth.setDate(1)
	startOfMonth.setHours(0, 0, 0, 0)
	const monthIncomeByCurrency = payments.payments
		.filter((payment) => new Date(payment.paidAt) >= startOfMonth)
		.reduce(
			(totals, payment) => {
				totals[payment.currency] += payment.amount
				return totals
			},
			{ RUB: 0, KZT: 0 }
		)

	return {
		activeStudents: students.students.filter((student) => student.status === 'active').length,
		todayLessons: lessons.lessons.filter((lesson) => lesson.startsAt.slice(0, 10) === todayKey).length,
		missingAttendance: lessons.lessons.filter((lesson) => {
			if (lesson.startsAt.slice(0, 10) !== todayKey) return false
			return lesson.studentIds.some(
				(studentId) =>
					!lessons.attendance.some((record) => record.lessonId === lesson.id && record.studentId === studentId)
			)
		}).length,
		overdueStudents: payments.balances.filter(isBalanceOverdue).length,
		monthIncome: monthIncomeByCurrency.RUB,
		monthIncomeByCurrency,
	}
}

function collectIssue(issues: TeacherCrmLoadIssue[], result: LoadResult<unknown>) {
	if (result.issue) issues.push(result.issue)
}

const emptyPaymentsResponse: PaymentsResponse = { ok: true, payments: [], balances: [] }

export async function loadTeacherCrm() {
	const issues: TeacherCrmLoadIssue[] = []
	const calendarResult = await loadResource(
		'Load calendar connection',
		apiRequest<CalendarResponse>('/calendar/connection')
	)
	collectIssue(issues, calendarResult)

	const [studentsResult, lessonsResult, refreshedCalendarResult] = await Promise.all([
		loadResource('Load students', apiRequest<ListStudentsResponse>('/students')),
		loadResource('Load lessons', apiRequest<LessonsResponse>('/lessons')),
		loadResource('Refresh calendar connection', apiRequest<CalendarResponse>('/calendar/connection')),
	])
	for (const result of [studentsResult, lessonsResult, refreshedCalendarResult]) {
		collectIssue(issues, result)
	}

	const students = studentsResult.data ?? { ok: true, students: [] }
	const lessons = lessonsResult.data ?? { ok: true, lessons: [], attendance: [] }
	const calendar = refreshedCalendarResult.data ?? calendarResult.data ?? emptyCalendarResponse

	const state: TeacherCrmState = {
		students: students.students,
		lessons: lessons.lessons,
		attendance: lessons.attendance,
		payments: [],
		studentBalances: [],
		calendarConnection: calendar.connection,
		calendarOptions: [],
		calendarSyncRecords: calendar.syncRecords,
	}

	return {
		state,
		summary: fallbackSummary(students, lessons, emptyPaymentsResponse),
		issues,
	}
}

export async function loadTeacherCrmSupplements(baseState: TeacherCrmState) {
	const issues: TeacherCrmLoadIssue[] = []
	const [paymentsResult, dashboardResult] = await Promise.all([
		loadResource('Load payments', apiRequest<PaymentsResponse>('/payments')),
		loadResource('Load dashboard summary', apiRequest<DashboardResponse>('/dashboard')),
	])
	for (const result of [paymentsResult, dashboardResult]) {
		collectIssue(issues, result)
	}

	const payments = paymentsResult.data ?? emptyPaymentsResponse
	const students: ListStudentsResponse = { ok: true, students: baseState.students }
	const lessons: LessonsResponse = { ok: true, lessons: baseState.lessons, attendance: baseState.attendance }

	return {
		payments: payments.payments,
		studentBalances: payments.balances,
		summary: dashboardResult.data
			? mapSummary(dashboardResult.data.summary)
			: fallbackSummary(students, lessons, payments),
		issues,
	}
}

export const teacherCrmStudentApi = {
	createStudent: (input: CreateStudentInput) =>
		apiRequest<StudentMutationResponse>('/students', {
			method: 'POST',
			body: JSON.stringify(input),
		}),
	updateStudent: (studentId: string, input: UpdateStudentInput) =>
		apiRequest<StudentMutationResponse>(`/students/${studentId}`, {
			method: 'PATCH',
			body: JSON.stringify(input),
		}),
	deleteStudent: (studentId: string) =>
		apiRequest<StudentMutationResponse>(`/students/${studentId}`, {
			method: 'DELETE',
		}),
}

export const teacherCrmLessonApi = {
	createLesson: (input: CreateLessonInput) =>
		apiRequest<LessonMutationResponse>('/lessons', {
			method: 'POST',
			body: JSON.stringify(input),
		}),
	updateLesson: (lessonId: string, input: UpdateLessonInput) =>
		apiRequest<LessonMutationResponse>(`/lessons/${lessonId}`, {
			method: 'PATCH',
			body: JSON.stringify(input),
		}),
	deleteLesson: (lessonId: string) =>
		apiRequest<LessonMutationResponse>(`/lessons/${lessonId}`, {
			method: 'DELETE',
		}),
	markAttendance: (input: MarkAttendanceInput) =>
		apiRequest<AttendanceMutationResponse>('/lessons/attendance', {
			method: 'POST',
			body: JSON.stringify(input),
		}),
}

export const teacherCrmPaymentApi = {
	createPayment: (input: CreatePaymentInput) =>
		apiRequest<PaymentMutationResponse>('/payments', {
			method: 'POST',
			body: JSON.stringify(input),
		}),
	deletePayment: (paymentId: string) =>
		apiRequest<PaymentMutationResponse>(`/payments/${paymentId}`, {
			method: 'DELETE',
		}),
}

export const teacherCrmSettingsApi = {
	listSidebarItems: () => apiRequest<SidebarSettingsResponse>('/settings/sidebar'),
	saveSidebarItems: (items: SidebarItem[]) =>
		apiRequest<SidebarSettingsResponse>('/settings/sidebar', {
			method: 'PUT',
			body: JSON.stringify({ items }),
		}),
	getThemeSettings: () => apiRequest<ThemeSettingsResponse>('/settings/theme'),
	saveThemeSettings: (theme: CrmThemeSettings) =>
		apiRequest<ThemeSettingsResponse>('/settings/theme', {
			method: 'PUT',
			body: JSON.stringify(theme),
		}),
}

export const teacherCrmErrorApi = {
	listCrmErrors: () => apiRequest<CrmErrorLogResponse>('/errors'),
	saveCrmError: (input: SaveCrmErrorInput) =>
		apiRequest<CrmErrorLogMutationResponse>('/errors', {
			method: 'POST',
			body: JSON.stringify(input),
		}),
	deleteCrmError: (errorId: string) =>
		apiRequest<CrmErrorLogMutationResponse>(`/errors/${errorId}`, {
			method: 'DELETE',
		}),
	clearCrmErrors: () =>
		apiRequest<{ ok: true }>('/errors', {
			method: 'DELETE',
		}),
}

export const teacherCrmCalendarApi = {
	connectCalendar: () =>
		apiRequest<CalendarConnectionResponse>('/calendar/connections', {
			method: 'POST',
		}),
	listCalendars: () => apiRequest<CalendarListResponse>('/calendar/calendars'),
	listBusyIntervals: (input: CalendarBusyQuery) =>
		apiRequest<CalendarBusyResponse>('/calendar/busy', {
			method: 'POST',
			body: JSON.stringify(input),
		}),
	selectCalendar: (calendarId: string, calendarName: string) =>
		apiRequest<CalendarConnectionResponse>('/calendar/connection', {
			method: 'PATCH',
			body: JSON.stringify({ calendarId, calendarName }),
		}),
	syncLesson: (lessonId: string) =>
		apiRequest<CalendarSyncResponse>('/calendar/sync-events', {
			method: 'POST',
			body: JSON.stringify({ lessonId, syncPolicy: 'sync' }),
		}),
	importCalendarEvents: () =>
		apiRequest<CalendarImportResponse>('/calendar/import-events', {
			method: 'POST',
		}),
}

export const teacherCrmApi = {
	...teacherCrmStudentApi,
	...teacherCrmLessonApi,
	...teacherCrmPaymentApi,
	...teacherCrmSettingsApi,
	...teacherCrmErrorApi,
	...teacherCrmCalendarApi,
}
