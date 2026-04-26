'use client'

import { createClient } from '@/lib/supabase/client'

import type {
	ApiErrorResponse,
	AttendanceRecord,
	CalendarConnection,
	CalendarSyncRecord,
	CreateLessonInput,
	CreatePaymentInput,
	CreateStudentInput,
	CrmErrorLogEntry,
	DashboardSummary,
	Lesson,
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
type DashboardResponse = { ok: true; summary: DashboardSummary }
type SidebarSettingsResponse = { ok: true; items: SidebarItem[] }
type CrmErrorLogResponse = { ok: true; errors: CrmErrorLogEntry[] }
type CrmErrorLogMutationResponse = { ok: true; error: CrmErrorLogEntry }

const apiBaseUrl = () => process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
const isApiErrorResponse = (value: unknown): value is ApiErrorResponse =>
	Boolean(value && typeof value === 'object' && (value as { ok?: unknown }).ok === false)

async function accessToken() {
	const supabase = createClient()
	const {
		data: { session },
	} = await supabase.auth.getSession()
	return session?.access_token ?? null
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

	const headers = new Headers(init.headers)
	headers.set('authorization', `Bearer ${token}`)
	if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json')

	const response = await fetch(`${apiBaseUrl()}${path}`, {
		...init,
		headers,
		cache: 'no-store',
	})
	const payload = (await response.json().catch(() => null)) as T | ApiErrorResponse | null

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
	const [students, lessons, payments, calendar, dashboard] = await Promise.all([
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
		calendarConnection: calendar.connection,
		calendarSyncRecords: calendar.syncRecords,
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
	markAttendance: (input: MarkAttendanceInput) =>
		apiRequest('/lessons/attendance', {
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
		apiRequest('/calendar/connections', {
			method: 'POST',
		}),
	syncLesson: (lessonId: string) =>
		apiRequest('/calendar/sync-events', {
			method: 'POST',
			body: JSON.stringify({ lessonId, syncPolicy: 'sync' }),
		}),
}
