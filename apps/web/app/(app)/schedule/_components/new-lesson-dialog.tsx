'use client'

import { useRef, useState, type FormEvent } from 'react'

import { CalendarFormStatus } from '@/components/app/calendar-command-notice'
import { DateField } from '@/components/app/date-field'
import { ConflictStatus, GoogleConflicts, lessonOverlaps, useGoogleConflicts } from '@/components/app/google-conflicts'
import { LengthField } from '@/components/app/length-field'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TabItem, Tabs, TabsList } from '@/components/ui/tabs'
import { TimePicker } from '@/components/ui/time-picker'
import { LENGTH_ERROR, LENGTH_HELPER } from '@/lib/lesson-length'
import { formatDate, secondWhen, weekdayName } from '@/lib/schedule-format'
import { sameTimeZone, zoneName } from '@/lib/time-zones'

import type { CalendarEventView, LessonRepeats } from '@dv-lab/contracts'
import { scheduleDate, weekdayOf } from '@dv-lab/core'

import { useToast } from '../../_components/toasts'
import { NewLessonFooter, NewLessonStudent } from './new-lesson-content'
import {
	gapMessage,
	localTimeInput,
	LocalTimeHint,
	TimeZoneStaleNotice,
	useScheduleFormContext,
	type ScheduleFormContext,
} from './schedule-form-context'
import { useScheduleMutation, type CreateLessonBody } from './schedule-mutations'
import type { StudentsState } from './use-lesson-students'

interface NewLessonDialogProps extends ScheduleFormContext {
	students: StudentsState
	available: boolean
	seed: { date: string; time: string; durationMinutes?: number; dragged?: boolean }
	events: readonly CalendarEventView[]
	currentMainTimeZone: string
	secondZone: string | null
	onClose: () => void
	onCreated: () => void
	onRefresh: () => void
}

type Field = 'date' | 'time' | 'length'

const nameCollator = new Intl.Collator('en', { sensitivity: 'base' })
const DAY_MINUTES = 1440
const CHECK_STUDENT = '00000000-0000-0000-0000-000000000000'

function clockMinutes(time: string): number {
	return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
}

function clockOf(minutes: number): string {
	const wall = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
	return `${String(Math.floor(wall / 60)).padStart(2, '0')}:${String(wall % 60).padStart(2, '0')}`
}

function dateError(date: string, repeats: LessonRepeats, today: string) {
	if (date === '') return 'Choose a date.'
	if (repeats === 'weekly' && date < today) return 'Choose today or later.'
	return undefined
}

function createProposal(
	input: Omit<CreateLessonBody, 'startTime' | 'durationMinutes'> & {
		startTime: string | null
		durationMinutes: number | null
	},
	invalid: boolean
) {
	if (!input.studentId || input.startTime === null || input.durationMinutes === null || invalid) return null
	return {
		operation: 'create' as const,
		input: { ...input, startTime: input.startTime, durationMinutes: input.durationMinutes },
	}
}

function activeStudents(students: StudentsState) {
	if (students.kind !== 'ready') return []
	return students.rows.toSorted((left, right) => nameCollator.compare(left.displayName, right.displayName))
}

function HelperLine({ id, text, error }: { id: string; text: string | null; error?: string }) {
	return (
		<p
			id={id}
			className={error ? 'min-h-4 text-caption text-destructive' : 'min-h-4 text-caption text-muted-foreground'}
		>
			{error ?? text}
		</p>
	)
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
	const context = useScheduleFormContext({ mainTimeZone, asOf }, currentMainTimeZone)
	const { today, currentYear } = context
	const initialMinutes = seed.durationMinutes ?? 60
	const [studentId, setStudentId] = useState('')
	const [date, setDate] = useState(seed.date)
	const [time, setTime] = useState<string | null>(seed.time)
	const [length, setLength] = useState<number | null>(initialMinutes)
	const [lengthKey, setLengthKey] = useState(0)
	const [span, setSpan] = useState(initialMinutes)
	const [lengthEdited, setLengthEdited] = useState(seed.dragged === true)
	const [repeats, setRepeats] = useState<LessonRepeats>('once')
	const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
	const [submitted, setSubmitted] = useState(false)
	const [failed, setFailed] = useState(false)
	const command = useScheduleMutation({ mainTimeZone: context.mainTimeZone, date })
	const pending = command.pending
	const [serverGap, setServerGap] = useState(false)
	const studentRef = useRef<HTMLButtonElement>(null)
	const lengthRef = useRef<HTMLInputElement>(null)

	const active = activeStudents(students)
	const minutes = length
	const lengthProblem = length === null ? LENGTH_ERROR : undefined
	const weekday = weekdayOf(date)
	const input = localTimeInput(date, time, context)
	const timeError = serverGap ? gapMessage(context.mainTimeZone) : input.error
	const errors = {
		date: dateError(date, repeats, today),
		time: timeError ?? (time === null ? 'Choose a start time.' : undefined),
		length: lengthProblem,
	}
	const shown = (field: Field) =>
		submitted || touched[field] || (field === 'time' && timeError) ? errors[field] : undefined
	const touch = (field: Field) => setTouched((current) => ({ ...current, [field]: true }))

	const second = secondZone !== null && !sameTimeZone(secondZone, context.mainTimeZone) ? secondZone : null
	const startLine = input.instant === null ? null : secondWhen(input.instant, context.mainTimeZone, second)
	const end = time === null ? null : clockOf(clockMinutes(time) + span)
	const endInstant = input.instant === null ? null : new Date(input.instant.getTime() + span * 60000)
	const endDate = endInstant === null ? null : scheduleDate(endInstant, context.mainTimeZone)
	const endSecond = endInstant === null ? null : secondWhen(endInstant, context.mainTimeZone, second)
	const endLine =
		endDate !== null && endDate !== date
			? [formatDate(endDate, currentYear), endSecond].filter(Boolean).join(' · ')
			: endSecond
	const studentName = active.find((student) => student.id === studentId)?.displayName ?? null
	const noStudents = students.kind === 'ready' && active.length === 0
	const blocked = !available || students.kind !== 'ready' || noStudents || studentId === ''
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
			Boolean(timeError || errors.date)
		),
		date,
		available: available && !context.stale && !command.blocked,
	})

	function commitLength(next: number | null) {
		if (next !== span) setLengthEdited(true)
		setLength(next)
		if (next !== null) setSpan(next)
		touch('length')
	}

	function chooseStudent(value: string) {
		setStudentId(value)
		if (lengthEdited) return
		const row = active.find((student) => student.id === value)
		if (row) {
			setLength(row.defaultLessonMinutes)
			setLengthKey((key) => key + 1)
			setSpan(row.defaultLessonMinutes)
		}
	}

	function chooseEnd(value: string | null) {
		if (value === null || time === null) return
		let next = clockMinutes(value) - clockMinutes(time)
		if (next <= 0) next += DAY_MINUTES
		setSpan(next)
		setLength(next)
		setLengthKey((key) => key + 1)
		setLengthEdited(true)
		touch('length')
	}

	function announceCreated() {
		const name = studentName ?? ''
		const label = input.label
		toast.show(
			repeats === 'weekly'
				? { title: 'Series added', description: `${name} every ${weekdayName(weekday)} at ${time} ${label}.` }
				: { title: 'Lesson added', description: `${name}, ${formatDate(date, currentYear)}, ${time} ${label}.` }
		)
	}

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (pending || blocked || command.blocked || context.stale) return
		setSubmitted(true)
		setFailed(false)
		if (studentId === '') return studentRef.current?.focus()
		if (errors.date) return document.getElementById('new-lesson-date')?.focus()
		if (errors.time || time === null) return document.getElementById('new-lesson-time')?.focus()
		if (errors.length || minutes === null) return lengthRef.current?.focus()
		const result = await command.mutate(
			{ kind: 'new' },
			'create',
			{
				studentId,
				date,
				startTime: time,
				durationMinutes: minutes,
				repeats,
				expectedDefaultTimeZone: context.mainTimeZone,
			},
			conflicts.checked ?? undefined
		)
		if (result.kind === 'detached') return
		if (result.kind === 'zone_changed') return context.markStale()
		if (result.kind === 'gap') return setServerGap(true)
		if (result.kind !== 'ok') {
			setFailed(true)
			return
		}
		announceCreated()
		onCreated()
	}

	const lengthHelper =
		!lengthEdited && studentName !== null && minutes !== null ? `${studentName}'s usual length.` : LENGTH_HELPER

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
						<DialogTitle>New lesson</DialogTitle>
						<DialogDescription>
							Add a lesson to the schedule. Times are in {zoneName(context.mainTimeZone)} time.
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
							<NewLessonStudent
								studentId={studentId}
								chooseStudent={chooseStudent}
								pending={pending}
								studentRef={studentRef}
								students={students}
								active={active}
								noStudents={noStudents}
							/>
							<div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)]">
								<div className="col-span-2 min-w-0 sm:col-span-1">
									<DateField
										id="new-lesson-date"
										label="Date"
										short
										reserve
										value={date}
										onChange={(value) => {
											setDate(value)
											setServerGap(false)
											touch('date')
										}}
										disabled={pending}
										error={shown('date')}
									/>
								</div>
								<div className="flex min-w-0 flex-col gap-2">
									<span id="new-lesson-time-label" className="text-body text-muted-foreground">
										Start, {input.label}
									</span>
									<TimePicker
										id="new-lesson-time"
										aria-labelledby="new-lesson-time-label"
										aria-describedby="new-lesson-time-note new-lesson-time-dst"
										value={time}
										onValueChange={(value) => {
											setTime(value)
											setServerGap(false)
											touch('time')
										}}
										minuteStep={15}
										hourCycle={24}
										disabled={pending}
										invalid={Boolean(shown('time'))}
										className="w-full"
									/>
									<HelperLine id="new-lesson-time-note" text={startLine} error={shown('time')} />
									<LocalTimeHint id="new-lesson-time-dst" hint={input.hint} />
								</div>
								<div className="flex min-w-0 flex-col gap-2">
									<span id="new-lesson-end-label" className="text-body text-muted-foreground">
										End, {input.label}
									</span>
									<TimePicker
										id="new-lesson-end"
										aria-labelledby="new-lesson-end-label"
										aria-describedby="new-lesson-end-note"
										value={end}
										onValueChange={chooseEnd}
										minuteStep={15}
										hourCycle={24}
										disabled={pending || time === null}
										className="w-full"
									/>
									<HelperLine id="new-lesson-end-note" text={endLine} />
								</div>
							</div>
							<div className="grid items-start gap-3 sm:grid-cols-2">
								<LengthField
									key={lengthKey}
									hoursRef={lengthRef}
									id="new-lesson-length"
									initialMinutes={length ?? span}
									onCommit={commitLength}
									disabled={pending}
									helper={lengthHelper}
									error={shown('length')}
								/>
								<div className="flex min-w-0 flex-col gap-2">
									<span id="new-lesson-repeats-label" className="text-body text-muted-foreground">
										Repeats
									</span>
									<Tabs value={repeats} onValueChange={(value) => setRepeats(value === 'weekly' ? 'weekly' : 'once')}>
										<div className="flex min-w-0 rounded-xl bg-muted">
											<TabsList
												aria-labelledby="new-lesson-repeats-label"
												className="w-full bg-transparent *:flex-1 *:justify-center"
											>
												<TabItem value="once" label="Once" disabled={pending} />
												<TabItem value="weekly" label="Every week" disabled={pending} />
											</TabsList>
										</div>
									</Tabs>
									<HelperLine
										id="new-lesson-repeat-note"
										text={
											repeats === 'weekly' && time !== null && input.instant !== null
												? `Every ${weekdayName(weekday)}, ${time} ${input.label}.`
												: null
										}
									/>
								</div>
							</div>
							<GoogleConflicts check={conflicts} pending={pending} />
						</div>
					</ScrollArea>
					<NewLessonFooter
						onClose={onClose}
						pending={pending}
						blocked={blocked || command.blocked || context.stale}
						repeats={repeats}
						status={
							<ConflictStatus
								check={conflicts}
								timeZone={context.mainTimeZone}
								durationMinutes={minutes}
								failure={failed ? 'Could not add the lesson. Try again.' : null}
								lessons={localLessons}
							/>
						}
					/>
				</form>
			</DialogContent>
		</Dialog>
	)
}
