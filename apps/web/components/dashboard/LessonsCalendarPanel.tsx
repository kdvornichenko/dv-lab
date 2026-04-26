import { useMemo, useState } from 'react'

import { ru } from 'date-fns/locale'
import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react'

import {
	Calendar,
	CalendarCurrentDate,
	CalendarDayView,
	type CalendarEvent,
	CalendarMonthView,
	CalendarNextTrigger,
	CalendarPrevTrigger,
	CalendarTodayTrigger,
	CalendarViewTrigger,
	CalendarWeekView,
} from '@/components/calendar/Calendar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatTime, lessonDisplayTitle } from '@/lib/crm/model'

import type {
	CalendarBusyInterval,
	CalendarSyncRecord,
	CreateLessonInput,
	Lesson,
	Student,
	UpdateLessonInput,
} from '@teacher-crm/api-types'

import { LessonFormDialog } from './LessonFormDialog'

type LessonsCalendarPanelProps = {
	lessons: Lesson[]
	students: Student[]
	calendarSyncRecords: CalendarSyncRecord[]
	onAddLesson: (input: CreateLessonInput) => Promise<void>
	onUpdateLesson: (lessonId: string, input: UpdateLessonInput) => Promise<void>
	onCheckCalendarConflicts?: (input: CreateLessonInput) => Promise<CalendarBusyInterval[]>
}

function lessonEventColor(lesson: Lesson): CalendarEvent['color'] {
	if (lesson.status === 'completed') return 'green'
	if (lesson.status === 'cancelled') return 'pink'
	if (lesson.status === 'rescheduled') return 'purple'
	return 'default'
}

function lessonToCalendarEvent(lesson: Lesson, students: Student[]): CalendarEvent {
	const start = new Date(lesson.startsAt)
	const end = new Date(start.getTime() + lesson.durationMinutes * 60_000)
	return {
		id: lesson.id,
		start,
		end,
		title: `${formatTime(lesson.startsAt)} ${lessonDisplayTitle(lesson, students)}`,
		color: lessonEventColor(lesson),
	}
}

export function LessonsCalendarPanel({
	lessons,
	students,
	calendarSyncRecords,
	onAddLesson,
	onUpdateLesson,
	onCheckCalendarConflicts,
}: LessonsCalendarPanelProps) {
	const [isCreateOpen, setIsCreateOpen] = useState(false)
	const [editingLesson, setEditingLesson] = useState<Lesson | null>(null)
	const [defaultStartsAt, setDefaultStartsAt] = useState<Date | null>(null)
	const events = useMemo(() => lessons.map((lesson) => lessonToCalendarEvent(lesson, students)), [lessons, students])
	const syncedCount = calendarSyncRecords.filter((record) => record.status === 'synced').length
	const failedCount = calendarSyncRecords.filter((record) => record.status === 'failed').length
	const formOpen = isCreateOpen || Boolean(editingLesson)

	return (
		<section className="border-line bg-surface flex min-h-dvh flex-col overflow-hidden border shadow-[0_18px_55px_-46px_var(--shadow-sage)]">
			<Calendar
				view="week"
				locale={ru}
				events={events}
				onEventClick={(event) => {
					const lesson = lessons.find((item) => item.id === event.id)
					if (lesson) {
						setDefaultStartsAt(null)
						setEditingLesson(lesson)
					}
				}}
				onTimeSlotClick={(startsAt) => {
					setEditingLesson(null)
					setDefaultStartsAt(startsAt)
					setIsCreateOpen(true)
				}}
			>
				<header className="border-line-soft bg-surface-muted flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
					<div>
						<p className="text-sage font-mono text-xs font-semibold uppercase">Lesson calendar</p>
						<h1 className="font-heading text-ink mt-1 text-lg font-semibold">
							<CalendarCurrentDate />
						</h1>
					</div>
					<div className="flex flex-wrap items-center justify-end gap-2">
						<Badge tone="neutral" className="font-mono tabular-nums">
							{lessons.length} lessons
						</Badge>
						<Badge tone={failedCount > 0 ? 'red' : 'green'} className="font-mono tabular-nums">
							{syncedCount} synced
						</Badge>
						<CalendarTodayTrigger className="h-9 px-3 text-xs">Today</CalendarTodayTrigger>
						<CalendarPrevTrigger className="h-9 w-9">
							<ChevronLeft className="h-4 w-4" />
						</CalendarPrevTrigger>
						<CalendarNextTrigger className="h-9 w-9">
							<ChevronRight className="h-4 w-4" />
						</CalendarNextTrigger>
						<div className="border-line-soft bg-surface flex rounded-lg border p-1">
							<CalendarViewTrigger
								view="day"
								className="aria-current:bg-sage aria-current:text-primary-foreground h-7 px-2 text-xs"
							>
								Day
							</CalendarViewTrigger>
							<CalendarViewTrigger
								view="week"
								className="aria-current:bg-sage aria-current:text-primary-foreground h-7 px-2 text-xs"
							>
								Week
							</CalendarViewTrigger>
							<CalendarViewTrigger
								view="month"
								className="aria-current:bg-sage aria-current:text-primary-foreground h-7 px-2 text-xs"
							>
								Month
							</CalendarViewTrigger>
						</div>
						<Button
							size="sm"
							onClick={() => {
								setDefaultStartsAt(null)
								setIsCreateOpen(true)
							}}
						>
							<CalendarPlus className="h-4 w-4" />
							Add lesson
						</Button>
					</div>
				</header>
				<div className="min-h-168 bg-surface h-[calc(100dvh-5rem)] overflow-hidden">
					<CalendarDayView />
					<CalendarWeekView />
					<CalendarMonthView />
				</div>
			</Calendar>
			<LessonFormDialog
				open={formOpen}
				students={students}
				lessons={lessons}
				lesson={editingLesson}
				defaultStartsAt={defaultStartsAt}
				onCheckCalendarConflicts={onCheckCalendarConflicts}
				onOpenChange={(open) => {
					if (open) return
					setIsCreateOpen(false)
					setEditingLesson(null)
					setDefaultStartsAt(null)
				}}
				onSubmit={async (input) => {
					if (editingLesson) {
						await onUpdateLesson(editingLesson.id, input)
						setEditingLesson(null)
					} else {
						await onAddLesson(input)
						setIsCreateOpen(false)
						setDefaultStartsAt(null)
					}
				}}
			/>
		</section>
	)
}
