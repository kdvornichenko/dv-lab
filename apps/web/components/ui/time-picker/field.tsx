'use client'
import type { ComponentProps, ReactNode } from 'react'
import { useState } from 'react'

import { ClockIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { assignRef, useTimePickerContext } from './context'
import { periodOf, sameTime, toSeconds } from './format'
import { nearestEnabled, spanInWindow } from './grid'
import { handleInputKey } from './input-keyboard'
import { parseTimeInput } from './parse'
import type { TimePickerTime } from './types'

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
			className={cn('block min-w-0 overflow-x-clip leading-5 text-ellipsis whitespace-nowrap', className)}
			{...props}
		>
			{context.time ? context.format(context.time) : (placeholder ?? context.i18n.labels.placeholder)}
		</span>
	)
}
const TRIGGER_CLASS =
	'justify-between font-normal normal-case tracking-normal tabular-nums data-placeholder:text-muted-foreground [&>span:last-child]:w-full [&>span:last-child]:min-w-0 [&>span:last-child>span]:w-full [&>span:last-child>span]:min-w-0 [&>span:last-child>span]:[text-box:normal] data-invalid:[&>span:first-child]:shadow-[0_0_0_1px_var(--destructive)]'
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
					handleInputKey(event, { context, text, read, parse, setText })
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
