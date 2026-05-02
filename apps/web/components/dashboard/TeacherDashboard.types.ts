import type { TeacherCrm } from '@/components/workspace/TeacherCrmPageShell'

import type { Currency } from '@teacher-crm/api-types'

export type DashboardContentProps = {
	crm: TeacherCrm
	now: Date
}

export type FocusPanelProps = {
	overdueStudents: number
	atRiskStudent?: string
	monthIncomeByCurrency: Record<Currency, number>
	todayLessonCount: number
	cancelledToday: number
}
