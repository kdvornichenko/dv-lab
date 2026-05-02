import type { ReactNode } from 'react'

import type { CalendarEvent } from '@/components/calendar/Calendar'

import type {
	CalendarBlock,
	CalendarBusyInterval,
	CalendarSyncRecord,
	CreateCalendarBlockInput,
	CreateLessonInput,
	DeleteLessonQuery,
	Lesson,
	LessonOccurrenceException,
	Student,
	UpdateCalendarBlockInput,
	UpdateLessonInput,
} from '@teacher-crm/api-types'

export type LessonsCalendarPanelProps = {
	lessons: Lesson[]
	students: Student[]
	calendarSyncRecords: CalendarSyncRecord[]
	calendarBlocks: CalendarBlock[]
	lessonOccurrenceExceptions: LessonOccurrenceException[]
	onAddLesson: (input: CreateLessonInput) => Promise<void>
	onUpdateLesson: (lessonId: string, input: UpdateLessonInput) => Promise<void>
	onDeleteLesson: (lessonId: string, options?: DeleteLessonQuery) => Promise<void>
	onAddCalendarBlock: (input: CreateCalendarBlockInput) => Promise<void>
	onUpdateCalendarBlock: (blockId: string, input: UpdateCalendarBlockInput) => Promise<void>
	onDeleteCalendarBlock: (blockId: string) => Promise<void>
	onCheckCalendarConflicts?: (input: CreateLessonInput) => Promise<CalendarBusyInterval[]>
}

export type PersonalBlockDialogProps = {
	open: boolean
	block: CalendarBlock | null
	defaultStartsAt: Date | null
	onOpenChange: (open: boolean) => void
	onSubmit: (input: CreateCalendarBlockInput | UpdateCalendarBlockInput) => Promise<void>
	onDelete?: () => Promise<void>
}

export type SlotChoiceDialogProps = {
	startsAt: Date | null
	onClose: () => void
	onAddLesson: () => void
	onAddBlock: () => void
}

export type DropScopeDialogProps = {
	pendingDrop: { event: CalendarEvent; startsAt: Date } | null
	onClose: () => void
	onApply: (scope: 'current' | 'series') => Promise<void>
}

export type CalendarFieldProps = {
	label: string
	children: ReactNode
}
