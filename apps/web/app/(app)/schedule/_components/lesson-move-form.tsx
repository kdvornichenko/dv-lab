'use client'

import { useEffect, useRef, useState } from 'react'

import { ArrowRight, CalendarClock } from 'lucide-react'

import { DateField } from '@/components/app/date-field'
import { ConflictStatus, FormFooter, lessonOverlaps, useGoogleConflicts } from '@/components/app/google-conflicts'
import { LengthField } from '@/components/app/length-field'
import { Button } from '@/components/ui/button'
import { TimePicker } from '@/components/ui/time-picker'
import type { CalendarLesson } from '@/lib/lesson-actions'
import { LENGTH_ERROR, LENGTH_HELPER } from '@/lib/lesson-length'
import { formatDate, formatDay, mainRange, mainWhen } from '@/lib/schedule-format'

import type { CalendarEditScope, CalendarEventView } from '@dv-lab/contracts'
import { scheduleDate, zonedParts } from '@dv-lab/core'

import type { DirectState } from './event-form'
import {
	localTimeInput,
	LocalTimeHint,
	TimeZoneStaleNotice,
	useScheduleFormContext,
	type ScheduleFormContext,
} from './schedule-form-context'
import type { CheckedWindow } from './schedule-mutations'
import { ScopeDialog } from './scope-dialog'
import type { MoveSeed } from './use-lesson-drag'

export type MoveDraft = { date: string; time: string; durationMinutes: number; checked?: CheckedWindow | null }

interface LessonMoveFormProps extends ScheduleFormContext {
	moveSeed?: MoveSeed
	event: CalendarLesson
	weekEvents: readonly CalendarEventView[]
	available: boolean
	scopes: readonly CalendarEditScope[]
	currentMainTimeZone: string
	secondZone: string | null
	locked: boolean
	direct?: boolean
	onDirect?: (state: DirectState) => void
	onClose: () => void
	onDiscard: () => void
	onRefresh: () => void
	onSave: (scope: CalendarEditScope, draft: MoveDraft) => Promise<boolean>
}

type Field = 'date' | 'time' | 'length'

function moveErrors(
	date: string,
	time: string | null,
	length: number | null,
	lengthChanged: boolean,
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
				: target?.getTime() === start.getTime() && !lengthChanged
					? 'Choose a different date or time.'
					: undefined),
		length: length === null ? LENGTH_ERROR : undefined,
	}
}

export function LessonMoveForm({
	moveSeed,
	event: initialEvent,
	weekEvents,
	available,
	scopes,
	mainTimeZone,
	asOf,
	currentMainTimeZone,
	secondZone,
	locked,
	direct = false,
	onDirect,
	onClose,
	onDiscard,
	onRefresh,
	onSave,
}: LessonMoveFormProps) {
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
	const [length, setLength] = useState<number | null>(moveSeed?.durationMinutes ?? block.durationMinutes)
	const [scoping, setScoping] = useState(false)
	const [stage, setStage] = useState<'start' | 'asked' | 'sending' | 'shown'>(direct ? 'start' : 'shown')
	const quick = stage !== 'shown'
	const sent = useRef(false)
	const lengthRef = useRef<HTMLInputElement>(null)
	const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
	const [submitted, setSubmitted] = useState(false)
	const [failed, setFailed] = useState<string | null>(null)
	const pending = locked
	const disabled = pending

	useEffect(() => {
		if (quick) return
		const timer = setTimeout(() => document.getElementById('move-lesson-date')?.focus(), 50)
		return () => clearTimeout(timer)
	}, [quick])

	const input = localTimeInput(date, time, context)
	const target = input.instant
	const timeError = input.error
	const lengthChanged = length !== null && length !== block.durationMinutes
	const minutes = length ?? block.durationMinutes
	const errors = moveErrors(date, time, length, lengthChanged, target, start, timeError)
	const shown = (field: Field) =>
		submitted || touched[field] || (field === 'time' && timeError) ? errors[field] : undefined
	const conflicts = useGoogleConflicts({
		proposal:
			time !== null && !errors.date && !errors.time && !errors.length
				? {
						operation: 'move',
						input: {
							date,
							startTime: time,
							...(lengthChanged ? { durationMinutes: length } : {}),
							expectedStartsAt: block.startsAt,
							expectedDefaultTimeZone: context.mainTimeZone,
						},
					}
				: null,
		editedRef: block.ref,
		date: scheduleDate(start, context.mainTimeZone),
		available: available && !locked && !context.stale,
	})

	async function send(scope: CalendarEditScope): Promise<boolean> {
		if (time === null || length === null) return false
		const done = await onSave(scope, {
			date,
			time,
			durationMinutes: length,
			checked: quick || scope !== 'one' ? undefined : conflicts.checked,
		})
		if (!done && scope === 'one') setFailed('Could not move the lesson. Try again.')
		return done
	}

	async function submit() {
		if (!conflicts.ready) return
		setSubmitted(true)
		setFailed(null)
		if (errors.date) return document.getElementById('move-lesson-date')?.focus()
		if (errors.time || time === null || target === null) return document.getElementById('move-lesson-time')?.focus()
		if (errors.length || length === null) return lengthRef.current?.focus()
		if (block.ref.kind === 'series') return setScoping(true)
		await send('one')
	}

	if (stage === 'start') {
		const ready =
			available && !locked && !context.stale && target !== null && !errors.date && !errors.time && !errors.length
		const series = block.ref.kind === 'series'
		setStage(!ready ? 'shown' : series ? 'asked' : 'sending')
		if (ready && series) setScoping(true)
	}

	useEffect(() => {
		if (stage !== 'sending' || sent.current) return
		sent.current = true
		void send('one').then(() => setStage('shown'))
	})

	const directState: DirectState = !quick ? 'shown' : stage === 'asked' ? 'asking' : 'sending'
	useEffect(() => {
		if (direct) onDirect?.(directState)
	}, [direct, directState, onDirect])

	return (
		<div role="group" aria-label="Move lesson" className="flex flex-col gap-4 rounded-xl bg-hover p-4">
			<TimeZoneStaleNotice stale={context.stale} pending={pending} onRefresh={onRefresh} />
			<div className="grid items-start gap-4 sm:grid-cols-2">
				<DateField
					id="move-lesson-date"
					label="New date"
					value={date}
					onChange={(value) => {
						setDate(value)
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
				<LengthField
					id="move-lesson-length"
					hoursRef={lengthRef}
					initialMinutes={length ?? block.durationMinutes}
					onCommit={(value) => {
						setLength(value)
						setTouched((state) => ({ ...state, length: true }))
					}}
					disabled={disabled}
					helper={LENGTH_HELPER}
					error={shown('length')}
				/>
			</div>
			<div aria-live="polite" data-slot="move-lesson-change" className="flex flex-col gap-1 tabular-nums">
				<p data-slot="move-lesson-vn" className="flex flex-wrap items-center gap-x-2 text-body text-foreground">
					<span className="text-muted-foreground">{mainWhen(start, context.mainTimeZone, null, currentYear)}</span>
					<ArrowRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
					{target === null ? null : (
						<span>
							{formatDate(date, currentYear)}, {mainRange(target, minutes, context.mainTimeZone, null)}
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
								{formatDay(target, secondZone, currentYear)}, {mainRange(target, minutes, secondZone, null)}
							</span>
						)}
					</p>
				)}
			</div>
			<FormFooter
				className=""
				status={
					<ConflictStatus
						check={conflicts}
						timeZone={context.mainTimeZone}
						durationMinutes={minutes}
						failure={failed}
						lessons={lessonOverlaps(weekEvents, target, minutes, event.eventKey)}
					/>
				}
			>
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
					Move lesson
				</Button>
			</FormFooter>
			{scoping ? (
				<ScopeDialog
					kind={{ subject: 'lesson', action: 'save' }}
					allowed={scopes}
					onConfirm={send}
					onClose={quick ? onClose : () => setScoping(false)}
					onDone={() => {
						setScoping(false)
						setStage('shown')
					}}
				/>
			) : null}
		</div>
	)
}
