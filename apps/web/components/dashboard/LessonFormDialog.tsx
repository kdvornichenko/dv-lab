import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'

import { Save } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Textarea } from '@/components/ui/textarea'

import type { CreateLessonInput, Lesson, Student } from '@teacher-crm/api-types'

type LessonFormValues = {
	title: string
	date: string
	time: string
	durationMinutes: string
	topic: string
	notes: string
	status: Lesson['status']
	studentIds: string[]
}

type LessonFormErrors = Partial<Record<keyof LessonFormValues | 'startsAt', string>>

type LessonFormDialogProps = {
	open: boolean
	students: Student[]
	lesson?: Lesson | null
	onOpenChange: (open: boolean) => void
	onSubmit: (input: CreateLessonInput) => Promise<void>
}

const statusOptions = [
	'planned',
	'completed',
	'cancelled',
	'rescheduled',
] as const satisfies readonly Lesson['status'][]

function tomorrowDate() {
	const value = new Date()
	value.setDate(value.getDate() + 1)
	value.setHours(16, 0, 0, 0)
	return value
}

function dateInputValue(value: Date) {
	return value.toISOString().slice(0, 10)
}

function timeInputValue(value: Date) {
	return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
}

function initialValues(students: Student[], lesson?: Lesson | null): LessonFormValues {
	if (lesson) {
		const startsAt = new Date(lesson.startsAt)
		return {
			title: lesson.title,
			date: dateInputValue(startsAt),
			time: timeInputValue(startsAt),
			durationMinutes: String(lesson.durationMinutes),
			topic: lesson.topic ?? '',
			notes: lesson.notes ?? '',
			status: lesson.status,
			studentIds: lesson.studentIds,
		}
	}

	const startsAt = tomorrowDate()
	const firstActiveStudent = students.find((student) => student.status === 'active') ?? students[0]

	return {
		title: 'English lesson',
		date: dateInputValue(startsAt),
		time: timeInputValue(startsAt),
		durationMinutes: '60',
		topic: '',
		notes: '',
		status: 'planned',
		studentIds: firstActiveStudent ? [firstActiveStudent.id] : [],
	}
}

function validate(values: LessonFormValues) {
	const errors: LessonFormErrors = {}
	const duration = Number(values.durationMinutes)

	if (!values.title.trim()) errors.title = 'Title is required'
	if (!values.date || !values.time) errors.startsAt = 'Date and time are required'
	if (!Number.isFinite(duration) || duration <= 0) errors.durationMinutes = 'Duration must be greater than zero'
	if (values.studentIds.length === 0) errors.studentIds = 'Choose at least one student'
	if (values.notes.length > 1000) errors.notes = 'Notes must be 1000 characters or fewer'

	return errors
}

function toCommand(values: LessonFormValues): CreateLessonInput {
	const startsAt = new Date(`${values.date}T${values.time}:00`)

	return {
		title: values.title.trim(),
		startsAt: startsAt.toISOString(),
		durationMinutes: Number(values.durationMinutes),
		topic: values.topic.trim(),
		notes: values.notes.trim(),
		status: values.status,
		studentIds: values.studentIds,
	}
}

export function LessonFormDialog({ open, students, lesson, onOpenChange, onSubmit }: LessonFormDialogProps) {
	const selectableStudents = useMemo(() => students.filter((student) => student.status !== 'archived'), [students])
	const [values, setValues] = useState<LessonFormValues>(() => initialValues(selectableStudents, lesson))
	const [errors, setErrors] = useState<LessonFormErrors>({})
	const [isSubmitting, setIsSubmitting] = useState(false)
	const mode = lesson ? 'edit' : 'create'

	useEffect(() => {
		if (!open) return
		setValues(initialValues(selectableStudents, lesson))
		setErrors({})
	}, [open, selectableStudents, lesson])

	const updateValue = <Key extends keyof LessonFormValues>(key: Key, value: LessonFormValues[Key]) => {
		setValues((current) => ({ ...current, [key]: value }))
		setErrors((current) => ({ ...current, [key]: undefined, startsAt: undefined }))
	}

	const toggleStudent = (studentId: string, checked: boolean) => {
		setValues((current) => ({
			...current,
			studentIds: checked
				? [...current.studentIds, studentId]
				: current.studentIds.filter((currentStudentId) => currentStudentId !== studentId),
		}))
		setErrors((current) => ({ ...current, studentIds: undefined }))
	}

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const nextErrors = validate(values)
		setErrors(nextErrors)
		if (Object.keys(nextErrors).length > 0) return

		setIsSubmitting(true)
		try {
			await onSubmit(toCommand(values))
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl">
				<form onSubmit={handleSubmit} className="grid min-h-0">
					<DialogHeader className="border-b border-line-soft bg-surface-muted px-6 py-5 pr-14">
						<div>
							<p className="mb-1 font-mono text-xs font-semibold text-sage uppercase">Lesson record</p>
							<DialogTitle>{mode === 'create' ? 'Add lesson' : 'Edit lesson'}</DialogTitle>
							<p className="mt-1 text-sm text-ink-muted">Create a one-on-one or group lesson in the schedule.</p>
						</div>
						<DialogDescription className="sr-only">Lesson schedule form</DialogDescription>
					</DialogHeader>

					<ScrollArea className="max-h-[calc(100dvh-13rem)]">
						<div className="grid gap-4 px-6 py-5 md:grid-cols-2">
							<Field label="Title" error={errors.title}>
								<Input
									value={values.title}
									onChange={(event) => updateValue('title', event.target.value)}
									aria-invalid={Boolean(errors.title)}
								/>
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
								<Input
									type="date"
									value={values.date}
									onChange={(event) => updateValue('date', event.target.value)}
									aria-invalid={Boolean(errors.startsAt)}
								/>
							</Field>
							<Field label="Time" error={errors.startsAt}>
								<Input
									type="time"
									value={values.time}
									onChange={(event) => updateValue('time', event.target.value)}
									aria-invalid={Boolean(errors.startsAt)}
								/>
							</Field>
							<Field label="Duration" error={errors.durationMinutes}>
								<Input
									type="number"
									inputMode="numeric"
									min="1"
									step="5"
									value={values.durationMinutes}
									onChange={(event) => updateValue('durationMinutes', event.target.value)}
									aria-invalid={Boolean(errors.durationMinutes)}
								/>
							</Field>
							<Field label="Topic">
								<Input value={values.topic} onChange={(event) => updateValue('topic', event.target.value)} />
							</Field>
							<Field label="Students" error={errors.studentIds} className="md:col-span-2">
								<div className="grid gap-2 rounded-lg border border-line-soft bg-surface-muted p-3 sm:grid-cols-2">
									{selectableStudents.map((student) => (
										<label
											key={student.id}
											className="flex min-h-11 items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
										>
											<Checkbox
												checked={values.studentIds.includes(student.id)}
												onCheckedChange={(checked) => toggleStudent(student.id, checked === true)}
											/>
											<span className="min-w-0">
												<span className="block truncate font-medium text-ink">{student.fullName}</span>
												<span className="block truncate text-xs text-ink-muted">{student.level || student.status}</span>
											</span>
										</label>
									))}
									{selectableStudents.length === 0 && (
										<p className="text-sm text-ink-muted">Add an active student before scheduling a lesson.</p>
									)}
								</div>
							</Field>
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

					<DialogFooter className="border-t border-line-soft bg-surface-muted px-6 py-4">
						<Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
							Cancel
						</Button>
						<Button type="submit" disabled={isSubmitting || selectableStudents.length === 0}>
							<Save className="h-4 w-4" />
							{isSubmitting ? 'Saving' : mode === 'create' ? 'Save lesson' : 'Save changes'}
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
			<Label className="mb-1.5 block text-xs font-medium text-ink-muted">{label}</Label>
			{children}
			{error && <p className="mt-1 text-xs text-danger">{error}</p>}
		</div>
	)
}
