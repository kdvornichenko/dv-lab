'use client'

import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from 'react'

import { DateField } from '@/components/app/date-field'
import { TextField } from '@/components/app/text-field'
import { Banner, BannerDescription, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { TimePicker } from '@/components/ui/time-picker'
import { apiRequest } from '@/lib/api-client'
import { secondWhen, seriesPhrase, vnRange, vnWhen, weekdayName } from '@/lib/schedule-format'

import {
	LESSON_MINUTES_MAX,
	LESSON_MINUTES_MIN,
	type LessonRepeats,
	type ScheduleCreateResponse,
	type StudentRow,
} from '@dv-lab/contracts'
import { SCHEDULE_TIME_ZONE, overlaps, weekdayOf, zonedInstant, type OverlapItem } from '@dv-lab/core'

import { useToast } from '../../_components/toasts'

export type OverlapBlock = OverlapItem & { studentName: string }

export type StudentsState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; rows: StudentRow[] }

interface NewLessonDialogProps {
	students: StudentsState
	seed: { date: string; time: string; durationMinutes?: number }
	today: string
	secondZone: string | null
	currentYear: number
	blocksOn: (date: string) => Promise<OverlapBlock[]>
	onClose: () => void
	onCreated: () => void
}

type Field = 'student' | 'time' | 'length'

const nameCollator = new Intl.Collator('en', { sensitivity: 'base' })

function parseLength(text: string): number | null {
	const trimmed = text.trim()
	if (!/^\d+$/.test(trimmed)) return null
	const value = Number(trimmed)
	return value >= LESSON_MINUTES_MIN && value <= LESSON_MINUTES_MAX ? value : null
}

function secondZoneLine(date: string, time: string | null, zone: string | null): string | null {
	if (time === null) return null
	return secondWhen(zonedInstant(date, time, SCHEDULE_TIME_ZONE), zone)
}

function clashText(items: readonly OverlapBlock[]): string {
	const label = (item: OverlapBlock) => `${item.studentName} ${vnRange(item.startsAt, item.durationMinutes, null)}`
	if (items.length === 1) return `${label(items[0])}. You can still save.`
	if (items.length === 2) return `${label(items[0])} and ${label(items[1])}. You can still save.`
	return `${label(items[0])}, ${label(items[1])} and ${items.length - 2} more. You can still save.`
}

export function NewLessonDialog({
	students,
	seed,
	today,
	secondZone,
	currentYear,
	blocksOn,
	onClose,
	onCreated,
}: NewLessonDialogProps) {
	const toast = useToast()
	const [studentId, setStudentId] = useState('')
	const [date, setDate] = useState(seed.date)
	const [time, setTime] = useState<string | null>(seed.time)
	const [lengthText, setLengthText] = useState(String(seed.durationMinutes ?? 60))
	const [lengthEdited, setLengthEdited] = useState(seed.durationMinutes !== undefined)
	const [repeats, setRepeats] = useState<LessonRepeats>('once')
	const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
	const [submitted, setSubmitted] = useState(false)
	const [failed, setFailed] = useState(false)
	const [pending, setPending] = useState(false)
	const [clash, setClash] = useState<{ date: string; items: OverlapBlock[] } | null>(null)
	const studentRef = useRef<HTMLButtonElement>(null)
	const lengthRef = useRef<HTMLInputElement>(null)

	const loadBlocks = useEffectEvent((forDate: string) => blocksOn(forDate))

	useEffect(() => {
		let current = true
		void loadBlocks(date).then((items) => {
			if (current) setClash({ date, items })
		})
		return () => {
			current = false
		}
	}, [date])

	const active = students.kind === 'ready' ? students.rows.filter((row) => row.status === 'active') : []
	active.sort((left, right) => nameCollator.compare(left.displayName, right.displayName))
	const minutes = parseLength(lengthText)
	const weekday = weekdayOf(date)

	const errors: Partial<Record<Field | 'date', string>> = {}
	if (studentId === '') errors.student = 'Choose a student.'
	if (time === null) errors.time = 'Choose a start time.'
	if (minutes === null) errors.length = 'Use 15 to 240 minutes.'
	const dateError =
		repeats === 'weekly' && date < today ? 'Choose today or a later date for a repeating lesson.' : undefined
	const shown = (field: Field) => (submitted || touched[field] ? errors[field] : undefined)
	const touch = (field: Field) => setTouched((current) => ({ ...current, [field]: true }))

	const candidate =
		time === null ? null : { startsAt: zonedInstant(date, time, SCHEDULE_TIME_ZONE), durationMinutes: minutes ?? 60 }
	const clashes = candidate !== null && clash !== null && clash.date === date ? overlaps(clash.items, candidate) : []
	const zoneLine = secondZoneLine(date, time, secondZone)
	const noStudents = students.kind === 'ready' && active.length === 0
	const blocked = students.kind !== 'ready' || noStudents

	function chooseStudent(value: string) {
		setStudentId(value)
		if (lengthEdited) return
		const row = active.find((student) => student.id === value)
		if (row) setLengthText(String(row.defaultLessonMinutes))
	}

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (pending || blocked) return
		setSubmitted(true)
		setFailed(false)
		if (errors.student) return studentRef.current?.focus()
		if (dateError) return document.getElementById('new-lesson-date')?.focus()
		if (errors.time || time === null) return document.getElementById('new-lesson-time')?.focus()
		if (errors.length || minutes === null) return lengthRef.current?.focus()
		setPending(true)
		const result = await apiRequest<ScheduleCreateResponse>('POST', '/schedule/lessons', {
			studentId,
			date,
			startTime: time,
			durationMinutes: minutes,
			repeats,
		})
		setPending(false)
		if (!result.ok) {
			setFailed(true)
			return
		}
		const name = active.find((student) => student.id === studentId)?.displayName ?? ''
		if ('lesson' in result.data) {
			toast.show({
				title: 'Lesson added',
				description: `${name}, ${vnWhen(new Date(result.data.lesson.startsAt), null, currentYear)}.`,
			})
		} else {
			toast.show({
				title: result.status === 200 ? 'This series already exists' : 'Series added',
				description: `${name} every ${weekdayName(result.data.series.weekday)} at ${result.data.series.startTime}.`,
			})
		}
		onCreated()
	}

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !pending) onClose()
			}}
		>
			<DialogContent size="lg">
				<form noValidate onSubmit={onSubmit}>
					<DialogHeader>
						<DialogTitle>New lesson</DialogTitle>
						<DialogDescription>Add a lesson to the schedule. Times are in Vietnam time.</DialogDescription>
					</DialogHeader>
					<ScrollArea className="max-h-[calc(100dvh-14rem)]" viewportClassName="scroll-fade max-h-[inherit] px-1 -mx-1">
						<div className="flex flex-col gap-4 py-1">
							{students.kind === 'error' ? (
								<Banner status="error">
									<BannerTitle>Could not load students. Close this window and try again.</BannerTitle>
								</Banner>
							) : null}
							{failed ? (
								<Banner status="error">
									<BannerTitle>Could not add the lesson. Try again.</BannerTitle>
								</Banner>
							) : null}
							{clashes.length > 0 ? (
								<Banner status="warning" data-slot="new-lesson-overlap">
									<BannerTitle>This overlaps another lesson</BannerTitle>
									<BannerDescription>{clashText(clashes)}</BannerDescription>
								</Banner>
							) : null}
							<div className="flex min-w-0 flex-col gap-2">
								<label htmlFor="new-lesson-student" className="text-body text-muted-foreground">
									Student
								</label>
								<Select value={studentId} onValueChange={chooseStudent} disabled={pending || blocked}>
									<SelectTrigger
										ref={studentRef}
										id="new-lesson-student"
										className="w-full min-w-0"
										placeholder={students.kind === 'loading' ? 'Loading students…' : 'Choose a student'}
										autoFocus
										error={shown('student')}
										onBlur={() => touch('student')}
									/>
									<SelectContent>
										{active.map((student, index) => (
											<SelectItem key={student.id} index={index} value={student.id}>
												{student.displayName}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{noStudents ? (
									<p className="text-caption text-muted-foreground">
										No active students. Add a card on the Students page.
									</p>
								) : null}
							</div>
							<div className="grid items-start gap-4 sm:grid-cols-2">
								<DateField
									id="new-lesson-date"
									label="Date"
									value={date}
									onChange={setDate}
									disabled={pending}
									error={dateError}
								/>
								<div className="flex min-w-0 flex-col gap-2">
									<span id="new-lesson-time-label" className="text-body text-muted-foreground">
										Start time, VN
									</span>
									<TimePicker
										id="new-lesson-time"
										aria-labelledby="new-lesson-time-label"
										aria-describedby="new-lesson-time-note"
										value={time}
										onValueChange={(value) => {
											setTime(value)
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
									{repeats === 'weekly' && time !== null ? (
										<p data-slot="new-lesson-repeat-note" className="text-caption text-muted-foreground">
											{seriesPhrase(weekday, time)} VN until you end the series.
										</p>
									) : null}
								</div>
							</div>
						</div>
					</ScrollArea>
					<DialogFooter>
						<Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
							Discard changes
						</Button>
						<Button type="submit" loading={pending} disabled={blocked}>
							{pending ? 'Adding…' : repeats === 'weekly' ? 'Add series' : 'Add lesson'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
