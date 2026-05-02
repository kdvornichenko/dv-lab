import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { enUS } from 'date-fns/locale'
import { CalendarPlus, ChevronLeft, ChevronRight, Clock, LockKeyhole, Trash2 } from 'lucide-react'

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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { lessonDisplayTitle } from '@/lib/crm/model'

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

import { LessonFormDialog } from './LessonFormDialog'

const RECURRING_LESSON_OCCURRENCES = 104
const LESSON_EVENT_ID_SEPARATOR = '::'

type LessonsCalendarPanelProps = {
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
	const occurrenceStartsAt = start.toISOString()

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
		kind: 'lesson',
		lessonId: lesson.id,
		occurrenceIndex,
		occurrenceStartsAt,
		draggable: lesson.status !== 'cancelled',
	}
}

function lessonToCalendarEvents(
	lesson: Lesson,
	students: Student[],
	syncRecordsByLessonId: Map<string, CalendarSyncRecord>,
	exceptionsByOccurrence: Map<string, LessonOccurrenceException>
) {
	const count = lesson.repeatWeekly ? RECURRING_LESSON_OCCURRENCES : 1
	return Array.from({ length: count }, (_, index) =>
		lessonToCalendarEvent(lesson, students, syncRecordsByLessonId, index)
	).filter((event) => !exceptionsByOccurrence.has(`${lesson.id}:${event.occurrenceStartsAt}`))
}

function lessonIdFromCalendarEventId(eventId: string) {
	return eventId.split(LESSON_EVENT_ID_SEPARATOR)[0] ?? eventId
}

function calendarBlockToEvent(block: CalendarBlock): CalendarEvent {
	const start = new Date(block.startsAt)
	return {
		id: `block:${block.id}`,
		start,
		end: new Date(start.getTime() + block.durationMinutes * 60_000),
		title: block.title,
		subtitle: 'Personal block',
		location: block.externalEventId ? 'Google Calendar' : 'Teacher CRM block',
		color: block.syncStatus === 'failed' ? 'pink' : 'gray',
		isAlert: block.syncStatus === 'failed',
		badges: block.syncStatus === 'failed' ? [{ label: 'Google failed', tone: 'danger' }] : undefined,
		kind: 'block',
		blockId: block.id,
		draggable: true,
	}
}

function dateInputValue(value: Date) {
	return [
		value.getFullYear(),
		String(value.getMonth() + 1).padStart(2, '0'),
		String(value.getDate()).padStart(2, '0'),
	].join('-')
}

function timeInputValue(value: Date) {
	return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
}

export function LessonsCalendarPanel({
	lessons,
	students,
	calendarSyncRecords,
	calendarBlocks,
	lessonOccurrenceExceptions,
	onAddLesson,
	onUpdateLesson,
	onDeleteLesson,
	onAddCalendarBlock,
	onUpdateCalendarBlock,
	onDeleteCalendarBlock,
	onCheckCalendarConflicts,
}: LessonsCalendarPanelProps) {
	const [isCreateOpen, setIsCreateOpen] = useState(false)
	const [editingLesson, setEditingLesson] = useState<Lesson | null>(null)
	const [editingOccurrenceStartsAt, setEditingOccurrenceStartsAt] = useState<string | null>(null)
	const [editingBlock, setEditingBlock] = useState<CalendarBlock | null>(null)
	const [blockStartsAt, setBlockStartsAt] = useState<Date | null>(null)
	const [slotChoiceStartsAt, setSlotChoiceStartsAt] = useState<Date | null>(null)
	const [availabilityMode, setAvailabilityMode] = useState(false)
	const [pendingDrop, setPendingDrop] = useState<{ event: CalendarEvent; startsAt: Date } | null>(null)
	const [defaultStartsAt, setDefaultStartsAt] = useState<Date | null>(null)
	const syncRecordsByLessonId = useMemo(
		() => new Map(calendarSyncRecords.map((record) => [record.lessonId, record])),
		[calendarSyncRecords]
	)
	const exceptionsByOccurrence = useMemo(
		() =>
			new Map(
				lessonOccurrenceExceptions.map((exception) => [
					`${exception.lessonId}:${exception.occurrenceStartsAt}`,
					exception,
				])
			),
		[lessonOccurrenceExceptions]
	)
	const events = useMemo(
		() => [
			...lessons.flatMap((lesson) =>
				lessonToCalendarEvents(lesson, students, syncRecordsByLessonId, exceptionsByOccurrence)
			),
			...calendarBlocks.map(calendarBlockToEvent),
		],
		[calendarBlocks, exceptionsByOccurrence, lessons, students, syncRecordsByLessonId]
	)
	const syncedCount = calendarSyncRecords.filter((record) => record.status === 'synced').length
	const failedCount = calendarSyncRecords.filter((record) => record.status === 'failed').length
	const formOpen = isCreateOpen || Boolean(editingLesson)

	return (
		<section className="flex min-h-dvh flex-col overflow-hidden border border-line bg-surface shadow-[0_18px_55px_-46px_var(--shadow-sage)]">
			<Calendar
				view="week"
				locale={enUS}
				events={events}
				availabilityMode={availabilityMode}
				onEventClick={(event) => {
					if (event.kind === 'block' && event.blockId) {
						const block = calendarBlocks.find((item) => item.id === event.blockId)
						if (block) {
							setEditingBlock(block)
							setBlockStartsAt(null)
						}
						return
					}
					const lessonId = event.lessonId ?? lessonIdFromCalendarEventId(event.id)
					const lesson = lessons.find((item) => item.id === lessonId)
					if (lesson) {
						setDefaultStartsAt(null)
						setEditingOccurrenceStartsAt(event.occurrenceStartsAt ?? null)
						setEditingLesson(lesson)
					}
				}}
				onTimeSlotClick={(startsAt) => {
					if (availabilityMode) {
						setSlotChoiceStartsAt(startsAt)
						return
					}
					setEditingLesson(null)
					setEditingOccurrenceStartsAt(null)
					setDefaultStartsAt(startsAt)
					setIsCreateOpen(true)
				}}
				onEventDrop={(event, startsAt) => {
					if (event.kind === 'block' && event.blockId) {
						void onUpdateCalendarBlock(event.blockId, { startsAt: startsAt.toISOString() })
						return
					}
					if (event.kind === 'lesson') setPendingDrop({ event, startsAt })
				}}
			>
				<header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft bg-surface-muted px-4 py-3">
					<div>
						<p className="font-mono text-xs font-semibold text-sage uppercase">Lesson calendar</p>
						<h1 className="mt-1 font-heading text-lg font-semibold text-ink">
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
						<Button
							type="button"
							variant={availabilityMode ? 'default' : 'secondary'}
							size="sm"
							onClick={() => setAvailabilityMode((value) => !value)}
						>
							<LockKeyhole className="h-4 w-4" />
							Free slots
						</Button>
						<CalendarTodayTrigger className="h-9 px-3 text-xs">Today</CalendarTodayTrigger>
						<CalendarPrevTrigger className="h-9 w-9">
							<ChevronLeft className="h-4 w-4" />
						</CalendarPrevTrigger>
						<CalendarNextTrigger className="h-9 w-9">
							<ChevronRight className="h-4 w-4" />
						</CalendarNextTrigger>
						<div className="flex rounded-lg border border-line-soft bg-surface p-1">
							<CalendarViewTrigger
								view="day"
								className="h-7 px-2 text-xs aria-current:bg-sage aria-current:text-primary-foreground"
							>
								Agenda
							</CalendarViewTrigger>
							<CalendarViewTrigger
								view="week"
								className="h-7 px-2 text-xs aria-current:bg-sage aria-current:text-primary-foreground"
							>
								Week
							</CalendarViewTrigger>
							<CalendarViewTrigger
								view="month"
								className="h-7 px-2 text-xs aria-current:bg-sage aria-current:text-primary-foreground"
							>
								Month
							</CalendarViewTrigger>
						</div>
						<Button
							size="sm"
							onClick={() => {
								setDefaultStartsAt(null)
								setEditingOccurrenceStartsAt(null)
								setIsCreateOpen(true)
							}}
						>
							<CalendarPlus className="h-4 w-4" />
							Add lesson
						</Button>
					</div>
				</header>
				<div className="h-[calc(100dvh-5rem)] min-h-168 overflow-hidden bg-surface">
					<CalendarViewStage />
				</div>
			</Calendar>
			<LessonFormDialog
				open={formOpen}
				students={students}
				lessons={lessons}
				lesson={editingLesson}
				occurrenceStartsAt={editingOccurrenceStartsAt}
				defaultStartsAt={defaultStartsAt}
				onCheckCalendarConflicts={onCheckCalendarConflicts}
				onOpenChange={(open) => {
					if (open) return
					setIsCreateOpen(false)
					setEditingLesson(null)
					setEditingOccurrenceStartsAt(null)
					setDefaultStartsAt(null)
				}}
				onSubmit={async (input) => {
					if (editingLesson) {
						await onUpdateLesson(editingLesson.id, input)
						setEditingLesson(null)
						setEditingOccurrenceStartsAt(null)
					} else {
						await onAddLesson(input)
						setIsCreateOpen(false)
						setDefaultStartsAt(null)
					}
				}}
				onDelete={async (options) => {
					if (!editingLesson) return
					await onDeleteLesson(editingLesson.id, options)
					setEditingLesson(null)
					setEditingOccurrenceStartsAt(null)
				}}
			/>
			<PersonalBlockDialog
				open={Boolean(editingBlock || blockStartsAt)}
				block={editingBlock}
				defaultStartsAt={blockStartsAt}
				onOpenChange={(open) => {
					if (open) return
					setEditingBlock(null)
					setBlockStartsAt(null)
				}}
				onSubmit={async (input) => {
					if (editingBlock) {
						await onUpdateCalendarBlock(editingBlock.id, input)
						setEditingBlock(null)
					} else {
						await onAddCalendarBlock(input as CreateCalendarBlockInput)
						setBlockStartsAt(null)
					}
				}}
				onDelete={
					editingBlock
						? async () => {
								await onDeleteCalendarBlock(editingBlock.id)
								setEditingBlock(null)
							}
						: undefined
				}
			/>
			<SlotChoiceDialog
				startsAt={slotChoiceStartsAt}
				onClose={() => setSlotChoiceStartsAt(null)}
				onAddLesson={() => {
					setDefaultStartsAt(slotChoiceStartsAt)
					setSlotChoiceStartsAt(null)
					setIsCreateOpen(true)
				}}
				onAddBlock={() => {
					setBlockStartsAt(slotChoiceStartsAt)
					setSlotChoiceStartsAt(null)
				}}
			/>
			<DropScopeDialog
				pendingDrop={pendingDrop}
				onClose={() => setPendingDrop(null)}
				onApply={async (scope) => {
					if (!pendingDrop?.event.lessonId) return
					await onUpdateLesson(pendingDrop.event.lessonId, {
						startsAt: pendingDrop.startsAt.toISOString(),
						durationMinutes: Math.round((pendingDrop.event.end.getTime() - pendingDrop.event.start.getTime()) / 60_000),
						applyToFuture: scope === 'series',
						occurrenceStartsAt: scope === 'current' ? pendingDrop.event.occurrenceStartsAt : undefined,
					})
					setPendingDrop(null)
				}}
			/>
		</section>
	)
}

function startsAtFromDateTime(date: string, time: string) {
	const value = new Date(`${date}T${time}:00`)
	return Number.isNaN(value.getTime()) ? new Date() : value
}

function PersonalBlockDialog({
	open,
	block,
	defaultStartsAt,
	onOpenChange,
	onSubmit,
	onDelete,
}: {
	open: boolean
	block: CalendarBlock | null
	defaultStartsAt: Date | null
	onOpenChange: (open: boolean) => void
	onSubmit: (input: CreateCalendarBlockInput | UpdateCalendarBlockInput) => Promise<void>
	onDelete?: () => Promise<void>
}) {
	const initialStart = block ? new Date(block.startsAt) : (defaultStartsAt ?? new Date())
	const [title, setTitle] = useState(block?.title ?? 'Personal time')
	const [date, setDate] = useState(dateInputValue(initialStart))
	const [time, setTime] = useState(timeInputValue(initialStart))
	const [durationMinutes, setDurationMinutes] = useState(String(block?.durationMinutes ?? 60))
	const [isSubmitting, setIsSubmitting] = useState(false)

	useEffect(() => {
		if (!open) return
		const nextStart = block ? new Date(block.startsAt) : (defaultStartsAt ?? new Date())
		setTitle(block?.title ?? 'Personal time')
		setDate(dateInputValue(nextStart))
		setTime(timeInputValue(nextStart))
		setDurationMinutes(String(block?.durationMinutes ?? 60))
	}, [block, defaultStartsAt, open])

	const submit = async () => {
		const startsAt = startsAtFromDateTime(date, time)
		setIsSubmitting(true)
		try {
			await onSubmit({
				title: title.trim() || 'Personal time',
				startsAt: startsAt.toISOString(),
				durationMinutes: Math.max(Number(durationMinutes) || 60, 5),
			})
			onOpenChange(false)
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>{block ? 'Edit personal slot' : 'Block personal slot'}</DialogTitle>
				</DialogHeader>
				<div className="grid gap-4 py-2">
					<Field label="Title">
						<Input value={title} onChange={(event) => setTitle(event.target.value)} />
					</Field>
					<div className="grid gap-3 sm:grid-cols-3">
						<Field label="Date">
							<Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
						</Field>
						<Field label="Time">
							<Input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
						</Field>
						<Field label="Duration">
							<Input
								type="number"
								min="5"
								step="5"
								value={durationMinutes}
								onChange={(event) => setDurationMinutes(event.target.value)}
							/>
						</Field>
					</div>
				</div>
				<DialogFooter className="flex-row justify-between sm:justify-between">
					{onDelete ? (
						<Button type="button" variant="destructive" onClick={onDelete} disabled={isSubmitting}>
							<Trash2 className="h-4 w-4" />
							Delete
						</Button>
					) : (
						<span />
					)}
					<div className="flex gap-2">
						<Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
							Cancel
						</Button>
						<Button type="button" onClick={submit} disabled={isSubmitting}>
							<Clock className="h-4 w-4" />
							Save
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

function SlotChoiceDialog({
	startsAt,
	onClose,
	onAddLesson,
	onAddBlock,
}: {
	startsAt: Date | null
	onClose: () => void
	onAddLesson: () => void
	onAddBlock: () => void
}) {
	return (
		<Dialog open={Boolean(startsAt)} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle>{startsAt ? timeInputValue(startsAt) : 'Choose action'}</DialogTitle>
				</DialogHeader>
				<div className="grid gap-2">
					<Button type="button" onClick={onAddLesson}>
						<CalendarPlus className="h-4 w-4" />
						Add lesson
					</Button>
					<Button type="button" variant="secondary" onClick={onAddBlock}>
						<Clock className="h-4 w-4" />
						Block personal slot
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}

function DropScopeDialog({
	pendingDrop,
	onClose,
	onApply,
}: {
	pendingDrop: { event: CalendarEvent; startsAt: Date } | null
	onClose: () => void
	onApply: (scope: 'current' | 'series') => Promise<void>
}) {
	return (
		<Dialog open={Boolean(pendingDrop)} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-w-sm p-unit">
				<DialogHeader className="mb-unit">
					<DialogTitle>Apply schedule move</DialogTitle>
				</DialogHeader>
				<div className="grid gap-2">
					<Button type="button" onClick={() => void onApply('current')}>
						Apply current
					</Button>
					<Button type="button" variant="secondary" onClick={() => void onApply('series')}>
						Apply all future
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}

function Field({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div>
			<Label className="mb-1.5 block text-xs font-medium text-ink-muted">{label}</Label>
			{children}
		</div>
	)
}
