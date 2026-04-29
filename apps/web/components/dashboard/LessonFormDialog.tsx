import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { AlertTriangle, Save } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { getStudentShortName } from '@/lib/crm/model'

import type { CalendarBusyInterval, CreateLessonInput, Lesson, Student } from '@teacher-crm/api-types'

type LessonFormCommand = CreateLessonInput & {
	applyToFuture?: boolean
}
type CalendarConflictCommand = CreateLessonInput & {
	excludeLessonId?: string
}

type LessonFormValues = {
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

type LessonFormErrors = Partial<Record<keyof LessonFormValues | 'startsAt', string>>
type FormSubmitEvent = {
	preventDefault: () => void
}

type LessonFormDialogProps = {
	open: boolean
	students: Student[]
	lessons: Lesson[]
	lesson?: Lesson | null
	defaultStartsAt?: Date | null
	onOpenChange: (open: boolean) => void
	onSubmit: (input: LessonFormCommand) => Promise<void>
	onCheckCalendarConflicts?: (input: CalendarConflictCommand) => Promise<CalendarBusyInterval[]>
}

const statusOptions = [
	'planned',
	'completed',
	'cancelled',
	'rescheduled',
	'no_show',
] as const satisfies readonly Lesson['status'][]
const REPEAT_CONFLICT_WEEKS = 8

function tomorrowDate() {
	const value = new Date()
	value.setDate(value.getDate() + 1)
	value.setHours(16, 0, 0, 0)
	return value
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

function conflictDateValue(value: Date) {
	return new Intl.DateTimeFormat('ru-RU', {
		day: '2-digit',
		month: 'short',
	}).format(value)
}

function datePickerValue(value: string) {
	if (!value) return undefined
	const date = new Date(`${value}T00:00:00`)
	return Number.isNaN(date.getTime()) ? undefined : date
}

function initialValues(students: Student[], lesson?: Lesson | null, defaultStartsAt?: Date | null): LessonFormValues {
	if (lesson) {
		const startsAt = new Date(lesson.startsAt)
		return {
			date: dateInputValue(startsAt),
			time: timeInputValue(startsAt),
			durationMinutes: String(lesson.durationMinutes),
			topic: lesson.topic ?? '',
			notes: lesson.notes ?? '',
			status: lesson.status,
			studentId: lesson.studentIds[0] ?? '',
			repeatWeekly: lesson.repeatWeekly,
			repeatCount: '8',
			applyToFuture: false,
		}
	}

	const startsAt = defaultStartsAt ?? tomorrowDate()
	const firstActiveStudent = students.find((student) => student.status === 'active') ?? students[0]

	return {
		date: dateInputValue(startsAt),
		time: timeInputValue(startsAt),
		durationMinutes: String(firstActiveStudent?.defaultLessonDurationMinutes ?? 60),
		topic: '',
		notes: '',
		status: 'planned',
		studentId: firstActiveStudent?.id ?? '',
		repeatWeekly: false,
		repeatCount: '8',
		applyToFuture: false,
	}
}

function validate(values: LessonFormValues) {
	const errors: LessonFormErrors = {}
	const duration = Number(values.durationMinutes)

	if (!values.date || !values.time) errors.startsAt = 'Date and time are required'
	if (!Number.isFinite(duration) || duration <= 0) errors.durationMinutes = 'Duration must be greater than zero'
	if (!values.studentId) errors.studentId = 'Choose a student'
	if (values.notes.length > 1000) errors.notes = 'Notes must be 1000 characters or fewer'

	return errors
}

function toCommand(values: LessonFormValues, student: Student): LessonFormCommand {
	const startsAt = new Date(`${values.date}T${values.time}:00`)

	return {
		title: getStudentShortName(student),
		startsAt: startsAt.toISOString(),
		durationMinutes: Number(values.durationMinutes),
		topic: values.topic.trim(),
		notes: values.notes.trim(),
		status: values.status,
		studentIds: [values.studentId],
		repeatWeekly: values.repeatWeekly,
		repeatCount: values.repeatWeekly ? REPEAT_CONFLICT_WEEKS : 1,
		applyToFuture: values.applyToFuture,
	}
}

function toCalendarConflictCommand(
	values: LessonFormValues,
	student: Student,
	editingLessonId?: string
): CalendarConflictCommand {
	return {
		...toCommand(values, student),
		excludeLessonId: editingLessonId,
	}
}

function startsAtFromValues(values: LessonFormValues) {
	const date = new Date(`${values.date}T${values.time}:00`)
	return Number.isNaN(date.getTime()) ? null : date
}

function occurrenceStarts(values: LessonFormValues) {
	const firstStart = startsAtFromValues(values)
	if (!firstStart) return []
	const count = values.repeatWeekly ? REPEAT_CONFLICT_WEEKS : 1
	if (!Number.isInteger(count) || count < 1 || count > 50) return []
	return Array.from({ length: count }, (_, index) => {
		const start = new Date(firstStart)
		start.setDate(start.getDate() + index * 7)
		return start
	})
}

function lessonEndsAt(lesson: Lesson) {
	return new Date(new Date(lesson.startsAt).getTime() + lesson.durationMinutes * 60_000)
}

function overlaps(start: Date, durationMinutes: number, lesson: Lesson) {
	const end = new Date(start.getTime() + durationMinutes * 60_000)
	const lessonStart = new Date(lesson.startsAt)
	return start < lessonEndsAt(lesson) && end > lessonStart
}

function findConflicts(values: LessonFormValues, lessons: Lesson[], editingLessonId?: string) {
	const duration = Number(values.durationMinutes)
	if (!Number.isFinite(duration) || duration <= 0) return []
	const occurrences = occurrenceStarts(values)
	if (occurrences.length === 0) return []
	return lessons
		.filter((lesson) => lesson.id !== editingLessonId && lesson.status !== 'cancelled')
		.filter((lesson) => occurrences.some((start) => overlaps(start, duration, lesson)))
}

function calendarConflictTitle(conflict: CalendarBusyInterval) {
	return conflict.title?.trim() || 'Busy time'
}

export function LessonFormDialog({
	open,
	students,
	lessons,
	lesson,
	defaultStartsAt,
	onOpenChange,
	onSubmit,
	onCheckCalendarConflicts,
}: LessonFormDialogProps) {
	const selectableStudents = useMemo(() => students.filter((student) => student.status !== 'archived'), [students])
	const [values, setValues] = useState<LessonFormValues>(() =>
		initialValues(selectableStudents, lesson, defaultStartsAt)
	)
	const [errors, setErrors] = useState<LessonFormErrors>({})
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [isCheckingCalendar, setIsCheckingCalendar] = useState(false)
	const [calendarConflicts, setCalendarConflicts] = useState<CalendarBusyInterval[]>([])
	const mode = lesson ? 'edit' : 'create'
	const conflicts = useMemo(() => findConflicts(values, lessons, lesson?.id), [lesson?.id, lessons, values])

	useEffect(() => {
		if (!open) return
		setValues(initialValues(selectableStudents, lesson, defaultStartsAt))
		setErrors({})
	}, [defaultStartsAt, open, selectableStudents, lesson])

	useEffect(() => {
		if (!open || !onCheckCalendarConflicts) {
			setCalendarConflicts([])
			setIsCheckingCalendar(false)
			return
		}
		const selectedStudent = selectableStudents.find((student) => student.id === values.studentId)
		if (!selectedStudent || Object.keys(validate(values)).length > 0) {
			setCalendarConflicts([])
			setIsCheckingCalendar(false)
			return
		}

		let cancelled = false
		setIsCheckingCalendar(true)
		const timeoutId = window.setTimeout(() => {
			onCheckCalendarConflicts(toCalendarConflictCommand(values, selectedStudent, lesson?.id))
				.then((busy) => {
					if (!cancelled) setCalendarConflicts(busy)
				})
				.catch(() => {
					if (!cancelled) setCalendarConflicts([])
				})
				.finally(() => {
					if (!cancelled) setIsCheckingCalendar(false)
				})
		}, 350)

		return () => {
			cancelled = true
			window.clearTimeout(timeoutId)
		}
	}, [lesson?.id, onCheckCalendarConflicts, open, selectableStudents, values])

	const updateValue = <Key extends keyof LessonFormValues>(key: Key, value: LessonFormValues[Key]) => {
		setValues((current) => {
			if (key === 'studentId' && mode === 'create') {
				const selectedStudent = selectableStudents.find((student) => student.id === value)
				return {
					...current,
					[key]: value,
					durationMinutes: String(selectedStudent?.defaultLessonDurationMinutes ?? current.durationMinutes),
				}
			}
			return { ...current, [key]: value }
		})
		setErrors((current) => ({ ...current, [key]: undefined, startsAt: undefined }))
	}

	const handleSubmit = async (event: FormSubmitEvent) => {
		event.preventDefault()
		if (isCheckingCalendar) return
		const nextErrors = validate(values)
		setErrors(nextErrors)
		if (Object.keys(nextErrors).length > 0) return
		const selectedStudent = selectableStudents.find((student) => student.id === values.studentId)
		if (!selectedStudent) return

		setIsSubmitting(true)
		try {
			await onSubmit(toCommand(values, selectedStudent))
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl">
				<form onSubmit={handleSubmit} className="grid min-h-0">
					<DialogHeader className="border-line-soft bg-surface-muted border-b px-6 py-5 pr-14">
						<div>
							<p className="text-sage mb-1 font-mono text-xs font-semibold uppercase">Lesson record</p>
							<DialogTitle>{mode === 'create' ? 'Add lesson' : 'Edit lesson'}</DialogTitle>
							<p className="text-ink-muted mt-1 text-sm">Create an individual lesson in the schedule.</p>
						</div>
						<DialogDescription className="sr-only">Lesson schedule form</DialogDescription>
					</DialogHeader>

					<ScrollArea className="max-h-[calc(100dvh-13rem)]">
						<div className="grid gap-4 px-6 py-5 md:grid-cols-2">
							<Field label="Student" error={errors.studentId}>
								<Select value={values.studentId} onValueChange={(value) => updateValue('studentId', value)}>
									<SelectTrigger aria-invalid={Boolean(errors.studentId)}>
										<SelectValue placeholder="Choose student" />
									</SelectTrigger>
									<SelectContent>
										{selectableStudents.map((student) => (
											<SelectItem key={student.id} value={student.id}>
												{student.fullName}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
							<Field label="Status">
								<Select
									value={values.status}
									onValueChange={(value) => updateValue('status', value as Lesson['status'])}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{statusOptions.map((item) => (
											<SelectItem key={item} value={item}>
												{item}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
							<Field label="Date" error={errors.startsAt}>
								<DatePicker
									date={datePickerValue(values.date)}
									onSelect={(date) => updateValue('date', date ? dateInputValue(date) : '')}
									placeholder="Choose date"
									className="w-full font-mono tabular-nums"
								/>
							</Field>
							<Field label="Time" error={errors.startsAt}>
								<Input
									type="time"
									className="font-mono tabular-nums"
									value={values.time}
									onChange={(event) => updateValue('time', event.target.value)}
									aria-invalid={Boolean(errors.startsAt)}
								/>
							</Field>
							<Field label="Duration" error={errors.durationMinutes}>
								<Input
									type="number"
									inputMode="numeric"
									min="5"
									step="5"
									className="font-mono tabular-nums"
									value={values.durationMinutes}
									onChange={(event) => updateValue('durationMinutes', event.target.value)}
									aria-invalid={Boolean(errors.durationMinutes)}
								/>
							</Field>
							<Field label="Topic">
								<Input value={values.topic} onChange={(event) => updateValue('topic', event.target.value)} />
							</Field>
							<Field label="Repeat" className="md:col-span-2">
								<div className="border-line-soft bg-surface-muted rounded-lg border p-3">
									<div className="flex items-center justify-between gap-3">
										<div>
											<p className="font-heading text-ink text-sm font-semibold">Weekly at this time</p>
											<p className="text-ink-muted mt-1 text-xs">
												{mode === 'create'
													? 'Creates one weekly recurring Google Calendar event.'
													: 'Makes this lesson weekly recurring in Google Calendar.'}
											</p>
										</div>
										<Switch
											checked={values.repeatWeekly}
											onCheckedChange={(checked) => updateValue('repeatWeekly', checked)}
											aria-label="Repeat lesson weekly"
										/>
									</div>
								</div>
							</Field>
							{mode === 'edit' && (
								<Field label="Series" className="md:col-span-2">
									<div className="border-line-soft bg-surface-muted rounded-lg border p-3">
										<div className="flex items-center justify-between gap-3">
											<div>
												<p className="font-heading text-ink text-sm font-semibold">Apply to future weekly lessons</p>
												<p className="text-ink-muted mt-1 text-xs">
													Updates this student&apos;s future lessons with the same weekday and time.
												</p>
											</div>
											<Switch
												checked={values.applyToFuture}
												onCheckedChange={(checked) => updateValue('applyToFuture', checked)}
												aria-label="Apply to future lessons"
											/>
										</div>
									</div>
								</Field>
							)}
							{conflicts.length > 0 && (
								<div className="border-warning-line bg-warning-soft/55 rounded-lg border p-3 md:col-span-2">
									<div className="flex items-start gap-2">
										<AlertTriangle className="text-warning mt-0.5 h-4 w-4 shrink-0" />
										<div className="min-w-0">
											<p className="font-heading text-ink text-sm font-semibold">Schedule overlap</p>
											<p className="text-ink-muted mt-1 text-xs">
												This warning does not block saving. Check these lessons before confirming:
											</p>
											<div className="mt-2 grid gap-1">
												{conflicts.slice(0, 3).map((conflict) => (
													<p key={conflict.id} className="text-ink truncate font-mono text-xs tabular-nums">
														{timeInputValue(new Date(conflict.startsAt))} · {conflict.title}
													</p>
												))}
											</div>
										</div>
									</div>
								</div>
							)}
							{calendarConflicts.length > 0 && (
								<div className="border-warning-line bg-warning-soft/55 rounded-lg border p-3 md:col-span-2">
									<div className="flex items-start gap-2">
										<AlertTriangle className="text-warning mt-0.5 h-4 w-4 shrink-0" />
										<div className="min-w-0">
											<p className="font-heading text-ink text-sm font-semibold">Google Calendar busy time</p>
											<p className="text-ink-muted mt-1 text-xs">
												Google Calendar already has busy time in this slot. Saving is still allowed.
											</p>
											<div className="mt-2 grid gap-1">
												{calendarConflicts.slice(0, 3).map((conflict) => (
													<p
														key={`${conflict.calendarId}-${conflict.startsAt}`}
														className="text-ink truncate font-mono text-xs tabular-nums"
													>
														{conflictDateValue(new Date(conflict.startsAt))} ·{' '}
														{timeInputValue(new Date(conflict.startsAt))} - {timeInputValue(new Date(conflict.endsAt))}{' '}
														· {calendarConflictTitle(conflict)}
													</p>
												))}
											</div>
										</div>
									</div>
								</div>
							)}
							<Field label="Notes" error={errors.notes} className="md:col-span-2">
								<Textarea
									value={values.notes}
									onChange={(event) => updateValue('notes', event.target.value)}
									aria-invalid={Boolean(errors.notes)}
									className="min-h-24"
								/>
							</Field>
						</div>
					</ScrollArea>

					<DialogFooter className="border-line-soft bg-surface-muted border-t px-6 py-4">
						<Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
							Cancel
						</Button>
						<Button type="submit" disabled={isSubmitting || isCheckingCalendar || selectableStudents.length === 0}>
							<Save className="h-4 w-4" />
							{isSubmitting
								? 'Saving'
								: isCheckingCalendar
									? 'Checking calendar'
									: mode === 'create'
										? 'Save lesson'
										: 'Save changes'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}

function Field({
	label,
	error,
	className,
	children,
}: {
	label: string
	error?: string
	className?: string
	children: ReactNode
}) {
	return (
		<div className={className}>
			<Label className="text-ink-muted mb-1.5 block text-xs font-medium">{label}</Label>
			{children}
			{error && <p className="text-danger mt-1 text-xs">{error}</p>}
		</div>
	)
}
