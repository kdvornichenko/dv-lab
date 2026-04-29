import type { Currency, DashboardSummary } from '@teacher-crm/api-types'

import { lessonService } from './lesson-service'
import { paymentService } from './payment-service'
import type { StoreScope } from './store-scope'
import { studentService } from './student-service'

export const dashboardService = {
	async getDashboardSummary(scope: StoreScope): Promise<DashboardSummary> {
		const todayKey = new Date().toISOString().slice(0, 10)
		const startOfMonth = new Date()
		startOfMonth.setDate(1)
		startOfMonth.setHours(0, 0, 0, 0)
		const [students, lessons, attendance, payments, balances] = await Promise.all([
			studentService.listStudents(scope, { status: 'all', search: '' }),
			lessonService.listLessons(scope, { status: 'all', studentId: '', dateFrom: '', dateTo: '' }),
			lessonService.listAttendance(scope),
			paymentService.listPayments(scope),
			paymentService.listStudentBalances(scope),
		])
		const monthIncomeByCurrency = payments
			.filter((payment) => new Date(payment.paidAt) >= startOfMonth)
			.reduce(
				(totals, payment) => {
					totals[payment.currency] += payment.amount
					return totals
				},
				{ RUB: 0, KZT: 0 } satisfies Record<Currency, number>
			)

		return {
			activeStudents: students.filter((student) => student.status === 'active').length,
			todayLessonCount: lessons.filter((lesson) => lesson.startsAt.slice(0, 10) === todayKey).length,
			missingAttendanceCount: lessons.filter((lesson) => {
				if (lesson.startsAt.slice(0, 10) !== todayKey) return false
				return lesson.studentIds.some(
					(studentId) => !attendance.some((record) => record.lessonId === lesson.id && record.studentId === studentId)
				)
			}).length,
			overdueStudentCount: balances.filter(
				(balance) => balance.overdue || Boolean(balance.otherCurrencyBalances?.some((item) => item.overdue))
			).length,
			monthIncomeRub: monthIncomeByCurrency.RUB,
			monthIncome: monthIncomeByCurrency.RUB,
			monthIncomeByCurrency,
		}
	},
}
