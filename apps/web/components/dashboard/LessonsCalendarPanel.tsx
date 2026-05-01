import { useMemo, useState } from 'react'

import { enUS } from 'date-fns/locale'
import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react'

import {
	Calendar,
	CalendarCurrentDate,
	type CalendarEvent,
	CalendarNextTrigger,
	CalendarPrevTrigger,
	CalendarTodayTrigger,
	CalendarViewStage,
	CalendarViewTrigger,
} from '@/components/calendar/Calendar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { lessonDisplayTitle } from '@/lib/crm/model'

import type {
	CalendarBusyInterval,
	CalendarSyncRecord,
	CreateLessonInput,
	Lesson,
	Student,
	UpdateLessonInput,
} from '@teacher-crm/api-types'

import { LessonFormDialog } from './LessonFormDialog'

const RECURRING_LESSON_OCCURRENCES = 104
const LESSON_EVENT_ID_SEPARATOR = '::'

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
	if (lesson.status === 'no_show') return 'orange'
	return 'default'
}

function lessonAttendees(lesson: Lesson, students: Student[]) {
	return lesson.studentIds
		.map((id) => students.find((student) => student.id === id))
		.filter((student): student is Student => Boolean(student))
		.map((student) =>
			student.fullName
				.split(/\s+/)
				.map((part) => part[0])
				.join('')
				.slice(0, 2)
				.toUpperCase()
		)
}

function calendarSyncBadge(syncRecord?: CalendarSyncRecord): NonNullable<CalendarEvent['badges']>[number] | undefined {
	if (!syncRecord) return undefined

	if (syncRecord.status === 'synced') return { label: 'Google synced', tone: 'success' }
	if (syncRecord.status === 'failed') return { label: 'Google failed', tone: 'danger' }
	if (syncRecord.status === 'not_synced') return { label: 'Google pending', tone: 'neutral' }
	if (syncRecord.status === 'disabled') return { label: 'Google off', tone: 'neutral' }
}

function lessonToCalendarEvent(
	lesson: Lesson,
	students: Student[],
	syncRecordsByLessonId: Map<string, CalendarSyncRecord>,
	occurrenceIndex = 0
): CalendarEvent {
	const start = new Date(lesson.startsAt)
	if (occurrenceIndex > 0) start.setDate(start.getDate() + occurrenceIndex * 7)
	const end = new Date(start.getTime() + lesson.durationMinutes * 60_000)
	const syncRecord = syncRecordsByLessonId.get(lesson.id)
	const badge = calendarSyncBadge(syncRecord)

	return {
		id: `${lesson.id}${LESSON_EVENT_ID_SEPARATOR}${occurrenceIndex}`,
		start,
		end,
		title: lessonDisplayTitle(lesson, students),
		subtitle: lesson.title,
		location: syncRecord?.externalEventId ? 'Google Calendar' : 'Teacher CRM lesson',
		attendees: lessonAttendees(lesson, students),
		color: lessonEventColor(lesson),
		isAlert: syncRecord?.status === 'failed',
		badges: badge ? [badge] : undefined,
	}
}

function lessonToCalendarEvents(
	lesson: Lesson,
	students: Student[],
	syncRecordsByLessonId: Map<string, CalendarSyncRecord>
) {
	if (!lesson.repeatWeekly) return [lessonToCalendarEvent(lesson, students, syncRecordsByLessonId)]
	return Array.from({ length: RECURRING_LESSON_OCCURRENCES }, (_, index) =>
		lessonToCalendarEvent(lesson, students, syncRecordsByLessonId, index)
	)
}

function lessonIdFromCalendarEventId(eventId: string) {
	return eventId.split(LESSON_EVENT_ID_SEPARATOR)[0] ?? eventId
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
	const syncRecordsByLessonId = useMemo(
		() => new Map(calendarSyncRecords.map((record) => [record.lessonId, record])),
		[calendarSyncRecords]
	)
	const events = useMemo(
		() => lessons.flatMap((lesson) => lessonToCalendarEvents(lesson, students, syncRecordsByLessonId)),
		[lessons, students, syncRecordsByLessonId]
	)
	const syncedCount = calendarSyncRecords.filter((record) => record.status === 'synced').length
	const failedCount = calendarSyncRecords.filter((record) => record.status === 'failed').length
	const formOpen = isCreateOpen || Boolean(editingLesson)

	return (
		<section className="border-line bg-surface flex min-h-dvh flex-col overflow-hidden border shadow-[0_18px_55px_-46px_var(--shadow-sage)]">
			<Calendar
				view="week"
				locale={enUS}
				events={events}
				onEventClick={(event) => {
					const lesson = lessons.find((item) => item.id === lessonIdFromCalendarEventId(event.id))
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
								Agenda
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
					<CalendarViewStage />
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
