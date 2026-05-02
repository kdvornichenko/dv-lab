import type { CalendarListEntry } from '@teacher-crm/api-types'

import type { TeacherCrmState, TeacherCrmSummary } from '@/lib/crm/types'

export type TeacherCrmCacheSnapshot = {
	state: TeacherCrmState
	summary: TeacherCrmSummary
	calendarOptions: CalendarListEntry[]
	updatedAt: number
}

export type TeacherCrmLoadError = {
	source: 'core' | 'billing'
	message: string
}
