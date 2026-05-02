import type { ComponentProps, ReactNode } from 'react'

import type { Button } from '@/components/ui/button'
import type { StudentWithBalance } from '@/lib/crm/types'

import type { CreatePaymentInput, CreateStudentInput, Lesson } from '@teacher-crm/api-types'

export type StudentFilter = 'all' | StudentWithBalance['status']

export type StudentsPanelProps = {
	visibleStudents: StudentWithBalance[]
	lessons: Lesson[]
	filter: StudentFilter
	now: Date
	onFilterChange: (value: StudentFilter) => void
	onAddStudent: (input: CreateStudentInput) => Promise<void>
	onArchiveStudent: (studentId: string) => Promise<void>
	onRecordPayment: (input: CreatePaymentInput) => Promise<void>
	previewMode?: boolean
}

export type StudentLedgerItemProps = {
	student: StudentWithBalance
	lessons: Lesson[]
	now: Date
	settingsHref: string
	onRecordPayment: () => void
	onArchive: () => void
	previewMode: boolean
}

export type StudentMetricProps = {
	label: string
	value: string
}

export type StudentIconButtonProps = Omit<ComponentProps<typeof Button>, 'size' | 'aria-label'> & {
	label: string
	children: ReactNode
}
