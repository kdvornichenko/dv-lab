import type {
	AttendanceRecord,
	CalendarConnection,
	CalendarSyncRecord,
	Lesson,
	Payment,
	Student,
	StudentBalance,
} from '@teacher-crm/api-types'
import {
	DEFAULT_LESSON_DURATION_MINUTES,
	calculatePackageLessonPriceRub,
	calculatePackageTotalPriceRub,
	getLessonDurationUnits,
	getPackageDiscountRub,
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
	return new Intl.DateTimeFormat('ru-RU', {
		hour: '2-digit',
		minute: '2-digit',
	}).format(new Date(value))
}

export function formatDateShort(value: string | Date) {
	return new Intl.DateTimeFormat('ru-RU', {
		month: 'short',
		day: 'numeric',
	}).format(new Date(value))
}

export function formatWeekday(value: string | Date) {
	return new Intl.DateTimeFormat('ru-RU', {
		weekday: 'long',
		month: 'short',
		day: 'numeric',
	}).format(new Date(value))
}

export function getStudentShortName(student: Student) {
	const firstName = student.firstName || student.fullName.split(/\s+/)[0] || student.fullName
	const lastName = student.lastName || student.fullName.split(/\s+/).slice(1).join(' ')
	const lastInitial = lastName.trim() ? `${lastName.trim()[0]}.` : ''
	return [firstName, lastInitial].filter(Boolean).join(' ')
}

export function getStudentCalendarTitle(student: Student) {
	const shortName = getStudentShortName(student)
	return student.special ? `${shortName} - ${student.special}` : shortName
}

export function studentNames(lesson: Lesson, students: Student[]) {
	const names = lesson.studentIds.map((id) => students.find((student) => student.id === id)?.fullName).filter(Boolean)
	return names.length > 0 ? names.join(', ') : 'No students'
}

export function lessonDisplayTitle(lesson: Lesson, students: Student[]) {
	const lessonStudents = lesson.studentIds
		.map((id) => students.find((student) => student.id === id))
		.filter((student): student is Student => Boolean(student))

	if (lessonStudents.length === 1) return getStudentShortName(lessonStudents[0])
	if (lessonStudents.length > 1) return lessonStudents.map((student) => student.fullName).join(', ')
	return lesson.title
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

export function getLessonMarkedAttendanceCount(lesson: Lesson, attendance: AttendanceRecord[]) {
	const lessonStudentIds = new Set(lesson.studentIds)
	return attendance.filter(
		(record) => record.lessonId === lesson.id && lessonStudentIds.has(record.studentId) && record.status !== 'planned'
	).length
}

export function isLessonAttendanceMarked(lesson: Lesson, attendance: AttendanceRecord[]) {
	return lesson.studentIds.length > 0 && getLessonMarkedAttendanceCount(lesson, attendance) >= lesson.studentIds.length
}

export function selectLessonAttendanceBreakdown(lesson: Lesson, attendance: AttendanceRecord[]) {
	const lessonStudentIds = new Set(lesson.studentIds)
	const records = attendance.filter((record) => record.lessonId === lesson.id && lessonStudentIds.has(record.studentId))

	return {
		attended: records.filter((record) => record.status === 'attended').length,
		absent: records.filter((record) => record.status === 'absent').length,
		cancelled: records.filter((record) => record.status === 'cancelled').length,
		marked: records.filter((record) => record.status !== 'planned').length,
		rescheduled: records.filter((record) => record.status === 'rescheduled').length,
		total: lesson.studentIds.length,
	}
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

export function getStudentDurationUnits(student: Pick<Student, 'defaultLessonDurationMinutes'>) {
	return getLessonDurationUnits(student.defaultLessonDurationMinutes || DEFAULT_LESSON_DURATION_MINUTES)
}

export function getStudentDurationPrice(student: Pick<Student, 'defaultLessonPrice' | 'defaultLessonDurationMinutes'>) {
	return student.defaultLessonPrice * getStudentDurationUnits(student)
}

export function getPackageLessonPrice(student: Student) {
	return calculatePackageLessonPriceRub({
		defaultLessonPrice: student.defaultLessonPrice,
		defaultLessonDurationMinutes: student.defaultLessonDurationMinutes,
		packageMonths: student.packageMonths,
	})
}

export function getPackageTotalPrice(student: Student) {
	return calculatePackageTotalPriceRub({
		defaultLessonPrice: student.defaultLessonPrice,
		defaultLessonDurationMinutes: student.defaultLessonDurationMinutes,
		packageMonths: student.packageMonths,
		packageLessonCount: student.packageLessonCount,
	})
}

export function getPackageSavings(student: Student) {
	if (student.packageLessonCount <= 0) return 0
	return Math.max(
		getPackageDiscountRub(student.packageMonths) * getStudentDurationUnits(student) * student.packageLessonCount,
		0
	)
}

export function selectStudentLessonStats(studentId: string, lessons: Lesson[], now: Date) {
	const relatedLessons = lessons.filter((lesson) => lesson.studentIds.includes(studentId))
	const attendedCount = relatedLessons.filter((lesson) => lesson.status === 'completed').length
	const nextLesson = relatedLessons
		.filter((lesson) => new Date(lesson.startsAt).getTime() >= now.getTime())
		.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0]

	return { relatedLessons, attendedCount, nextLesson }
}

export function getLessonUnitCount(lesson: Pick<Lesson, 'durationMinutes'>) {
	return getLessonDurationUnits(lesson.durationMinutes)
}

export function formatLessonUnitCount(value: number) {
	return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '')
}

export function selectStudentPackageProgress(student: Student, lessons: Lesson[]) {
	const completedLessons = lessons
		.filter((lesson) => lesson.studentIds.includes(student.id) && lesson.status === 'completed')
		.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
	const completedUnits = completedLessons.reduce((sum, lesson) => sum + getLessonUnitCount(lesson), 0)
	const totalUnits = student.packageLessonCount * getStudentDurationUnits(student)
	const remainingUnits = Math.max(totalUnits - completedUnits, 0)

	return {
		completedLessons,
		completedUnits,
		label: `${formatLessonUnitCount(completedUnits)}/${formatLessonUnitCount(totalUnits)}`,
		remainingLabel: `${formatLessonUnitCount(remainingUnits)} left`,
		totalUnits,
	}
}

export function formatCompletedLessonDatesText(lessons: Lesson[]) {
	if (lessons.length === 0) return 'No completed lessons yet.'

	const groups = new Map<string, number[]>()
	for (const lesson of lessons) {
		const date = new Date(lesson.startsAt)
		const key = new Intl.DateTimeFormat('ru-RU', { month: 'long' }).format(date)
		const days = groups.get(key) ?? []
		days.push(date.getDate())
		groups.set(key, days)
	}

	return Array.from(groups.entries())
		.map(([month, days]) => `${days.join(', ')} - ${month}`)
		.join('\n')
}

export function getStudentPlanLabel(student: StudentWithBalance) {
	const durationPrice = getStudentDurationPrice(student)
	if (student.billingMode === 'monthly') return `Monthly plan · ${formatUsdAmount(durationPrice)}`
	if (student.billingMode === 'package') {
		const packageLessonPrice = getPackageLessonPrice(student)
		return packageLessonPrice > 0
			? `${student.packageMonths || '-'} mo · ${formatUsdAmount(packageLessonPrice)} lesson`
			: 'Package not priced'
	}
	return `${formatUsdAmount(durationPrice)} lesson`
}

export function getLessonsLeftLabel(student: StudentWithBalance) {
	if (student.billingMode === 'package') return `${student.packageLessonCount} lessons`
	return `${student.balance.unpaidLessonCount} unpaid`
}

export function getNextPaymentLabel(student: StudentWithBalance, nextLesson?: Lesson) {
	if (student.balance.overdue) return 'Due now'
	if (nextLesson) return `After ${formatDateShort(nextLesson.startsAt)}`
	return 'Not scheduled'
}

export function selectStudentLedgerProjection(student: StudentWithBalance, lessons: Lesson[], now: Date) {
	const stats = selectStudentLessonStats(student.id, lessons, now)

	return {
		billingLabel: getBillingModeLabel(student.billingMode),
		balanceTone: getBalanceTone(student.balance),
		lessonsLeft: getLessonsLeftLabel(student),
		nextPayment: getNextPaymentLabel(student, stats.nextLesson),
		packageLessonPrice: getPackageLessonPrice(student),
		packageSavings: getPackageSavings(student),
		packageTotal: getPackageTotalPrice(student),
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
