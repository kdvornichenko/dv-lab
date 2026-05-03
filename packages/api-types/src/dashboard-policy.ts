type DashboardCurrency = 'RUB' | 'KZT'

export type DashboardSummaryInput = {
	students: Array<{ status: 'active' | 'paused' | 'archived' }>
	lessons: Array<{ id: string; startsAt: string; studentIds: string[] }>
	attendance: Array<{ lessonId: string; studentId: string }>
	payments: Array<{ amount: number; currency: DashboardCurrency; paidAt: string }>
	balances: Array<{ overdue: boolean; otherCurrencyBalances?: Array<{ overdue: boolean }> }>
}

export type DashboardSummaryResult = {
	activeStudents: number
	todayLessonCount: number
	missingAttendanceCount: number
	overdueStudentCount: number
	monthIncomeRub: number
	monthIncome: number
	monthIncomeByCurrency: Record<DashboardCurrency, number>
}

function policyDateOnly(value: string | Date) {
	const date = value instanceof Date ? value : new Date(value)
	if (Number.isNaN(date.getTime())) return ''
	return [
		date.getFullYear(),
		String(date.getMonth() + 1).padStart(2, '0'),
		String(date.getDate()).padStart(2, '0'),
	].join('-')
}

function policySameMonth(value: string | Date, anchor: Date) {
	const date = value instanceof Date ? value : new Date(value)
	return (
		!Number.isNaN(date.getTime()) &&
		date.getFullYear() === anchor.getFullYear() &&
		date.getMonth() === anchor.getMonth()
	)
}

export function buildDashboardSummary(input: DashboardSummaryInput, now = new Date()): DashboardSummaryResult {
	const todayKey = policyDateOnly(now)
	const attendanceKeys = new Set(input.attendance.map((record) => `${record.lessonId}:${record.studentId}`))
	const monthIncomeByCurrency = input.payments
		.filter((payment) => policySameMonth(payment.paidAt, now))
		.reduce(
			(totals, payment) => {
				totals[payment.currency] += payment.amount
				return totals
			},
			{ RUB: 0, KZT: 0 } satisfies Record<DashboardCurrency, number>
		)

	return {
		activeStudents: input.students.filter((student) => student.status === 'active').length,
		todayLessonCount: input.lessons.filter((lesson) => policyDateOnly(lesson.startsAt) === todayKey).length,
		missingAttendanceCount: input.lessons.filter((lesson) => {
			if (policyDateOnly(lesson.startsAt) !== todayKey) return false
			return lesson.studentIds.some((studentId) => !attendanceKeys.has(`${lesson.id}:${studentId}`))
		}).length,
		overdueStudentCount: input.balances.filter(
			(balance) => balance.overdue || Boolean(balance.otherCurrencyBalances?.some((item) => item.overdue))
		).length,
		monthIncomeRub: monthIncomeByCurrency.RUB,
		monthIncome: monthIncomeByCurrency.RUB,
		monthIncomeByCurrency,
	}
}
