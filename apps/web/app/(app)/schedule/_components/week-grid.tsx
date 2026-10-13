'use client'

import { useCallback, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'

import { TimePair } from '@/components/app/time-pair'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Elevated } from '@/lib/elevated'
import { eventPaint } from '@/lib/event-colors'
import { dayNumber, formatDate, gutterLabel, hourLabel, secondRange, weekdayCaps } from '@/lib/schedule-format'
import { zoneLabel } from '@/lib/time-zones'
import { cn } from '@/lib/utils'

import type { CalendarEventView } from '@dv-lab/contracts'
import {
	DAY_START_MINUTES,
	addDays,
	lessonDayMinutes,
	lessonDayPlace,
	scheduleDate,
	zonedInstant,
	zonedParts,
} from '@dv-lab/core'

import { eventRange, eventTitle } from './calendar-event-details'
import { COLUMN_STRIP, eventsOn, placeDay } from './calendar-layout'
import { EventTooltip } from './event-tooltip'
import { useEventResize } from './use-event-resize'
import { useLessonDrag, type MoveSeed } from './use-lesson-drag'
import { SLOT_MINUTES, clock, useSlotDrag } from './use-slot-drag'

export const HOUR_HEIGHT = 48
export const OPEN_SCROLL_TOP = 5 * HOUR_HEIGHT
const MINUTE_HEIGHT = HOUR_HEIGHT / 60
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
const COLUMNS = 'grid grid-cols-[100px_repeat(7,minmax(0,1fr))]'
const DAY_MINUTES = 24 * 60
const CHIP_BELOW_MINUTES = 30
const FIRST_HOUR = DAY_START_MINUTES / 60
const FRAME_WIDTH = `calc(100% - ${COLUMN_STRIP + 2}px)`

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
	canMove: (event: CalendarEventView) => boolean
	canEdit: (event: CalendarEventView) => boolean
	onMove: (event: CalendarEventView, seed: MoveSeed) => void
	studentName?: (id: string) => string | null
	onSlot?: (choice: SlotChoice) => void
	frame?: SlotFrame | null
	placed?: { event: CalendarEventView; seed: MoveSeed } | null
	emptyNote?: string | null
	scrollTopRef?: { current: number }
}

function AllDayBand({
	canEdit,
	dates,
	events,
	mainTimeZone,
	secondZone,
	currentYear,
	onOpen,
}: {
	canEdit: (event: CalendarEventView) => boolean
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
		<div data-slot="calendar-all-day" className="shrink-0 border-b border-gcal-line">
			<div
				className={cn(
					COLUMNS,
					'scroll-fade max-h-36 [scrollbar-gutter:stable] overflow-y-auto [--scroll-fade-size:var(--scroll-fade-size-compact)]'
				)}
			>
				<span className="px-2 py-1 text-right text-caption text-muted-foreground">All day</span>
				{dates.map((date) => (
					<div key={date} data-date={date} className="min-w-0 space-y-1 border-l border-gcal-line p-1">
						{eventsOn(allDay, date, mainTimeZone).map((event) => (
							<EventTooltip
								editable={canEdit(event)}
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
	emptyNote,
	onOpen,
}: {
	dates: string[]
	events: readonly CalendarEventView[]
	today: string
	mainTimeZone: string
	secondZone: string | null
	emptyNote: string | null
	onOpen: (event: CalendarEventView) => void
}) {
	return (
		<div
			data-slot="calendar-agenda"
			className="scroll-fade space-y-4 md:min-h-0 md:flex-1 md:overflow-y-auto lg:hidden"
		>
			{emptyNote !== null ? (
				<div data-slot="calendar-agenda-empty" className="flex justify-center py-8">
					<p className="rounded-lg bg-surface-2 px-3 py-1 text-center text-body text-muted-foreground">{emptyNote}</p>
				</div>
			) : null}
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
			style={{ top: start * MINUTE_HEIGHT, height: visible * MINUTE_HEIGHT, left: 2, width: FRAME_WIDTH }}
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

function overlapsOthers(
	events: readonly CalendarEventView[],
	source: CalendarEventView,
	frame: SlotFrame,
	mainTimeZone: string
): boolean {
	let start: number
	try {
		start = zonedInstant(frame.date, frame.time, mainTimeZone).getTime()
	} catch {
		return false
	}
	const end = start + frame.durationMinutes * 60000
	return eventsOn(events, lessonDayPlace(frame.date, frame.time).day, mainTimeZone).some(
		(event) =>
			event.eventKey !== source.eventKey &&
			event.when.kind === 'timed' &&
			Date.parse(event.when.startsAt) < end &&
			Date.parse(event.when.endsAt) > start
	)
}

function MoveFrameBlock({
	event,
	frame,
	gesture,
	mainTimeZone,
	currentYear,
	overlap,
	state,
}: {
	event: CalendarEventView
	frame: SlotFrame
	gesture: 'move' | 'resize'
	mainTimeZone: string
	currentYear: number
	overlap: boolean
	state: 'drag' | 'draft'
}) {
	const start = lessonDayPlace(frame.date, frame.time).minutes
	const range = `${clock(start)}–${clock(start + frame.durationMinutes)}`
	const sameDay =
		event.when.kind === 'timed' && scheduleDate(new Date(event.when.startsAt), mainTimeZone) === frame.date
	const chip = sameDay || gesture === 'resize' ? range : `${formatDate(frame.date, currentYear)}, ${range}`
	const height = Math.min(frame.durationMinutes, DAY_MINUTES - start) * MINUTE_HEIGHT
	const short = height < 34
	const paint = event.binding.kind === 'external' ? (eventPaint(event.color) ?? null) : null
	const foot = start * MINUTE_HEIGHT + height
	const chipTop =
		gesture === 'resize'
			? start + frame.durationMinutes >= DAY_MINUTES - 25
				? foot - 26
				: foot + 4
			: start < 30
				? foot + 4
				: start * MINUTE_HEIGHT - 22
	return (
		<>
			<div
				data-slot="week-grid-move-frame"
				data-state={state}
				data-gesture={gesture}
				data-overlap={overlap ? '' : undefined}
				data-range={range}
				className={cn(
					'pointer-events-none absolute z-30 overflow-hidden rounded-md px-[6px] py-[2px] text-foreground shadow-surface-4 ring-inset',
					paint === null && 'bg-selected/85',
					overlap ? 'ring-2 ring-warning' : 'ring-1 ring-foreground/40'
				)}
				style={{
					top: start * MINUTE_HEIGHT,
					height,
					left: 2,
					width: FRAME_WIDTH,
					...(paint === null
						? undefined
						: { background: `color-mix(in oklab, ${paint.fill} 85%, transparent)`, color: paint.ink }),
				}}
			>
				<span className="block truncate text-caption font-semibold">
					{eventTitle(event)}
					{short ? `, ${range}` : ''}
				</span>
				{!short ? <span className="block truncate text-caption tabular-nums">{range}</span> : null}
			</div>
			<span
				data-slot="week-grid-move-chip"
				className="pointer-events-none absolute left-1 z-30 rounded-md bg-surface-4 px-2 py-0.5 text-micro whitespace-nowrap text-foreground tabular-nums shadow-surface-4"
				style={{ top: chipTop }}
			>
				{chip}
			</span>
		</>
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
	canMove,
	canEdit,
	onMove,
	studentName,
	frame = null,
	placed = null,
	emptyNote = null,
	scrollTopRef,
}: WeekGridProps) {
	const dates = Array.from({ length: 7 }, (_: undefined, index) => addDays(monday, index))
	const nowParts = zonedParts(now, mainTimeZone)
	const nowMinutes = lessonDayMinutes(now, mainTimeZone)
	const [columnWidth, setColumnWidth] = useState(0)
	const columnRef = useRef<HTMLDivElement | null>(null)
	useLayoutEffect(() => {
		const column = columnRef.current
		if (!column) return
		const measure = () => setColumnWidth(column.clientWidth)
		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(column)
		return () => observer.disconnect()
	}, [])
	const mainCaption = zoneLabel(mainTimeZone, zonedInstant(monday, '12:00', mainTimeZone))
	const bodyRef = useRef<HTMLDivElement | null>(null)
	const lessonDrag = useLessonDrag(bodyRef, HOUR_HEIGHT, events, mainTimeZone, editable, canMove, onMove)
	const eventResize = useEventResize(bodyRef, HOUR_HEIGHT, events, mainTimeZone, editable, canMove, onMove)
	const moving = lessonDrag.drag
	const resizing = eventResize.resize
	const live = moving ?? resizing
	const liveSource = live === null ? null : (events.find((event) => event.eventKey === live.eventKey) ?? null)
	const moveFrame =
		live !== null && live.frame !== null && liveSource !== null
			? {
					event: liveSource,
					frame: live.frame,
					state: 'drag' as const,
					gesture: moving !== null ? ('move' as const) : ('resize' as const),
				}
			: placed !== null
				? {
						event: placed.event,
						frame: placed.seed,
						state: 'draft' as const,
						gesture: placed.seed.gesture,
					}
				: null
	const ghostKey = live?.eventKey ?? (moveFrame?.state === 'draft' ? moveFrame.event.eventKey : null)
	const handlers = {
		onPointerDownCapture: (event: PointerEvent<HTMLDivElement>) => {
			lessonDrag.handlers.onPointerDownCapture(event)
			eventResize.handlers.onPointerDownCapture(event)
		},
		onPointerMoveCapture: (event: PointerEvent<HTMLDivElement>) => {
			lessonDrag.handlers.onPointerMoveCapture(event)
			eventResize.handlers.onPointerMoveCapture(event)
		},
		onPointerUpCapture: (event: PointerEvent<HTMLDivElement>) => {
			lessonDrag.handlers.onPointerUpCapture(event)
			eventResize.handlers.onPointerUpCapture(event)
		},
		onPointerCancelCapture: () => {
			lessonDrag.handlers.onPointerCancelCapture()
			eventResize.handlers.onPointerCancelCapture()
		},
		onLostPointerCapture: () => {
			lessonDrag.handlers.onLostPointerCapture()
			eventResize.handlers.onLostPointerCapture()
		},
		onClickCapture: (event: MouseEvent<HTMLDivElement>) => {
			lessonDrag.handlers.onClickCapture(event)
			eventResize.handlers.onClickCapture(event)
		},
	}
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
				emptyNote={emptyNote}
				onOpen={onOpen}
			/>
			<Elevated
				offset={1}
				shadowLevel={2}
				data-slot="week-grid"
				data-dragging={dragging ? '' : undefined}
				data-moving={moving !== null ? '' : undefined}
				data-resizing={resizing !== null ? '' : undefined}
				className="relative hidden min-h-90 flex-1 flex-col overflow-hidden rounded-2xl data-[dragging]:**:cursor-ns-resize! data-[moving]:**:cursor-grabbing! data-[resizing]:**:cursor-ns-resize! lg:flex"
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
					canEdit={canEdit}
					dates={dates}
					events={events}
					mainTimeZone={mainTimeZone}
					secondZone={secondZone?.id ?? null}
					currentYear={currentYear}
					onOpen={onOpen}
				/>
				<div
					{...handlers}
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
									local={hourLabel((hour + FIRST_HOUR) % 24)}
									second={
										secondZone
											? gutterLabel(
													hour + FIRST_HOUR >= 24 ? addDays(monday, 1) : monday,
													(hour + FIRST_HOUR) % 24,
													mainTimeZone,
													secondZone.id
												)
											: null
									}
									top={hour * HOUR_HEIGHT}
									className={cn('absolute inset-x-0', hour > 0 && '-translate-y-1/2')}
								/>
							))}
						</div>
						{dates.map((date, dayIndex) => {
							const isToday = date === today
							const live = drag !== null && drag.date === date ? drag : null
							const framePlace = frame === null ? null : lessonDayPlace(frame.date, frame.time)
							const shownFrame =
								editable && !dragging && moveFrame === null && framePlace?.day === date ? framePlace : null
							const shownMove =
								moveFrame !== null && lessonDayPlace(moveFrame.frame.date, moveFrame.frame.time).day === date
									? moveFrame
									: null
							return (
								<div
									key={date}
									ref={dayIndex === 0 ? columnRef : undefined}
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
											style={{ top: nowMinutes * MINUTE_HEIGHT }}
										>
											<span
												aria-hidden
												className="absolute top-1/2 left-0 size-3 -translate-y-1/2 rounded-full bg-gcal-now"
											/>
											<span className="sr-only">Now {nowParts.time}</span>
										</div>
									) : null}
									{placeDay(events, date, mainTimeZone, HOUR_HEIGHT, columnWidth).map(({ event, layout }) => (
										<EventTooltip
											editable={canEdit(event)}
											movable={canMove(event)}
											studentName={studentName}
											ghost={event.eventKey === ghostKey}
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
											start={shownFrame.minutes}
											minutes={frame?.durationMinutes ?? 60}
											state="draft"
											flip={dayIndex === 6}
										/>
									) : null}
									{shownMove !== null ? (
										<MoveFrameBlock
											event={shownMove.event}
											frame={shownMove.frame}
											gesture={shownMove.gesture}
											mainTimeZone={mainTimeZone}
											currentYear={currentYear}
											state={shownMove.state}
											overlap={overlapsOthers(events, shownMove.event, shownMove.frame, mainTimeZone)}
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
				{emptyNote !== null ? (
					<div
						data-slot="week-grid-empty"
						className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-4"
					>
						<p className="rounded-lg bg-surface-2 px-3 py-1 text-center text-body text-muted-foreground">{emptyNote}</p>
					</div>
				) : null}
			</Elevated>
		</TooltipProvider>
	)
}
