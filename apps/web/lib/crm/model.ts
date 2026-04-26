import type {
	AttendanceRecord,
	CalendarConnection,
	CalendarSyncRecord,
	Lesson,
	Payment,
	Student,
	StudentBalance,
} from '@teacher-crm/api-types'

import type { StudentWithBalance } from './types'

export const STUDENT_STATUS_OPTIONS = ['active', 'paused', 'archived'] as const satisfies readonly Student['status'][]
export const STUDENT_FILTER_OPTIONS = ['all', ...STUDENT_STATUS_OPTIONS] as const
export const BILLING_MODE_OPTIONS = [
	'per_lesson',
	'monthly',
	'package',
] as const satisfies readonly Student['billingMode'][]

export type LedgerTone = 'green' | 'amber' | 'neutral' | 'red'

export function formatUsdAmount(value: number) {
	return new Intl.NumberFormat('ru-RU', {
		style: 'currency',
		currency: 'RUB',
		maximumFractionDigits: 0,
	}).format(value)
}

export function formatTime(value: string) {
	return new Intl.DateTimeFormat('en-US', {
		hour: '2-digit',
		minute: '2-digit',
	}).format(new Date(value))
}

export function formatDateShort(value: string | Date) {
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
	}).format(new Date(value))
}

export function formatWeekday(value: string | Date) {
	return new Intl.DateTimeFormat('en-US', {
		weekday: 'long',
		month: 'short',
		day: 'numeric',
	}).format(new Date(value))
}

export function studentNames(lesson: Lesson, students: Student[]) {
	const names = lesson.studentIds.map((id) => students.find((student) => student.id === id)?.fullName).filter(Boolean)
	return names.length > 0 ? names.join(', ') : 'No students'
}

export function isSameCalendarDay(value: string | Date, now: Date) {
	const date = new Date(value)
	return (
		date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
	)
}

export function isSameCalendarMonth(value: string | Date, now: Date) {
	const date = new Date(value)
	return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
}

export function isThisWeek(value: string | Date, now: Date) {
	const date = new Date(value)
	const weekStart = new Date(now)
	weekStart.setDate(now.getDate() - now.getDay())
	weekStart.setHours(0, 0, 0, 0)
	return date >= weekStart
}

export function selectTodayLessons(lessons: Lesson[], now: Date) {
	return lessons.filter((lesson) => isSameCalendarDay(lesson.startsAt, now))
}

export function getLessonAttendanceCount(lesson: Lesson, attendance: AttendanceRecord[]) {
	return attendance.filter((record) => record.lessonId === lesson.id && record.status === 'attended').length
}

export function isLessonAttendanceMarked(lesson: Lesson, attendance: AttendanceRecord[]) {
	return getLessonAttendanceCount(lesson, attendance) >= lesson.studentIds.length
}

export function selectMissingAttendanceLessons(lessons: Lesson[], attendance: AttendanceRecord[]) {
	return lessons.filter((lesson) => !isLessonAttendanceMarked(lesson, attendance))
}

export function selectOverdueStudents(students: StudentWithBalance[]) {
	return students.filter((student) => student.balance.overdue)
}

export function selectFailedCalendarSyncs(syncRecords: CalendarSyncRecord[]) {
	return syncRecords.filter((record) => record.status === 'failed')
}

export function getBillingModeLabel(value: Student['billingMode']) {
	return value.replace('_', ' ')
}

export function getStudentStatusTone(status: Student['status']): LedgerTone {
	if (status === 'active') return 'green'
	if (status === 'paused') return 'amber'
	return 'neutral'
}

export function getBalanceTone(balance: StudentBalance): LedgerTone {
	return balance.overdue ? 'red' : 'green'
}

export function getPackageLessonPrice(student: Student) {
	return student.packageLessonCount > 0 ? student.packageTotalPrice / student.packageLessonCount : 0
}

export function getPackageSavings(student: Student) {
	if (student.packageLessonCount <= 0 || student.packageTotalPrice <= 0) return 0
	return Math.max(student.defaultLessonPrice * student.packageLessonCount - student.packageTotalPrice, 0)
}

export function selectStudentLessonStats(
	studentId: string,
	lessons: Lesson[],
	attendance: AttendanceRecord[],
	now: Date
) {
	const relatedLessons = lessons.filter((lesson) => lesson.studentIds.includes(studentId))
	const attendedCount = attendance.filter(
		(record) => record.studentId === studentId && record.status === 'attended'
	).length
	const nextLesson = relatedLessons
		.filter((lesson) => new Date(lesson.startsAt).getTime() >= now.getTime())
		.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0]

	return { relatedLessons, attendedCount, nextLesson }
}

export function getStudentPlanLabel(student: StudentWithBalance) {
	if (student.billingMode === 'monthly') return `Monthly plan · ${formatUsdAmount(student.defaultLessonPrice)}`
	if (student.billingMode === 'package') {
		const packageLessonPrice = getPackageLessonPrice(student)
		return packageLessonPrice > 0
			? `${student.packageMonths || '-'} mo · ${formatUsdAmount(packageLessonPrice)} lesson`
			: 'Package not priced'
	}
	return `${formatUsdAmount(student.defaultLessonPrice)} lesson`
}

export function getLessonsLeftLabel(student: StudentWithBalance) {
	if (student.billingMode === 'package') return `${student.packageLessonCount} in package`
	return `${student.balance.unpaidLessonCount} unpaid`
}

export function getNextPaymentLabel(student: StudentWithBalance, nextLesson?: Lesson) {
	if (student.balance.overdue) return 'Due now'
	if (nextLesson) return `After ${formatDateShort(nextLesson.startsAt)}`
	return 'Not scheduled'
}

export function selectStudentLedgerProjection(
	student: StudentWithBalance,
	lessons: Lesson[],
	attendance: AttendanceRecord[],
	now: Date
) {
	const stats = selectStudentLessonStats(student.id, lessons, attendance, now)

	return {
		billingLabel: getBillingModeLabel(student.billingMode),
		balanceTone: getBalanceTone(student.balance),
		lessonsLeft: getLessonsLeftLabel(student),
		nextPayment: getNextPaymentLabel(student, stats.nextLesson),
		packageLessonPrice: getPackageLessonPrice(student),
		packageSavings: getPackageSavings(student),
		packageTotal: student.packageTotalPrice,
		plan: getStudentPlanLabel(student),
		stats,
		statusTone: getStudentStatusTone(student.status),
	}
}

export function selectCalendarStatus(connection: CalendarConnection, syncRecords: CalendarSyncRecord[]) {
	const failedSyncs = selectFailedCalendarSyncs(syncRecords).length
	const syncedEvents = syncRecords.filter((record) => record.status === 'synced').length
	const hasCalendarGrant =
		connection.tokenAvailable && connection.requiredScopes.every((scope) => connection.grantedScopes.includes(scope))

	return {
		connected: connection.status === 'connected' && hasCalendarGrant,
		failedSyncs,
		hasCalendarGrant,
		syncedEvents,
	}
}

export function selectPaymentLedger(payments: Payment[], studentBalances: StudentBalance[], now: Date) {
	return {
		monthIncome: payments
			.filter((payment) => isSameCalendarMonth(payment.paidAt, now))
			.reduce((sum, payment) => sum + payment.amount, 0),
		paidThisWeek: payments.filter((payment) => isThisWeek(payment.paidAt, now)).length,
		overdueTotal: studentBalances
			.filter((balance) => balance.overdue)
			.reduce((sum, balance) => sum + Math.abs(balance.balance), 0),
	}
}
