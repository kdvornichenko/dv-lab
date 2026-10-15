'use client'

import {
	useCallback,
	useLayoutEffect,
	useRef,
	useState,
	type ComponentPropsWithoutRef,
	type MouseEvent,
	type PointerEvent,
	type ReactNode,
} from 'react'

import { m } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Elevated } from '@/lib/elevated'
import { eventPaint } from '@/lib/event-colors'
import { dayNumber, formatDate, gutterLabel, hourLabel, weekTitle, weekdayCaps } from '@/lib/schedule-format'
import { zoneLabel } from '@/lib/time-zones'
import { cn } from '@/lib/utils'

import type { CalendarEventView } from '@dv-lab/contracts'
import { addDays, lessonDayPlace, scheduleDate, zonedInstant, zonedParts } from '@dv-lab/core'

import { COLUMN_STRIP, GRID_MINUTES, eventsOn, gridPlaces, placeDay } from './calendar-layout'
import { eventTitle } from './event-summary'
import { EventTooltip } from './event-tooltip'
import type { BlockMark } from './optimistic-writes'
import { useEventResize } from './use-event-resize'
import { useLessonDrag, type MoveSeed } from './use-lesson-drag'
import { SLOT_MINUTES, clock, useSlotDrag } from './use-slot-drag'
import { useTouchHold } from './use-touch-hold'
import { useWeekPager } from './use-week-pager'

export const HOUR_HEIGHT = 48
export const OPEN_SCROLL_TOP = 7 * HOUR_HEIGHT
const MINUTE_HEIGHT = HOUR_HEIGHT / 60
const HOURS = Array.from({ length: GRID_MINUTES / 60 }, (_, hour) => hour)
const COLUMNS = 'grid grid-cols-[100px_repeat(7,minmax(0,1fr))]'
const PHONE_COLUMNS = 'grid grid-cols-[48px_minmax(0,1fr)] pr-3'
const PHONE_FOOT = 16
const CHIP_BELOW_MINUTES = 30
const FRAME_WIDTH = `calc(100% - ${COLUMN_STRIP + 2}px)`

function noTurn() {}

export interface SecondZone {
	id: string
	caption: string
}

export interface GridPlaceholder {
	day: number
	start: number
	minutes: number
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
	mark?: (event: CalendarEventView) => BlockMark | null
	emptyNote?: string | null
	scrollTopRef?: { current: number | null }
	onWeekStep?: (direction: 1 | -1) => void
	placeholders?: readonly GridPlaceholder[]
	zoneKnown?: boolean
	phone?: boolean
	loadingBlocks?: readonly GridPlaceholder[]
	pager?: {
		onTurn: (monday: string) => void
		pageEvents: (monday: string) => readonly CalendarEventView[] | null
	}
}

interface GridPage {
	monday: string
	role: 'before' | 'current' | 'after'
	dates: string[]
	events: readonly CalendarEventView[]
	placeholders: readonly GridPlaceholder[]
}

function AllDayCells({
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
	return dates.map((date) => (
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
	))
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
	const visible = Math.min(minutes, GRID_MINUTES - start)
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
	start,
	event,
	frame,
	gesture,
	mainTimeZone,
	currentYear,
	overlap,
	state,
}: {
	start: number
	event: CalendarEventView
	frame: SlotFrame
	gesture: 'move' | 'resize'
	mainTimeZone: string
	currentYear: number
	overlap: boolean
	state: 'drag' | 'draft'
}) {
	const range = `${clock(start)}–${clock(start + frame.durationMinutes)}`
	const sameDay =
		event.when.kind === 'timed' && scheduleDate(new Date(event.when.startsAt), mainTimeZone) === frame.date
	const chip = sameDay || gesture === 'resize' ? range : `${formatDate(frame.date, currentYear)}, ${range}`
	const height = Math.min(frame.durationMinutes, GRID_MINUTES - start) * MINUTE_HEIGHT
	const short = height < 34
	const paint = eventPaint(event.color)
	const foot = start * MINUTE_HEIGHT + height
	const chipTop =
		gesture === 'resize'
			? start + frame.durationMinutes >= GRID_MINUTES - 25
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

function EdgeZone({ side, shown, width }: { side: 'left' | 'right'; shown: boolean; width: number }) {
	const Chevron = side === 'left' ? ChevronLeft : ChevronRight
	return (
		<div
			aria-hidden
			data-slot="week-grid-edge"
			data-side={side}
			data-shown={shown ? '' : undefined}
			className={cn(
				'pointer-events-none absolute inset-y-0 z-40 flex items-center opacity-0 transition-opacity duration-80',
				side === 'left'
					? 'left-0 justify-start bg-linear-to-r from-foreground/10 to-transparent'
					: 'right-0 justify-end bg-linear-to-l from-foreground/10 to-transparent',
				shown && 'opacity-100'
			)}
			style={{ width }}
		>
			<Chevron className="size-4 text-foreground" />
		</div>
	)
}

function GutterPair({
	local,
	second,
	className,
	top,
	phone = false,
}: {
	local: string
	second: string | null
	className?: string
	top?: number
	phone?: boolean
}) {
	if (phone)
		return (
			<div
				style={top === undefined ? undefined : { top }}
				className={cn(
					'flex flex-col items-start pl-3 text-[11px] leading-[14px] whitespace-nowrap text-muted-foreground tabular-nums',
					className
				)}
			>
				<span>{local}</span>
				{second !== null ? (
					<span data-slot="week-grid-second" className="text-[10px] leading-3 font-normal text-muted-foreground/70">
						{second}
					</span>
				) : null}
			</div>
		)
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

function Frame({
	phone,
	children,
	...props
}: { phone: boolean; children: ReactNode } & Omit<ComponentPropsWithoutRef<'div'>, 'children'>) {
	if (phone)
		return (
			<div {...props} className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
				{children}
			</div>
		)
	return (
		<Elevated
			offset={1}
			shadowLevel={2}
			{...props}
			className="relative flex min-h-90 flex-1 flex-col overflow-hidden rounded-2xl data-[dragging]:**:cursor-ns-resize! data-[moving]:**:cursor-grabbing! data-[resizing]:**:cursor-ns-resize!"
		>
			{children}
		</Elevated>
	)
}

export function WeekGrid({
	monday,
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
	mark,
	emptyNote = null,
	scrollTopRef,
	placeholders = [],
	zoneKnown = true,
	phone = false,
	loadingBlocks = [],
	pager,
	onWeekStep,
}: WeekGridProps) {
	const paged = phone && pager !== undefined
	const turning = useWeekPager({ monday, enabled: paged, onTurn: pager?.onTurn ?? noTurn })
	const columns = phone ? PHONE_COLUMNS : COLUMNS
	const mouseEditable = editable && !phone
	const weekDates = (first: string) => Array.from({ length: 7 }, (_: undefined, index) => addDays(first, index))
	const pageOf = (first: string, role: GridPage['role']): GridPage => {
		if (first === monday) return { monday: first, role, dates: weekDates(first), events, placeholders }
		const known = pager?.pageEvents(first) ?? null
		return {
			monday: first,
			role,
			dates: weekDates(first),
			events: known ?? [],
			placeholders: known === null ? loadingBlocks : [],
		}
	}
	const current = pageOf(paged ? turning.base : monday, 'current')
	const pages: GridPage[] = paged
		? [pageOf(addDays(current.monday, -7), 'before'), current, pageOf(addDays(current.monday, 7), 'after')]
		: [current]
	const nowParts = zonedParts(now, mainTimeZone)
	const nowPlaces = gridPlaces(nowParts.date, nowParts.time)
	const [columnWidth, setColumnWidth] = useState(0)
	const columnRef = useRef<HTMLDivElement | null>(null)
	useLayoutEffect(() => {
		const column = columnRef.current
		if (!column) return
		const measure = () => {
			if (!column.isConnected || column.clientWidth <= 0) return
			setColumnWidth(phone ? column.getBoundingClientRect().width - column.clientLeft : column.clientWidth)
		}
		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(column)
		return () => observer.disconnect()
	}, [current.monday, phone])
	const mainCaption = zoneLabel(mainTimeZone, zonedInstant(monday, '12:00', mainTimeZone))
	const bodyRef = useRef<HTMLDivElement | null>(null)
	const heldRef = useTouchHold(bodyRef)
	const lessonDrag = useLessonDrag(
		bodyRef,
		HOUR_HEIGHT,
		events,
		mainTimeZone,
		editable,
		canMove,
		onMove,
		heldRef,
		onWeekStep
	)
	const eventResize = useEventResize(bodyRef, HOUR_HEIGHT, events, mainTimeZone, mouseEditable, canMove, onMove)
	const moving = lessonDrag.drag
	const resizing = eventResize.resize
	const live = moving ?? resizing
	const moveFrame =
		live !== null && live.frame !== null
			? {
					event: live.event,
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
		onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) => {
			lessonDrag.handlers.onLostPointerCapture(event)
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
		editable,
		heldRef
	)
	const opening = useRef({ dates: current.dates, nowPlaces })
	const scroller = useCallback(
		(node: HTMLDivElement | null) => {
			bodyRef.current = node
			if (!node) return
			if (scrollTopRef && scrollTopRef.current !== null) {
				node.scrollTop = scrollTopRef.current
				return
			}
			const { dates, nowPlaces: places } = opening.current
			const shown = places.find((place) => dates.includes(place.day))
			node.scrollTop = shown === undefined ? OPEN_SCROLL_TOP : shown.minutes * MINUTE_HEIGHT - node.clientHeight / 2
		},
		[scrollTopRef]
	)
	const pagerProps = paged
		? {
				...turning.frameProps,
				onPointerMove: (event: PointerEvent<HTMLElement>) => {
					if (!heldRef.current) turning.frameProps.onPointerMove?.(event)
				},
			}
		: {}

	const bodyHeight = HOUR_HEIGHT * HOURS.length + (phone ? PHONE_FOOT : 0)
	const place = (render: (page: GridPage) => ReactNode, measure = false, height?: number) => {
		if (!phone) return render(current)
		if (!paged)
			return (
				<div data-page="current" className="grid min-w-0 grid-cols-7">
					{render(current)}
				</div>
			)
		return (
			<div ref={measure ? turning.clipRef : undefined} className="relative min-w-0 overflow-x-clip">
				<m.div className="isolate -ml-[100%] flex w-[300%]" style={{ x: turning.x, opacity: turning.opacity, height }}>
					{pages.map((page) => (
						<div
							key={page.monday}
							data-page={page.role}
							aria-hidden={page.role === 'current' ? undefined : true}
							inert={page.role === 'current' ? undefined : true}
							className="grid w-1/3 grid-cols-7"
						>
							{render(page)}
						</div>
					))}
				</m.div>
			</div>
		)
	}
	const heads = (page: GridPage) =>
		page.dates.map((date) => {
			const isToday = date === nowParts.date
			return (
				<div
					key={date}
					data-slot="week-grid-day"
					data-date={date}
					className={cn(
						'flex flex-col items-center',
						phone ? 'h-16 justify-start pt-1' : 'gap-0.5 border-l border-gcal-line pt-2 pb-2.5'
					)}
				>
					<span
						className={cn(
							'text-muted-foreground uppercase',
							phone ? 'text-[11px] leading-4 font-medium' : 'text-[11px] leading-4 font-medium tracking-[0.08em]',
							isToday && 'text-gcal-today'
						)}
					>
						{weekdayCaps(date)}
					</span>
					<span
						data-slot="week-grid-date"
						className={cn(
							'flex items-center justify-center rounded-full tabular-nums',
							phone ? 'size-9 text-[18px] leading-6 font-medium' : 'size-11 text-[24px] leading-8 font-normal',
							isToday ? 'bg-gcal-today text-gcal-today-ink' : 'text-foreground'
						)}
					>
						{dayNumber(date)}
					</span>
				</div>
			)
		})
	const cells = (page: GridPage) =>
		page.dates.map((date, dayIndex) => {
			const isToday = date === nowParts.date
			const slotDrag = drag !== null && drag.date === date ? drag : null
			const framePlace =
				frame === null ? undefined : gridPlaces(frame.date, frame.time).find((place) => place.day === date)
			const shownFrame = editable && !dragging && moveFrame === null && framePlace !== undefined ? framePlace : null
			const movePlace =
				moveFrame === null
					? undefined
					: gridPlaces(moveFrame.frame.date, moveFrame.frame.time).find((place) => place.day === date)
			const nowPlace = nowPlaces.find((place) => place.day === date)
			return (
				<div
					key={date}
					ref={page.role === 'current' && dayIndex === 0 ? columnRef : undefined}
					data-slot="week-grid-column"
					data-date={date}
					data-page={page.role}
					onPointerDown={(event) => pressColumn(event, date)}
					onPointerMove={moveColumn}
					onPointerUp={releaseColumn}
					onPointerCancel={cancelDrag}
					className={cn(
						'relative border-l border-gcal-line select-none',
						isToday && !phone && 'bg-hover',
						dragging && 'cursor-ns-resize'
					)}
				>
					{nowPlace !== undefined ? (
						<div
							data-slot="week-grid-now"
							className="pointer-events-none absolute inset-x-0 z-20 h-0.5 -translate-y-1/2 bg-gcal-now"
							style={{ top: nowPlace.minutes * MINUTE_HEIGHT }}
						>
							<span
								aria-hidden
								className={cn(
									'absolute top-1/2 -translate-y-1/2 rounded-full bg-gcal-now',
									phone ? '-left-1 size-2' : 'left-0 size-3'
								)}
							/>
							<span className="sr-only">Now {nowParts.time}</span>
						</div>
					) : null}
					{page.placeholders
						.filter((placeholder) => placeholder.day === dayIndex)
						.map((placeholder) => (
							<Skeleton
								key={placeholder.start}
								className="absolute rounded-md"
								style={{
									top: placeholder.start * MINUTE_HEIGHT,
									height: placeholder.minutes * MINUTE_HEIGHT - 2,
									left: 2,
									width: FRAME_WIDTH,
								}}
							/>
						))}
					{placeDay(page.events, date, mainTimeZone, HOUR_HEIGHT, columnWidth, phone).map(({ event, layout }) => (
						<EventTooltip
							editable={canEdit(event)}
							movable={mouseEditable && canMove(event)}
							phone={phone}
							needsMark={
								event.binding.kind === 'lesson' &&
								event.when.kind === 'timed' &&
								Date.parse(event.when.startsAt) <= now.getTime()
							}
							studentName={studentName}
							ghost={event.eventKey === ghostKey}
							mark={mark?.(event) ?? null}
							key={event.eventKey}
							event={event}
							mainTimeZone={mainTimeZone}
							layout={layout}
							secondZone={secondZone ? secondZone.id : null}
							currentYear={currentYear}
							onOpen={onOpen}
						/>
					))}
					{slotDrag !== null ? (
						<SlotFrameBlock
							start={slotDrag.start * SLOT_MINUTES}
							minutes={(slotDrag.end - slotDrag.start) * SLOT_MINUTES}
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
					{moveFrame !== null && movePlace !== undefined ? (
						<MoveFrameBlock
							start={movePlace.minutes}
							event={moveFrame.event}
							frame={moveFrame.frame}
							gesture={moveFrame.gesture}
							mainTimeZone={mainTimeZone}
							currentYear={currentYear}
							state={moveFrame.state}
							overlap={overlapsOthers(events, moveFrame.event, moveFrame.frame, mainTimeZone)}
						/>
					) : null}
				</div>
			)
		})
	const allDayCells = (page: GridPage) => (
		<AllDayCells
			canEdit={canEdit}
			dates={page.dates}
			events={page.events}
			mainTimeZone={mainTimeZone}
			secondZone={secondZone?.id ?? null}
			currentYear={currentYear}
			onOpen={onOpen}
		/>
	)
	const hourLines = HOURS.map((hour) => (
		<div
			key={hour}
			data-slot="week-grid-line"
			data-hour={hour}
			className={cn('pointer-events-none absolute right-0 h-px bg-gcal-line', phone ? 'left-12' : 'left-[100px]')}
			style={{ top: hour * HOUR_HEIGHT }}
		/>
	))
	const hasAllDay = pages.some((page) => page.events.some((event) => event.when.kind === 'all_day'))

	return (
		<TooltipProvider>
			<Frame
				phone={phone}
				{...pagerProps}
				data-slot="week-grid"
				data-phone={phone ? '' : undefined}
				data-paged={paged ? '' : undefined}
				data-dragging={dragging ? '' : undefined}
				data-moving={moving !== null ? '' : undefined}
				data-resizing={resizing !== null ? '' : undefined}
			>
				{paged ? (
					<span role="status" aria-live="polite" data-slot="week-grid-announce" className="sr-only">
						{weekTitle(turning.settled)}
					</span>
				) : null}
				<div
					data-slot="week-grid-head"
					className={cn(
						columns,
						'[scrollbar-gutter:stable] overflow-y-hidden',
						phone && 'border-b border-gcal-line',
						paged && 'touch-pan-y'
					)}
				>
					<div
						data-slot="week-grid-corner"
						className={cn('flex items-end', phone ? 'justify-start pb-1.5' : 'justify-end pb-3')}
					>
						{zoneKnown ? (
							<GutterPair
								phone={phone}
								local={mainCaption}
								second={secondZone ? secondZone.caption : null}
								className={phone ? 'font-medium' : undefined}
							/>
						) : null}
					</div>
					{place(heads, true)}
				</div>
				{hasAllDay ? (
					<div data-slot="calendar-all-day" className="shrink-0 border-b border-gcal-line">
						<div
							className={cn(
								columns,
								'scroll-fade max-h-36 [scrollbar-gutter:stable] overflow-y-auto [--scroll-fade-size:var(--scroll-fade-size-compact)]',
								paged && 'touch-pan-y'
							)}
						>
							<span className="px-1 py-1 text-right text-micro text-muted-foreground md:px-2 md:text-caption">
								All day
							</span>
							{place(allDayCells)}
						</div>
					</div>
				) : null}
				<div className="relative flex min-h-0 flex-1 flex-col">
					<div
						{...handlers}
						ref={scroller}
						data-slot="week-grid-body"
						onScroll={(event) => {
							if (scrollTopRef) scrollTopRef.current = event.currentTarget.scrollTop
						}}
						className={cn(
							'scroll-fade min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto [-webkit-touch-callout:none]',
							paged && 'touch-pan-y'
						)}
					>
						<div className={cn(columns, 'relative')} style={{ height: bodyHeight }}>
							<div data-slot="week-grid-gutter" className="relative">
								{(zoneKnown ? HOURS : []).map((hour) => (
									<GutterPair
										key={hour}
										phone={phone}
										local={hourLabel(hour % 24)}
										second={
											secondZone
												? gutterLabel(hour >= 24 ? addDays(monday, 1) : monday, hour % 24, mainTimeZone, secondZone.id)
												: null
										}
										top={hour * HOUR_HEIGHT}
										className={cn(
											'absolute inset-x-0',
											hour > 0 && (phone ? '-translate-y-[7px]' : '-translate-y-1/2')
										)}
									/>
								))}
							</div>
							{phone ? hourLines : null}
							{place(cells, false, bodyHeight)}
							{phone ? null : hourLines}
						</div>
					</div>
					{moving !== null ? (
						<>
							<EdgeZone side="left" shown={moving.edge === -1} width={phone ? 48 : 100} />
							<EdgeZone side="right" shown={moving.edge === 1} width={Math.max(12, Math.min(32, columnWidth / 4))} />
						</>
					) : null}
				</div>
				{emptyNote !== null ? (
					<div
						data-slot="week-grid-empty"
						className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-4"
					>
						<p className="rounded-lg bg-surface-2 px-3 py-1 text-center text-body text-muted-foreground">{emptyNote}</p>
					</div>
				) : null}
			</Frame>
		</TooltipProvider>
	)
}
