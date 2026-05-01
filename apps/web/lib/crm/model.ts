import type {
	AttendanceRecord,
	AttendanceStatus,
	CalendarConnection,
	CalendarSyncRecord,
	Currency,
	Lesson,
	Payment,
	Student,
	StudentBalance,
} from '@teacher-crm/api-types'
import {
	DEFAULT_LESSON_DURATION_MINUTES,
	calculateMonthlyLessonCount,
	calculateMonthlyTotalPrice,
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
const CHARGEABLE_LESSON_STATUSES = ['completed', 'no_show'] as const

export type LedgerTone = 'green' | 'amber' | 'neutral' | 'red'

export function formatRubAmount(value: number) {
	return formatCurrencyAmount(value, 'RUB')
}

export const formatUsdAmount = formatRubAmount

export function formatCurrencyAmount(value: number, currency: Currency = 'RUB') {
	return new Intl.NumberFormat(currency === 'KZT' ? 'kk-KZ' : 'ru-RU', {
		style: 'currency',
		currency,
		maximumFractionDigits: 0,
	}).format(value)
}

export function formatCurrencyTotals(totals: Partial<Record<Currency, number>>) {
	const entries = (Object.entries(totals) as [Currency, number][]).filter(([, amount]) => amount > 0)
	if (entries.length === 0) return formatCurrencyAmount(0, 'RUB')
	return entries.map(([currency, amount]) => formatCurrencyAmount(amount, currency)).join(' · ')
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

export function formatDateShortEn(value: string | Date) {
	return new Intl.DateTimeFormat('en-US', {
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
	return attendance.filter(
		(record) => record.lessonId === lesson.id && (record.status === 'attended' || record.status === 'no_show')
	).length
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
		noShow: records.filter((record) => record.status === 'no_show').length,
		rescheduled: records.filter((record) => record.status === 'rescheduled').length,
		total: lesson.studentIds.length,
	}
}

export function isLessonAbsentFree(lesson: Lesson, attendance: AttendanceRecord[]) {
	if (lesson.studentIds.length === 0) return false
	const recordsByStudentId = new Map(
		attendance.filter((record) => record.lessonId === lesson.id).map((record) => [record.studentId, record])
	)

	return lesson.studentIds.every((studentId) => {
		const record = recordsByStudentId.get(studentId)
		return record?.status === 'absent' && record.billable === false
	})
}

export function buildLessonAttendanceRecords(lesson: Lesson, status: AttendanceStatus, billable: boolean) {
	return lesson.studentIds.map((studentId) => ({
		studentId,
		status,
		billable,
	}))
}

export function selectMissingAttendanceLessons(lessons: Lesson[], attendance: AttendanceRecord[]) {
	return lessons.filter((lesson) => !isLessonAttendanceMarked(lesson, attendance))
}

export function selectOverdueStudents(students: StudentWithBalance[]) {
	return students.filter(
		(student) =>
			student.balance.overdue || Boolean(student.balance.otherCurrencyBalances?.some((balance) => balance.overdue))
	)
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
	return balance.overdue || balance.otherCurrencyBalances?.some((item) => item.overdue) ? 'red' : 'green'
}

export function getStudentDurationUnits(student: Pick<Student, 'defaultLessonDurationMinutes'>) {
	return getLessonDurationUnits(student.defaultLessonDurationMinutes || DEFAULT_LESSON_DURATION_MINUTES)
}

export function getStudentDurationPrice(student: Pick<Student, 'defaultLessonPrice' | 'defaultLessonDurationMinutes'>) {
	return student.defaultLessonPrice * getStudentDurationUnits(student)
}

export function isChargeableLessonStatus(status: Lesson['status']) {
	return (CHARGEABLE_LESSON_STATUSES as readonly string[]).includes(status)
}

function isProjectedPackageLesson(lesson: Lesson, now: Date) {
	if (isChargeableLessonStatus(lesson.status)) return true
	return lesson.status === 'planned' && new Date(lesson.startsAt).getTime() >= now.getTime()
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
	const attendedCount = relatedLessons.filter((lesson) => isChargeableLessonStatus(lesson.status)).length
	const nextLesson = relatedLessons
		.filter((lesson) => new Date(lesson.startsAt).getTime() >= now.getTime() && lesson.status === 'planned')
		.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0]

	return { relatedLessons, attendedCount, nextLesson }
}

export function getLessonUnitCount(lesson: Pick<Lesson, 'durationMinutes'>) {
	return getLessonDurationUnits(lesson.durationMinutes)
}

export function formatLessonUnitCount(value: number) {
	return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '')
}

function estimatePackagePaymentDate(
	student: Student,
	scheduledUnits: number,
	anchor: string | Date | undefined,
	now: Date
) {
	const totalUnits = student.packageLessonCount * getStudentDurationUnits(student)
	const weeklyUnits = student.packageLessonsPerWeek * getStudentDurationUnits(student)
	if (totalUnits <= 0 || weeklyUnits <= 0) return undefined

	const remainingUnits = Math.max(totalUnits - scheduledUnits, 0)
	const remainingWeeks = Math.ceil(remainingUnits / weeklyUnits)
	const date = new Date(anchor ?? now)
	date.setDate(date.getDate() + remainingWeeks * 7)
	return date.toISOString()
}

export function selectStudentPackageProgress(student: StudentWithBalance, lessons: Lesson[], now = new Date()) {
	const backendProgress = student.balance.packageProgress
	if (backendProgress) {
		const completedLessons = backendProgress.completedLessonIds
			.map((lessonId) => lessons.find((lesson) => lesson.id === lessonId))
			.filter((lesson): lesson is Lesson => Boolean(lesson))
		const projectedPaymentLesson = backendProgress.projectedPaymentLessonId
			? lessons.find((lesson) => lesson.id === backendProgress.projectedPaymentLessonId)
			: undefined

		return {
			completedLessons,
			completedUnits: backendProgress.consumedUnits,
			estimatedPaymentDate: projectedPaymentLesson ? undefined : backendProgress.projectedPaymentDate,
			label: `${formatLessonUnitCount(backendProgress.consumedUnits)}/${formatLessonUnitCount(backendProgress.totalUnits)}`,
			projectedPaymentDate: backendProgress.projectedPaymentDate,
			projectedPaymentLesson,
			remainingLabel: `${formatLessonUnitCount(backendProgress.remainingUnits)} left`,
			remainingUnits: backendProgress.remainingUnits,
			totalUnits: backendProgress.totalUnits,
		}
	}

	const packageLessons = lessons
		.filter((lesson) => lesson.studentIds.includes(student.id))
		.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
	const completedLessons = packageLessons.filter((lesson) => isChargeableLessonStatus(lesson.status))
	const completedUnits = completedLessons.reduce((sum, lesson) => sum + getLessonUnitCount(lesson), 0)
	const totalUnits = student.packageLessonCount * getStudentDurationUnits(student)
	const remainingUnits = Math.max(totalUnits - completedUnits, 0)
	const projectedLessons = packageLessons.filter((lesson) => isProjectedPackageLesson(lesson, now))
	let projectedUnits = 0
	let projectedPaymentLesson: Lesson | undefined

	for (const lesson of projectedLessons) {
		projectedUnits += getLessonUnitCount(lesson)
		if (totalUnits > 0 && projectedUnits >= totalUnits) {
			projectedPaymentLesson = lesson
			break
		}
	}

	const lastProjectedLesson = projectedLessons.at(-1)
	const estimatedPaymentDate = projectedPaymentLesson
		? undefined
		: estimatePackagePaymentDate(student, projectedUnits, lastProjectedLesson?.startsAt, now)

	return {
		completedLessons,
		completedUnits,
		estimatedPaymentDate,
		label: `${formatLessonUnitCount(completedUnits)}/${formatLessonUnitCount(totalUnits)}`,
		projectedPaymentDate: projectedPaymentLesson?.startsAt ?? estimatedPaymentDate,
		projectedPaymentLesson,
		remainingLabel: `${formatLessonUnitCount(remainingUnits)} left`,
		remainingUnits,
		totalUnits,
	}
}

export function formatCompletedLessonDatesText(lessons: Lesson[]) {
	if (lessons.length === 0) return 'No charged lessons yet.'

	const groups = new Map<string, number[]>()
	for (const lesson of lessons) {
		const date = new Date(lesson.startsAt)
		const key = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date)
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
	const formatStudentAmount = (value: number) => formatCurrencyAmount(value, student.currency)
	if (student.billingMode === 'monthly') {
		const monthlyLessonCount = calculateMonthlyLessonCount({ lessonsPerWeek: student.packageLessonsPerWeek })
		const monthlyTotal = calculateMonthlyTotalPrice({
			defaultLessonPrice: student.defaultLessonPrice,
			defaultLessonDurationMinutes: student.defaultLessonDurationMinutes,
			lessonsPerWeek: student.packageLessonsPerWeek,
		})
		return monthlyLessonCount > 0
			? `Monthly plan · ${monthlyLessonCount} lessons · ${formatStudentAmount(monthlyTotal)}`
			: `Monthly plan · ${formatStudentAmount(durationPrice)}`
	}
	if (student.billingMode === 'package') {
		const packageLessonPrice = getPackageLessonPrice(student)
		return packageLessonPrice > 0
			? `${student.packageMonths || '-'} mo · ${formatStudentAmount(packageLessonPrice)} lesson`
			: 'Package not priced'
	}
	return `${formatStudentAmount(durationPrice)} lesson`
}

export function getLessonsLeftLabel(
	student: StudentWithBalance,
	packageProgress?: ReturnType<typeof selectStudentPackageProgress>
) {
	if (student.billingMode === 'package')
		return packageProgress?.remainingLabel ?? `${student.packageLessonCount} lessons`
	return `${student.balance.unpaidLessonCount} unpaid`
}

export function getNextPaymentLabel(
	student: StudentWithBalance,
	nextLesson?: Lesson,
	packageProgress?: ReturnType<typeof selectStudentPackageProgress>
) {
	const projectedDate = student.balance.nextPayment.projectedDate
	if (student.balance.nextPayment.status === 'due_now') return 'Due now'
	if (student.balance.nextPayment.status === 'not_configured') return 'Plan not configured'
	if (student.balance.nextPayment.status === 'not_scheduled') return 'Not scheduled'
	if (student.balance.nextPayment.status === 'after_projected_lesson' && projectedDate)
		return `After ${formatDateShortEn(projectedDate)}`
	if (student.balance.nextPayment.status === 'estimated_after' && projectedDate)
		return `Est. after ${formatDateShortEn(projectedDate)}`
	if (student.balance.nextPayment.status === 'after_next_lesson' && projectedDate)
		return `After ${formatDateShortEn(projectedDate)}`

	if (student.balance.overdue) return 'Due now'
	if (student.billingMode === 'package') {
		if (!packageProgress || packageProgress.totalUnits <= 0) return 'Package not configured'
		if (packageProgress.remainingUnits <= 0) return 'Due now'
		if (packageProgress.projectedPaymentDate) {
			const prefix = packageProgress.projectedPaymentLesson ? 'After' : 'Est. after'
			return `${prefix} ${formatDateShortEn(packageProgress.projectedPaymentDate)}`
		}
		return 'Not scheduled'
	}
	if (nextLesson) return `After ${formatDateShort(nextLesson.startsAt)}`
	return 'Not scheduled'
}

export function selectStudentLedgerProjection(student: StudentWithBalance, lessons: Lesson[], now: Date) {
	const stats = selectStudentLessonStats(student.id, lessons, now)
	const packageProgress = selectStudentPackageProgress(student, lessons, now)

	return {
		billingLabel: getBillingModeLabel(student.billingMode),
		balanceTone: getBalanceTone(student.balance),
		lessonsLeft: getLessonsLeftLabel(student, packageProgress),
		nextPayment: getNextPaymentLabel(student, stats.nextLesson, packageProgress),
		packageProgress,
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
	const monthPayments = payments.filter((payment) => isSameCalendarMonth(payment.paidAt, now))
	const allBalances = studentBalances.flatMap((balance) => [balance, ...(balance.otherCurrencyBalances ?? [])])
	const monthIncomeByCurrency = monthPayments.reduce(
		(totals, payment) => {
			totals[payment.currency] += payment.amount
			return totals
		},
		{ RUB: 0, KZT: 0 } satisfies Record<Currency, number>
	)

	return {
		monthIncome: monthIncomeByCurrency.RUB,
		monthIncomeByCurrency,
		paidThisWeek: payments.filter((payment) => isThisWeek(payment.paidAt, now)).length,
		overdueTotal: allBalances
			.filter((balance) => balance.overdue)
			.reduce((sum, balance) => sum + Math.abs(balance.balance), 0),
	}
}
