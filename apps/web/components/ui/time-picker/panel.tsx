'use client'
import type { ComponentProps } from 'react'
import { useContext } from 'react'

import { Button } from '@/components/ui/button'
import { PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { TimePickerColumn } from './column'
import { LIST_SELECTOR, SurfaceContext, assignRef, pickNow, useTimePickerContext } from './context'

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

const FOOTER_CLASS = 'flex items-center justify-between gap-2 border-t p-2'
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
