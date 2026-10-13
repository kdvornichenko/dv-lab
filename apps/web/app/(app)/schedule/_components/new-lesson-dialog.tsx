'use client'

import { useRef, useState, type FormEvent } from 'react'

import { CalendarFormStatus } from '@/components/app/calendar-command-notice'
import { useCalendarCommands } from '@/components/app/calendar-command-provider'
import { ConflictStatus, GoogleConflicts, lessonOverlaps, useGoogleConflicts } from '@/components/app/google-conflicts'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TabItem, Tabs, TabsList } from '@/components/ui/tabs'
import { formatDate, weekdayName } from '@/lib/schedule-format'
import { zoneName } from '@/lib/time-zones'

import type { CalendarEventView } from '@dv-lab/contracts'

import { useToast } from '../../_components/toasts'
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
	type TimeSeed,
} from './event-form'
import { NewLessonFooter, NewLessonStudent } from './new-lesson-content'
import { TimeZoneStaleNotice, useScheduleFormContext, type ScheduleFormContext } from './schedule-form-context'
import { useScheduleMutation } from './schedule-mutations'
import type { StudentsState } from './use-lesson-students'

interface NewLessonDialogProps extends ScheduleFormContext {
	students: StudentsState
	available: boolean
	seed: TimeSeed
	events: readonly CalendarEventView[]
	currentMainTimeZone: string
	secondZone: string | null
	onClose: () => void
	onCreated: () => void
	onRefresh: () => void
}

type Mode = 'lesson' | 'event'

const nameCollator = new Intl.Collator('en', { sensitivity: 'base' })

function activeStudents(students: StudentsState) {
	if (students.kind !== 'ready') return []
	return students.rows.toSorted((left, right) => nameCollator.compare(left.displayName, right.displayName))
}

export function NewLessonDialog({
	students,
	available,
	seed,
	events,
	mainTimeZone,
	asOf,
	currentMainTimeZone,
	secondZone,
	onClose,
	onCreated,
	onRefresh,
}: NewLessonDialogProps) {
	const toast = useToast()
	const { view } = useCalendarCommands()
	const context = useScheduleFormContext({ mainTimeZone, asOf }, currentMainTimeZone)
	const fields = useTimeFields(seed, context, secondZone, { idPrefix: 'new-lesson' })
	const values = useEventValues()
	const palette = useEventPalette()
	const [mode, setMode] = useState<Mode>('lesson')
	const [studentId, setStudentId] = useState('')
	const [titleTouched, setTitleTouched] = useState(false)
	const [failed, setFailed] = useState(false)
	const command = useScheduleMutation({ mainTimeZone: context.mainTimeZone, date: fields.date })
	const pending = command.pending
	const studentRef = useRef<HTMLButtonElement>(null)
	const lengthRef = useRef<HTMLInputElement>(null)
	const titleRef = useRef<HTMLInputElement>(null)

	const { date, time, minutes, repeats, input, errors } = fields
	const eventMode = mode === 'event'
	const active = activeStudents(students)
	const studentName = active.find((student) => student.id === studentId)?.displayName ?? null
	const noStudents = students.kind === 'ready' && active.length === 0
	const title = values.title.trim()
	const titleError = title === '' && (titleTouched || fields.submitted) ? EVENT_TITLE_ERROR : undefined
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
		if (pending || (next !== 'lesson' && next !== 'event')) return
		setMode(next)
		setFailed(false)
	}

	function announceCreated() {
		const name = eventMode ? title : (studentName ?? '')
		const label = input.label
		if (repeats === 'weekly')
			toast.show({
				title: 'Series added',
				description: `${name} every ${weekdayName(fields.weekday)} at ${time} ${label}.`,
			})
		else
			toast.show({
				title: eventMode ? 'Event added' : 'Lesson added',
				description: `${name}, ${formatDate(date, context.currentYear)}, ${time} ${label}.`,
			})
	}

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (pending || blocked || command.blocked || context.stale) return
		fields.setSubmitted(true)
		setFailed(false)
		if (eventMode && title === '') return titleRef.current?.focus()
		if (!eventMode && studentId === '') return studentRef.current?.focus()
		if (errors.date) return document.getElementById('new-lesson-date')?.focus()
		if (errors.time || time === null) return document.getElementById('new-lesson-time')?.focus()
		if (errors.length || minutes === null) return lengthRef.current?.focus()
		const common = {
			date,
			startTime: time,
			durationMinutes: minutes,
			repeats,
			expectedDefaultTimeZone: context.mainTimeZone,
		}
		const result = eventMode
			? await command.mutate(
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
			: await command.mutate({ kind: 'new' }, 'create', { ...common, studentId }, conflicts.checked ?? undefined)
		if (result.kind === 'detached') return
		if (result.kind === 'zone_changed') return context.markStale()
		if (result.kind === 'gap') return fields.setServerGap(true)
		if (result.kind !== 'ok') {
			setFailed(true)
			return
		}
		announceCreated()
		onCreated()
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
			failure={
				failed ? (eventMode ? 'Could not add the event. Try again.' : 'Could not add the lesson. Try again.') : null
			}
			lessons={localLessons}
		/>
	)

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !pending) onClose()
			}}
		>
			<DialogContent size="lg" showCloseButton={!pending}>
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
						className="-m-1 max-h-[calc(100dvh-14rem+8px)]"
						viewportClassName="scroll-fade max-h-[inherit] p-1"
					>
						<CalendarFormStatus
							entry={command.entry}
							blocked={command.blocked}
							connectionShown
							onViewSchedule={() => {
								command.detach()
								onClose()
							}}
						/>
						<div className="flex flex-col gap-3">
							<TimeZoneStaleNotice stale={context.stale} pending={pending} onRefresh={onRefresh} />
							<Tabs value={mode} onValueChange={changeMode}>
								<div className="flex min-w-0 rounded-xl bg-muted">
									<TabsList aria-label="Lesson or event" className="w-full bg-transparent *:flex-1 *:justify-center">
										<TabItem value="lesson" label="Lesson" disabled={pending} />
										<TabItem value="event" label="Event" disabled={pending} />
									</TabsList>
								</div>
							</Tabs>
							{eventMode ? (
								<div onBlur={() => setTitleTouched(true)}>
									<EventTitleRow
										id="new-event-title"
										values={values}
										error={titleError}
										disabled={pending}
										inputRef={titleRef}
										autoFocus
									/>
								</div>
							) : (
								<NewLessonStudent
									studentId={studentId}
									chooseStudent={chooseStudent}
									pending={pending}
									studentRef={studentRef}
									students={students}
									active={active}
									noStudents={noStudents}
								/>
							)}
							<TimeRows fields={fields} pending={pending} lengthRef={lengthRef} lengthHelper={lengthHelper} />
							{eventMode ? (
								<EventExtraRows prefix="new-event" values={values} palette={palette} custom={null} disabled={pending} />
							) : null}
							<GoogleConflicts check={conflicts} pending={pending} />
						</div>
					</ScrollArea>
					{eventMode ? (
						<EventFooter
							status={status}
							pending={pending}
							disabled={blocked || command.blocked || context.stale}
							label={repeats === 'weekly' ? 'Add series' : 'Add event'}
							pendingLabel="Adding…"
							onDiscard={onClose}
						/>
					) : (
						<NewLessonFooter
							onClose={onClose}
							pending={pending}
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
