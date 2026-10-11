'use client'
import type { ReactNode, Ref } from 'react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { Popover } from '@/components/ui/popover'

import { assignRef, LIST_SELECTOR, TimePickerContext, type ColumnGoal, type TimePickerContextValue } from './context'
import { TimePickerTrigger } from './field'
import { formatTimeValue, mergeTimePickerI18n, parseTimeValue, toSeconds } from './format'
import { firstEnabledTime, stepValues, type TimeGrid } from './grid'
import { TimePickerContent } from './panel'
import type {
	TimePickerGranularity,
	TimePickerHourCycle,
	TimePickerI18nOverrides,
	TimePickerPeriodPosition,
	TimePickerTime,
} from './types'

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
