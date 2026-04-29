import type { StudentWithBalance, TeacherCrmSummary } from '@/lib/crm/types'

import type {
	CalendarConnection,
	CalendarListEntry,
	CalendarSyncRecord,
	Lesson,
	Payment,
	Student,
	StudentBalance,
} from '@teacher-crm/api-types'

export const previewNow = new Date('2026-04-26T12:00:00.000Z')

export const previewStudents: Student[] = [
	{
		id: 'preview-anna',
		firstName: 'Anna',
		lastName: 'Petrova',
		fullName: 'Anna Petrova',
		email: 'anna@example.com',
		phone: '+7 900 000-10-01',
		level: 'B2',
		special: 'Speaking practice',
		status: 'active',
		notes: 'Speaking and exam prep',
		defaultLessonPrice: 2300,
		defaultLessonDurationMinutes: 60,
		packageMonths: 3,
		packageLessonsPerWeek: 2,
		packageLessonCount: 24,
		packageTotalPrice: 50400,
		currency: 'RUB',
		billingMode: 'package',
		createdAt: '2026-04-01T09:00:00.000Z',
		updatedAt: '2026-04-20T09:00:00.000Z',
	},
	{
		id: 'preview-max',
		firstName: 'Max',
		lastName: 'Ivanov',
		fullName: 'Max Ivanov',
		email: 'max@example.com',
		phone: '+7 900 000-10-02',
		level: 'A2',
		special: 'Grammar support',
		status: 'active',
		notes: 'Monthly plan',
		defaultLessonPrice: 2300,
		defaultLessonDurationMinutes: 60,
		packageMonths: 0,
		packageLessonsPerWeek: 0,
		packageLessonCount: 0,
		packageTotalPrice: 0,
		currency: 'RUB',
		billingMode: 'monthly',
		createdAt: '2026-03-10T09:00:00.000Z',
		updatedAt: '2026-04-18T09:00:00.000Z',
	},
	{
		id: 'preview-lena',
		firstName: 'Lena',
		lastName: 'Smirnova',
		fullName: 'Lena Smirnova',
		email: 'lena@example.com',
		phone: '+7 900 000-10-03',
		level: 'C1',
		special: 'Exam prep',
		status: 'paused',
		notes: 'Package renewal pending',
		defaultLessonPrice: 2300,
		defaultLessonDurationMinutes: 60,
		packageMonths: 5,
		packageLessonsPerWeek: 2,
		packageLessonCount: 40,
		packageTotalPrice: 76000,
		currency: 'KZT',
		billingMode: 'package',
		createdAt: '2026-02-02T09:00:00.000Z',
		updatedAt: '2026-04-16T09:00:00.000Z',
	},
]

export const previewBalances: StudentBalance[] = [
	{ studentId: 'preview-anna', balance: 0, unpaidLessonCount: 0, overdue: false },
	{ studentId: 'preview-max', balance: 2300, unpaidLessonCount: 1, overdue: true },
	{ studentId: 'preview-lena', balance: -1900, unpaidLessonCount: 0, overdue: false },
]

export const previewStudentsWithBalance: StudentWithBalance[] = previewStudents.map((student) => ({
	...student,
	balance: previewBalances.find((balance) => balance.studentId === student.id) ?? {
		studentId: student.id,
		balance: 0,
		unpaidLessonCount: 0,
		overdue: false,
	},
}))

export const previewLessons: Lesson[] = [
	{
		id: 'preview-lesson-speaking',
		title: 'Anna P.',
		startsAt: '2026-04-26T12:00:00.000Z',
		durationMinutes: 60,
		repeatWeekly: false,
		topic: 'Travel and work',
		notes: '',
		status: 'planned',
		studentIds: ['preview-anna'],
		createdAt: '2026-04-20T09:00:00.000Z',
		updatedAt: '2026-04-20T09:00:00.000Z',
	},
	{
		id: 'preview-lesson-grammar',
		title: 'Max I.',
		startsAt: '2026-04-26T15:30:00.000Z',
		durationMinutes: 90,
		repeatWeekly: false,
		topic: 'Conditionals',
		notes: '',
		status: 'planned',
		studentIds: ['preview-max'],
		createdAt: '2026-04-20T09:00:00.000Z',
		updatedAt: '2026-04-20T09:00:00.000Z',
	},
]

export const previewPayments: Payment[] = [
	{
		id: 'preview-payment-anna',
		studentId: 'preview-anna',
		amount: 50400,
		paidAt: '2026-04-24',
		method: 'bank_transfer',
		comment: '3 month package',
		createdAt: '2026-04-24T10:00:00.000Z',
	},
	{
		id: 'preview-payment-max',
		studentId: 'preview-max',
		amount: 2300,
		paidAt: '2026-04-20',
		method: 'card',
		comment: 'Single lesson',
		createdAt: '2026-04-20T10:00:00.000Z',
	},
]

export const previewCalendarConnection: CalendarConnection = {
	id: 'preview-calendar',
	provider: 'google',
	email: 'teacher@gmail.com',
	status: 'connected',
	requiredScopes: [],
	grantedScopes: [],
	tokenAvailable: true,
	selectedCalendarId: 'english-lessons',
	selectedCalendarName: 'English lessons',
	connectedAt: '2026-04-01T09:00:00.000Z',
	updatedAt: '2026-04-26T09:00:00.000Z',
}

export const previewCalendarOptions: CalendarListEntry[] = [
	{
		id: 'english-lessons',
		name: 'English lessons',
		primary: true,
		accessRole: 'owner',
	},
]

export const previewCalendarSyncRecords: CalendarSyncRecord[] = [
	{
		id: 'preview-sync-speaking',
		lessonId: 'preview-lesson-speaking',
		provider: 'google',
		externalEventId: 'evt_1',
		status: 'synced',
		lastSyncedAt: '2026-04-26T09:00:00.000Z',
		lastError: null,
		updatedAt: '2026-04-26T09:00:00.000Z',
	},
]

export const previewSummary: TeacherCrmSummary = {
	activeStudents: 2,
	todayLessons: 2,
	missingAttendance: 0,
	overdueStudents: 1,
	monthIncome: 52700,
}

export const routeLinks = [
	{ label: 'Dashboard', href: '/' },
	{ label: 'Lessons', href: '/lessons' },
	{ label: 'Students', href: '/students' },
	{ label: 'Payments', href: '/payments' },
	{ label: 'Calendar', href: '/calendar' },
	{ label: 'Settings', href: '/settings' },
] as const
