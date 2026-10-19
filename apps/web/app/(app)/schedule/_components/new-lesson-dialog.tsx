'use client'

import { useRef, useState, type FormEvent } from 'react'

import { useCalendarCommands } from '@/components/app/calendar-command-provider'
import { ConflictStatus, GoogleConflicts, lessonOverlaps, useGoogleConflicts } from '@/components/app/google-conflicts'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TabItem, Tabs, TabsList } from '@/components/ui/tabs'
import { zoneName } from '@/lib/time-zones'

import type { CalendarEventView, LessonRepeats } from '@dv-lab/contracts'

import { colorIdOf, useEventPalette } from './color-select'
import {
	CHECK_STUDENT,
	createProposal,
	EVENT_TITLE_ERROR,
	EventExtraRows,
	EventFooter,
	EventTitleRow,
	TimeRows,
	useEventValues,
	useTimeFields,
	type EventValues,
	type TimeSeed,
} from './event-form'
import { NewLessonFooter, NewLessonStudent } from './new-lesson-content'
import type { WriteRunner } from './optimistic-writes'
import { TimeZoneStaleNotice, useScheduleFormContext, type ScheduleFormContext } from './schedule-form-context'
import { useScheduleMutation } from './schedule-mutations'
import type { StudentsState } from './use-lesson-students'

type Mode = 'lesson' | 'event'

export type NewLessonDraft = {
	seed: Required<TimeSeed>
	mode: Mode
	studentId: string
	repeats: LessonRepeats
	values: EventValues
}

interface NewLessonDialogProps extends ScheduleFormContext {
	students: StudentsState
	available: boolean
	seed: TimeSeed
	initial?: NewLessonDraft
	events: readonly CalendarEventView[]
	currentMainTimeZone: string
	secondZone: string | null
	onClose: () => void
	onRefresh: () => void
	onWrite: WriteRunner
	onRedo: (draft: NewLessonDraft) => void
}

const nameCollator = new Intl.Collator('en', { sensitivity: 'base' })

function activeStudents(students: StudentsState) {
	if (students.kind !== 'ready') return []
	return students.rows.toSorted((left, right) => nameCollator.compare(left.displayName, right.displayName))
}

export function NewLessonDialog({
	students,
	available,
	seed,
	initial,
	events,
	mainTimeZone,
	asOf,
	currentMainTimeZone,
	secondZone,
	onClose,
	onRefresh,
	onWrite,
	onRedo,
}: NewLessonDialogProps) {
	const { view } = useCalendarCommands()
	const context = useScheduleFormContext({ mainTimeZone, asOf }, currentMainTimeZone)
	const fields = useTimeFields(initial?.seed ?? seed, context, secondZone, {
		idPrefix: 'new-lesson',
		repeats: initial?.repeats,
	})
	const values = useEventValues(initial?.values)
	const palette = useEventPalette()
	const [mode, setMode] = useState<Mode>(initial?.mode ?? 'lesson')
	const [studentId, setStudentId] = useState(initial?.studentId ?? '')
	const [titleSeen, setTitleSeen] = useState(false)
	const command = useScheduleMutation({ mainTimeZone: context.mainTimeZone, date: fields.date })
	const studentRef = useRef<HTMLInputElement>(null)
	const lengthRef = useRef<HTMLInputElement>(null)
	const titleRef = useRef<HTMLInputElement>(null)

	const { date, time, minutes, repeats, input, errors } = fields
	const eventMode = mode === 'event'
	const active = activeStudents(students)
	const studentName = active.find((student) => student.id === studentId)?.displayName ?? null
	const noStudents = students.kind === 'ready' && active.length === 0
	const title = values.title.trim()
	if (title !== '' && !titleSeen) setTitleSeen(true)
	const titleError = title === '' && (titleSeen || fields.submitted) ? EVENT_TITLE_ERROR : undefined
	const blocked = eventMode
		? !available || title === ''
		: !available || students.kind !== 'ready' || noStudents || studentId === ''
	const calendarLabel = view.connection?.calendar?.label ?? null
	const localLessons = lessonOverlaps(events, input.instant, minutes)
	const conflicts = useGoogleConflicts({
		proposal: createProposal(
			{
				studentId: CHECK_STUDENT,
				date,
				startTime: time,
				durationMinutes: minutes,
				repeats,
				expectedDefaultTimeZone: context.mainTimeZone,
			},
			Boolean(fields.timeError || errors.date)
		),
		date,
		available: available && !context.stale && !command.blocked,
	})

	function chooseStudent(value: string) {
		setStudentId(value)
		if (fields.lengthEdited) return
		const row = active.find((student) => student.id === value)
		if (row) fields.setUsualLength(row.defaultLessonMinutes)
	}

	function changeMode(next: string) {
		if (next !== 'lesson' && next !== 'event') return
		setMode(next)
	}

	function shownBlock(start: Date, length: number): CalendarEventView {
		const location = values.location.trim()
		return {
			eventKey: `optimistic:${crypto.randomUUID()}`,
			version: 'optimistic',
			title: eventMode ? title : studentName,
			when: {
				kind: 'timed',
				startsAt: start.toISOString(),
				endsAt: new Date(start.getTime() + length * 60000).toISOString(),
				timeZone: context.mainTimeZone,
			},
			status: 'confirmed',
			blocksTime: true,
			color: {
				id: eventMode ? colorIdOf(values.colorValue) : null,
				background: null,
				foreground: null,
				custom: false,
			},
			location: eventMode && location !== '' ? location : null,
			seriesMember: repeats === 'weekly',
			binding: { kind: 'external' },
			suggestion: null,
			editBlock: null,
		}
	}

	function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (blocked || command.blocked || context.stale) return
		fields.setSubmitted(true)
		if (eventMode && title === '') return titleRef.current?.focus()
		if (!eventMode && studentId === '') return studentRef.current?.focus()
		if (errors.date) return document.getElementById('new-lesson-date')?.focus()
		if (errors.time || time === null || input.instant === null)
			return document.getElementById('new-lesson-time')?.focus()
		if (errors.length || minutes === null) return lengthRef.current?.focus()
		const common = {
			date,
			startTime: time,
			durationMinutes: minutes,
			repeats,
			expectedDefaultTimeZone: context.mainTimeZone,
		}
		const send = eventMode
			? command.prepare(
					{ kind: 'event_new' },
					'event_create',
					{
						...common,
						title,
						colorId: colorIdOf(values.colorValue),
						description: values.description.trim() === '' ? null : values.description,
						location: values.location.trim() === '' ? null : values.location.trim(),
					},
					conflicts.checked ?? undefined
				)
			: command.prepare({ kind: 'new' }, 'create', { ...common, studentId }, conflicts.checked ?? undefined)
		const draft: NewLessonDraft = {
			seed: { date, time, durationMinutes: minutes, dragged: fields.lengthEdited },
			mode,
			studentId,
			repeats,
			values: {
				title: values.title,
				colorValue: values.colorValue,
				location: values.location,
				description: values.description,
			},
		}
		onWrite(
			{
				title: eventMode ? 'Could not add the event' : 'Could not add the lesson',
				back: 'Nothing was added.',
				hidden: [],
				shown: [shownBlock(input.instant, minutes)],
				redo: () => onRedo(draft),
			},
			send
		)
		onClose()
	}

	const lengthHelper =
		!fields.lengthEdited && !eventMode && studentName !== null && minutes !== null
			? `${studentName}'s usual length.`
			: undefined
	const status = (
		<ConflictStatus
			check={conflicts}
			timeZone={context.mainTimeZone}
			durationMinutes={minutes}
			failure={null}
			lessons={localLessons}
		/>
	)

	return (
		<Dialog
			open
			disablePointerDismissal
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
		>
			<DialogContent size="lg" showCloseButton={false}>
				<form noValidate onSubmit={onSubmit}>
					<DialogHeader>
						<DialogTitle>{eventMode ? 'New event' : 'New lesson'}</DialogTitle>
						<DialogDescription>
							{eventMode
								? `Added to ${calendarLabel ?? 'your calendar'}. Times are in ${zoneName(context.mainTimeZone)} time.`
								: `Add a lesson to the schedule. Times are in ${zoneName(context.mainTimeZone)} time.`}
						</DialogDescription>
					</DialogHeader>
					<ScrollArea
						className="-m-1 max-h-[calc(100dvh-15rem+8px)] max-md:max-h-none max-md:min-h-0 max-md:flex-1 pointer-coarse:-m-2"
						viewportClassName="scroll-fade max-h-[inherit] p-1 pointer-coarse:p-2"
					>
						<div className="flex flex-col gap-3">
							<TimeZoneStaleNotice stale={context.stale} pending={false} onRefresh={onRefresh} />
							<Tabs value={mode} onValueChange={changeMode}>
								<div className="flex min-w-0 rounded-xl bg-muted">
									<TabsList aria-label="Lesson or event" className="w-full bg-transparent *:flex-1 *:justify-center">
										<TabItem value="lesson" label="Lesson" />
										<TabItem value="event" label="Event" />
									</TabsList>
								</div>
							</Tabs>
							{eventMode ? (
								<EventTitleRow
									id="new-event-title"
									values={values}
									error={titleError}
									disabled={false}
									inputRef={titleRef}
									autoFocus
								/>
							) : (
								<NewLessonStudent
									studentId={studentId}
									chooseStudent={chooseStudent}
									pending={false}
									studentRef={studentRef}
									students={students}
									active={active}
									noStudents={noStudents}
								/>
							)}
							<TimeRows fields={fields} pending={false} lengthRef={lengthRef} lengthHelper={lengthHelper} />
							{eventMode ? (
								<EventExtraRows prefix="new-event" values={values} palette={palette} custom={null} disabled={false} />
							) : null}
							<GoogleConflicts check={conflicts} pending={false} />
						</div>
					</ScrollArea>
					{eventMode ? (
						<EventFooter
							status={status}
							disabled={blocked || command.blocked || context.stale}
							label={repeats === 'weekly' ? 'Add series' : 'Add event'}
							onDiscard={onClose}
						/>
					) : (
						<NewLessonFooter
							onClose={onClose}
							blocked={blocked || command.blocked || context.stale}
							repeats={repeats}
							status={status}
						/>
					)}
				</form>
			</DialogContent>
		</Dialog>
	)
}
