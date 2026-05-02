import type { ReactNode } from 'react'

import type { CalendarBusyInterval, CreateLessonInput, DeleteLessonQuery, Lesson, Student } from '@teacher-crm/api-types'

export type LessonFormCommand = CreateLessonInput & {
	applyToFuture?: boolean
	occurrenceStartsAt?: string
}

export type CalendarConflictCommand = CreateLessonInput & {
	excludeLessonId?: string
}

export type LessonFormValues = {
	date: string
	time: string
	durationMinutes: string
	topic: string
	notes: string
	status: Lesson['status']
	studentId: string
	repeatWeekly: boolean
	repeatCount: string
	applyToFuture: boolean
}

export type LessonFormErrors = Partial<Record<keyof LessonFormValues | 'startsAt', string>>

export type FormSubmitEvent = {
	preventDefault: () => void
}

export type LessonFormDialogProps = {
	open: boolean
	students: Student[]
	lessons: Lesson[]
	lesson?: Lesson | null
	occurrenceStartsAt?: string | null
	defaultStartsAt?: Date | null
	onOpenChange: (open: boolean) => void
	onSubmit: (input: LessonFormCommand) => Promise<void>
	onDelete?: (options?: DeleteLessonQuery) => Promise<void>
	onCheckCalendarConflicts?: (input: CalendarConflictCommand) => Promise<CalendarBusyInterval[]>
}

export type LessonFieldProps = {
	label: string
	error?: string
	className?: string
	children: ReactNode
}
