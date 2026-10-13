'use client'

import type { ComponentProps, CSSProperties } from 'react'

import { eventPaint } from '@/lib/event-colors'
import { cn } from '@/lib/utils'

import type { CalendarEventView } from '@dv-lab/contracts'

import { eventRange, eventStatus, eventTitle } from './calendar-event-details'
import type { BlockLayout } from './calendar-layout'

const LESSON_SHORT_HEIGHT = 34
const EVENT_SHORT_HEIGHT = 36
const SELECTED_PAINT = { fill: 'var(--selected)', ink: 'var(--foreground)' }
const EVENT_FOCUS = 'focus-visible:shadow-[0_0_0_1px_var(--surface-2),0_0_0_3px_var(--focus-ring)]'
const LESSON_FOCUS = 'focus-visible:ring-2 focus-visible:ring-focus-ring'
const HATCH =
	'bg-[repeating-linear-gradient(45deg,color-mix(in_oklab,var(--event-fill)_40%,transparent)_0_5px,transparent_5px_10px)] ring-1 ring-(--event-fill) ring-inset'
const LESSON_HATCH =
	'bg-[repeating-linear-gradient(45deg,color-mix(in_oklab,var(--selected)_40%,transparent)_0_5px,transparent_5px_10px)] ring-1 ring-selected ring-inset'
const GHOST = 'bg-transparent text-muted-foreground outline-1 -outline-offset-1 outline-foreground/40 outline-dashed'

interface LessonBlockProps extends Omit<ComponentProps<'button'>, 'onClick'> {
	event: CalendarEventView
	layout: BlockLayout | null
	mainTimeZone: string
	editable: boolean
	movable?: boolean
	ghost?: boolean
	onOpen: (event: CalendarEventView) => void
	onClick?: ComponentProps<'button'>['onClick']
}

function surface(coloured: boolean, ghost: boolean, cancelled: boolean, tentative: boolean): string {
	if (ghost) return GHOST
	if (cancelled) return 'text-muted-foreground ring-1 ring-selected ring-inset'
	if (coloured)
		return tentative ? `${HATCH} text-foreground` : 'bg-(--event-fill) text-(--event-ink) ring-1 ring-surface-2'
	return tentative ? `${LESSON_HATCH} text-foreground` : 'bg-selected text-foreground ring-1 ring-surface-2'
}

export function LessonBlock({
	event: calendarEvent,
	layout,
	mainTimeZone,
	editable,
	movable = false,
	ghost = false,
	onOpen,
	onClick,
	className,
	style,
	...props
}: LessonBlockProps) {
	const title = eventTitle(calendarEvent)
	const range = eventRange(calendarEvent, mainTimeZone)
	const cancelled = calendarEvent.status === 'cancelled'
	const tentative = calendarEvent.status === 'tentative'
	const plain = calendarEvent.binding.kind === 'external'
	const unconfirmed = calendarEvent.binding.kind === 'transition'
	const chip = layout === null
	const availability = calendarEvent.blocksTime ? 'Busy' : 'Available'
	const short = layout !== null && layout.height < (plain ? EVENT_SHORT_HEIGHT : LESSON_SHORT_HEIGHT)
	const paint = eventPaint(calendarEvent.color) ?? (plain ? SELECTED_PAINT : null)
	const position: CSSProperties | undefined =
		layout === null
			? undefined
			: {
					top: layout.top,
					height: layout.height,
					left: layout.left,
					width: layout.width,
					zIndex: layout.layer > 0 ? Math.min(10 + layout.layer, 19) : undefined,
				}
	const suggested = plain && calendarEvent.suggestion !== null
	const hideText = ghost && plain
	const resizable = movable && layout !== null && !layout.cutTop && !layout.cutBottom
	const paintVars =
		paint === null ? undefined : ({ '--event-fill': paint.fill, '--event-ink': paint.ink } as CSSProperties)
	return (
		<button
			type="button"
			{...props}
			data-event-key={calendarEvent.eventKey}
			data-slot="calendar-event"
			data-binding={calendarEvent.binding.kind}
			data-status={calendarEvent.status}
			data-ghost={ghost ? '' : undefined}
			aria-label={`${title}, ${range}, ${eventStatus(calendarEvent)}, ${availability}, ${editable ? 'Editable' : 'Read-only'}`}
			style={{ ...position, ...paintVars, ...style }}
			onClick={(event) => {
				onClick?.(event)
				onOpen(calendarEvent)
			}}
			className={cn(
				'z-10 block overflow-hidden rounded-md px-[6px] text-left focus-visible:outline-none',
				chip ? 'py-[4px]' : 'py-[2px]',
				plain ? EVENT_FOCUS : LESSON_FOCUS,
				movable ? 'cursor-grab' : 'cursor-default',
				chip ? 'relative w-full' : 'absolute',
				layout?.cutTop && 'rounded-t-none',
				layout?.cutBottom && 'rounded-b-none',
				surface(paint !== null, ghost, cancelled, tentative),
				unconfirmed && !ghost && 'opacity-60',
				className
			)}
		>
			<span
				className={cn(
					'block truncate text-caption',
					tentative ? 'font-normal' : 'font-semibold',
					cancelled && 'line-through',
					suggested && 'pr-[14px]',
					hideText && 'invisible'
				)}
			>
				{title}
				{short ? `, ${range}` : ''}
			</span>
			{!short && !chip ? (
				<span className={cn('block truncate text-caption tabular-nums', hideText && 'invisible')}>{range}</span>
			) : null}
			{suggested ? (
				<span
					aria-hidden
					data-slot="calendar-event-dot"
					className={cn(
						'absolute top-1 right-1 size-2 rounded-full bg-info ring-2 ring-surface-2',
						hideText && 'invisible'
					)}
				/>
			) : null}
			{resizable ? (
				<span
					aria-hidden
					data-slot="calendar-event-resize"
					className="absolute inset-x-0 bottom-0 cursor-ns-resize"
					style={{ height: Math.min(8, layout.height / 3) }}
				/>
			) : null}
		</button>
	)
}
