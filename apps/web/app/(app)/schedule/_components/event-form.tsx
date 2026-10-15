'use client'

import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react'

import { Info, RefreshCw } from 'lucide-react'

import { DateField } from '@/components/app/date-field'
import { READ_ISSUES } from '@/components/app/google-calendar-state'
import { ConflictStatus, FormFooter, useGoogleConflicts } from '@/components/app/google-conflicts'
import { LengthField } from '@/components/app/length-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TabItem, Tabs, TabsList } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { TimePicker } from '@/components/ui/time-picker'
import { Tooltip } from '@/components/ui/tooltip'
import { LENGTH_ERROR, LENGTH_HELPER } from '@/lib/lesson-length'
import { formatDate, secondWhen, weekdayName } from '@/lib/schedule-format'
import { sameTimeZone } from '@/lib/time-zones'

import type {
	CalendarEditScope,
	CalendarEventDetails,
	CalendarEventView,
	GoogleScheduleWindow,
	LessonRepeats,
	UpdateCalendarEventRequest,
} from '@dv-lab/contracts'
import { scheduleDate, weekdayOf, zonedParts } from '@dv-lab/core'

import {
	COLOR_CUSTOM,
	COLOR_DEFAULT,
	ColorSelect,
	colorIdOf,
	colorValueOf,
	useEventPalette,
	type PaletteState,
} from './color-select'
import { backAt, placedEvent, type WriteRunner } from './optimistic-writes'
import { LocalTimeHint, localTimeInput, TimeZoneStaleNotice, useScheduleFormContext } from './schedule-form-context'
import { useScheduleMutation } from './schedule-mutations'
import { ScopeDialog } from './scope-dialog'
import type { MoveSeed } from './use-lesson-drag'

export const EVENT_TITLE_ERROR = 'Enter a title.'
export const CHECK_STUDENT = '00000000-0000-0000-0000-000000000000'

const DAY_MINUTES = 1440

type ScheduleContext = ReturnType<typeof useScheduleFormContext>
type ConflictCheck = ReturnType<typeof useGoogleConflicts>
type TimeField = 'date' | 'time' | 'length'

export interface TimeSeed {
	date: string
	time: string
	durationMinutes?: number
	dragged?: boolean
}

function clockMinutes(time: string): number {
	return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
}

function clockOf(minutes: number): string {
	const wall = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
	return `${String(Math.floor(wall / 60)).padStart(2, '0')}:${String(wall % 60).padStart(2, '0')}`
}

function dateError(date: string, repeats: LessonRepeats, today: string, allowPast: boolean) {
	if (date === '') return 'Choose a date.'
	if (!allowPast && repeats === 'weekly' && date < today) return 'Choose today or later.'
	return undefined
}

export function createProposal(
	input: {
		studentId: string
		date: string
		startTime: string | null
		durationMinutes: number | null
		repeats: LessonRepeats
		expectedDefaultTimeZone: string
	},
	invalid: boolean
) {
	if (!input.studentId || input.startTime === null || input.durationMinutes === null || invalid) return null
	return {
		operation: 'create' as const,
		input: { ...input, startTime: input.startTime, durationMinutes: input.durationMinutes },
	}
}

export function withoutEvent(check: ConflictCheck, eventKey: string): ConflictCheck {
	const result = check.result
	if (result?.state !== 'complete') return check
	return { ...check, result: { ...result, events: result.events.filter((event) => event.eventKey !== eventKey) } }
}

export function HelperLine({ id, text, error }: { id: string; text: string | null; error?: string }) {
	return (
		<p
			id={id}
			className={error ? 'min-h-4 text-caption text-destructive' : 'min-h-4 text-caption text-muted-foreground'}
		>
			{error ?? text}
		</p>
	)
}

export function useTimeFields(
	seed: TimeSeed,
	context: ScheduleContext,
	secondZone: string | null,
	options: { idPrefix: string; repeats?: LessonRepeats; allowPast?: boolean }
) {
	const { today, currentYear } = context
	const initialMinutes = seed.durationMinutes ?? 60
	const [date, setDateValue] = useState(seed.date)
	const [time, setTimeValue] = useState<string | null>(seed.time)
	const [length, setLength] = useState<number | null>(initialMinutes)
	const [lengthKey, setLengthKey] = useState(0)
	const [span, setSpan] = useState(initialMinutes)
	const [lengthEdited, setLengthEdited] = useState(seed.dragged === true)
	const [repeats, setRepeats] = useState<LessonRepeats>(options.repeats ?? 'once')
	const [touched, setTouched] = useState<Partial<Record<TimeField, boolean>>>({})
	const [submitted, setSubmitted] = useState(false)

	const weekday = weekdayOf(date)
	const input = localTimeInput(date, time, context)
	const timeError = input.error
	const errors = {
		date: dateError(date, repeats, today, options.allowPast === true),
		time: timeError ?? (time === null ? 'Choose a start time.' : undefined),
		length: length === null ? LENGTH_ERROR : undefined,
	}
	const shown = (field: TimeField) =>
		submitted || touched[field] || (field === 'time' && timeError) ? errors[field] : undefined
	const touch = (field: TimeField) => setTouched((current) => ({ ...current, [field]: true }))

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

	function setDate(value: string) {
		setDateValue(value)
		touch('date')
	}

	function setTime(value: string | null) {
		setTimeValue(value)
		touch('time')
	}

	function commitLength(next: number | null) {
		if (next !== span) setLengthEdited(true)
		setLength(next)
		if (next !== null) setSpan(next)
		touch('length')
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

	function setUsualLength(minutes: number) {
		setLength(minutes)
		setLengthKey((key) => key + 1)
		setSpan(minutes)
	}

	return {
		idPrefix: options.idPrefix,
		date,
		time,
		length,
		lengthKey,
		span,
		lengthEdited,
		repeats,
		minutes: length,
		weekday,
		input,
		timeError,
		errors,
		shown,
		startLine,
		end,
		endLine,
		submitted,
		setSubmitted,
		setDate,
		setTime,
		setRepeats,
		commitLength,
		chooseEnd,
		setUsualLength,
	}
}

export type TimeFields = ReturnType<typeof useTimeFields>

export function TimeRows({
	fields,
	pending,
	lengthRef,
	lengthHelper = LENGTH_HELPER,
	repeatsLocked = null,
}: {
	fields: TimeFields
	pending: boolean
	lengthRef?: RefObject<HTMLInputElement | null>
	lengthHelper?: string
	repeatsLocked?: string | null
}) {
	const { idPrefix: prefix, input, time, repeats } = fields
	return (
		<>
			<div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)]">
				<div className="col-span-2 min-w-0 sm:col-span-1">
					<DateField
						id={`${prefix}-date`}
						label="Date"
						short
						reserve
						value={fields.date}
						onChange={fields.setDate}
						disabled={pending}
						error={fields.shown('date')}
					/>
				</div>
				<div className="flex min-w-0 flex-col gap-2">
					<span id={`${prefix}-time-label`} className="text-body text-muted-foreground">
						Start, {input.label}
					</span>
					<TimePicker
						id={`${prefix}-time`}
						aria-labelledby={`${prefix}-time-label`}
						aria-describedby={`${prefix}-time-note ${prefix}-time-dst`}
						value={time}
						onValueChange={fields.setTime}
						minuteStep={15}
						hourCycle={24}
						disabled={pending}
						invalid={Boolean(fields.shown('time'))}
						className="w-full"
					/>
					<HelperLine id={`${prefix}-time-note`} text={fields.startLine} error={fields.shown('time')} />
					<LocalTimeHint id={`${prefix}-time-dst`} hint={input.hint} />
				</div>
				<div className="flex min-w-0 flex-col gap-2">
					<span id={`${prefix}-end-label`} className="text-body text-muted-foreground">
						End, {input.label}
					</span>
					<TimePicker
						id={`${prefix}-end`}
						aria-labelledby={`${prefix}-end-label`}
						aria-describedby={`${prefix}-end-note`}
						value={fields.end}
						onValueChange={fields.chooseEnd}
						minuteStep={15}
						hourCycle={24}
						disabled={pending || time === null}
						className="w-full"
					/>
					<HelperLine id={`${prefix}-end-note`} text={fields.endLine} />
				</div>
			</div>
			<div className="grid items-start gap-3 sm:grid-cols-2">
				<LengthField
					key={fields.lengthKey}
					hoursRef={lengthRef}
					id={`${prefix}-length`}
					initialMinutes={fields.length ?? fields.span}
					onCommit={fields.commitLength}
					disabled={pending}
					helper={lengthHelper}
					error={fields.shown('length')}
				/>
				<div className="flex min-w-0 flex-col gap-2">
					<span id={`${prefix}-repeats-label`} className="text-body text-muted-foreground">
						Repeats
					</span>
					<Tabs
						value={repeatsLocked === null ? repeats : ''}
						onValueChange={(value) => fields.setRepeats(value === 'weekly' ? 'weekly' : 'once')}
					>
						<div className="flex min-w-0 rounded-xl bg-muted">
							<TabsList
								aria-labelledby={`${prefix}-repeats-label`}
								className="w-full bg-transparent *:flex-1 *:justify-center"
							>
								<TabItem value="once" label="Once" disabled={pending || repeatsLocked !== null} />
								<TabItem value="weekly" label="Every week" disabled={pending || repeatsLocked !== null} />
							</TabsList>
						</div>
					</Tabs>
					<HelperLine
						id={`${prefix}-repeat-note`}
						text={
							repeatsLocked ??
							(repeats === 'weekly' && time !== null && input.instant !== null
								? `Every ${weekdayName(fields.weekday)}, ${time} ${input.label}.`
								: null)
						}
					/>
				</div>
			</div>
		</>
	)
}

export interface EventValues {
	title: string
	colorValue: string
	location: string
	description: string
}

export function useEventValues(initial?: Partial<EventValues>) {
	const [title, setTitle] = useState(initial?.title ?? '')
	const [colorValue, setColorValue] = useState(initial?.colorValue ?? COLOR_DEFAULT)
	const [location, setLocation] = useState(initial?.location ?? '')
	const [description, setDescription] = useState(initial?.description ?? '')
	return { title, setTitle, colorValue, setColorValue, location, setLocation, description, setDescription }
}

export type EventFields = ReturnType<typeof useEventValues>

export function EventTitleRow({
	id,
	values,
	error,
	disabled,
	inputRef,
	autoFocus,
}: {
	id: string
	values: EventFields
	error?: string
	disabled: boolean
	inputRef?: RefObject<HTMLInputElement | null>
	autoFocus?: boolean
}) {
	return (
		<div className="flex min-w-0 flex-col gap-2">
			<label htmlFor={id} className="text-body text-muted-foreground">
				Title
			</label>
			<Input
				id={id}
				ref={inputRef}
				value={values.title}
				onChange={(event) => values.setTitle(event.target.value)}
				placeholder="Title"
				maxLength={1024}
				disabled={disabled}
				autoFocus={autoFocus}
				aria-invalid={error ? true : undefined}
				aria-describedby={`${id}-note`}
				autoComplete="off"
			/>
			<HelperLine id={`${id}-note`} text={null} error={error} />
		</div>
	)
}

export function EventExtraRows({
	prefix,
	values,
	palette,
	custom,
	disabled,
	descriptionFormatted = false,
}: {
	prefix: string
	values: EventFields
	palette: PaletteState
	custom: { background: string | null } | null
	disabled: boolean
	descriptionFormatted?: boolean
}) {
	return (
		<>
			<div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
				<div className="flex min-w-0 flex-col gap-2">
					<label htmlFor={`${prefix}-color`} className="text-body text-muted-foreground">
						Color
					</label>
					<ColorSelect
						id={`${prefix}-color`}
						value={values.colorValue}
						onValueChange={values.setColorValue}
						palette={palette}
						custom={custom}
						disabled={disabled}
					/>
				</div>
				<div className="flex min-w-0 flex-col gap-2">
					<label htmlFor={`${prefix}-place`} className="text-body text-muted-foreground">
						Place
					</label>
					<Input
						id={`${prefix}-place`}
						value={values.location}
						onChange={(event) => values.setLocation(event.target.value)}
						placeholder="Place"
						maxLength={1024}
						disabled={disabled}
						autoComplete="off"
					/>
				</div>
			</div>
			<div className="flex min-w-0 flex-col gap-2">
				<label
					htmlFor={descriptionFormatted ? undefined : `${prefix}-description`}
					className="text-body text-muted-foreground"
				>
					Description
				</label>
				{descriptionFormatted ? (
					<div
						data-slot="event-description-note"
						className="flex items-start gap-3 rounded-lg bg-surface-2 p-3 ring-1 ring-border ring-inset"
					>
						<Info size={16} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
						<p className="min-w-0 text-body text-muted-foreground">
							This description has formatting, so it can only be edited in Google Calendar. It stays as it is when you
							save.
						</p>
					</div>
				) : (
					<Textarea
						id={`${prefix}-description`}
						value={values.description}
						onChange={(event) => values.setDescription(event.target.value)}
						placeholder="Description"
						maxLength={8192}
						disabled={disabled}
						className="max-h-44 min-h-19 overflow-y-auto pointer-coarse:max-h-52"
					/>
				)}
			</div>
		</>
	)
}

export function ChangedInGoogle({ onRefresh, disabled }: { onRefresh: () => void; disabled: boolean }) {
	return (
		<Tooltip content={READ_ISSUES.external_change} className="max-w-[280px]">
			<Button
				type="button"
				variant="ghost"
				size="compact"
				leadingIcon={RefreshCw}
				disabled={disabled}
				className="[&_svg]:text-warning"
				onClick={onRefresh}
			>
				Changed in Google. Refresh
			</Button>
		</Tooltip>
	)
}

export function EventFooter({
	status,
	disabled,
	label,
	onDiscard,
}: {
	status: ReactNode
	disabled: boolean
	label: string
	onDiscard: () => void
}) {
	return (
		<FormFooter status={status}>
			<Button type="button" variant="ghost" onClick={onDiscard}>
				Discard changes
			</Button>
			<Button type="submit" disabled={disabled}>
				{label}
			</Button>
		</FormFooter>
	)
}

export type DirectState = 'asking' | 'sending' | 'shown'

export function EventEditForm({
	moveSeed,
	event,
	details,
	latestVersion,
	window,
	mainTimeZone,
	secondZone,
	available,
	direct = false,
	onDirect,
	onDirtyChange,
	onRefresh,
	onReload,
	onDiscard,
	onClose,
	onWrite,
}: {
	moveSeed?: MoveSeed
	event: CalendarEventView
	details: CalendarEventDetails
	latestVersion: string
	window: GoogleScheduleWindow
	mainTimeZone: string
	secondZone: string | null
	available: boolean
	direct?: boolean
	onDirect?: (state: DirectState) => void
	onDirtyChange: (dirty: boolean) => void
	onRefresh: () => void
	onReload: () => void
	onDiscard: () => void
	onClose: () => void
	onWrite: WriteRunner
}) {
	const asOf = window.read.state === 'unavailable' ? new Date().toISOString() : window.read.fetchedAt
	const context = useScheduleFormContext({ mainTimeZone, asOf }, window.requestedRange.timeZone)
	const [seed] = useState(() => {
		if (event.when.kind !== 'timed') throw new Error('Only timed events are edited')
		const start = new Date(event.when.startsAt)
		const parts = zonedParts(start, mainTimeZone)
		return {
			date: parts.date,
			time: clockOf(parts.minutes),
			durationMinutes: Math.round((Date.parse(event.when.endsAt) - start.getTime()) / 60000),
		}
	})
	const timeOnly = details.repeat.kind === 'other'
	const locked = timeOnly ? READ_ISSUES.unsupported_recurrence : null
	const seedRepeats: LessonRepeats = details.repeat.kind === 'weekly' ? 'weekly' : 'once'
	const fields = useTimeFields(moveSeed ?? seed, context, secondZone, {
		idPrefix: 'event-edit',
		repeats: seedRepeats,
		allowPast: true,
	})
	const base = {
		title: details.title?.trim() ?? '',
		color: colorValueOf(details.color),
		location: details.location ?? '',
		description: details.description ?? '',
	}
	const values = useEventValues({
		title: base.title,
		colorValue: base.color,
		location: base.location,
		description: base.description,
	})
	const palette = useEventPalette()
	const command = useScheduleMutation({ mainTimeZone: context.mainTimeZone, date: seed.date })
	const [titleTouched, setTitleTouched] = useState(false)
	const [scoping, setScoping] = useState(false)
	const [stage, setStage] = useState<'start' | 'asked' | 'sending' | 'shown'>(direct ? 'start' : 'shown')
	const quick = stage !== 'shown'
	const lengthRef = useRef<HTMLInputElement>(null)
	const titleRef = useRef<HTMLInputElement>(null)
	const sent = useRef(false)

	const { date, time, minutes, repeats, input, errors } = fields
	const title = values.title.trim()
	const changes: UpdateCalendarEventRequest['changes'] = {}
	const timeChanged = date !== seed.date || time !== seed.time || minutes !== seed.durationMinutes
	if (title !== base.title) changes.title = title
	if (date !== seed.date || time !== seed.time) {
		changes.date = date
		changes.startTime = time ?? seed.time
	}
	if (minutes !== seed.durationMinutes && minutes !== null) changes.durationMinutes = minutes
	if (locked === null && repeats !== seedRepeats) changes.repeats = repeats
	if (values.colorValue !== base.color && values.colorValue !== COLOR_CUSTOM)
		changes.colorId = colorIdOf(values.colorValue)
	if (values.description !== base.description)
		changes.description = values.description.trim() === '' ? null : values.description
	if (values.location !== base.location)
		changes.location = values.location.trim() === '' ? null : values.location.trim()
	const dirty = Object.keys(changes).length > 0
	const titleMissing = title === '' && base.title !== ''
	const titleError = titleMissing && (titleTouched || fields.submitted) ? EVENT_TITLE_ERROR : undefined
	const stale = latestVersion !== details.version
	const invalid = Boolean(errors.date || errors.time || errors.length) || titleMissing

	useEffect(() => {
		onDirtyChange(dirty)
	}, [dirty, onDirtyChange])

	const conflicts = useGoogleConflicts({
		proposal: createProposal(
			{
				studentId: CHECK_STUDENT,
				date,
				startTime: time,
				durationMinutes: minutes,
				repeats: 'once',
				expectedDefaultTimeZone: context.mainTimeZone,
			},
			Boolean(fields.timeError || errors.date)
		),
		date,
		available: available && timeChanged && !stale && !context.stale && !command.blocked,
	})
	const check = withoutEvent(conflicts, event.eventKey)
	const waiting = timeChanged && !conflicts.ready
	const scopeAsked = event.seriesMember && details.scopes.edit.length > 1

	function shownEvent(): CalendarEventView {
		const placed =
			timeChanged && input.instant !== null && minutes !== null ? placedEvent(event, input.instant, minutes) : event
		return {
			...placed,
			title: changes.title ?? placed.title,
			location: changes.location === undefined ? placed.location : changes.location,
			color:
				changes.colorId === undefined
					? placed.color
					: { id: changes.colorId, background: null, foreground: null, custom: false },
		}
	}

	function send(scope: CalendarEditScope): Promise<boolean> {
		if (time === null || minutes === null) return Promise.resolve(false)
		onWrite(
			{
				title: 'Could not change the event',
				back: timeChanged ? backAt(event, context.mainTimeZone) : 'It is back as it was.',
				hidden: [],
				shown: [shownEvent()],
			},
			command.prepare(
				{ kind: 'event', eventKey: event.eventKey, version: details.version },
				'event_update',
				{ scope, changes },
				timeChanged && !quick ? (conflicts.checked ?? undefined) : undefined
			)
		)
		onClose()
		return Promise.resolve(true)
	}

	if (stage === 'start') {
		const ready = dirty && !invalid && !stale && !command.blocked && !context.stale && available
		setStage(!ready ? 'shown' : scopeAsked ? 'asked' : 'sending')
		if (ready && scopeAsked) setScoping(true)
	}

	useEffect(() => {
		if (stage !== 'sending' || sent.current) return
		sent.current = true
		void send('one')
	})

	function onSubmit(submitted: FormEvent<HTMLFormElement>) {
		submitted.preventDefault()
		if (!dirty || command.blocked || context.stale || stale) return
		fields.setSubmitted(true)
		if (titleMissing) return titleRef.current?.focus()
		if (errors.date) return document.getElementById('event-edit-date')?.focus()
		if (errors.time || time === null) return document.getElementById('event-edit-time')?.focus()
		if (errors.length || minutes === null) return lengthRef.current?.focus()
		if (waiting) return
		if (scopeAsked) return setScoping(true)
		void send('one')
	}

	const status = stale ? (
		<ChangedInGoogle onRefresh={onRefresh} disabled={false} />
	) : (
		<ConflictStatus
			check={check}
			timeZone={context.mainTimeZone}
			durationMinutes={minutes}
			failure={null}
			lessons={[]}
		/>
	)
	const directState: DirectState = !quick ? 'shown' : stage === 'asked' ? 'asking' : 'sending'
	useEffect(() => {
		if (direct) onDirect?.(directState)
	}, [direct, directState, onDirect])

	return (
		<form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-col">
			<div className="flex flex-col gap-3 py-1">
				<TimeZoneStaleNotice stale={context.stale} pending={false} onRefresh={onReload} />
				<div onBlur={() => setTitleTouched(true)}>
					<EventTitleRow
						id="event-edit-title"
						values={values}
						error={titleError}
						disabled={timeOnly}
						inputRef={titleRef}
					/>
				</div>
				<TimeRows fields={fields} pending={false} lengthRef={lengthRef} repeatsLocked={locked} />
				<EventExtraRows
					prefix="event-edit"
					values={values}
					palette={palette}
					custom={details.color.custom ? { background: details.color.background } : null}
					disabled={timeOnly}
					descriptionFormatted={details.descriptionFormatted}
				/>
			</div>
			<EventFooter
				status={status}
				disabled={!dirty || invalid || stale || command.blocked || context.stale || waiting || !available}
				label="Save changes"
				onDiscard={onDiscard}
			/>
			{scoping ? (
				<ScopeDialog
					kind={{ subject: 'event', action: 'save' }}
					allowed={details.scopes.edit}
					onConfirm={send}
					onClose={quick ? onClose : () => setScoping(false)}
				/>
			) : null}
		</form>
	)
}
