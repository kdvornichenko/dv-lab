'use client'
import type { ComponentProps, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { useId, useLayoutEffect, useMemo, useRef } from 'react'

import { cn } from '@/lib/utils'

import { handleColumnKey } from './column-keyboard'
import {
	columnOptions,
	columnValueOf,
	columnPeriod,
	columnHidden,
	highlightFor,
	type TimePickerOption,
} from './column-options'
import { useTimePickerContext } from './context'
import { sameTime } from './format'
import { hasEnabled, nearestEnabled, type TimeFilter } from './grid'
import type { TimePickerColumnType, TimePickerPeriod } from './types'

const COLUMN_CLASS =
	'group/time-picker-column flex min-w-16 flex-1 flex-col [--time-picker-option-height:calc(var(--spacing)*7)] [--time-picker-list-padding:calc(var(--spacing)*1)]'
const LABEL_CLASS =
	'text-muted-foreground text-center text-caption whitespace-nowrap transition-colors select-none group-has-focus-visible/time-picker-column:text-foreground px-2 pt-2 pb-1'
const LIST_CLASS =
	'group/time-picker-list relative flex h-[calc(var(--time-picker-option-height)*var(--time-picker-rows,5)+var(--spacing)*(var(--time-picker-rows,5)-1)+var(--time-picker-list-padding)*2)] flex-col gap-1 overflow-y-auto overscroll-contain px-2 py-(--time-picker-list-padding) outline-none [scrollbar-width:none] data-empty:focus-visible:outline-solid data-empty:focus-visible:outline-2 data-empty:focus-visible:-outline-offset-2 data-empty:focus-visible:outline-ring scroll-fade [--scroll-fade-size:var(--scroll-fade-size-compact)] [&::-webkit-scrollbar]:hidden'
const OPTION_CLASS =
	'flex h-(--time-picker-option-height) shrink-0 cursor-default items-center justify-center tabular-nums transition-[color,background-color,box-shadow] duration-100 select-none not-aria-selected:hover:bg-accent not-aria-selected:hover:text-accent-foreground aria-selected:bg-primary aria-selected:font-semibold aria-selected:text-primary-foreground aria-disabled:pointer-events-none aria-disabled:opacity-50 forced-colors:aria-selected:bg-[Highlight] forced-colors:aria-selected:text-[HighlightText] forced-colors:group-focus-visible/time-picker-list:data-highlighted:outline-solid forced-colors:group-focus-visible/time-picker-list:data-highlighted:outline-2 group-focus-visible/time-picker-list:data-highlighted:ring-2 ring-ring/30 rounded-md text-caption'

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
	const listPeriod = columnPeriod(display, firstEnabled)
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
	const current = display ? columnValueOf(display, type) : undefined
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
	const hidden = columnHidden(type, hourCycle, context.granularity)
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
		handleColumnKey(event, {
			context,
			type,
			options,
			enabled,
			current,
			selectedIndex,
			highlightIndex,
			highlighted,
			typeahead,
			pick,
		})
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
