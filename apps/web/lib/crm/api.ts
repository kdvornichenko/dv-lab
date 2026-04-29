'use client'

import { createClient } from '@/lib/supabase/client'

import type {
	ApiErrorResponse,
	AttendanceMutationResponse,
	AttendanceRecord,
	CalendarBusyInterval,
	CalendarBusyQuery,
	CalendarConnection,
	CalendarListEntry,
	CalendarSyncRecord,
	CreateLessonInput,
	CreatePaymentInput,
	CreateStudentInput,
	CrmErrorLogEntry,
	CrmThemeSettings,
	DashboardSummary,
	Lesson,
	LessonMutationResponse,
	ListStudentsResponse,
	MarkAttendanceInput,
	Payment,
	SaveCrmErrorInput,
	SidebarItem,
	StudentBalance,
	UpdateLessonInput,
	StudentMutationResponse,
	UpdateStudentInput,
} from '@teacher-crm/api-types'

import type { TeacherCrmState, TeacherCrmSummary } from './types'

type LessonsResponse = { ok: true; lessons: Lesson[]; attendance: AttendanceRecord[] }
type PaymentsResponse = { ok: true; payments: Payment[]; balances: StudentBalance[] }
type CalendarResponse = { ok: true; connection: CalendarConnection; syncRecords: CalendarSyncRecord[] }
type CalendarListResponse = { ok: true; calendars: CalendarListEntry[] }
type CalendarBusyResponse = { ok: true; busy: CalendarBusyInterval[] }
type CalendarImportResponse = { ok: true; checked: number; updated: number }
type CalendarProviderTokenResponse = { ok: true; connection: CalendarConnection }
type DashboardResponse = { ok: true; summary: DashboardSummary }
type SidebarSettingsResponse = { ok: true; items: SidebarItem[] }
type ThemeSettingsResponse = { ok: true; theme: CrmThemeSettings }
type CrmErrorLogResponse = { ok: true; errors: CrmErrorLogEntry[] }
type CrmErrorLogMutationResponse = { ok: true; error: CrmErrorLogEntry }

const apiBaseUrl = () => '/api'
const isApiErrorResponse = (value: unknown): value is ApiErrorResponse =>
	Boolean(value && typeof value === 'object' && (value as { ok?: unknown }).ok === false)
const canImportCalendarChanges = (calendar: CalendarResponse) =>
	calendar.connection.status === 'connected' && calendar.connection.tokenAvailable

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
	const token = await accessToken()
	if (!token) throw new TeacherCrmApiError('Authentication session is missing', 401, 'UNAUTHENTICATED')

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
		throw new TeacherCrmApiError(error?.message ?? 'Teacher CRM API request failed', response.status, error?.code)
	}

	return payload as T
}

function mapSummary(summary: DashboardSummary): TeacherCrmSummary {
	return {
		activeStudents: summary.activeStudents,
		todayLessons: summary.todayLessonCount,
		missingAttendance: summary.missingAttendanceCount,
		overdueStudents: summary.overdueStudentCount,
		monthIncome: summary.monthIncome,
	}
}

export async function loadTeacherCrm() {
	const calendar = await apiRequest<CalendarResponse>('/calendar/connection')
	if (canImportCalendarChanges(calendar)) {
		try {
			await apiRequest<CalendarImportResponse>('/calendar/import-events', {
				method: 'POST',
			})
		} catch (error) {
			console.warn('[teacher-crm] failed to import Google Calendar changes before loading lessons', error)
		}
	}

	const [students, lessons, payments, refreshedCalendar, dashboard] = await Promise.all([
		apiRequest<ListStudentsResponse>('/students'),
		apiRequest<LessonsResponse>('/lessons'),
		apiRequest<PaymentsResponse>('/payments'),
		apiRequest<CalendarResponse>('/calendar/connection'),
		apiRequest<DashboardResponse>('/dashboard'),
	])

	const state: TeacherCrmState = {
		students: students.students,
		lessons: lessons.lessons,
		attendance: lessons.attendance,
		payments: payments.payments,
		studentBalances: payments.balances,
		calendarConnection: refreshedCalendar.connection,
		calendarOptions: [],
		calendarSyncRecords: refreshedCalendar.syncRecords,
	}

	return {
		state,
		summary: mapSummary(dashboard.summary),
	}
}

export const teacherCrmApi = {
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
	createLesson: (input: CreateLessonInput) =>
		apiRequest('/lessons', {
			method: 'POST',
			body: JSON.stringify(input),
		}),
	updateLesson: (lessonId: string, input: UpdateLessonInput) =>
		apiRequest(`/lessons/${lessonId}`, {
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
	createPayment: (input: CreatePaymentInput) =>
		apiRequest('/payments', {
			method: 'POST',
			body: JSON.stringify(input),
		}),
	deletePayment: (paymentId: string) =>
		apiRequest<{ ok: true; payment: Payment }>(`/payments/${paymentId}`, {
			method: 'DELETE',
		}),
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
	connectCalendar: () =>
		apiRequest<{ ok: true; connection: CalendarConnection }>('/calendar/connections', {
			method: 'POST',
		}),
	listCalendars: () => apiRequest<CalendarListResponse>('/calendar/calendars'),
	listBusyIntervals: (input: CalendarBusyQuery) =>
		apiRequest<CalendarBusyResponse>('/calendar/busy', {
			method: 'POST',
			body: JSON.stringify(input),
		}),
	selectCalendar: (calendarId: string, calendarName: string) =>
		apiRequest<{ ok: true; connection: CalendarConnection }>('/calendar/connection', {
			method: 'PATCH',
			body: JSON.stringify({ calendarId, calendarName }),
		}),
	syncLesson: (lessonId: string) =>
		apiRequest('/calendar/sync-events', {
			method: 'POST',
			body: JSON.stringify({ lessonId, syncPolicy: 'sync' }),
		}),
	importCalendarEvents: () =>
		apiRequest<CalendarImportResponse>('/calendar/import-events', {
			method: 'POST',
		}),
}
