'use client'

import type { ComponentProps, CSSProperties } from 'react'

import { Loader2, TriangleAlert } from 'lucide-react'

import { eventPaint } from '@/lib/event-colors'
import { cn } from '@/lib/utils'

import type { CalendarEventView } from '@dv-lab/contracts'

import { eventRange, eventStatus, eventTitle } from './calendar-event-details'
import type { BlockLayout } from './calendar-layout'
import type { BlockMark } from './optimistic-writes'

const MARKER_MIN_HEIGHT = 24
const LESSON_SHORT_HEIGHT = 34
const EVENT_SHORT_HEIGHT = 36
const SELECTED_PAINT = { fill: 'var(--selected)', ink: 'var(--foreground)' }
const EVENT_FOCUS = 'focus-visible:shadow-[0_0_0_1px_var(--surface-2),0_0_0_3px_var(--focus-ring)]'
const LESSON_FOCUS = 'focus-visible:ring-2 focus-visible:ring-focus-ring'
const HATCH =
	'bg-[repeating-linear-gradient(45deg,color-mix(in_oklab,var(--event-fill)_40%,transparent)_0_5px,transparent_5px_10px)] ring-1 ring-(--event-fill) ring-inset'
const LESSON_HATCH =
	'bg-[repeating-linear-gradient(45deg,color-mix(in_oklab,var(--selected)_40%,transparent)_0_5px,transparent_5px_10px)] ring-1 ring-selected ring-inset'
const PHONE_LINE = 14
const PHONE_LETTER_BELOW = 28
const PHONE_COLOUR_BELOW = 12
const GHOST = 'bg-transparent text-muted-foreground outline-1 -outline-offset-1 outline-foreground/40 outline-dashed'

interface LessonBlockProps extends Omit<ComponentProps<'button'>, 'onClick'> {
	event: CalendarEventView
	layout: BlockLayout | null
	mainTimeZone: string
	editable: boolean
	movable?: boolean
	ghost?: boolean
	mark?: BlockMark | null
	phone?: boolean
	needsMark?: boolean
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

function phoneTitle(event: CalendarEventView, layout: BlockLayout, title: string) {
	if (layout.width < PHONE_COLOUR_BELOW) return null
	const minutes =
		event.when.kind === 'timed' ? (Date.parse(event.when.endsAt) - Date.parse(event.when.startsAt)) / 60000 : 60
	const lines =
		minutes < 30 ? 0 : minutes < 45 ? 1 : Math.max(1, Math.min(3, Math.floor((layout.height - 4) / PHONE_LINE)))
	if (layout.width < PHONE_LETTER_BELOW) return { lines: Math.min(lines, 1), text: Array.from(title)[0] ?? '' }
	return { lines, text: title }
}

export function LessonBlock({
	event: calendarEvent,
	layout,
	mainTimeZone,
	editable,
	movable = false,
	ghost = false,
	mark: markProp = null,
	phone = false,
	needsMark = false,
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
	const mark = markProp ?? (calendarEvent.binding.kind === 'transition' ? 'unconfirmed' : null)
	const marked = calendarEvent.binding.kind === 'lesson' && calendarEvent.binding.mark !== null && !cancelled
	const dimmed = (mark !== null || (phone && marked)) && !ghost
	const marker = !phone && dimmed && layout !== null && layout.height >= MARKER_MIN_HEIGHT ? mark : null
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
	const phoneText = phone && layout !== null ? phoneTitle(calendarEvent, layout, title) : null
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
			aria-label={`${title}, ${range}, ${eventStatus(calendarEvent)}, ${availability}, ${editable ? 'Editable' : 'Read-only'}${mark === 'syncing' ? ', syncing' : mark === 'unconfirmed' ? ', not confirmed' : ''}`}
			data-mark={mark ?? undefined}
			style={{ ...position, ...paintVars, ...style }}
			onClick={(event) => {
				onClick?.(event)
				onOpen(calendarEvent)
			}}
			className={cn(
				'z-10 block overflow-hidden rounded-md text-left focus-visible:outline-none',
				phone && !chip ? 'px-[3px]' : 'px-[6px]',
				chip ? 'py-[4px]' : 'py-[2px]',
				plain ? EVENT_FOCUS : LESSON_FOCUS,
				movable ? 'cursor-grab' : 'cursor-default',
				chip ? 'relative w-full' : 'absolute',
				layout?.cutTop && 'rounded-t-none',
				layout?.cutBottom && 'rounded-b-none',
				surface(paint !== null, ghost, cancelled, tentative),
				dimmed && 'opacity-60',
				className
			)}
		>
			{phone && !chip ? (
				phoneText !== null && phoneText.lines > 0 ? (
					<span
						className={cn(
							'block overflow-hidden text-[11px] leading-[14px] font-medium wrap-anywhere',
							cancelled && 'line-through'
						)}
						style={{ maxHeight: phoneText.lines * PHONE_LINE }}
					>
						{phoneText.text}
					</span>
				) : null
			) : (
				<span
					className={cn(
						'block truncate text-caption',
						tentative ? 'font-normal' : 'font-semibold',
						cancelled && 'line-through',
						suggested && 'pr-[14px]',
						marker !== null && 'pr-4',
						hideText && 'invisible'
					)}
				>
					{title}
					{short ? `, ${range}` : ''}
				</span>
			)}
			{!phone && !short && !chip ? (
				<span className={cn('block truncate text-caption tabular-nums', hideText && 'invisible')}>{range}</span>
			) : null}
			{phone && needsMark && !marked && !cancelled ? (
				<span
					aria-hidden
					data-slot="calendar-event-needs-mark"
					className="absolute top-0.5 right-0.5 size-2 rounded-full bg-warning ring-1 ring-surface-2"
				/>
			) : null}
			{marker === 'syncing' ? (
				<Loader2
					aria-hidden
					data-slot="calendar-event-pending"
					className="absolute top-1 right-1 size-3 animate-spin"
				/>
			) : marker === 'unconfirmed' ? (
				<TriangleAlert aria-hidden data-slot="calendar-event-unconfirmed" className="absolute top-1 right-1 size-3" />
			) : suggested ? (
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
