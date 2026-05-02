import type { ComponentType } from 'react'

import type { StudentWithBalance } from '@/lib/crm/types'

import type { Lesson } from '@teacher-crm/api-types'

export type StudentProfilePaneProps = {
	student: StudentWithBalance | null
	lessons: Lesson[]
	now: Date
}

export type ProfileMetricTone = 'sage' | 'success' | 'warning' | 'danger'

export type ProfileMetricProps = {
	icon: ComponentType<{ className?: string }>
	label: string
	value: string | number
	tone: ProfileMetricTone
}

export type ProfileRowProps = {
	icon: ComponentType<{ className?: string }>
	label: string
	value: string
	multiline?: boolean
}
