'use client'

import { useCallback, useRef } from 'react'

import { TimePair } from '@/components/app/time-pair'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Elevated } from '@/lib/elevated'
import { dayNumber, gutterLabel, hourLabel, secondRange, weekdayCaps } from '@/lib/schedule-format'
import { zoneLabel } from '@/lib/time-zones'
import { cn } from '@/lib/utils'

import type { CalendarEventView } from '@dv-lab/contracts'
import { addDays, zonedInstant, zonedParts } from '@dv-lab/core'

import { eventRange, eventTitle } from './calendar-event-details'
import { eventsOn, placeDay } from './calendar-layout'
import { EventTooltip } from './event-tooltip'
import { SLOT_MINUTES, clock, useSlotDrag } from './use-slot-drag'

export const HOUR_HEIGHT = 48
export const FRAME_HEIGHT = 'h-[max(28rem,calc(100svh-20rem))]'
export const OPEN_SCROLL_TOP = 7 * HOUR_HEIGHT
const MINUTE_HEIGHT = HOUR_HEIGHT / 60
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
const COLUMNS = 'grid grid-cols-[100px_repeat(7,minmax(0,1fr))]'
const DAY_MINUTES = 24 * 60
const CHIP_BELOW_MINUTES = 30

export interface SecondZone {
	id: string
	caption: string
}

export interface SlotChoice {
	date: string
	time: string
	durationMinutes: number
	dragged: boolean
}

export interface SlotFrame {
	date: string
	time: string
	durationMinutes: number
}

interface WeekGridProps {
	monday: string
	today: string
	now: Date
	mainTimeZone: string
	secondZone: SecondZone | null
	events: readonly CalendarEventView[]
	editable: boolean
	currentYear?: number
	onOpen: (event: CalendarEventView) => void
	onSlot?: (choice: SlotChoice) => void
	frame?: SlotFrame | null
	scrollTopRef?: { current: number }
}

function AllDayBand({
	dates,
	events,
	mainTimeZone,
	secondZone,
	currentYear,
	onOpen,
}: {
	dates: string[]
	events: readonly CalendarEventView[]
	mainTimeZone: string
	secondZone: string | null
	currentYear: number
	onOpen: (event: CalendarEventView) => void
}) {
	const allDay = events.filter((event) => event.when.kind === 'all_day')
	if (allDay.length === 0) return null
	return (
		<div
			data-slot="calendar-all-day"
			className={cn(COLUMNS, 'max-h-36 shrink-0 [scrollbar-gutter:stable] overflow-y-auto border-b border-gcal-line')}
		>
			<span className="px-2 py-1 text-right text-caption text-muted-foreground">All day</span>
			{dates.map((date) => (
				<div key={date} data-date={date} className="min-w-0 space-y-1 border-l border-gcal-line p-1">
					{eventsOn(allDay, date, mainTimeZone).map((event) => (
						<EventTooltip
							key={event.eventKey}
							event={event}
							layout={null}
							mainTimeZone={mainTimeZone}
							secondZone={secondZone}
							currentYear={currentYear}
							onOpen={onOpen}
						/>
					))}
				</div>
			))}
		</div>
	)
}

function AgendaRow({
	event,
	mainTimeZone,
	secondZone,
	onOpen,
}: {
	event: CalendarEventView
	mainTimeZone: string
	secondZone: string | null
	onOpen: (event: CalendarEventView) => void
}) {
	const second =
		event.when.kind === 'timed'
			? secondRange(
					new Date(event.when.startsAt),
					(Date.parse(event.when.endsAt) - Date.parse(event.when.startsAt)) / 60000,
					mainTimeZone,
					secondZone
				)
			: null
	return (
		<button
			type="button"
			data-event-key={event.eventKey}
			data-binding={event.binding.kind}
			onClick={() => onOpen(event)}
			className={cn(
				'flex w-full min-w-0 items-start gap-3 rounded-md p-2 text-left text-body focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none',
				event.status === 'cancelled' && 'text-muted-foreground line-through'
			)}
		>
			<span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-selected" />
			<TimePair
				as="span"
				main={eventRange(event, mainTimeZone)}
				second={second}
				mainClassName="text-body tabular-nums"
			/>
			<span className="min-w-0 flex-1 wrap-anywhere">{eventTitle(event)}</span>
		</button>
	)
}

function CalendarAgenda({
	dates,
	events,
	today,
	mainTimeZone,
	secondZone,
	onOpen,
}: {
	dates: string[]
	events: readonly CalendarEventView[]
	today: string
	mainTimeZone: string
	secondZone: string | null
	onOpen: (event: CalendarEventView) => void
}) {
	return (
		<div data-slot="calendar-agenda" className="space-y-4 lg:hidden">
			{dates.map((date) => {
				const dayEvents = eventsOn(events, date, mainTimeZone)
				if (dayEvents.length === 0) return null
				return (
					<section key={date} data-date={date} className="flex min-w-0 gap-3">
						<div className="flex w-11 shrink-0 flex-col items-center gap-1">
							<span className={cn('text-caption text-muted-foreground', date === today && 'text-gcal-today')}>
								{weekdayCaps(date)}
							</span>
							<span
								className={cn(
									'flex size-11 items-center justify-center rounded-full text-display tabular-nums',
									date === today && 'bg-gcal-today text-gcal-today-ink'
								)}
							>
								{dayNumber(date)}
							</span>
						</div>
						<div className="min-w-0 flex-1">
							{dayEvents.map((event) => (
								<AgendaRow
									key={event.eventKey}
									event={event}
									mainTimeZone={mainTimeZone}
									secondZone={secondZone}
									onOpen={onOpen}
								/>
							))}
						</div>
					</section>
				)
			})}
		</div>
	)
}

function timeMinutes(time: string): number {
	return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
}

function SlotFrameBlock({
	start,
	minutes,
	state,
	flip,
}: {
	start: number
	minutes: number
	state: 'drag' | 'draft'
	flip: boolean
}) {
	const range = `${clock(start)}–${clock(start + minutes)}`
	const visible = Math.min(minutes, DAY_MINUTES - start)
	return (
		<div
			data-slot="week-grid-frame"
			data-state={state}
			data-minutes={minutes}
			data-range={range}
			className="pointer-events-none absolute z-20 rounded-md bg-selected/85 px-[6px] py-[2px] text-foreground ring-1 ring-foreground/40 ring-inset"
			style={{ top: start * MINUTE_HEIGHT, height: visible * MINUTE_HEIGHT, left: 2, width: 'calc(100% - 6px)' }}
		>
			{minutes < CHIP_BELOW_MINUTES ? (
				<span
					data-slot="week-grid-frame-chip"
					className={cn(
						'absolute top-1/2 -translate-y-1/2 rounded-md bg-surface-4 px-2 py-0.5 text-micro whitespace-nowrap text-foreground shadow-surface-4',
						flip ? 'right-full mr-1' : 'left-full ml-1'
					)}
				>
					{range}
				</span>
			) : (
				<span className="block text-caption whitespace-nowrap">{range}</span>
			)}
		</div>
	)
}

function GutterPair({
	local,
	second,
	className,
	top,
}: {
	local: string
	second: string | null
	className?: string
	top?: number
}) {
	return (
		<div
			style={top === undefined ? undefined : { top }}
			className={cn(
				'flex justify-end gap-2 pr-2 pl-[12px] text-caption whitespace-nowrap text-muted-foreground tabular-nums',
				className
			)}
		>
			{second !== null ? <span className="w-[36px] text-right">{second}</span> : null}
			<span className="w-[36px] text-right">{local}</span>
		</div>
	)
}

export function WeekGrid({
	monday,
	today,
	now,
	mainTimeZone,
	secondZone,
	events,
	editable,
	currentYear = 0,
	onOpen,
	onSlot,
	frame = null,
	scrollTopRef,
}: WeekGridProps) {
	const dates = Array.from({ length: 7 }, (_: undefined, index) => addDays(monday, index))
	const nowParts = zonedParts(now, mainTimeZone)
	const mainCaption = zoneLabel(mainTimeZone, zonedInstant(monday, '12:00', mainTimeZone))
	const bodyRef = useRef<HTMLDivElement | null>(null)
	const { drag, dragging, cancelDrag, pressColumn, moveColumn, releaseColumn } = useSlotDrag(
		bodyRef,
		HOUR_HEIGHT,
		onSlot,
		editable
	)
	const scroller = useCallback(
		(node: HTMLDivElement | null) => {
			bodyRef.current = node
			if (node) node.scrollTop = scrollTopRef ? scrollTopRef.current : OPEN_SCROLL_TOP
		},
		[scrollTopRef]
	)

	return (
		<TooltipProvider>
			<CalendarAgenda
				dates={dates}
				events={events}
				today={today}
				mainTimeZone={mainTimeZone}
				secondZone={secondZone?.id ?? null}
				onOpen={onOpen}
			/>
			<Elevated
				offset={1}
				shadowLevel={2}
				data-slot="week-grid"
				data-dragging={dragging ? '' : undefined}
				className={cn(
					FRAME_HEIGHT,
					'hidden flex-col overflow-hidden rounded-2xl data-[dragging]:**:cursor-ns-resize! lg:flex'
				)}
			>
				<div data-slot="week-grid-head" className={cn(COLUMNS, '[scrollbar-gutter:stable] overflow-y-hidden')}>
					<div data-slot="week-grid-corner" className="flex items-end justify-end pb-2">
						<GutterPair local={mainCaption} second={secondZone ? secondZone.caption : null} />
					</div>
					{dates.map((date) => {
						const isToday = date === today
						return (
							<div
								key={date}
								data-slot="week-grid-day"
								data-date={date}
								className="flex flex-col items-center gap-1 border-l border-gcal-line pt-2 pb-2"
							>
								<span
									className={cn(
										'text-caption tracking-wider text-muted-foreground uppercase',
										isToday && 'text-gcal-today'
									)}
								>
									{weekdayCaps(date)}
								</span>
								<span
									data-slot="week-grid-date"
									className={cn(
										'flex size-11 items-center justify-center rounded-full text-display font-normal tabular-nums',
										isToday ? 'bg-gcal-today text-gcal-today-ink' : 'text-foreground'
									)}
								>
									{dayNumber(date)}
								</span>
							</div>
						)
					})}
				</div>
				<AllDayBand
					dates={dates}
					events={events}
					mainTimeZone={mainTimeZone}
					secondZone={secondZone?.id ?? null}
					currentYear={currentYear}
					onOpen={onOpen}
				/>
				<div
					ref={scroller}
					data-slot="week-grid-body"
					onScroll={(event) => {
						if (scrollTopRef) scrollTopRef.current = event.currentTarget.scrollTop
					}}
					className="scroll-fade min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto"
				>
					<div className={cn(COLUMNS, 'relative')} style={{ height: HOUR_HEIGHT * 24 }}>
						<div data-slot="week-grid-gutter" className="relative">
							{HOURS.map((hour) => (
								<GutterPair
									key={hour}
									local={hourLabel(hour)}
									second={secondZone ? gutterLabel(monday, hour, mainTimeZone, secondZone.id) : null}
									top={hour * HOUR_HEIGHT}
									className={cn('absolute inset-x-0', hour > 0 && '-translate-y-1/2')}
								/>
							))}
						</div>
						{dates.map((date, dayIndex) => {
							const isToday = date === today
							const live = drag !== null && drag.date === date ? drag : null
							const shownFrame = editable && !dragging && frame !== null && frame.date === date ? frame : null
							return (
								<div
									key={date}
									data-slot="week-grid-column"
									data-date={date}
									onPointerDown={(event) => pressColumn(event, date)}
									onPointerMove={moveColumn}
									onPointerUp={releaseColumn}
									onPointerCancel={cancelDrag}
									className={cn(
										'relative border-l border-gcal-line select-none',
										isToday && 'bg-hover',
										dragging && 'cursor-ns-resize'
									)}
								>
									{isToday ? (
										<div
											data-slot="week-grid-now"
											className="pointer-events-none absolute inset-x-0 z-20 h-0.5 -translate-y-1/2 bg-gcal-now"
											style={{ top: nowParts.minutes * MINUTE_HEIGHT }}
										>
											<span
												aria-hidden
												className="absolute top-1/2 left-0 size-3 -translate-y-1/2 rounded-full bg-gcal-now"
											/>
											<span className="sr-only">Now {nowParts.time}</span>
										</div>
									) : null}
									{placeDay(events, date, mainTimeZone, HOUR_HEIGHT).map(({ event, layout }) => (
										<EventTooltip
											key={event.eventKey}
											event={event}
											mainTimeZone={mainTimeZone}
											layout={layout}
											secondZone={secondZone ? secondZone.id : null}
											currentYear={currentYear}
											onOpen={onOpen}
										/>
									))}
									{live !== null ? (
										<SlotFrameBlock
											start={Math.min(live.anchor, live.slot) * SLOT_MINUTES}
											minutes={(Math.abs(live.slot - live.anchor) + 1) * SLOT_MINUTES}
											state="drag"
											flip={dayIndex === 6}
										/>
									) : null}
									{shownFrame !== null ? (
										<SlotFrameBlock
											start={timeMinutes(shownFrame.time)}
											minutes={shownFrame.durationMinutes}
											state="draft"
											flip={dayIndex === 6}
										/>
									) : null}
								</div>
							)
						})}
						{HOURS.map((hour) => (
							<div
								key={hour}
								data-slot="week-grid-line"
								data-hour={hour}
								className="pointer-events-none absolute right-0 left-[100px] h-px bg-gcal-line"
								style={{ top: hour * HOUR_HEIGHT }}
							/>
						))}
					</div>
				</div>
			</Elevated>
		</TooltipProvider>
	)
}
