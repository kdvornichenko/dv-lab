'use client'

import {
	DndContext,
	PointerSensor,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
	type DragEndEvent,
} from '@dnd-kit/core'

import { type FC, useMemo } from 'react'

import { addDays, format, isSameDay, isToday, startOfWeek } from 'date-fns'
import { Plus } from 'lucide-react'

import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

import { HOUR_PX, TONE_EVENT, WEEK_END_HOUR, WEEK_START_HOUR } from '../constants'
import { useCalendar } from '../context'
import type { CalendarEvent } from '../types'
import { calendarSlot, eventTone, formatEventTime, sameDayEvents } from '../utils'
import type { HourSlotProps, SlotDropZoneProps, WeekEventProps } from './WeekView.types'

const AVAILABILITY_START_HOUR = 10
const AVAILABILITY_END_HOUR = 21
const DROP_INTERVAL_MINUTES = 15

function eventOverlaps(a: CalendarEvent, b: CalendarEvent) {
	return a.start < b.end && a.end > b.start
}

function layoutEvents(events: CalendarEvent[]) {
	return events.map((event) => {
		const overlaps = events
			.filter((candidate) => eventOverlaps(event, candidate))
			.sort((a, b) => a.start.getTime() - b.start.getTime() || a.id.localeCompare(b.id))
		return {
			event,
			column: Math.max(
				overlaps.findIndex((candidate) => candidate.id === event.id),
				0
			),
			columns: Math.max(overlaps.length, 1),
		}
	})
}

function mergedBusyIntervals(events: CalendarEvent[], day: Date) {
	const dayStart = calendarSlot(day, AVAILABILITY_START_HOUR)
	const dayEnd = calendarSlot(day, AVAILABILITY_END_HOUR + 1)
	const busy = sameDayEvents(events, day)
		.filter((event) => event.kind !== 'free')
		.map((event) => ({
			start: new Date(Math.max(event.start.getTime(), dayStart.getTime())),
			end: new Date(Math.min(event.end.getTime(), dayEnd.getTime())),
		}))
		.filter((event) => event.end > event.start)
		.sort((a, b) => a.start.getTime() - b.start.getTime())

	const merged: Array<{ start: Date; end: Date }> = []
	for (const interval of busy) {
		const last = merged.at(-1)
		if (last && interval.start <= last.end) {
			last.end = new Date(Math.max(last.end.getTime(), interval.end.getTime()))
		} else {
			merged.push({ ...interval })
		}
	}
	return { dayStart, dayEnd, busy: merged }
}

function freeSlotEvents(events: CalendarEvent[], day: Date): CalendarEvent[] {
	const { dayStart, dayEnd, busy } = mergedBusyIntervals(events, day)
	const free: CalendarEvent[] = []
	let cursor = dayStart
	for (const interval of busy) {
		if (interval.start > cursor) {
			free.push({
				id: `free:${day.toISOString()}:${cursor.toISOString()}`,
				start: cursor,
				end: interval.start,
				title: 'Free slot',
				color: 'green',
				kind: 'free',
			})
		}
		cursor = new Date(Math.max(cursor.getTime(), interval.end.getTime()))
	}
	if (cursor < dayEnd) {
		free.push({
			id: `free:${day.toISOString()}:${cursor.toISOString()}`,
			start: cursor,
			end: dayEnd,
			title: 'Free slot',
			color: 'green',
			kind: 'free',
		})
	}
	return free.filter((event) => event.end.getTime() - event.start.getTime() >= DROP_INTERVAL_MINUTES * 60_000)
}

function visibleAvailabilityEvent(event: CalendarEvent, day: Date): CalendarEvent | null {
	const dayStart = calendarSlot(day, AVAILABILITY_START_HOUR)
	const dayEnd = calendarSlot(day, AVAILABILITY_END_HOUR + 1)
	if (event.end <= dayStart || event.start >= dayEnd) return null

	return {
		...event,
		start: new Date(Math.max(event.start.getTime(), dayStart.getTime())),
		end: new Date(Math.min(event.end.getTime(), dayEnd.getTime())),
	}
}

function dropSlots(day: Date, startHour: number, endHour: number) {
	const slots: Date[] = []
	const start = startHour * 60
	const end = (endHour + 1) * 60
	for (let minute = start; minute < end; minute += DROP_INTERVAL_MINUTES) {
		const slot = calendarSlot(day, Math.floor(minute / 60))
		slot.setMinutes(minute % 60, 0, 0)
		slots.push(slot)
	}
	return slots
}

export const CalendarWeekView: FC = () => {
	const { date, locale, events, onEventClick, onTimeSlotClick, onEventDrop, availabilityMode } = useCalendar()
	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
	const startHour = availabilityMode ? AVAILABILITY_START_HOUR : WEEK_START_HOUR
	const endHour = availabilityMode ? AVAILABILITY_END_HOUR : WEEK_END_HOUR
	const hours = useMemo(
		() => Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index),
		[endHour, startHour]
	)
	const days = useMemo(() => {
		const start = startOfWeek(date, { weekStartsOn: 1 })
		return Array.from({ length: 7 }, (_, index) => addDays(start, index))
	}, [date])
	const weekEvents = useMemo(
		() => events.filter((event) => days.some((day) => isSameDay(day, event.start))),
		[days, events]
	)
	const renderEvents = useMemo(() => {
		if (!availabilityMode) return weekEvents
		const freeEvents = days.flatMap((day) => freeSlotEvents(weekEvents, day))
		const busyEvents = days.flatMap((day) =>
			sameDayEvents(weekEvents, day)
				.filter((event) => event.kind !== 'free')
				.map((event) => visibleAvailabilityEvent(event, day))
				.filter((event): event is CalendarEvent => Boolean(event))
				.map((event) => ({
					...event,
					title: ' ',
					subtitle: undefined,
					attendees: undefined,
					color: 'gray' as const,
					isPrivate: true,
					draggable: false,
				}))
		)
		return [...busyEvents, ...freeEvents]
	}, [availabilityMode, days, weekEvents])
	const handleDragEnd = (event: DragEndEvent) => {
		const activeEvent = events.find((item) => item.id === event.active.id)
		const slotIso = typeof event.over?.id === 'string' ? event.over.id.replace(/^slot:/, '') : ''
		if (!activeEvent || !slotIso || slotIso === String(event.over?.id)) return
		const startsAt = new Date(slotIso)
		if (!Number.isNaN(startsAt.getTime())) onEventDrop?.(activeEvent, startsAt)
	}

	return (
		<ScrollArea className="h-full bg-surface font-body text-ink">
			<DndContext sensors={sensors} onDragEnd={handleDragEnd}>
				<div className="min-w-230">
					<div className="bg-surface">
						<div className="sticky top-0 z-100 grid grid-cols-[64px_repeat(7,1fr)] border-b border-line-soft bg-surface/10 backdrop-blur-xs">
							<div className="border-r border-line-soft" />
							{days.map((day) => (
								<div key={day.toISOString()} className="border-line-soft px-3 py-3 last:border-r-0 sm:border-r">
									<div className="font-mono text-[10px] tracking-[0.25em] text-ink-muted uppercase">
										{format(day, 'EEE', { locale })}
									</div>
									<div
										className={cn(
											'mt-0.5 inline-flex size-7 items-center justify-center rounded-full font-heading text-base',
											isToday(day) && 'bg-ink text-surface'
										)}
									>
										{format(day, 'd')}
									</div>
								</div>
							))}
						</div>

						<div className="grid grid-cols-[64px_repeat(7,1fr)]">
							<div className="border-r border-line-soft">
								{hours.map((hour) => (
									<div
										key={hour}
										className="flex items-start justify-end px-2 py-1 font-mono text-[10px] text-ink-muted"
										style={{ height: HOUR_PX }}
									>
										{String(hour).padStart(2, '0')}:00
									</div>
								))}
							</div>

							{days.map((day) => (
								<div
									key={day.toISOString()}
									className="relative border-line-soft last:border-r-0 sm:border-r"
									style={{ height: hours.length * HOUR_PX }}
								>
									{hours.map((hour, hourIndex) => (
										<HourSlot
											key={hour}
											day={day}
											hour={hour}
											hourIndex={hourIndex}
											onTimeSlotClick={onTimeSlotClick}
										/>
									))}
									{dropSlots(day, startHour, endHour).map((slot) => (
										<SlotDropZone key={slot.toISOString()} slot={slot} startHour={startHour} />
									))}

									{isToday(day) && <NowLine />}

									{layoutEvents(sameDayEvents(renderEvents, day)).map(({ event, column, columns }) => {
										const startMinutes = event.start.getHours() * 60 + event.start.getMinutes()
										const endMinutes = event.end.getHours() * 60 + event.end.getMinutes()
										const calendarStart = startHour * 60
										const top = ((startMinutes - calendarStart) / 60) * HOUR_PX
										const height = Math.max(((endMinutes - startMinutes) / 60) * HOUR_PX - 2, 28)
										const gap = 4
										const width = `calc((100% - ${gap * (columns + 1)}px) / ${columns})`
										const left = `calc(${gap}px + (${width} + ${gap}px) * ${column})`

										return (
											<WeekEvent
												key={event.id}
												event={event}
												onEventClick={event.kind === 'free' ? undefined : onEventClick}
												style={{
													top: Math.max(top, 0),
													height,
													left,
													width,
												}}
											/>
										)
									})}
								</div>
							))}
						</div>
					</div>
				</div>
			</DndContext>
		</ScrollArea>
	)
}

const HourSlot: FC<HourSlotProps> = ({ day, hour, hourIndex, onTimeSlotClick }) => {
	const slot = calendarSlot(day, hour)
	return (
		<button
			type="button"
			className="group absolute inset-x-0 border-t border-line-soft text-left transition-colors hover:bg-sage-soft/45 focus-visible:bg-sage-soft/60 focus-visible:ring-2 focus-visible:ring-sage/35 focus-visible:outline-none"
			style={{ top: hourIndex * HOUR_PX, height: HOUR_PX }}
			onClick={() => onTimeSlotClick?.(slot)}
			aria-label={`Add lesson at ${format(slot, 'HH:mm')}`}
		>
			<span className="pointer-events-none mt-1.5 ml-1.5 inline-flex items-center gap-1 rounded-md bg-surface/90 px-1.5 py-0.5 font-mono text-[10px] text-sage opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
				<Plus className="h-3 w-3" />
				{format(slot, 'HH:mm')}
			</span>
		</button>
	)
}

const SlotDropZone: FC<SlotDropZoneProps> = ({ slot, startHour }) => {
	const { setNodeRef, isOver } = useDroppable({ id: `slot:${slot.toISOString()}` })
	const slotMinutes = slot.getHours() * 60 + slot.getMinutes()
	const top = ((slotMinutes - startHour * 60) / 60) * HOUR_PX
	return (
		<div
			ref={setNodeRef}
			className={cn('pointer-events-none absolute inset-x-0 z-1', isOver && 'bg-sage-soft/55')}
			style={{ top, height: (DROP_INTERVAL_MINUTES / 60) * HOUR_PX }}
		/>
	)
}

const WeekEvent: FC<WeekEventProps> = ({ event, onEventClick, style }) => {
	const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
		id: event.id,
		disabled: event.draggable === false || event.kind === 'free',
	})
	const transformStyle = transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined
	return (
		<button
			ref={setNodeRef}
			type="button"
			className={cn(
				'absolute z-10 overflow-hidden rounded-md border px-2 py-1 text-left shadow-sm',
				event.kind === 'free'
					? 'border-yellow-400 bg-yellow-400/55 text-ink'
					: event.isPrivate
						? 'border-line-strong bg-surface-muted/75 text-ink-muted opacity-75'
						: TONE_EVENT[eventTone(event)],
				isDragging && 'z-40 opacity-80'
			)}
			style={{ ...style, transform: transformStyle }}
			onClick={() => onEventClick?.(event)}
			{...attributes}
			{...listeners}
		>
			<div
				className={cn("truncate text-xs leading-tight font-medium", event.kind === 'free' && "text-lg")}
				data-private={event.kind === 'lesson' ? true : undefined}
			>
				{event.title}
			</div>
			<div className={cn("font-mono text-xs opacity-70", event.kind === 'free' && "text-lg")}>
				{formatEventTime(event.start)}-{formatEventTime(event.end)}
			</div>
			{event.badges?.some((badge) => badge.tone === 'danger') && (
				<div className="mt-0.5 font-mono text-xs">{event.badges.find((badge) => badge.tone === 'danger')?.label}</div>
			)}
		</button>
	)
}

const NowLine: FC = () => {
	const now = new Date()
	const currentMinutes = now.getHours() * 60 + now.getMinutes()
	const calendarStart = WEEK_START_HOUR * 60
	const calendarEnd = (WEEK_END_HOUR + 1) * 60

	if (currentMinutes < calendarStart || currentMinutes > calendarEnd) return null

	return (
		<div
			className="absolute inset-x-0 z-20 flex items-center"
			style={{ top: ((currentMinutes - calendarStart) / 60) * HOUR_PX }}
		>
			<span className="size-2 rounded-full bg-danger ring-2 ring-danger/30" />
			<span className="h-px flex-1 bg-danger" />
		</div>
	)
}
