import type { ReactNode } from 'react'

import type {
	AttendanceRecord,
	CalendarBusyInterval,
	CalendarConnection,
	CalendarSyncRecord,
	CreateLessonInput,
	Lesson,
	MarkAttendanceInput,
	Student,
	UpdateLessonInput,
} from '@teacher-crm/api-types'

export type LessonsPanelProps = {
	lessons: Lesson[]
	students: Student[]
	attendanceRecords?: AttendanceRecord[]
	calendarConnection?: CalendarConnection
	calendarSyncRecords: CalendarSyncRecord[]
	title?: string
	description?: string
	toolbar?: ReactNode
	onAddLesson: (input: CreateLessonInput) => Promise<void>
	onUpdateLesson: (lessonId: string, input: UpdateLessonInput) => Promise<void>
	onCancelLesson: (lessonId: string) => Promise<void>
	onDeleteLesson: (lessonId: string) => Promise<void>
	onMarkAttendance?: (input: MarkAttendanceInput) => Promise<void>
	onCheckCalendarConflicts?: (input: CreateLessonInput) => Promise<CalendarBusyInterval[]>
	onConnectCalendar?: () => void
	previewMode?: boolean
}

export type LessonTone = {
	badge: 'green' | 'red' | 'amber' | 'neutral'
	rail: string
	frame: string
}

export type LessonListItemProps = {
	lesson: Lesson
	students: Student[]
	attendanceRecords: AttendanceRecord[]
	calendarConnection?: CalendarConnection
	calendarSyncRecords: CalendarSyncRecord[]
	previewMode: boolean
	onEdit: (lesson: Lesson) => void
	onUpdateLesson: (lessonId: string, input: UpdateLessonInput) => Promise<void>
	onCancelLesson: (lessonId: string) => Promise<void>
	onDeleteLesson: (lessonId: string) => Promise<void>
	onMarkAttendance?: (input: MarkAttendanceInput) => Promise<void>
}
