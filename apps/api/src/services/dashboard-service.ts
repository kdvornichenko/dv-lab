import { buildDashboardSummary, type DashboardSummary } from '@teacher-crm/api-types'

import { lessonService } from './lesson-service'
import { paymentService } from './payment-service'
import type { StoreScope } from './store-scope'
import { studentService } from './student-service'

export const dashboardService = {
	async getDashboardSummary(scope: StoreScope): Promise<DashboardSummary> {
		const [students, lessons, attendance, payments, balances] = await Promise.all([
			studentService.listStudents(scope, { status: 'all', search: '' }),
			lessonService.listLessons(scope, { status: 'all', studentId: '', dateFrom: '', dateTo: '' }),
			lessonService.listAttendance(scope),
			paymentService.listPayments(scope),
			paymentService.listStudentBalances(scope),
		])
		return buildDashboardSummary({ students, lessons, attendance, payments, balances })
	},
}
