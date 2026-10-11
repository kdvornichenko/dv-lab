'use client'

import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from 'react'

import { CalendarFormStatus } from '@/components/app/calendar-command-notice'
import { DateField } from '@/components/app/date-field'
import { TextField } from '@/components/app/text-field'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { TimePicker } from '@/components/ui/time-picker'
import { secondWhen, seriesPhrase } from '@/lib/schedule-format'
import { sameTimeZone, zoneName } from '@/lib/time-zones'

import { LESSON_MINUTES_MAX, LESSON_MINUTES_MIN, type LessonRepeats, type StudentRow } from '@dv-lab/contracts'
import { weekdayOf, type OverlapItem } from '@dv-lab/core'

import { useToast } from '../../_components/toasts'
import { overlapsOn } from './calendar-overlaps'
import { NewLessonFooter, NewLessonNotices, NewLessonStudent } from './new-lesson-content'
import {
	gapMessage,
	localTimeInput,
	LocalTimeHint,
	TimeZoneStaleNotice,
	useScheduleFormContext,
	type ScheduleFormContext,
} from './schedule-form-context'
import { useScheduleMutation } from './schedule-mutations'

export type OverlapBlock = OverlapItem & { studentName: string }

export type StudentsState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; rows: StudentRow[] }

interface NewLessonDialogProps extends ScheduleFormContext {
	students: StudentsState
	available: boolean
	seed: { date: string; time: string; durationMinutes?: number }
	currentMainTimeZone: string
	secondZone: string | null
	blocksOn: (date: string) => Promise<OverlapBlock[] | null>
	onClose: () => void
	onCreated: () => void
	onRefresh: () => void
}

type Field = 'student' | 'time' | 'length'

const nameCollator = new Intl.Collator('en', { sensitivity: 'base' })

function parseLength(text: string): number | null {
	const trimmed = text.trim()
	if (!/^\d+$/.test(trimmed)) return null
	const value = Number(trimmed)
	return value >= LESSON_MINUTES_MIN && value <= LESSON_MINUTES_MAX ? value : null
}

function newLessonErrors(
	studentId: string,
	date: string,
	time: string | null,
	minutes: number | null,
	repeats: LessonRepeats,
	today: string,
	timeError: string | undefined
) {
	return {
		student: studentId === '' ? 'Choose a student.' : undefined,
		date:
			date === ''
				? 'Choose a date.'
				: repeats === 'weekly' && date < today
					? 'Choose today or a later date for a repeating lesson.'
					: undefined,
		time: timeError ?? (time === null ? 'Choose a start time.' : undefined),
		length: minutes === null ? 'Use 15 to 240 minutes.' : undefined,
	}
}

export function NewLessonDialog({
	students,
	available,
	seed,
	mainTimeZone,
	asOf,
	currentMainTimeZone,
	secondZone,
	blocksOn,
	onClose,
	onCreated,
	onRefresh,
}: NewLessonDialogProps) {
	const toast = useToast()
	const context = useScheduleFormContext({ mainTimeZone, asOf }, currentMainTimeZone)
	const { today } = context
	const [studentId, setStudentId] = useState('')
	const [date, setDate] = useState(seed.date)
	const [time, setTime] = useState<string | null>(seed.time)
	const [lengthText, setLengthText] = useState(String(seed.durationMinutes ?? 60))
	const [lengthEdited, setLengthEdited] = useState(seed.durationMinutes !== undefined)
	const [repeats, setRepeats] = useState<LessonRepeats>('once')
	const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
	const [submitted, setSubmitted] = useState(false)
	const [failed, setFailed] = useState(false)
	const command = useScheduleMutation({ mainTimeZone: context.mainTimeZone, date })
	const pending = command.pending
	const [serverGap, setServerGap] = useState(false)
	const [clash, setClash] = useState<{ date: string; items: OverlapBlock[] } | null>(null)
	const studentRef = useRef<HTMLButtonElement>(null)
	const lengthRef = useRef<HTMLInputElement>(null)

	const loadBlocks = useEffectEvent((forDate: string) => blocksOn(forDate))

	useEffect(() => {
		let current = true
		void loadBlocks(date).then((items) => {
			if (current) setClash(items === null ? null : { date, items })
		})
		return () => {
			current = false
		}
	}, [date])

	const active = students.kind === 'ready' ? students.rows.filter((row) => row.status === 'active') : []
	active.sort((left, right) => nameCollator.compare(left.displayName, right.displayName))
	const minutes = parseLength(lengthText)
	const weekday = weekdayOf(date)
	const input = localTimeInput(date, time, context)
	const timeError = serverGap ? gapMessage(context.mainTimeZone) : input.error
	const errors = newLessonErrors(studentId, date, time, minutes, repeats, today, timeError)
	const shown = (field: Field) =>
		submitted || touched[field] || (field === 'time' && timeError) ? errors[field] : undefined
	const touch = (field: Field) => setTouched((current) => ({ ...current, [field]: true }))

	const candidate = input.instant === null ? null : { startsAt: input.instant, durationMinutes: minutes ?? 60 }
	const clashes = overlapsOn(date, clash, candidate)
	const second = secondZone !== null && !sameTimeZone(secondZone, context.mainTimeZone) ? secondZone : null
	const zoneLine = input.instant === null ? null : secondWhen(input.instant, context.mainTimeZone, second)
	const noStudents = students.kind === 'ready' && active.length === 0
	const blocked = !available || students.kind !== 'ready' || noStudents

	function chooseStudent(value: string) {
		setStudentId(value)
		if (lengthEdited) return
		const row = active.find((student) => student.id === value)
		if (row) setLengthText(String(row.defaultLessonMinutes))
	}

	function announceCreated() {
		const name = active.find((student) => student.id === studentId)?.displayName ?? ''
		toast.show({
			title: repeats === 'weekly' ? 'Series added' : 'Lesson added',
			description: name,
		})
	}

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (pending || blocked || command.blocked || context.stale) return
		setSubmitted(true)
		setFailed(false)
		if (errors.student) return studentRef.current?.focus()
		if (errors.date) return document.getElementById('new-lesson-date')?.focus()
		if (errors.time || time === null) return document.getElementById('new-lesson-time')?.focus()
		if (errors.length || minutes === null) return lengthRef.current?.focus()
		const result = await command.mutate({ kind: 'new' }, 'create', {
			studentId,
			date,
			startTime: time,
			durationMinutes: minutes,
			repeats,
			expectedDefaultTimeZone: context.mainTimeZone,
		})
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
					<ScrollArea className="max-h-[calc(100dvh-14rem)]" viewportClassName="scroll-fade max-h-[inherit] px-1 -mx-1">
						<CalendarFormStatus
							entry={command.entry}
							blocked={command.blocked}
							onViewSchedule={() => {
								command.detach()
								onClose()
							}}
						/>
						<div className="flex flex-col gap-4 py-1">
							<TimeZoneStaleNotice stale={context.stale} pending={pending} onRefresh={onRefresh} />
							<NewLessonNotices
								students={students}
								failed={failed}
								clashes={clashes}
								mainTimeZone={context.mainTimeZone}
							/>
							<NewLessonStudent
								studentId={studentId}
								chooseStudent={chooseStudent}
								pending={pending}
								blocked={blocked}
								studentRef={studentRef}
								students={students}
								active={active}
								error={shown('student')}
								onBlur={() => touch('student')}
								noStudents={noStudents}
							/>
							<div className="grid items-start gap-4 sm:grid-cols-2">
								<DateField
									id="new-lesson-date"
									label="Date"
									value={date}
									onChange={(value) => {
										setDate(value)
										setServerGap(false)
									}}
									disabled={pending}
									error={errors.date}
								/>
								<div className="flex min-w-0 flex-col gap-2">
									<span id="new-lesson-time-label" className="text-body text-muted-foreground">
										Start time, {input.label}
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
									{shown('time') ? (
										<p id="new-lesson-time-note" className="text-caption text-destructive">
											{shown('time')}
										</p>
									) : zoneLine !== null ? (
										<p
											id="new-lesson-time-note"
											data-slot="new-lesson-zone"
											className="text-caption text-muted-foreground"
										>
											{zoneLine}
										</p>
									) : null}
									<LocalTimeHint id="new-lesson-time-dst" hint={input.hint} />
								</div>
							</div>
							<div className="grid items-start gap-4 sm:grid-cols-2">
								<TextField
									ref={lengthRef}
									id="new-lesson-length"
									name="length"
									label="Length, min"
									inputMode="numeric"
									autoComplete="off"
									value={lengthText}
									onChange={(event) => {
										setLengthText(event.target.value)
										setLengthEdited(true)
									}}
									onBlur={() => touch('length')}
									disabled={pending}
									helper={
										lengthEdited
											? '15 to 240 minutes.'
											: "Taken from the student's usual lesson length. 15 to 240 minutes."
									}
									error={shown('length')}
								/>
								<div className="flex min-w-0 flex-col gap-2">
									<label htmlFor="new-lesson-repeats" className="text-body text-muted-foreground">
										Repeats
									</label>
									<Select
										value={repeats}
										onValueChange={(value) => setRepeats(value === 'weekly' ? 'weekly' : 'once')}
										disabled={pending}
									>
										<SelectTrigger id="new-lesson-repeats" className="w-full min-w-0" />
										<SelectContent>
											<SelectItem index={0} value="once">
												Once
											</SelectItem>
											<SelectItem index={1} value="weekly">
												Every week
											</SelectItem>
										</SelectContent>
									</Select>
									{repeats === 'weekly' && time !== null && input.instant !== null ? (
										<p data-slot="new-lesson-repeat-note" className="text-caption text-muted-foreground">
											{seriesPhrase(weekday, time)} {input.label} until you end the series.
										</p>
									) : null}
								</div>
							</div>
						</div>
					</ScrollArea>
					<NewLessonFooter
						onClose={onClose}
						pending={pending}
						blocked={blocked || command.blocked || context.stale}
						repeats={repeats}
					/>
				</form>
			</DialogContent>
		</Dialog>
	)
}
