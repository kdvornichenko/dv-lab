import { GOOGLE_CALENDAR_REQUIRED_SCOPES, LESSON_PRICE_RUB } from '@teacher-crm/api-types'

import type { TeacherCrmState } from './types'

const now = new Date()
const iso = now.toISOString()

function todayAt(hour: number) {
	const value = new Date(now)
	value.setHours(hour, 0, 0, 0)
	return value.toISOString()
}

export const initialTeacherCrmState: TeacherCrmState = {
	students: [
		{
			id: 'stu_anna',
			fullName: 'Anna Petrova',
			email: 'anna@example.com',
			phone: '+1 555 0101',
			level: 'B1',
			status: 'active',
			notes: 'Prefers speaking practice.',
			defaultLessonPrice: LESSON_PRICE_RUB.default,
			packageMonths: 0,
			packageLessonCount: 0,
			packageTotalPrice: 0,
			billingMode: 'per_lesson',
			createdAt: iso,
			updatedAt: iso,
		},
		{
			id: 'stu_max',
			fullName: 'Max Ivanov',
			email: 'max@example.com',
			phone: '+1 555 0102',
			level: 'A2',
			status: 'active',
			notes: 'Exam prep. 3-month package.',
			defaultLessonPrice: LESSON_PRICE_RUB.default,
			packageMonths: 3,
			packageLessonCount: 24,
			packageTotalPrice: LESSON_PRICE_RUB.package3Months * 24,
			billingMode: 'package',
			createdAt: iso,
			updatedAt: iso,
		},
		{
			id: 'stu_lena',
			fullName: 'Lena Smirnova',
			email: 'lena@example.com',
			phone: '+1 555 0103',
			level: 'B2',
			status: 'paused',
			notes: '5-month package. Paused until May.',
			defaultLessonPrice: LESSON_PRICE_RUB.default,
			packageMonths: 5,
			packageLessonCount: 40,
			packageTotalPrice: LESSON_PRICE_RUB.package5Months * 40,
			billingMode: 'package',
			createdAt: iso,
			updatedAt: iso,
		},
	],
	lessons: [
		{
			id: 'les_today_speaking',
			title: 'Speaking practice',
			startsAt: todayAt(15),
			durationMinutes: 60,
			topic: 'Travel vocabulary',
			notes: '',
			status: 'planned',
			studentIds: ['stu_anna'],
			createdAt: iso,
			updatedAt: iso,
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
			createdAt: iso,
			updatedAt: iso,
		},
	],
	attendance: [],
	payments: [
		{
			id: 'pay_anna_1',
			studentId: 'stu_anna',
			amount: LESSON_PRICE_RUB.default,
			paidAt: iso,
			method: 'bank_transfer',
			comment: 'One lesson',
			createdAt: iso,
		},
	],
	studentBalances: [
		{ studentId: 'stu_anna', balance: LESSON_PRICE_RUB.default, unpaidLessonCount: 0, overdue: false },
		{ studentId: 'stu_max', balance: 0, unpaidLessonCount: 0, overdue: false },
		{ studentId: 'stu_lena', balance: 0, unpaidLessonCount: 0, overdue: false },
	],
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
		updatedAt: iso,
	},
	calendarSyncRecords: [],
}
