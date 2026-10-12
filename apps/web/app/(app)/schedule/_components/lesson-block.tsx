'use client'

import type { ComponentProps, CSSProperties } from 'react'

import { cn } from '@/lib/utils'

import type { CalendarEventView } from '@dv-lab/contracts'

import { eventRange, eventStatus, eventTitle } from './calendar-event-details'
import type { BlockLayout } from './calendar-layout'

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
	const availability = calendarEvent.blocksTime ? 'Busy' : 'Available'
	const short = layout !== null && layout.height < 34
	const position: CSSProperties | undefined =
		layout === null
			? undefined
			: {
					top: layout.top,
					height: layout.height,
					left: `calc(${layout.lane} / ${layout.lanes} * 100% + 2px)`,
					width: `calc(100% / ${layout.lanes} - 6px)`,
				}
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
			style={{ ...position, ...style }}
			onClick={(event) => {
				onClick?.(event)
				onOpen(calendarEvent)
			}}
			className={cn(
				'z-10 block overflow-hidden rounded-md px-[6px] py-[2px] text-left text-foreground focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none',
				movable ? 'cursor-grab' : 'cursor-default',
				layout === null ? 'relative w-full' : 'absolute',
				ghost
					? 'bg-transparent text-muted-foreground outline-1 -outline-offset-1 outline-foreground/40 outline-dashed'
					: cancelled
						? 'text-muted-foreground ring-1 ring-selected ring-inset'
						: tentative
							? 'bg-[repeating-linear-gradient(45deg,color-mix(in_oklab,var(--selected)_40%,transparent)_0_5px,transparent_5px_10px)] ring-1 ring-selected ring-inset'
							: 'bg-selected ring-1 ring-surface-2',
				className
			)}
		>
			<span
				className={cn(
					'block truncate text-caption',
					tentative ? 'font-normal' : 'font-semibold',
					cancelled && 'line-through'
				)}
			>
				{title}
				{short ? `, ${range}` : ''}
			</span>
			{!short ? <span className="block truncate text-caption tabular-nums">{range}</span> : null}
		</button>
	)
}
