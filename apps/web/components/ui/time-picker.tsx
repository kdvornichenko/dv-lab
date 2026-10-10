'use client'
import { createContext, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ComponentProps, KeyboardEvent as ReactKeyboardEvent, ReactNode, Ref } from 'react'
import { flushSync } from 'react-dom'

import { ClockIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export type TimePickerTime = {
	hour: number
	minute: number
	second: number
}
export type TimePickerGranularity = 'hour' | 'minute' | 'second'
export type TimePickerHourCycle = 12 | 24
export type TimePickerPeriod = 'am' | 'pm'
export type TimePickerPeriodPosition = 'start' | 'end'
export type TimePickerUnit = 'hour' | 'minute' | 'second'
export type TimePickerColumnType = TimePickerUnit | 'period'
export type TimePickerLabels = {
	placeholder: string
	hour: string
	minute: string
	second: string
	period: string
	am: string
	pm: string
	now: string
	clear: string
	confirm: string
	panelLabel: string
	openPicker: string
}
export type TimePickerFormatContext = {
	hourCycle: TimePickerHourCycle
	granularity: TimePickerGranularity
	periodPosition: TimePickerPeriodPosition
	labels: TimePickerLabels
	formatSegment: TimePickerFunctions['formatSegment']
}
export type TimePickerFunctions = {
	formatSegment: (value: number, unit: TimePickerUnit) => string
	formatValue: (time: TimePickerTime, context: TimePickerFormatContext) => string
}
export type TimePickerI18nConfig = {
	labels: TimePickerLabels
	functions: TimePickerFunctions
}
export type TimePickerI18nOverrides = {
	labels?: Partial<TimePickerLabels>
	functions?: Partial<TimePickerFunctions>
}
export const DEFAULT_TIME_PICKER_I18N: TimePickerI18nConfig = {
	labels: {
		placeholder: 'Choose a time',
		hour: 'Hours',
		minute: 'Minutes',
		second: 'Seconds',
		period: 'AM/PM',
		am: 'AM',
		pm: 'PM',
		now: 'Now',
		clear: 'Clear',
		confirm: 'Done',
		panelLabel: 'Time picker',
		openPicker: 'Open time picker',
	},
	functions: {
		formatSegment: (value) => String(value).padStart(2, '0'),
		formatValue: (time, context) => {
			const { hourCycle, granularity, periodPosition, labels } = context
			const hour = hourCycle === 12 ? time.hour % 12 || 12 : time.hour
			let text = `${context.formatSegment(hour, 'hour')}:${context.formatSegment(time.minute, 'minute')}`
			if (granularity === 'second') {
				text += `:${context.formatSegment(time.second, 'second')}`
			}
			if (hourCycle === 24) return text
			const period = time.hour < 12 ? labels.am : labels.pm
			return periodPosition === 'start' ? `${period} ${text}` : `${text} ${period}`
		},
	},
}
export function mergeTimePickerI18n(overrides?: TimePickerI18nOverrides): TimePickerI18nConfig {
	if (!overrides?.labels && !overrides?.functions) {
		return DEFAULT_TIME_PICKER_I18N
	}
	return {
		labels: { ...DEFAULT_TIME_PICKER_I18N.labels, ...overrides.labels },
		functions: {
			...DEFAULT_TIME_PICKER_I18N.functions,
			...overrides.functions,
		},
	}
}
const pad = (value: number) => String(value).padStart(2, '0')
const toSeconds = (time: TimePickerTime) => time.hour * 3600 + time.minute * 60 + time.second
const periodOf = (hour: number): TimePickerPeriod => (hour < 12 ? 'am' : 'pm')
const sameTime = (a: TimePickerTime | null, b: TimePickerTime | null) =>
	a === b || (!!a && !!b && toSeconds(a) === toSeconds(b))
export function parseTimeValue(value: string | null | undefined): TimePickerTime | null {
	const match = /^\s*(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*$/.exec(value ?? '')
	if (!match) return null
	const time = {
		hour: Number(match[1]),
		minute: Number(match[2]),
		second: Number(match[3] ?? 0),
	}
	return time.hour < 24 && time.minute < 60 && time.second < 60 ? time : null
}
export function formatTimeValue(time: TimePickerTime, granularity: TimePickerGranularity = 'minute'): string {
	const value = `${pad(time.hour)}:${pad(time.minute)}`
	return granularity === 'second' ? `${value}:${pad(time.second)}` : value
}
function normalizeTyped(text: string) {
	return text
		.normalize('NFKC')
		.replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x660))
		.replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x6f0))
		.replace(/[\u00a0\u202f]/g, ' ')
		.toLowerCase()
}
export function parseTimeInput(
	text: string,
	options: {
		hourCycle?: TimePickerHourCycle
		period?: TimePickerPeriod
		labels?: Pick<TimePickerLabels, 'am' | 'pm'>
	} = {}
): TimePickerTime | null {
	const labels = options.labels ?? DEFAULT_TIME_PICKER_I18N.labels
	let source = normalizeTyped(text).trim()
	let period: TimePickerPeriod | undefined
	for (const [label, value] of [
		[labels.pm, 'pm'],
		[labels.am, 'am'],
	] as const) {
		const needle = normalizeTyped(label).trim()
		if (needle && source.includes(needle)) {
			period = value
			source = source.replace(needle, ' ').trim()
			break
		}
	}
	if (!period) {
		const suffix = /\s*([ap])\.?\s*(?:m\.?)?$/.exec(source)
		if (suffix) {
			period = suffix[1] === 'a' ? 'am' : 'pm'
			source = source.slice(0, suffix.index)
		}
	}
	if (/[^\d\s:.h]/.test(source)) return null
	const parts = source.split(/[^\d]+/).filter(Boolean)
	let fields = parts
	if (parts.length === 1 && parts[0].length > 2) {
		const digits = parts[0]
		if (digits.length > 6) return null
		const hourLength = digits.length % 2 === 1 ? 1 : 2
		fields = [digits.slice(0, hourLength)]
		for (let index = hourLength; index < digits.length; index += 2) {
			fields.push(digits.slice(index, index + 2))
		}
	}
	if (fields.length === 0 || fields.length > 3) return null
	if (fields.slice(1).some((field) => field.length !== 2)) return null
	let hour = Number(fields[0])
	const minute = Number(fields[1] ?? 0)
	const second = Number(fields[2] ?? 0)
	if (minute > 59 || second > 59) return null
	const resolved =
		period ?? (options.hourCycle === 12 && hour >= 1 && hour <= 12 ? (options.period ?? 'am') : undefined)
	if (resolved) {
		if (hour < 1 || hour > 12) return null
		hour = (hour % 12) + (resolved === 'pm' ? 12 : 0)
	}
	return hour < 24 ? { hour, minute, second } : null
}
type TimeGrid = {
	hours: number[]
	minutes: number[]
	seconds: number[]
	min: number | null
	max: number | null
	granularity: TimePickerGranularity
	isTimeDisabled?: (value: string, time: TimePickerTime) => boolean
}
type TimeFilter = Partial<TimePickerTime> & {
	period?: TimePickerPeriod
}
function stepValues(step: number | undefined, limit: number) {
	const size = Math.floor(step ?? 1)
	if (!Number.isFinite(size)) return [0]
	const values: number[] = []
	for (let value = 0; value < limit; value += Math.max(1, size)) {
		values.push(value)
	}
	return values
}
const gridSize = (grid: TimeGrid) => grid.hours.length * grid.minutes.length * grid.seconds.length
function timeAt(grid: TimeGrid, index: number): TimePickerTime {
	const seconds = grid.seconds.length
	const minutes = grid.minutes.length
	return {
		hour: grid.hours[Math.floor(index / (minutes * seconds))],
		minute: grid.minutes[Math.floor(index / seconds) % minutes],
		second: grid.seconds[index % seconds],
	}
}
function lastAtOrBelow(values: number[], limit: number) {
	let found = 0
	for (let index = 0; index < values.length; index++) {
		if (values[index] <= limit) found = index
	}
	return found
}
function floorIndex(grid: TimeGrid, seconds: number) {
	const hour = lastAtOrBelow(grid.hours, seconds / 3600)
	const inHour = seconds - grid.hours[hour] * 3600
	const minute = lastAtOrBelow(grid.minutes, inHour / 60)
	const second = lastAtOrBelow(grid.seconds, inHour - grid.minutes[minute] * 60)
	return (hour * grid.minutes.length + minute) * grid.seconds.length + second
}
function spanInWindow(grid: TimeGrid, from: number, to: number) {
	const { min, max } = grid
	if (min !== null && max !== null && min > max) return to >= min || from <= max
	return (min === null || to >= min) && (max === null || from <= max)
}
function isEnabled(grid: TimeGrid, time: TimePickerTime) {
	const seconds = toSeconds(time)
	return spanInWindow(grid, seconds, seconds) && !grid.isTimeDisabled?.(formatTimeValue(time, grid.granularity), time)
}
function matches(time: TimePickerTime, filter: TimeFilter) {
	return (
		(filter.hour === undefined || time.hour === filter.hour) &&
		(filter.minute === undefined || time.minute === filter.minute) &&
		(filter.second === undefined || time.second === filter.second) &&
		(filter.period === undefined || periodOf(time.hour) === filter.period)
	)
}
function hasEnabled(grid: TimeGrid, filter: TimeFilter) {
	for (const hour of grid.hours) {
		if (filter.hour !== undefined && hour !== filter.hour) continue
		if (filter.period !== undefined && periodOf(hour) !== filter.period) continue
		if (!spanInWindow(grid, hour * 3600, hour * 3600 + 3599)) continue
		for (const minute of grid.minutes) {
			if (filter.minute !== undefined && minute !== filter.minute) continue
			for (const second of grid.seconds) {
				if (filter.second !== undefined && second !== filter.second) continue
				if (isEnabled(grid, { hour, minute, second })) return true
			}
		}
	}
	return false
}
function nearestEnabled(grid: TimeGrid, target: TimePickerTime, filter: TimeFilter = {}): TimePickerTime | null {
	const goal = toSeconds(target)
	const total = gridSize(grid)
	let back = floorIndex(grid, goal)
	let ahead = back + 1
	while (back >= 0 || ahead < total) {
		const behind = back >= 0 ? timeAt(grid, back) : null
		const next = ahead < total ? timeAt(grid, ahead) : null
		const useBack = !!behind && (!next || goal - toSeconds(behind) <= toSeconds(next) - goal)
		const time = (useBack ? behind : next) as TimePickerTime
		if (matches(time, filter) && isEnabled(grid, time)) return time
		if (useBack) back--
		else ahead++
	}
	return null
}
function walkEnabled(grid: TimeGrid, start: number, direction: 1 | -1, wrap: boolean): TimePickerTime | null {
	const total = gridSize(grid)
	let index = start
	for (let step = 0; step < total; step++) {
		if (index < 0 || index >= total) {
			if (!wrap) return null
			index = (index + total) % total
		}
		const time = timeAt(grid, index)
		if (isEnabled(grid, time)) return time
		index += direction
	}
	return null
}
function stepEnabled(grid: TimeGrid, from: TimePickerTime, direction: 1 | -1) {
	const index = floorIndex(grid, toSeconds(from))
	const onGrid = sameTime(timeAt(grid, index), from)
	const start = direction === 1 ? index + 1 : onGrid ? index - 1 : index
	return walkEnabled(grid, start, direction, true)
}
function firstEnabledTime(grid: TimeGrid) {
	if (grid.min === null) return walkEnabled(grid, 0, 1, true)
	const index = floorIndex(grid, grid.min)
	const start = toSeconds(timeAt(grid, index)) < grid.min ? index + 1 : index
	return walkEnabled(grid, start, 1, true)
}
type TimePickerContextValue = {
	id: string
	time: TimePickerTime | null
	display: TimePickerTime | null
	grid: TimeGrid
	firstEnabled: TimePickerTime | null
	hourCycle: TimePickerHourCycle
	granularity: TimePickerGranularity
	periodPosition: TimePickerPeriodPosition
	i18n: TimePickerI18nConfig
	disabled: boolean
	readOnly: boolean
	invalid: boolean
	requireConfirm: boolean
	required: boolean
	label: string | undefined
	labelledBy: string | undefined
	describedBy: string | undefined
	open: boolean
	setOpen: (open: boolean) => void
	select: (time: TimePickerTime | null) => void
	commit: (time: TimePickerTime | null) => void
	confirm: () => void
	hasDraft: boolean
	discardDraft: () => void
	format: (time: TimePickerTime) => string
	getGoal: () => ColumnGoal | null
	setGoal: (goal: ColumnGoal) => void
	registerFocusTarget: (node: HTMLElement | null) => void
	registerColumns: (node: HTMLElement | null) => void
	getColumns: () => HTMLElement | null
}
type ColumnGoal = {
	goal: TimePickerTime
	result: TimePickerTime
}
const TimePickerContext = createContext<TimePickerContextValue | null>(null)
const SurfaceContext = createContext<'inline' | 'popup'>('inline')
function useTimePickerContext(part: string) {
	const context = useContext(TimePickerContext)
	if (!context) throw new Error(`${part} must be used within a TimePicker`)
	return context
}
export type TimePickerApi = {
	value: string | null
	time: TimePickerTime | null
	open: boolean
	setOpen: (open: boolean) => void
	setValue: (value: string | null) => void
	now: () => void
	clear: () => void
	confirm: () => void
}
export function useTimePicker(): TimePickerApi {
	const context = useTimePickerContext('useTimePicker')
	return {
		value: context.time ? formatTimeValue(context.time, context.granularity) : null,
		time: context.time,
		open: context.open,
		setOpen: context.setOpen,
		setValue: (value) => context.commit(parseTimeValue(value)),
		now: () => pickNow(context),
		clear: () => context.select(null),
		confirm: context.confirm,
	}
}
function pickNow(context: TimePickerContextValue) {
	const now = new Date()
	const { grid } = context
	const seconds =
		now.getHours() * 3600 +
		(context.granularity === 'hour' ? 0 : now.getMinutes() * 60) +
		(context.granularity === 'second' ? now.getSeconds() : 0)
	const index = floorIndex(grid, seconds)
	const time = walkEnabled(grid, index, 1, false) ?? walkEnabled(grid, index - 1, -1, false)
	if (time) context.select(time)
}
function assignRef<T>(ref: Ref<T> | undefined, node: T | null) {
	if (typeof ref === 'function') ref(node)
	else if (ref) ref.current = node
}
export type TimePickerProps = {
	value?: string | null
	defaultValue?: string | null
	onValueChange?: (value: string | null) => void
	open?: boolean
	defaultOpen?: boolean
	onOpenChange?: (open: boolean) => void
	hourCycle?: TimePickerHourCycle
	granularity?: TimePickerGranularity
	periodPosition?: TimePickerPeriodPosition
	hourStep?: number
	minuteStep?: number
	secondStep?: number
	min?: string
	max?: string
	isTimeDisabled?: (value: string, time: TimePickerTime) => boolean
	requireConfirm?: boolean
	disabled?: boolean
	readOnly?: boolean
	invalid?: boolean
	name?: string
	form?: string
	required?: boolean
	inputRef?: Ref<HTMLInputElement>
	id?: string
	'aria-label'?: string
	'aria-labelledby'?: string
	'aria-describedby'?: string
	i18n?: TimePickerI18nOverrides
	placeholder?: string
	className?: string
	children?: ReactNode
}
export function TimePicker({
	value,
	defaultValue = null,
	onValueChange,
	open: openProp,
	defaultOpen = false,
	onOpenChange,
	hourCycle = 24,
	granularity = 'minute',
	periodPosition = 'end',
	hourStep,
	minuteStep,
	secondStep,
	min,
	max,
	isTimeDisabled,
	requireConfirm = false,
	disabled = false,
	readOnly = false,
	invalid = false,
	name,
	form,
	required = false,
	inputRef,
	id: idProp,
	'aria-label': label,
	'aria-labelledby': labelledBy,
	'aria-describedby': describedBy,
	i18n: i18nProp,
	placeholder,
	className,
	children,
}: TimePickerProps) {
	const generatedId = useId()
	const id = idProp ?? generatedId
	const [uncontrolled, setUncontrolled] = useState(defaultValue)
	const [initialValue] = useState(defaultValue)
	const [openState, setOpenState] = useState(defaultOpen)
	const [draft, setDraft] = useState<{
		time: TimePickerTime | null
	} | null>(null)
	const open = openProp ?? openState
	const [seenOpen, setSeenOpen] = useState(open)
	if (seenOpen !== open) {
		setSeenOpen(open)
		setDraft(null)
	}
	const goal = useRef<ColumnGoal | null>(null)
	const focusTarget = useRef<HTMLElement | null>(null)
	const columns = useRef<HTMLElement | null>(null)
	const fieldRef = useRef<HTMLInputElement | null>(null)
	const resetRef = useRef(() => {})
	const raw = (value !== undefined ? value : uncontrolled) || null
	const time = parseTimeValue(raw)
	const i18n = useMemo(() => mergeTimePickerI18n(i18nProp), [i18nProp])
	const grid = useMemo<TimeGrid>(
		() => ({
			hours: stepValues(hourStep, 24),
			minutes: granularity === 'hour' ? [0] : stepValues(minuteStep, 60),
			seconds: granularity === 'second' ? stepValues(secondStep, 60) : [0],
			min: parseSeconds(min),
			max: parseSeconds(max),
			granularity,
			isTimeDisabled,
		}),
		[hourStep, minuteStep, secondStep, granularity, min, max, isTimeDisabled]
	)
	const firstEnabled = useMemo(() => firstEnabledTime(grid), [grid])
	const setOpen = (next: boolean) => {
		if (next && disabled) return
		if (openProp === undefined) setOpenState(next)
		onOpenChange?.(next)
	}
	const commit = (next: TimePickerTime | null) => {
		setDraft(null)
		const nextValue = next ? formatTimeValue(next, granularity) : null
		if (nextValue === raw) return
		if (value === undefined) setUncontrolled(nextValue)
		onValueChange?.(nextValue)
	}
	const context: TimePickerContextValue = {
		id,
		time,
		display: draft ? draft.time : time,
		grid,
		firstEnabled,
		hourCycle,
		granularity,
		periodPosition,
		i18n,
		disabled,
		readOnly,
		invalid,
		requireConfirm,
		required,
		label,
		labelledBy,
		describedBy,
		open,
		setOpen,
		select: (next) => {
			if (disabled || readOnly) return
			if (requireConfirm) setDraft({ time: next })
			else commit(next)
		},
		commit,
		confirm: () => {
			if (draft) commit(draft.time)
			if (open) setOpen(false)
		},
		hasDraft: draft !== null,
		discardDraft: () => setDraft(null),
		format: (next) =>
			i18n.functions.formatValue(next, {
				hourCycle,
				granularity,
				periodPosition,
				labels: i18n.labels,
				formatSegment: i18n.functions.formatSegment,
			}),
		getGoal: () => goal.current,
		setGoal: (next) => {
			goal.current = next
		},
		registerFocusTarget: (node) => {
			if (node) focusTarget.current = node
		},
		registerColumns: (node) => {
			columns.current = node
		},
		getColumns: () => columns.current,
	}
	useEffect(() => {
		resetRef.current = () => commit(parseTimeValue(initialValue))
	})
	const hasField = !!name || required
	useEffect(() => {
		const root = fieldRef.current?.getRootNode()
		if (!root) return
		let pending = 0
		const onReset = (event: Event) => {
			if (event.target !== fieldRef.current?.form) return
			pending = window.setTimeout(() => {
				if (!event.defaultPrevented) resetRef.current()
			})
		}
		root.addEventListener('reset', onReset, true)
		return () => {
			root.removeEventListener('reset', onReset, true)
			window.clearTimeout(pending)
		}
	}, [hasField])
	return (
		<TimePickerContext.Provider value={context}>
			<Popover open={open} onOpenChange={(next) => setOpen(next)}>
				{children === undefined ? (
					<>
						<TimePickerTrigger className={className} placeholder={placeholder} />
						<TimePickerContent />
					</>
				) : (
					children
				)}
			</Popover>
			{hasField && (
				<input
					ref={(node) => {
						fieldRef.current = node
						assignRef(inputRef, node)
					}}
					type="text"
					name={name}
					form={form}
					required={required}
					disabled={disabled}
					value={time ? formatTimeValue(time, granularity) : ''}
					onChange={() => {}}
					tabIndex={-1}
					aria-hidden="true"
					data-slot="time-picker-field"
					onFocus={(event) => {
						const target = focusTarget.current ?? columns.current?.querySelector<HTMLElement>(LIST_SELECTOR)
						if (target) target.focus()
						else event.currentTarget.blur()
					}}
					className="pointer-events-none absolute size-px max-w-px opacity-0"
				/>
			)}
		</TimePickerContext.Provider>
	)
}
function parseSeconds(value: string | undefined) {
	const time = parseTimeValue(value)
	return time ? toSeconds(time) : null
}
const CLOCK_ICON = <ClockIcon aria-hidden="true" size={16} strokeWidth={1.5} />
export type TimePickerValueProps = Omit<ComponentProps<'span'>, 'children'> & {
	placeholder?: ReactNode
}
export function TimePickerValue({ placeholder, className, ...props }: TimePickerValueProps) {
	const context = useTimePickerContext('TimePickerValue')
	return (
		<span
			id={`${context.id}-value`}
			data-slot="time-picker-value"
			data-placeholder={context.time ? undefined : ''}
			className={cn('truncate', className)}
			{...props}
		>
			{context.time ? context.format(context.time) : (placeholder ?? context.i18n.labels.placeholder)}
		</span>
	)
}
const TRIGGER_CLASS =
	'justify-between font-normal normal-case tracking-normal tabular-nums data-placeholder:text-muted-foreground [&>span:last-child]:w-full [&>span:last-child]:min-w-0 [&>span:last-child>span]:w-full [&>span:last-child>span]:min-w-0'
export type TimePickerTriggerProps = ComponentProps<typeof Button> & {
	placeholder?: ReactNode
}
export function TimePickerTrigger({
	className,
	variant = 'tertiary',
	placeholder,
	children,
	ref,
	...props
}: TimePickerTriggerProps) {
	const context = useTimePickerContext('TimePickerTrigger')
	const labelledBy = props['aria-labelledby'] ?? context.labelledBy
	const buttonProps = {
		variant,
		disabled: context.disabled,
		'aria-label': context.label,
		'aria-describedby': context.describedBy,
		...(context.invalid && { 'aria-invalid': true, 'data-invalid': '' }),
		...props,
		'aria-labelledby': labelledBy ? `${labelledBy} ${context.id}-value` : undefined,
		id: context.id,
		ref: (node: HTMLButtonElement | null) => {
			context.registerFocusTarget(node)
			assignRef(ref, node)
		},
		'data-slot': 'time-picker-trigger',
		'data-placeholder': context.time ? undefined : '',
		className: cn(TRIGGER_CLASS, className),
	}
	const content =
		children === undefined ? (
			<span className="flex w-full min-w-0 items-center justify-between gap-2">
				<TimePickerValue placeholder={placeholder} />
				<span data-icon="inline-end" aria-hidden="true" className="flex text-muted-foreground">
					{CLOCK_ICON}
				</span>
			</span>
		) : (
			children
		)
	return (
		<PopoverTrigger id={context.id} render={<Button {...buttonProps} />}>
			{content}
		</PopoverTrigger>
	)
}
export type TimePickerInputProps = Omit<ComponentProps<typeof InputGroupInput>, 'value' | 'defaultValue'>
export function TimePickerInput({
	className,
	placeholder,
	onBlur,
	onKeyDown,
	onChange,
	ref,
	...props
}: TimePickerInputProps) {
	const context = useTimePickerContext('TimePickerInput')
	const { grid, time } = context
	const [text, setText] = useState<string | null>(null)
	const shown = text ?? (time ? context.format(time) : '')
	const mask =
		context.hourCycle === 12
			? context.periodPosition === 'start'
				? '-- --:--'
				: '--:-- --'
			: context.granularity === 'second'
				? '--:--:--'
				: '--:--'
	const parse = (source: string) => {
		if (context.hourCycle === 24) {
			return parseTimeInput(source, { labels: context.i18n.labels })
		}
		const period = time ? periodOf(time.hour) : context.firstEnabled ? periodOf(context.firstEnabled.hour) : 'am'
		const options = { hourCycle: 12 as const, labels: context.i18n.labels }
		const here = parseTimeInput(source, { ...options, period })
		const there = parseTimeInput(source, {
			...options,
			period: period === 'am' ? 'pm' : 'am',
		})
		if (!here || !there || sameTime(here, there)) return here
		const inBounds = (typed: TimePickerTime) => spanInWindow(grid, toSeconds(typed), toSeconds(typed))
		if (inBounds(here)) return here
		return inBounds(there) ? there : here
	}
	const read = () => {
		if (text === null) return
		setText(null)
		if (!text.trim()) return context.commit(null)
		if (text === (time ? context.format(time) : '')) return
		const typed = parse(text)
		if (!typed) return
		const truncated = {
			hour: typed.hour,
			minute: context.granularity === 'hour' ? 0 : typed.minute,
			second: context.granularity === 'second' ? typed.second : 0,
		}
		const next = nearestEnabled(grid, truncated)
		if (next) context.commit(next)
	}
	const clockProps = {
		size: 'icon-xs' as const,
		disabled: context.disabled,
		'aria-label': context.i18n.labels.openPicker,
		'data-slot': 'time-picker-input-trigger',
	}
	return (
		<InputGroup data-slot="time-picker-input" data-disabled={context.disabled ? '' : undefined} className={className}>
			<InputGroupInput
				value={shown}
				placeholder={placeholder ?? mask}
				disabled={context.disabled}
				readOnly={context.readOnly}
				required={context.required}
				autoComplete="off"
				autoCorrect="off"
				autoCapitalize="off"
				spellCheck={false}
				aria-keyshortcuts="Alt+ArrowDown"
				aria-label={context.label}
				aria-labelledby={context.labelledBy}
				aria-describedby={context.describedBy}
				aria-invalid={context.invalid || undefined}
				className="tabular-nums"
				onChange={(event) => {
					onChange?.(event)
					setText(event.target.value)
				}}
				onBlur={(event) => {
					onBlur?.(event)
					read()
				}}
				onKeyDown={(event) => {
					onKeyDown?.(event)
					if (event.defaultPrevented) return
					if (event.key === 'Enter') {
						flushSync(() => read())
					} else if (event.key === 'Escape' && text !== null) {
						event.preventDefault()
						setText(null)
					} else if (event.altKey && event.key === 'ArrowDown') {
						event.preventDefault()
						read()
						context.setOpen(true)
					} else if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && !event.altKey && !context.readOnly) {
						event.preventDefault()
						const direction = event.key === 'ArrowUp' ? 1 : -1
						const from = (text !== null && parse(text)) || time
						const next = from
							? stepEnabled(grid, from, direction)
							: direction === 1
								? context.firstEnabled
								: walkEnabled(grid, gridSize(grid) - 1, -1, true)
						setText(null)
						if (next) context.commit(next)
					}
				}}
				{...props}
				id={context.id}
				ref={(node: HTMLInputElement | null) => {
					context.registerFocusTarget(node)
					assignRef(ref, node)
				}}
			/>
			<InputGroupAddon align="inline-end">
				<PopoverTrigger render={<InputGroupButton {...clockProps} />}>{CLOCK_ICON}</PopoverTrigger>
			</InputGroupAddon>
		</InputGroup>
	)
}
const TABBABLE =
	'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
export type TimePickerContentProps = ComponentProps<typeof PopoverContent>
export function TimePickerContent({
	className,
	align = 'start',
	onKeyDown,
	children,
	...props
}: TimePickerContentProps) {
	const context = useTimePickerContext('TimePickerContent')
	return (
		<PopoverContent
			align={align}
			aria-labelledby={context.labelledBy}
			aria-label={context.labelledBy ? undefined : (context.label ?? context.i18n.labels.panelLabel)}
			className={cn('w-auto gap-0 overflow-hidden p-0', className)}
			onKeyDown={(event) => {
				onKeyDown?.(event)
				if (event.defaultPrevented || event.key !== 'Tab') return
				if (event.altKey || event.ctrlKey || event.metaKey) return
				const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(TABBABLE))
				const active = event.currentTarget.ownerDocument.activeElement
				const first = items[0]
				const last = items[items.length - 1]
				if (!event.shiftKey && active === last) {
					event.preventDefault()
					first?.focus()
				} else if (event.shiftKey && active === first) {
					event.preventDefault()
					last?.focus()
				}
			}}
			{...props}
		>
			<SurfaceContext.Provider value="popup">
				{children === undefined ? (
					<>
						<TimePickerColumns />
						<TimePickerFooter />
					</>
				) : (
					children
				)}
			</SurfaceContext.Provider>
		</PopoverContent>
	)
}
export type TimePickerPanelProps = ComponentProps<'div'>
export function TimePickerPanel({ className, children, ...props }: TimePickerPanelProps) {
	const context = useTimePickerContext('TimePickerPanel')
	const inline = useContext(SurfaceContext) === 'inline'
	return (
		<div
			role={inline ? 'group' : undefined}
			aria-labelledby={inline ? context.labelledBy : undefined}
			aria-label={inline && !context.labelledBy ? (context.label ?? context.i18n.labels.panelLabel) : undefined}
			data-slot="time-picker-panel"
			data-disabled={context.disabled ? '' : undefined}
			className={cn('flex w-fit flex-col', className)}
			{...props}
		>
			{children === undefined ? (
				<>
					<TimePickerColumns />
					<TimePickerFooter />
				</>
			) : (
				children
			)}
		</div>
	)
}
export type TimePickerColumnsProps = ComponentProps<'div'>
export function TimePickerColumns({ className, children, ref, ...props }: TimePickerColumnsProps) {
	const context = useTimePickerContext('TimePickerColumns')
	const { display, granularity } = context
	const period = context.hourCycle === 12 && <TimePickerColumn type="period" />
	return (
		<div
			dir="ltr"
			data-slot="time-picker-columns"
			className={cn('flex divide-x', className)}
			{...props}
			ref={(node) => {
				context.registerColumns(node)
				assignRef(ref, node)
			}}
		>
			<span id={`${context.id}-current`} hidden>
				{display ? context.format(display) : context.i18n.labels.placeholder}
			</span>
			{children === undefined ? (
				<>
					{context.periodPosition === 'start' && period}
					<TimePickerColumn type="hour" />
					{granularity !== 'hour' && <TimePickerColumn type="minute" />}
					{granularity === 'second' && <TimePickerColumn type="second" />}
					{context.periodPosition === 'end' && period}
				</>
			) : (
				children
			)}
		</div>
	)
}
const LIST_SELECTOR = '[data-slot="time-picker-column-list"]:not([aria-disabled="true"])'
const COLUMN_CLASS =
	'group/time-picker-column flex min-w-16 flex-1 flex-col [--time-picker-option-height:calc(var(--spacing)*7)] [--time-picker-list-padding:calc(var(--spacing)*1)]'
const LABEL_CLASS =
	'text-muted-foreground text-center text-caption whitespace-nowrap transition-colors select-none group-has-focus-visible/time-picker-column:text-foreground px-2 pt-2 pb-1.5'
const LIST_CLASS =
	'group/time-picker-list relative flex h-[calc(var(--time-picker-option-height)*var(--time-picker-rows,5)+var(--spacing)*(var(--time-picker-rows,5)-1)+var(--time-picker-list-padding)*2)] flex-col gap-1 overflow-y-auto overscroll-contain px-2 py-(--time-picker-list-padding) outline-none [scrollbar-width:none] data-empty:focus-visible:outline-solid data-empty:focus-visible:outline-2 data-empty:focus-visible:-outline-offset-2 data-empty:focus-visible:outline-ring scroll-fade [--scroll-fade-size:var(--scroll-fade-size-compact)] [&::-webkit-scrollbar]:hidden'
const OPTION_CLASS =
	'flex h-(--time-picker-option-height) shrink-0 cursor-default items-center justify-center tabular-nums transition-[color,background-color,box-shadow] duration-100 select-none not-aria-selected:hover:bg-accent not-aria-selected:hover:text-accent-foreground aria-selected:bg-primary aria-selected:font-semibold aria-selected:text-primary-foreground aria-disabled:pointer-events-none aria-disabled:opacity-50 forced-colors:aria-selected:bg-[Highlight] forced-colors:aria-selected:text-[HighlightText] forced-colors:group-focus-visible/time-picker-list:data-highlighted:outline-solid forced-colors:group-focus-visible/time-picker-list:data-highlighted:outline-2 group-focus-visible/time-picker-list:data-highlighted:ring-2 ring-ring/30 rounded-md text-caption'
type TimePickerOption = {
	value: number | TimePickerPeriod
	label: string
	typed: number | null
	disabled: boolean
}
export type TimePickerColumnProps = Omit<ComponentProps<'div'>, 'children'> & {
	type: TimePickerColumnType
	label?: ReactNode
}
export function TimePickerColumn({ type, label, className, ...props }: TimePickerColumnProps) {
	const context = useTimePickerContext('TimePickerColumn')
	const { display, grid, hourCycle, i18n, firstEnabled } = context
	const baseId = useId()
	const listRef = useRef<HTMLDivElement>(null)
	const typeahead = useRef({ text: '', at: 0 })
	const listPeriod: TimePickerPeriod = display
		? periodOf(display.hour)
		: firstEnabled
			? periodOf(firstEnabled.hour)
			: 'am'
	const displayHour = display?.hour
	const displayMinute = display?.minute
	const flags = useMemo(() => {
		if (type === 'period') {
			return [hasEnabled(grid, { period: 'am' }), hasEnabled(grid, { period: 'pm' })]
		}
		if (type === 'hour') {
			return grid.hours.map((hour) => hasEnabled(grid, { hour }))
		}
		const values = type === 'minute' ? grid.minutes : grid.seconds
		return values.map((value) =>
			hasEnabled(grid, {
				hour: displayHour,
				minute: type === 'second' ? displayMinute : value,
				second: type === 'second' ? value : undefined,
			})
		)
	}, [type, grid, displayHour, displayMinute])
	const options = columnOptions(type, grid, flags, hourCycle, listPeriod, i18n)
	const current = display ? (type === 'period' ? periodOf(display.hour) : display[type]) : undefined
	const selectedIndex = options.findIndex((option) => option.value === current)
	const enabled = options.flatMap((option, index) => (option.disabled ? [] : [index]))
	const highlightIndex = highlightFor(
		options,
		enabled,
		selectedIndex,
		current,
		firstEnabled && !display ? columnValueOf(firstEnabled, type) : undefined
	)
	const highlighted = highlightIndex === -1 ? undefined : options[highlightIndex]
	const optionId = (option: TimePickerOption) => `${baseId}-${option.value}`
	const highlightedId = highlighted ? optionId(highlighted) : undefined
	const interactive = !context.disabled
	const editable = interactive && !context.readOnly
	useLayoutEffect(() => {
		const list = listRef.current
		if (!list) return
		const center = () => {
			const option = highlightedId ? list.ownerDocument.getElementById(highlightedId) : null
			if (option) {
				list.scrollTop = option.offsetTop - (list.clientHeight - option.offsetHeight) / 2
			}
		}
		center()
		if (typeof ResizeObserver === 'undefined') return
		const observer = new ResizeObserver(center)
		observer.observe(list)
		return () => observer.disconnect()
	}, [highlightedId])
	const hidden =
		(type === 'period' && hourCycle !== 12) ||
		(type === 'minute' && context.granularity === 'hour') ||
		(type === 'second' && context.granularity !== 'second')
	if (hidden) return null
	const pick = (option: TimePickerOption) => {
		if (option.disabled || !editable) return
		const kept = context.getGoal()
		const base = kept && sameTime(kept.result, display) ? kept.goal : (display ?? { hour: 0, minute: 0, second: 0 })
		const target =
			option.value === 'am' || option.value === 'pm'
				? { ...base, hour: (base.hour % 12) + (option.value === 'pm' ? 12 : 0) }
				: { ...base, [type]: option.value }
		const filter: TimeFilter =
			type === 'period' ? { period: option.value as TimePickerPeriod } : { [type]: option.value as number }
		const time = nearestEnabled(grid, target, filter)
		if (!time) return
		context.setGoal({ goal: target, result: time })
		context.select(time)
	}
	const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
		if (event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) return
		if (event.altKey) {
			if (event.key === 'ArrowUp' && context.open) {
				event.preventDefault()
				context.confirm()
			}
			return
		}
		const down = event.key === 'ArrowDown' || event.key === 'PageDown'
		let position = selectedIndex
		if (position === -1) {
			const above =
				typeof current === 'number'
					? options.findIndex((option) => typeof option.value === 'number' && option.value > current)
					: -1
			position =
				typeof current === 'number'
					? (above === -1 ? options.length : above) - 0.5
					: highlightIndex === -1
						? -0.5
						: highlightIndex + (down ? -0.5 : 0.5)
		}
		const move = (index: number | undefined) => {
			event.preventDefault()
			if (index !== undefined) pick(options[index])
		}
		const last = enabled[enabled.length - 1]
		switch (event.key) {
			case 'ArrowDown':
				return move(enabled.find((index) => index > position))
			case 'ArrowUp':
				return move(findLast(enabled, (index) => index < position))
			case 'Home':
				return move(enabled[0])
			case 'End':
				return move(last)
			case 'PageDown':
				return move(enabled.find((index) => index >= position + 5) ?? last)
			case 'PageUp':
				return move(findLast(enabled, (index) => index <= position - 5) ?? enabled[0])
			case 'ArrowLeft':
			case 'ArrowRight': {
				event.preventDefault()
				const lists = Array.from(context.getColumns()?.querySelectorAll<HTMLElement>(LIST_SELECTOR) ?? [])
				const at = lists.indexOf(event.currentTarget)
				lists[at + (event.key === 'ArrowRight' ? 1 : -1)]?.focus()
				return
			}
			case ' ':
				event.preventDefault()
				if (highlighted && highlightIndex !== selectedIndex) pick(highlighted)
				return
			case 'Enter':
				event.preventDefault()
				if (highlighted && highlightIndex !== selectedIndex) pick(highlighted)
				return context.confirm()
			case 'Escape':
				if (!context.open && context.hasDraft) {
					event.preventDefault()
					event.stopPropagation()
					context.discardDraft()
				}
				return
		}
		const key = normalizeTyped(event.key)
		if (key.length !== 1) return
		if (type === 'period') {
			const found = enabled.filter((index) => {
				const option = options[index]
				return (
					option.value === (key === 'a' ? 'am' : key === 'p' ? 'pm' : '') ||
					normalizeTyped(option.label).startsWith(key)
				)
			})
			if (found.length === 0) return
			move(found[(found.indexOf(highlightIndex) + 1) % found.length])
			return
		}
		if (!/\d/.test(key)) return
		const buffer = typeahead.current
		const fresh = event.timeStamp - buffer.at > 1000
		let typed = !fresh && buffer.text.length === 1 ? buffer.text + key : key
		const find = (text: string) => options.findIndex((option) => !option.disabled && option.typed === Number(text))
		let index = find(typed)
		if (index === -1 && typed.length === 2) {
			typed = key
			index = find(typed)
		}
		if (index === -1) {
			index = options.findIndex(
				(option) => !option.disabled && option.typed !== null && pad(option.typed).startsWith(typed)
			)
		}
		typeahead.current = { text: typed, at: event.timeStamp }
		if (index !== -1) move(index)
	}
	const headerId = `${baseId}-label`
	return (
		<div data-slot="time-picker-column" data-type={type} className={cn(COLUMN_CLASS, className)} {...props}>
			<div id={headerId} data-slot="time-picker-column-label" className={LABEL_CLASS}>
				{label ?? i18n.labels[type]}
			</div>
			<div
				ref={listRef}
				role="listbox"
				aria-labelledby={headerId}
				aria-describedby={`${context.id}-current`}
				aria-activedescendant={highlightedId}
				aria-disabled={context.disabled || undefined}
				aria-readonly={context.readOnly || undefined}
				tabIndex={interactive ? 0 : -1}
				data-slot="time-picker-column-list"
				data-empty={highlighted ? undefined : ''}
				onKeyDown={interactive ? onKeyDown : undefined}
				className={LIST_CLASS}
			>
				{options.map((option, index) => (
					<div
						key={option.value}
						id={optionId(option)}
						role="option"
						aria-selected={index === selectedIndex}
						aria-disabled={option.disabled || undefined}
						data-highlighted={index === highlightIndex ? '' : undefined}
						data-slot="time-picker-option"
						onClick={editable ? () => pick(option) : undefined}
						className={OPTION_CLASS}
					>
						{option.label}
					</div>
				))}
			</div>
		</div>
	)
}
function columnValueOf(time: TimePickerTime, type: TimePickerColumnType) {
	return type === 'period' ? periodOf(time.hour) : time[type]
}
function columnOptions(
	type: TimePickerColumnType,
	grid: TimeGrid,
	flags: boolean[],
	hourCycle: TimePickerHourCycle,
	period: TimePickerPeriod,
	i18n: TimePickerI18nConfig
): TimePickerOption[] {
	const { formatSegment } = i18n.functions
	if (type === 'period') {
		return (['am', 'pm'] as const).map((value, index) => ({
			value,
			label: i18n.labels[value],
			typed: null,
			disabled: !flags[index],
		}))
	}
	if (type === 'hour') {
		return grid.hours.flatMap((hour, index) => {
			if (hourCycle === 12 && periodOf(hour) !== period) return []
			const shown = hourCycle === 12 ? hour % 12 || 12 : hour
			return [
				{
					value: hour,
					label: formatSegment(shown, 'hour'),
					typed: shown,
					disabled: !flags[index],
				},
			]
		})
	}
	const values = type === 'minute' ? grid.minutes : grid.seconds
	return values.map((value, index) => ({
		value,
		label: formatSegment(value, type),
		typed: value,
		disabled: !flags[index],
	}))
}
function highlightFor(
	options: TimePickerOption[],
	enabled: number[],
	selectedIndex: number,
	current: number | TimePickerPeriod | undefined,
	first: number | TimePickerPeriod | undefined
) {
	if (selectedIndex !== -1) return selectedIndex
	if (typeof current === 'number') {
		const below = findLast(enabled, (index) => {
			const value = options[index].value
			return typeof value === 'number' && value < current
		})
		return below ?? enabled[0] ?? -1
	}
	const preferred = enabled.find((index) => options[index].value === first)
	return preferred ?? enabled[0] ?? -1
}
function findLast<T>(items: T[], test: (item: T) => boolean) {
	for (let index = items.length - 1; index >= 0; index--) {
		if (test(items[index])) return items[index]
	}
	return undefined
}
const FOOTER_CLASS = 'flex items-center justify-between gap-2 border-t p-1.5'
export type TimePickerFooterProps = ComponentProps<'div'>
export function TimePickerFooter({ className, children, ...props }: TimePickerFooterProps) {
	const context = useTimePickerContext('TimePickerFooter')
	const popup = useContext(SurfaceContext) === 'popup'
	return (
		<div data-slot="time-picker-footer" className={cn(FOOTER_CLASS, className)} {...props}>
			{children === undefined ? (
				<>
					<TimePickerNow />
					<TimePickerClear />
					{(popup || context.requireConfirm) && <TimePickerConfirm />}
				</>
			) : (
				children
			)}
		</div>
	)
}
export type TimePickerActionProps = ComponentProps<typeof Button>
export function TimePickerNow({
	variant = 'ghost',
	size = 'compact',
	onClick,
	children,
	...props
}: TimePickerActionProps) {
	const context = useTimePickerContext('TimePickerNow')
	return (
		<Button
			type="button"
			variant={variant}
			size={size}
			disabled={context.disabled || context.readOnly}
			data-slot="time-picker-now"
			onClick={(event) => {
				onClick?.(event)
				if (!event.defaultPrevented) pickNow(context)
			}}
			{...props}
		>
			{children === undefined ? context.i18n.labels.now : children}
		</Button>
	)
}
export function TimePickerClear({
	variant = 'ghost',
	size = 'compact',
	className,
	onClick,
	children,
	...props
}: TimePickerActionProps) {
	const context = useTimePickerContext('TimePickerClear')
	return (
		<Button
			type="button"
			variant={variant}
			size={size}
			disabled={context.disabled || context.readOnly}
			data-slot="time-picker-clear"
			className={cn('text-muted-foreground', className)}
			onClick={(event) => {
				onClick?.(event)
				if (event.defaultPrevented) return
				context.select(null)
				context.getColumns()?.querySelector<HTMLElement>(LIST_SELECTOR)?.focus({ preventScroll: true })
			}}
			{...props}
		>
			{children === undefined ? context.i18n.labels.clear : children}
		</Button>
	)
}
export function TimePickerConfirm({ variant, size = 'compact', onClick, children, ...props }: TimePickerActionProps) {
	const context = useTimePickerContext('TimePickerConfirm')
	return (
		<Button
			type="button"
			variant={variant ?? (context.requireConfirm ? 'primary' : 'secondary')}
			size={size}
			disabled={context.disabled}
			data-slot="time-picker-confirm"
			onClick={(event) => {
				onClick?.(event)
				if (!event.defaultPrevented) context.confirm()
			}}
			{...props}
		>
			{children === undefined ? context.i18n.labels.confirm : children}
		</Button>
	)
}
