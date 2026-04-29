import { getPackageTotalPrice } from '@/lib/crm/model'
import type { TeacherCrmState } from '@/lib/crm/types'

import type { Student } from '@teacher-crm/api-types'

export const emptyBalance = (student: Student) => ({
	studentId: student.id,
	currency: student.currency,
	charged: 0,
	paid: 0,
	balance: 0,
	unpaidLessonCount: 0,
	overdue: false,
	otherCurrencyBalances: [],
	nextPayment: {
		status: student.billingMode === 'package' ? ('due_now' as const) : ('not_scheduled' as const),
		dueNow: student.billingMode === 'package',
		amount: student.billingMode === 'package' ? getPackageTotalPrice(student) : 0,
		currency: student.currency,
	},
})

export function mergeStudentIntoState(state: TeacherCrmState, student: Student): TeacherCrmState {
	return {
		...state,
		students: state.students.map((item) => (item.id === student.id ? student : item)),
	}
}
