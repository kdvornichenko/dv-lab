'use client'

import { useEffect, useState } from 'react'

import { ArrowRight, CalendarClock } from 'lucide-react'

import { CalendarFormStatus } from '@/components/app/calendar-command-notice'
import { DateField } from '@/components/app/date-field'
import { GoogleConflicts, useGoogleConflicts } from '@/components/app/google-conflicts'
import { Button } from '@/components/ui/button'
import { TimePicker } from '@/components/ui/time-picker'
import type { CalendarLesson } from '@/lib/lesson-actions'
import { formatDate, formatDay, mainRange, mainWhen } from '@/lib/schedule-format'

import { scheduleDate, zonedParts } from '@dv-lab/core'

import { useToast } from '../../_components/toasts'
import {
	gapMessage,
	localTimeInput,
	LocalTimeHint,
	TimeZoneStaleNotice,
	useScheduleFormContext,
	type ScheduleFormContext,
} from './schedule-form-context'
import { useScheduleMutation } from './schedule-mutations'
import type { MoveSeed } from './use-lesson-drag'

interface LessonMoveFormProps extends ScheduleFormContext {
	moveSeed?: MoveSeed
	event: CalendarLesson
	available: boolean
	currentMainTimeZone: string
	secondZone: string | null
	locked: boolean
	onPendingChange: (pending: boolean) => void
	onDiscard: () => void
	onStale: () => void
	onRefresh: () => void
	onMoved: () => void
}

type Field = 'date' | 'time'

function moveErrors(
	date: string,
	time: string | null,
	target: Date | null,
	start: Date,
	timeError: string | undefined
) {
	return {
		date: date === '' ? 'Choose a date.' : undefined,
		time:
			timeError ??
			(time === null
				? 'Choose a start time.'
				: target?.getTime() === start.getTime()
					? 'Choose a different date or time.'
					: undefined),
	}
}

export function LessonMoveForm({
	moveSeed,
	event: initialEvent,
	available,
	mainTimeZone,
	asOf,
	currentMainTimeZone,
	secondZone,
	locked,
	onPendingChange,
	onDiscard,
	onStale,
	onRefresh,
	onMoved,
}: LessonMoveFormProps) {
	const toast = useToast()
	const context = useScheduleFormContext({ mainTimeZone, asOf }, currentMainTimeZone)
	const { currentYear } = context
	const [event] = useState(initialEvent)
	const block = {
		key: event.eventKey,
		ref: event.binding.ref,
		startsAt: event.when.startsAt,
		durationMinutes: (Date.parse(event.when.endsAt) - Date.parse(event.when.startsAt)) / 60000,
	}
	const start = new Date(block.startsAt)
	const current = zonedParts(start, context.mainTimeZone)
	const [date, setDate] = useState(moveSeed?.date ?? scheduleDate(start, context.mainTimeZone))
	const [time, setTime] = useState<string | null>(moveSeed?.time ?? current.time)
	const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
	const [submitted, setSubmitted] = useState(false)
	const [failed, setFailed] = useState<string | null>(null)
	const command = useScheduleMutation({
		mainTimeZone: context.mainTimeZone,
		date: scheduleDate(start, context.mainTimeZone),
		event,
	})
	const pending = command.pending
	const [serverGap, setServerGap] = useState(false)
	const [sourceChanged, setSourceChanged] = useState(false)
	const disabled = pending || locked

	useEffect(() => {
		const timer = setTimeout(() => document.getElementById('move-lesson-date')?.focus(), 50)
		return () => clearTimeout(timer)
	}, [])

	const input = localTimeInput(date, time, context)
	const target = input.instant
	const timeError = serverGap ? gapMessage(context.mainTimeZone) : input.error
	const errors = moveErrors(date, time, target, start, timeError)
	const shown = (field: Field) =>
		submitted || touched[field] || (field === 'time' && timeError) ? errors[field] : undefined
	const conflicts = useGoogleConflicts({
		proposal:
			time !== null && !errors.date && !errors.time
				? {
						operation: 'move',
						input: {
							date,
							startTime: time,
							expectedStartsAt: block.startsAt,
							expectedDefaultTimeZone: context.mainTimeZone,
						},
					}
				: null,
		editedRef: block.ref,
		date: scheduleDate(start, context.mainTimeZone),
		available: available && !locked && !command.blocked && !context.stale && !sourceChanged,
	})

	useEffect(() => {
		onPendingChange(pending)
	}, [pending, onPendingChange])

	async function submit() {
		if (!conflicts.ready) return
		setSubmitted(true)
		setFailed(null)
		if (errors.date) return document.getElementById('move-lesson-date')?.focus()
		if (errors.time || time === null || target === null) return document.getElementById('move-lesson-time')?.focus()
		const result = await command.mutate(
			block.ref,
			'move',
			{
				date,
				startTime: time,
				expectedStartsAt: block.startsAt,
				expectedDefaultTimeZone: context.mainTimeZone,
			},
			conflicts.checked
		)
		if (result.kind === 'detached') return
		if (result.kind === 'zone_changed') return context.markStale()
		if (result.kind === 'gap') return setServerGap(true)
		if (result.kind === 'failed') {
			setFailed('Could not move the lesson. Try again.')
			return
		}
		if (result.kind === 'stale') {
			setSourceChanged(true)
			onStale()
			return
		}
		toast.show({ title: 'Lesson moved', description: 'Google Calendar confirmed the new time.' })
		onMoved()
	}

	return (
		<div role="group" aria-label="Move lesson" className="flex flex-col gap-4 rounded-xl bg-hover p-4">
			<TimeZoneStaleNotice stale={context.stale} pending={pending} onRefresh={onRefresh} />
			<CalendarFormStatus
				entry={command.entry}
				blocked={command.blocked}
				connectionShown

				onViewSchedule={() => {
					command.detach()
					onDiscard()
				}}
			/>
			<div className="grid items-start gap-4 sm:grid-cols-2">
				<DateField
					id="move-lesson-date"
					label="New date"
					value={date}
					onChange={(value) => {
						setDate(value)
						setServerGap(false)
						setTouched((state) => ({ ...state, date: true }))
					}}
					disabled={disabled}
					error={shown('date')}
				/>
				<div className="flex min-w-0 flex-col gap-2">
					<span id="move-lesson-time-label" className="text-body text-muted-foreground">
						Time, {input.label}
					</span>
					<TimePicker
						id="move-lesson-time"
						aria-labelledby="move-lesson-time-label"
						aria-describedby="move-lesson-time-error move-lesson-time-dst"
						value={time}
						onValueChange={(value) => {
							setTime(value)
							setServerGap(false)
							setTouched((state) => ({ ...state, time: true }))
						}}
						minuteStep={15}
						hourCycle={24}
						disabled={disabled}
						invalid={Boolean(shown('time'))}
						className="w-full"
					/>
					{shown('time') ? (
						<p id="move-lesson-time-error" className="text-caption text-destructive">
							{shown('time')}
						</p>
					) : null}
					<LocalTimeHint id="move-lesson-time-dst" hint={input.hint} />
				</div>
			</div>
			<div aria-live="polite" data-slot="move-lesson-change" className="flex flex-col gap-1 tabular-nums">
				<p data-slot="move-lesson-vn" className="flex flex-wrap items-center gap-x-2 text-body text-foreground">
					<span className="text-muted-foreground">{mainWhen(start, context.mainTimeZone, null, currentYear)}</span>
					<ArrowRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
					{target === null ? null : (
						<span>
							{formatDate(date, currentYear)}, {mainRange(target, block.durationMinutes, context.mainTimeZone, null)}
						</span>
					)}
				</p>
				{secondZone === null ? null : (
					<p
						data-slot="move-lesson-second"
						className="flex flex-wrap items-center gap-x-1 text-micro text-muted-foreground"
					>
						<span>{mainWhen(start, secondZone, null, currentYear)}</span>
						<ArrowRight aria-hidden className="size-3 shrink-0" />
						{target === null ? null : (
							<span>
								{formatDay(target, secondZone, currentYear)},{' '}
								{mainRange(target, block.durationMinutes, secondZone, null)}
							</span>
						)}
					</p>
				)}
			</div>
			<GoogleConflicts check={conflicts} pending={pending} durationMinutes={block.durationMinutes} failure={failed} />
			<div className="flex flex-wrap justify-end gap-2">
				<Button type="button" variant="ghost" size="compact" disabled={disabled} onClick={onDiscard}>
					Discard changes
				</Button>
				<Button
					type="button"
					size="compact"
					leadingIcon={CalendarClock}
					loading={pending}
					disabled={!conflicts.ready}
					onClick={() => void submit()}
				>
					{pending ? 'Moving…' : 'Move lesson'}
				</Button>
			</div>
		</div>
	)
}
